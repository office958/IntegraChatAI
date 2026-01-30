const messageInput = document.getElementById('messageInput');
const chatMessages = document.getElementById('chatMessages');
const chatContainer = document.getElementById('chatContainer');
const chatTrigger = document.getElementById('chatTrigger');

// PDF Upload elements (se vor inițializa la load)
let pdfInput = null;
let pdfUploadBtn = null;
let pdfFilesList = null;

let currentStreamingMessage = null;
let pageContext = null; // Context despre pagina părinte
let pdfTexts = []; // Listă de texte extrase din PDF-uri/imagini [{filename, text, type, pages?}, ...]
let pdfFiles = []; // Listă de fișiere PDF/imagini [{file, filename, type}, ...]

function closeChat() {
  chatContainer.classList.add('hidden');
  chatTrigger.classList.add('show');
}

function openChat() {
  chatContainer.classList.remove('hidden');
  chatTrigger.classList.remove('show');
  messageInput.focus();
}

function getCurrentTime() {
  return new Date().toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
}

window.addEventListener('load', () => {
  // Afișează mesajul de bun venit dacă nu există mesaje
  showWelcomeMessage();
  
  // Cere context de la pagina părinte
  requestPageContext();
  
  // Setup PDF upload
  setupPdfUpload();
  
  // Setup Speech to Text
  setupSpeechToText();
  
  // Încarcă istoricul conversației dacă există
  loadConversationHistory();
});

// ============================
// === Încărcare Istoric ====
// ============================
async function loadConversationHistory() {
  try {
    const chatId = window.location.pathname.split('/')[2];
    if (!chatId) return; // Nu există chat_id, nu încărcăm istoric
    
    // Obține session_id din URL sau localStorage
    const urlParams = new URLSearchParams(window.location.search);
    let sessionId = urlParams.get('session_id');
    if (!sessionId) {
      // Încearcă să obțină din localStorage
      sessionId = localStorage.getItem(`chat_session_${chatId}`);
    }
    
    const endpoint = sessionId 
      ? `http://127.0.0.1:3000/chat/${chatId}/history?session_id=${sessionId}`
      : `http://127.0.0.1:3000/chat/${chatId}/history`;
    
    const response = await fetch(endpoint);
    if (!response.ok) return;
    
    const data = await response.json();
    if (!data.messages || data.messages.length === 0) return;
    
    // Șterge mesajul de bun venit
    const welcomeMessage = chatMessages.querySelector('.welcome-message');
    if (welcomeMessage) {
      welcomeMessage.remove();
    }
    
    // Adaugă clasa pentru a indica că există mesaje
    chatContainer.classList.add('has-messages');
    
    // Afișează fiecare mesaj din istoric
    data.messages.forEach((msg) => {
      if (msg.role === 'user') {
        // Verifică dacă mesajul are file_info (mod nou)
        if (msg.file_info && msg.file_info.type === 'file' && msg.file_info.filename) {
          // Este un mesaj cu fișier (mod nou cu file_info)
          const fileType = msg.file_info.fileType || (msg.file_info.filename.toLowerCase().endsWith('.pdf') ? 'pdf' : 'image');
          
          addFileMessageFromHistory({
            filename: msg.file_info.filename,
            type: fileType
          });
          
          // Adaugă fișierul în pdfFiles pentru a-l păstra disponibil după refresh
          const existingFileIndex = pdfFiles.findIndex(p => p.filename === msg.file_info.filename);
          if (existingFileIndex < 0) {
            // Creează un obiect mock File pentru a păstra compatibilitatea
            // Nu avem fișierul real, dar păstrăm informațiile pentru a fi disponibile
            pdfFiles.push({
              filename: msg.file_info.filename,
              type: fileType,
              fromHistory: true // Flag pentru a indica că vine din istoric
            });
          }
          
          // Reîncarcă textul fișierului dacă există în file_info
          if (msg.file_info.text) {
            // Găsește sau creează intrarea în pdfTexts
            const existingIndex = pdfTexts.findIndex(p => p.filename === msg.file_info.filename);
            if (existingIndex >= 0) {
              pdfTexts[existingIndex].text = msg.file_info.text;
            } else {
              pdfTexts.push({
                filename: msg.file_info.filename,
                text: msg.file_info.text,
                type: fileType
              });
            }
          }
        } else {
          // Verifică dacă este un mesaj vechi cu JSON în content (compatibilitate)
          try {
            const fileData = JSON.parse(msg.content);
            if (fileData.type === 'file' && fileData.filename) {
              // Este un mesaj cu fișier (mod vechi)
              addFileMessageFromHistory({
                filename: fileData.filename,
                type: fileData.fileType || (fileData.filename.toLowerCase().endsWith('.pdf') ? 'pdf' : 'image')
              });
            } else {
              // Este un mesaj text normal
              addUserMessage(msg.content);
            }
          } catch (e) {
            // Nu este JSON, este un mesaj text normal
            addUserMessage(msg.content);
          }
        }
      } else if (msg.role === 'assistant') {
        addAiMessage(msg.content);
      }
    });
    
    scrollToBottom();
  } catch (error) {
    console.error('Eroare la încărcarea istoricului:', error);
  }
}

// Funcție pentru a adăuga mesaj cu fișier din istoric
function addFileMessageFromHistory(file) {
  const messageDiv = document.createElement('div');
  messageDiv.className = 'message user';
  
  const fileIcon = file.type === 'pdf' 
    ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M14 2V8H20" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
    : '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="8.5" cy="8.5" r="1.5" fill="currentColor"/><path d="M21 15L16 10L5 21" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  
  const fileTypeLabel = file.type === 'pdf' ? 'PDF' : 'IMAGINE';
  
  messageDiv.innerHTML = `
    <div class="message-avatar user-avatar">Tu</div>
    <div class="message-content file-message">
      <div class="file-message-content">
        ${fileIcon}
        <div class="file-message-info">
          <div class="file-message-name">${file.filename}</div>
          <div class="file-message-type">${fileTypeLabel}</div>
        </div>
      </div>
      <div class="message-time">${getCurrentTime()}</div>
    </div>
  `;
  chatMessages.appendChild(messageDiv);
}

// === Afișează mesajul de bun venit ===
function showWelcomeMessage() {
  // Verifică dacă există deja mesaje
  if (chatMessages && chatMessages.children.length === 0) {
    const welcomeDiv = document.createElement('div');
    welcomeDiv.className = 'welcome-message';
    welcomeDiv.innerHTML = `
      <h2>Cu ce te pot ajuta?</h2>
    `;
    chatMessages.appendChild(welcomeDiv);
  }
}

// === Cere context de la pagina părinte ===
function requestPageContext() {
  window.parent.postMessage({ type: 'requestPageContext' }, '*');
  console.log('📤 Cerere trimisă pentru context pagină');
}

// === Ascultă răspunsul cu contextul ===
window.addEventListener('message', (event) => {
  if (!event.data || !event.data.type) return;
  
  if (event.data.type === 'pageContext') {
    pageContext = event.data.payload;
    console.log('📥 Context pagină primit:', pageContext);
  }
});

async function sendMessage() {
  const message = messageInput.value.trim();
  if (!message && pdfFiles.length === 0) return;

  // Construiește mesajul complet cu informații despre PDF-uri
  let displayMessage = message;
  let fullMessage = message;
  
  // Dacă există fișiere, le adaugă ca mesaje separate în chat
  if (pdfFiles.length > 0) {
    // Adaugă mesajul text dacă există
    if (message) {
      addUserMessage(message);
      fullMessage = message; // Mesajul pentru LLM rămâne doar textul (PDF-urile/imagini sunt în payload.pdf_text)
      
      // Salvează mesajul text în baza de date
      await saveTextMessageToDatabase(message);
    } else {
      fullMessage = 'Completează formularul folosind informațiile din documentele încărcate.';
    }
    
    // Adaugă fiecare fișier ca mesaj separat în chat și salvează în baza de date
    console.log(`📎 Salvare ${pdfFiles.length} fișier(e) în baza de date...`);
    for (const file of pdfFiles) {
      // Skip fișierele care vin din istoric (nu trebuie salvate din nou)
      if (file.fromHistory) {
        console.log(`⏭️ Skip salvarea fișierului din istoric: ${file.filename}`);
        addFileMessage(file);
        continue;
      }
      
      addFileMessage(file);
      // Salvează mesajul cu fișier în baza de date
      try {
        await saveFileMessageToDatabase(file);
      } catch (error) {
        console.error('❌ Eroare la salvarea fișierului:', file.filename, error);
      }
    }
  } else {
    // Dacă nu sunt fișiere, adaugă doar mesajul text
    addUserMessage(displayMessage);
  }

  messageInput.value = '';

  showTypingIndicator();

  // Salvează o copie a pdfFiles și pdfTexts înainte de a le șterge
  const pdfFilesCopy = [...pdfFiles];
  const pdfTextsCopy = [...pdfTexts];
  
  console.log('='.repeat(80));
  console.log('🔍 DEBUG sendMessage - SALVARE COPII');
  console.log('='.repeat(80));
  console.log('  - pdfFiles.length:', pdfFiles.length);
  console.log('  - pdfTexts.length:', pdfTexts.length);
  console.log('  - pdfFilesCopy.length:', pdfFilesCopy.length);
  console.log('  - pdfTextsCopy.length:', pdfTextsCopy.length);
  console.log('  - pdfFilesCopy:', JSON.stringify(pdfFilesCopy, null, 2));
  console.log('  - pdfTextsCopy (sumar):', pdfTextsCopy.map(p => ({ 
    filename: p.filename, 
    textLength: p.text?.length || 0 
  })));
  console.log('='.repeat(80));

  setTimeout(() => {
    console.log('🚀 APEL startStreamingResponse cu copiile...');
    // Folosește copiile pentru a construi payload-ul
    startStreamingResponse(fullMessage, pdfFilesCopy, pdfTextsCopy);
    
    // Șterge PDF-urile după trimitere (după ce mesajul a fost trimis)
    if (pdfFiles.length > 0) {
      setTimeout(() => {
        removePdf();
      }, 200);
    }
  }, 500);
}

// Funcție pentru a salva mesajele text în baza de date
async function saveTextMessageToDatabase(message) {
  try {
    console.log('🔍 saveTextMessageToDatabase apelat pentru mesaj:', message.substring(0, 50));
    
    // Obține chatId din URL (folosim aceeași metodă ca în loadConversationHistory)
    const chatId = window.location.pathname.split('/')[2];
    
    console.log('🔍 chatId extras:', chatId, 'pathname:', window.location.pathname);
    
    if (!chatId) {
      console.error('❌ Nu există chat_id valid, nu salvăm mesajul');
      return; // Nu există chat_id, nu salvăm
    }
    
    // Obține session_id din URL sau localStorage
    const urlParams = new URLSearchParams(window.location.search);
    let sessionId = urlParams.get('session_id');
    if (!sessionId) {
      sessionId = localStorage.getItem(`chat_session_${chatId}`);
    }
    
    // Trimite mesajul către server pentru a fi salvat
    const endpoint = `http://127.0.0.1:3000/chat/${chatId}/save-message`;
    const payload = {
      role: 'user',
      content: message
    };
    
    if (sessionId) {
      payload.session_id = parseInt(sessionId);
    }
    
    console.log('💾 Salvare mesaj text în baza de date:', {
      message: message.substring(0, 50) + '...',
      sessionId: sessionId,
      chatId: chatId
    });
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      let errorData = {};
      try {
        errorData = JSON.parse(errorText);
      } catch (e) {
        errorData = { detail: errorText };
      }
      console.error('❌ Eroare la salvarea mesajului text:', errorData);
      throw new Error(`HTTP ${response.status}: ${errorData.detail || errorData.message || 'Eroare necunoscută'}`);
    }
    
    const result = await response.json();
    console.log('✅ Mesaj text salvat cu succes:', result);
  } catch (error) {
    console.error('❌ Eroare la salvarea mesajului text:', error);
  }
}

// Funcție pentru a salva mesajele cu fișiere în baza de date
async function saveFileMessageToDatabase(file) {
  console.log("=".repeat(80));
  console.log("🔍🔍🔍 DEBUG saveFileMessageToDatabase - ÎNCEPUT 🔍🔍🔍");
  console.log("=".repeat(80));
  try {
    // Verifică structura obiectului file
    console.log('📄 File object complet:', JSON.stringify(file, null, 2));
    console.log('  - file.filename:', file.filename);
    console.log('  - file.name:', file.name);
    console.log('  - file.type:', file.type);
    console.log('  - file.fromHistory:', file.fromHistory);
    
    // Obține chatId din URL (folosim aceeași metodă ca în loadConversationHistory)
    const chatId = window.location.pathname.split('/')[2];
    
    console.log('🔍 chatId extras:', chatId, 'pathname:', window.location.pathname);
    
    if (!chatId) {
      console.error('❌ Nu există chat_id valid, nu salvăm fișierul');
      return; // Nu există chat_id, nu salvăm
    }
    
    // Obține session_id din URL sau localStorage
    const urlParams = new URLSearchParams(window.location.search);
    let sessionId = urlParams.get('session_id');
    if (!sessionId) {
      sessionId = localStorage.getItem(`chat_session_${chatId}`);
    }
    
    // Determină filename și type
    const filename = file.filename || file.name || 'necunoscut';
    const fileType = file.type || (filename.toLowerCase().endsWith('.pdf') ? 'pdf' : 'image');
    
    // Creează informații despre fișier pentru file_info
    const fileInfo = {
      type: 'file',
      filename: filename,
      fileType: fileType
    };
    
    // Găsește textul extras pentru acest fișier (dacă există)
    // Caută după filename sau name
    const pdfText = pdfTexts.find(p => p.filename === filename || p.filename === file.name);
    if (pdfText && pdfText.text) {
      // Limitează la 10000 caractere pentru baza de date (JSON poate stoca mult mai mult)
      fileInfo.text = pdfText.text.length > 10000 
        ? pdfText.text.substring(0, 10000) + '\n[... text trunchiat ...]'
        : pdfText.text;
      fileInfo.textLength = pdfText.text.length; // Salvează lungimea completă pentru referință
    }
    
    // Trimite mesajul către server pentru a fi salvat
    // Folosim un mesaj text simplu pentru content și file_info pentru informațiile despre fișier
    const endpoint = `http://127.0.0.1:3000/chat/${chatId}/save-message`;
    const payload = {
      role: 'user',
      content: `Fișier atașat: ${filename}`, // Mesaj text simplu pentru content
      file_info: fileInfo // Informații despre fișier în file_info
    };
    
    if (sessionId) {
      payload.session_id = parseInt(sessionId);
    }
    
    console.log('💾 Salvare fișier în baza de date:');
    console.log('  - filename:', filename);
    console.log('  - type:', fileInfo.fileType);
    console.log('  - hasText:', !!fileInfo.text);
    console.log('  - sessionId:', sessionId);
    console.log('  - chatId:', chatId);
    console.log('  - fileInfo:', JSON.stringify(fileInfo, null, 2));
    console.log('  - payload:', JSON.stringify(payload, null, 2));
    
    console.log('🚀 TRIMITE REQUEST la backend:');
    console.log('  - endpoint:', endpoint);
    console.log('  - method: POST');
    console.log('  - headers: Content-Type: application/json');
    console.log('  - body:', JSON.stringify(payload, null, 2));
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    console.log('📥 RĂSPUNS PRIMIT de la backend:');
    console.log('  - status:', response.status);
    console.log('  - ok:', response.ok);
    console.log('  - statusText:', response.statusText);
    
    if (!response.ok) {
      const errorText = await response.text();
      let errorData = {};
      try {
        errorData = JSON.parse(errorText);
      } catch (e) {
        errorData = { detail: errorText };
      }
      console.error('❌ Eroare la salvarea fișierului:', errorData);
      throw new Error(`HTTP ${response.status}: ${errorData.detail || errorData.message || 'Eroare necunoscută'}`);
    }
    
    const result = await response.json();
    console.log('✅ RĂSPUNS de la server:', result);
    console.log('✅ Fișier salvat cu succes!');
    console.log("=" * 80);
  } catch (error) {
    console.error("=" * 80);
    console.error('❌ EROARE la salvarea mesajului cu fișier:');
    console.error('  - Error:', error);
    console.error('  - Error message:', error.message);
    console.error('  - Error stack:', error.stack);
    console.error("=" * 80);
    // Nu aruncăm eroarea pentru a nu întrerupe fluxul, dar logăm eroarea
  }
}

async function sendQuickMessage(message) {
  addUserMessage(message);
  showTypingIndicator();
  setTimeout(() => {
    startStreamingResponse(message);
  }, 500);
}

// ============================
// === Stream Răspuns AI ====
// ============================
async function startStreamingResponse(message, pdfFilesToUse = null, pdfTextsToUse = null) {
  console.log('='.repeat(80));
  console.log('🚀🚀🚀 startStreamingResponse APELAT 🚀🚀🚀');
  console.log('='.repeat(80));
  console.log('  - message:', message);
  console.log('  - pdfFilesToUse:', pdfFilesToUse);
  console.log('  - pdfTextsToUse:', pdfTextsToUse);
  console.log('  - pdfFilesToUse length:', pdfFilesToUse?.length || 0);
  console.log('  - pdfTextsToUse length:', pdfTextsToUse?.length || 0);
  
  try {
    // Folosește copiile dacă sunt furnizate, altfel folosește variabilele globale
    const filesToProcess = pdfFilesToUse !== null ? pdfFilesToUse : pdfFiles;
    const textsToProcess = pdfTextsToUse !== null ? pdfTextsToUse : pdfTexts;
    
    console.log('  - filesToProcess length:', filesToProcess.length);
    console.log('  - textsToProcess length:', textsToProcess.length);
    console.log('='.repeat(80));
    
    const chatId = window.location.pathname.split('/')[2];
    const endpoint = chatId
      ? `http://127.0.0.1:3000/chat/${chatId}/ask`
      : `http://127.0.0.1:3000/ask`;

    // Construiește payload-ul cu context
    const payload = {
      message: message
    };
    
    // Adaugă chat_id dacă există (pentru endpoint-ul /ask)
    if (chatId) {
      payload.chat_id = chatId;
    }
    
    // Adaugă informații despre fișiere dacă există
    console.log('='.repeat(80));
    console.log('🔍 DEBUG startStreamingResponse - CONSTRUIRE PAYLOAD');
    console.log('='.repeat(80));
    console.log('  - filesToProcess.length:', filesToProcess.length);
    console.log('  - textsToProcess.length:', textsToProcess.length);
    console.log('  - filesToProcess complet:', JSON.stringify(filesToProcess, null, 2));
    console.log('  - textsToProcess (sumar):', textsToProcess.map(p => ({ 
      filename: p.filename, 
      textLength: p.text?.length || 0,
      type: p.type 
    })));
    
    if (filesToProcess.length > 0) {
      console.log('✅ Există fișiere, construiesc files_info...');
      // IMPORTANT: Include TOATE fișierele (chiar și cele din istoric) pentru a ști ce fișiere sunt în chat
      // Similar cu RAG care salvează toate fișierele
      const filesToSend = filesToProcess; // Nu mai filtrăm by fromHistory
      console.log(`  - Total fișiere de trimis: ${filesToSend.length} din ${filesToProcess.length}`);
      
      payload.files_info = filesToSend.map(file => {
        const filename = file.filename || file.name || 'necunoscut';
        const pdfText = textsToProcess.find(p => p.filename === filename || p.filename === file.name);
        const fileInfo = {
          filename: filename,
          type: file.type || (filename.toLowerCase().endsWith('.pdf') ? 'pdf' : 'image'),
          text: pdfText ? pdfText.text : null
        };
        console.log(`  📄 Fișier procesat:`);
        console.log(`    - filename: ${fileInfo.filename}`);
        console.log(`    - type: ${fileInfo.type}`);
        console.log(`    - fromHistory: ${file.fromHistory || false}`);
        console.log(`    - hasText: ${!!fileInfo.text}`);
        console.log(`    - textLength: ${fileInfo.text?.length || 0}`);
        return fileInfo;
      });
      
      console.log(`📎✅✅✅ TRIMITE ${payload.files_info.length} fișier(e) cu metadata către backend ✅✅✅:`);
      console.log('  - files_info complet:', JSON.stringify(payload.files_info, null, 2));
    } else {
      console.log('⚠️ Nu există fișiere - files_info NU va fi trimis!');
    }
    console.log('='.repeat(80));

    // Adaugă context despre pagină DOAR dacă este necesar (optimizare performanță)
    // Contextul este necesar doar când:
    // 1. Există PDF-uri pentru extragere și completare automată
    // 2. Mesajul conține cuvinte cheie care sugerează completare automată
    const needsContext = pdfTexts.length > 0 || 
                         /completează|complet|formular|automat|auto-fill|auto fill/i.test(message);
    
    if (pageContext && needsContext) {
      // Limitează dimensiunea contextului pentru requesturi mai rapide
      const optimizedContext = { ...pageContext };
      
      // Limitează fields_detailed dacă există (doar 20 pentru viteză maximă)
      if (optimizedContext.fields_detailed && optimizedContext.fields_detailed.length > 20) {
        optimizedContext.fields_detailed = optimizedContext.fields_detailed.slice(0, 20);
      }
      
      // Limitează form_fields dacă există (doar 20 pentru viteză maximă)
      if (optimizedContext.form_fields && optimizedContext.form_fields.length > 20) {
        optimizedContext.form_fields = optimizedContext.form_fields.slice(0, 20);
      }
      
      // Elimină câmpuri nefolositoare pentru a reduce dimensiunea
      if (optimizedContext.fields_detailed) {
        optimizedContext.fields_detailed = optimizedContext.fields_detailed.map(f => ({
          name: f.name,
          type: f.type,
          placeholder: f.placeholder,
          required: f.required,
          // Elimină opțiunile dacă sunt prea multe (păstrăm doar primele 3)
          options: f.options ? f.options.slice(0, 3) : undefined
        }));
      }
      
      payload.page_context = optimizedContext;
    }

    // Combină toate textele PDF-urilor (limitează dimensiunea pentru viteză)
    if (textsToProcess.length > 0) {
      let combinedPdfText = textsToProcess.map(p => `\n--- ${p.filename} ---\n${p.text || ''}`).join('\n\n');
      // Limitează la 5000 caractere pentru requesturi mai rapide
      if (combinedPdfText.length > 5000) {
        combinedPdfText = combinedPdfText.substring(0, 5000) + '\n\n[... text trunchiat pentru viteză ...]';
      }
      payload.pdf_text = combinedPdfText;
      console.log(`📎 Trimite ${textsToProcess.length} fișier(e) cu ${combinedPdfText.length} caractere către LLM`);
    } else {
      console.log(`⚠️ Nu există texte PDF/imagini de trimis către LLM`);
    }

    console.log('🚀🚀🚀 TRIMITE REQUEST către backend 🚀🚀🚀:');
    console.log('  - endpoint:', endpoint);
    console.log('  - payload keys:', Object.keys(payload));
    console.log('  - payload.message length:', payload.message?.length || 0);
    console.log('  - payload.files_info EXISTS:', 'files_info' in payload);
    console.log('  - payload.files_info VALUE:', payload.files_info);
    console.log('  - payload.files_info TYPE:', typeof payload.files_info);
    console.log('  - payload.files_info IS NULL:', payload.files_info === null);
    console.log('  - payload.files_info IS UNDEFINED:', payload.files_info === undefined);
    if (payload.files_info) {
      console.log('  - payload.files_info.length:', payload.files_info.length);
      console.log('  - payload.files_info content:', JSON.stringify(payload.files_info, null, 2));
    }
    console.log('  - payload complet:', JSON.stringify(payload, null, 2));
    
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    
    console.log('📥 RĂSPUNS PRIMIT de la backend:');
    console.log('  - status:', response.status);
    console.log('  - ok:', response.ok);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    // OPTIMIZARE CRITICĂ: Creează mesajul IMEDIAT, înainte de a primi primul chunk
    // Astfel utilizatorul vede că răspunsul a început să se genereze
    chatContainer.classList.add('has-messages');
    
    // Ascunde mesajul de bun venit
    const welcomeMessage = chatMessages.querySelector('.welcome-message');
    if (welcomeMessage) {
      welcomeMessage.style.display = 'none';
    }
    
    // Creează mesajul div-ul IMEDIAT cu un indicator de typing
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message ai';
    messageDiv.innerHTML = `
      <div class="message-content">
        <div class="message-text"><span class="typing-indicator">●</span><span style="opacity: 0.6; margin-left: 8px; font-size: 0.9em;">Se generează răspunsul...</span></div>
        <div class="message-footer">
          <button type="button" class="action-btn tts-btn" title="Citește mesajul (Text to Speech)">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M11 5L6 9H2V15H6L11 19V5Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M19.07 4.93C20.9447 6.80528 21.9979 9.34836 21.9979 12C21.9979 14.6516 20.9447 17.1947 19.07 19.07M15.54 8.46C16.4774 9.39764 17.0039 10.6692 17.0039 12C17.0039 13.3308 16.4774 14.6024 15.54 15.54" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
          <button type="button" class="action-btn copy-btn" title="Copiază mesajul">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M5 15H4C2.89543 15 2 14.1046 2 13V4C2 2.89543 2.89543 2 4 2H13C14.1046 2 15 2.89543 15 4V5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </div>
      </div>
    `;
    chatMessages.appendChild(messageDiv);
    const messageContent = messageDiv.querySelector('.message-text');
    hideTypingIndicator();
    scrollToBottom(); // Scroll imediat pentru a vedea mesajul
    
    // Adaugă event listener pentru copiere
    const copyBtn = messageDiv.querySelector('.copy-btn');
    if (copyBtn) {
      copyBtn.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(accumulatedText);
          copyBtn.innerHTML = `
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M20 6L9 17L4 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          `;
          copyBtn.style.color = '#10b981';
          setTimeout(() => {
            copyBtn.innerHTML = `
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M5 15H4C2.89543 15 2 14.1046 2 13V4C2 2.89543 2.89543 2 4 2H13C14.1046 2 15 2.89543 15 4V5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            `;
            copyBtn.style.color = '';
          }, 2000);
        } catch (err) {
          console.error('Eroare la copiere:', err);
        }
      });
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let accumulatedText = '';
    let isFirstChunk = true; // Flag pentru primul chunk
    let lastUpdateTime = 0;
    const UPDATE_INTERVAL = 16; // ~60fps pentru smooth updates (doar după primul chunk)

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      accumulatedText += chunk;

      // OPTIMIZARE CRITICĂ: Afișează IMEDIAT primul chunk fără throttling
      // După primul chunk, folosește throttling pentru smooth rendering
      const now = performance.now();
      const shouldUpdate = isFirstChunk || (now - lastUpdateTime >= UPDATE_INTERVAL) || done;
      
      if (shouldUpdate) {
        // Elimină indicatorul de typing la primul chunk
        if (isFirstChunk && accumulatedText.trim().length > 0) {
          isFirstChunk = false;
          messageContent.innerHTML = ''; // Șterge indicatorul
        }
        
        // Formatează textul pentru afișare frumoasă
        messageContent.innerHTML = formatMessageText(accumulatedText);
        
        // Detectează link-uri către PDF-uri generate în răspuns
        detectAndDisplayGeneratedFiles(messageDiv, accumulatedText);
        
        scrollToBottom();
        
        lastUpdateTime = now;
      }
    }

    // Adaugă event listener pentru TTS când se termină streaming-ul
    const ttsBtn = messageDiv.querySelector('.tts-btn');
    if (ttsBtn && !ttsBtn.hasAttribute('data-listener-added')) {
      ttsBtn.setAttribute('data-listener-added', 'true');
      ttsBtn.addEventListener('click', () => {
        speakText(accumulatedText, ttsBtn);
      });
    }

    // Când fluxul s-a terminat, încearcă să detectezi și completezi automat
    tryAutoFillFields(accumulatedText);
    
    // După ce s-a terminat streaming-ul, verifică din nou pentru documente generate
    if (messageDiv && messageContent) {
      detectAndDisplayGeneratedFiles(messageDiv, accumulatedText);
    }

  } catch (error) {
    hideTypingIndicator();
    addAiMessage("Îmi pare rău, momentan nu pot accesa serverul. Vă rog încercați mai târziu.");
    console.error('Streaming error:', error);
  }
}

// Funcție pentru a detecta și afișa documentele generate de LLM
function detectAndDisplayGeneratedFiles(messageDiv, text) {
  // Detectează link-uri către PDF-uri (pattern: http://.../pdf_generated/... sau /pdf_generated/...)
  const pdfUrlPattern = /(?:https?:\/\/[^\s]+)?\/pdf_generated\/[^\s\)]+\.pdf/gi;
  const matches = text.match(pdfUrlPattern);
  
  if (matches && matches.length > 0) {
    // Verifică dacă nu există deja un container pentru fișiere generate
    let filesContainer = messageDiv.querySelector('.generated-files-container');
    if (!filesContainer) {
      filesContainer = document.createElement('div');
      filesContainer.className = 'generated-files-container';
      filesContainer.style.marginTop = '12px';
      filesContainer.style.paddingTop = '12px';
      filesContainer.style.borderTop = '1px solid #e5e7eb';
      messageDiv.querySelector('.message-content').appendChild(filesContainer);
    }
    
    // Adaugă fiecare PDF detectat
    matches.forEach((url, index) => {
      // Verifică dacă fișierul nu a fost deja adăugat
      const existingFile = filesContainer.querySelector(`[data-file-url="${url}"]`);
      if (existingFile) return;
      
      // Extrage numele fișierului din URL
      const filename = url.split('/').pop() || `document_${index + 1}.pdf`;
      
      // Creează elementul pentru fișier
      const fileElement = document.createElement('div');
      fileElement.className = 'generated-file-item';
      fileElement.setAttribute('data-file-url', url);
      fileElement.style.display = 'flex';
      fileElement.style.alignItems = 'center';
      fileElement.style.gap = '8px';
      fileElement.style.padding = '8px';
      fileElement.style.backgroundColor = '#f3f4f6';
      fileElement.style.borderRadius = '6px';
      fileElement.style.marginBottom = '8px';
      
      const fileIcon = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M14 2V8H20" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      
      fileElement.innerHTML = `
        ${fileIcon}
        <span style="flex: 1; font-size: 14px; color: #374151;">${filename}</span>
        <a href="${url}" target="_blank" download="${filename}" style="color: #3b82f6; text-decoration: none; font-size: 14px; font-weight: 500;">
          Descarcă
        </a>
      `;
      
      filesContainer.appendChild(fileElement);
    });
  }
}

// ============================
// === Funcții Mesaje UI ====
// ============================
function addUserMessage(message) {
  // Ascunde mesajul de bun venit când se adaugă primul mesaj
  const welcomeMessage = chatMessages.querySelector('.welcome-message');
  if (welcomeMessage) {
    welcomeMessage.style.display = 'none';
  }
  
  // Adaugă clasa pentru a indica că există mesaje
  chatContainer.classList.add('has-messages');
  
  const messageDiv = document.createElement('div');
  messageDiv.className = 'message user';
  messageDiv.innerHTML = `
    <div class="message-avatar user-avatar">Tu</div>
    <div class="message-content">
      <div>${message}</div>
      <div class="message-time">${getCurrentTime()}</div>
    </div>
  `;
  chatMessages.appendChild(messageDiv);
  scrollToBottom();
}

function addFileMessage(file) {
  const messageDiv = document.createElement('div');
  messageDiv.className = 'message user';
  
  const fileIcon = file.type === 'pdf' 
    ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M14 2V8H20" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
    : '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="8.5" cy="8.5" r="1.5" fill="currentColor"/><path d="M21 15L16 10L5 21" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  
  const fileTypeLabel = file.type === 'pdf' ? 'PDF' : 'IMAGINE';
  
  messageDiv.innerHTML = `
    <div class="message-avatar user-avatar">Tu</div>
    <div class="message-content file-message">
      <div class="file-message-content">
        ${fileIcon}
        <div class="file-message-info">
          <div class="file-message-name">${file.filename}</div>
          <div class="file-message-type">${fileTypeLabel}</div>
        </div>
      </div>
      <div class="message-time">${getCurrentTime()}</div>
    </div>
  `;
  chatMessages.appendChild(messageDiv);
  scrollToBottom();
}

function addAiMessage(message) {
  // Adaugă clasa pentru a indica că există mesaje
  chatContainer.classList.add('has-messages');
  
  // Ascunde mesajul de bun venit când se adaugă primul mesaj AI
  const welcomeMessage = chatMessages.querySelector('.welcome-message');
  if (welcomeMessage) {
    welcomeMessage.style.display = 'none';
  }
  
  const messageDiv = document.createElement('div');
  messageDiv.className = 'message ai';
  messageDiv.innerHTML = `
    <div class="message-content">
      <div class="message-text">${formatMessageText(message)}</div>
      <div class="message-footer">
        <button type="button" class="action-btn tts-btn" title="Citește mesajul (Text to Speech)">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M11 5L6 9H2V15H6L11 19V5Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M19.07 4.93C20.9447 6.80528 21.9979 9.34836 21.9979 12C21.9979 14.6516 20.9447 17.1947 19.07 19.07M15.54 8.46C16.4774 9.39764 17.0039 10.6692 17.0039 12C17.0039 13.3308 16.4774 14.6024 15.54 15.54" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        <button type="button" class="action-btn copy-btn" title="Copiază mesajul">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M5 15H4C2.89543 15 2 14.1046 2 13V4C2 2.89543 2.89543 2 4 2H13C14.1046 2 15 2.89543 15 4V5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>
    </div>
  `;
  chatMessages.appendChild(messageDiv);
  
  // Adaugă event listener pentru text-to-speech
  const ttsBtn = messageDiv.querySelector('.tts-btn');
  if (ttsBtn) {
    ttsBtn.addEventListener('click', () => {
      speakText(message, ttsBtn);
    });
  }
  
  // Adaugă event listener pentru copiere
  const copyBtn = messageDiv.querySelector('.copy-btn');
  if (copyBtn) {
    copyBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(message);
        copyBtn.innerHTML = `
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M20 6L9 17L4 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        `;
        copyBtn.style.color = '#10b981';
        setTimeout(() => {
          copyBtn.innerHTML = `
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M5 15H4C2.89543 15 2 14.1046 2 13V4C2 2.89543 2.89543 2 4 2H13C14.1046 2 15 2.89543 15 4V5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          `;
          copyBtn.style.color = '';
        }, 2000);
      } catch (err) {
        console.error('Eroare la copiere:', err);
      }
    });
  }
  
  scrollToBottom();
}

// ============================
// === Formatare Mesaje ===
// ============================
function formatMessageText(text) {
  if (!text) return '';
  
  // Convertim tabele markdown în HTML (înainte de escape)
  let formatted = formatMarkdownTables(text);
  
  // Convertim listele numerotate (înainte de escape)
  formatted = formatNumberedLists(formatted);
  
  // Split pe linii pentru a procesa fiecare parte separat
  const parts = formatted.split(/(<div class="message-table-wrapper">[\s\S]*?<\/div>|<ul class="message-numbered-list">[\s\S]*?<\/ul>)/);
  
  formatted = parts.map(part => {
    // Dacă este deja HTML (tabel sau listă), nu-l procesăm
    if (part.includes('message-table-wrapper') || part.includes('message-numbered-list')) {
      return part;
    }
    
    // Escape HTML pentru securitate
    let processed = part
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    
    // Convertim formatări bold (**text**)
    processed = processed.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    
    // Convertim date structurate (cheie: valoare) în carduri
    processed = formatStructuredData(processed);
    
    // Convertim linii noi în <br>
    processed = processed.replace(/\n/g, '<br>');
    
    return processed;
  }).join('');
  
  return formatted;
}

function formatMarkdownTables(text) {
  // Detectează tabele markdown (linii care încep cu |)
  const lines = text.split('\n');
  const tables = [];
  let currentTable = null;
  let tableStartIndex = -1;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Verifică dacă linia este un header de tabel (conține | și -)
    if (line.includes('|') && line.includes('-')) {
      if (currentTable) {
        // Finalizează tabelul anterior
        tables.push({
          start: tableStartIndex,
          end: i - 1,
          rows: currentTable
        });
      }
      // Găsește header-ul (linia de dinainte)
      if (i > 0 && lines[i - 1].trim().includes('|')) {
        currentTable = [lines[i - 1].trim()];
        tableStartIndex = i - 1;
      }
    } else if (line.includes('|') && currentTable) {
      // Adaugă rând la tabel
      currentTable.push(line);
    } else if (currentTable && !line.includes('|')) {
      // Finalizează tabelul când nu mai sunt linii cu |
      tables.push({
        start: tableStartIndex,
        end: i - 1,
        rows: currentTable
      });
      currentTable = null;
    }
  }
  
  // Finalizează ultimul tabel dacă există
  if (currentTable) {
    tables.push({
      start: tableStartIndex,
      end: lines.length - 1,
      rows: currentTable
    });
  }
  
  // Procesează tabelele de la sfârșit la început pentru a nu afecta indicii
  for (let t = tables.length - 1; t >= 0; t--) {
    const table = tables[t];
    const htmlTable = convertTableToHTML(table.rows);
    
    // Înlocuiește liniile tabelului cu HTML
    const beforeTable = lines.slice(0, table.start).join('\n');
    const afterTable = lines.slice(table.end + 1).join('\n');
    lines.splice(table.start, table.end - table.start + 1, htmlTable);
  }
  
  return lines.join('\n');
}

function convertTableToHTML(rows) {
  if (!rows || rows.length < 2) return '';
  
  // Prima linie este header-ul, a doua este separatorul, restul sunt date
  const headerRow = rows[0];
  const dataRows = rows.slice(2);
  
  const headerCells = headerRow.split('|').map(cell => cell.trim()).filter(cell => cell);
  const headerHTML = headerCells.map(cell => {
    // Escape HTML în celule
    const escaped = cell.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    // Convertim bold
    const bolded = escaped.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    return `<th>${bolded}</th>`;
  }).join('');
  
  let bodyHTML = '';
  for (const row of dataRows) {
    const cells = row.split('|').map(cell => cell.trim()).filter(cell => cell);
    if (cells.length > 0) {
      bodyHTML += '<tr>' + cells.map(cell => {
        // Escape HTML în celule
        const escaped = cell.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        // Convertim bold
        const bolded = escaped.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        return `<td>${bolded}</td>`;
      }).join('') + '</tr>';
    }
  }
  
  return `<div class="message-table-wrapper"><table class="message-table"><thead><tr>${headerHTML}</tr></thead><tbody>${bodyHTML}</tbody></table></div>`;
}

function formatStructuredData(text) {
  // Detectează pattern-uri de tipul "**Cheie**: Valoare"
  return text.replace(/\*\*([^*:]+)\*\*:\s*([^\n*]+)/g, (match, key, value) => {
    return `<div class="structured-data-item"><span class="data-key">${key}</span><span class="data-value">${value.trim()}</span></div>`;
  });
}

function formatNumberedLists(text) {
  // Detectează liste numerotate (1., 2., etc.)
  const lines = text.split('\n');
  let inList = false;
  let listHTML = '';
  let result = [];
  
  for (const line of lines) {
    const numberedMatch = line.match(/^(\d+)\.\s+(.+)$/);
    if (numberedMatch) {
      if (!inList) {
        inList = true;
        listHTML = '<ul class="message-numbered-list">';
      }
      listHTML += `<li>${numberedMatch[2]}</li>`;
    } else {
      if (inList) {
        listHTML += '</ul>';
        result.push(listHTML);
        listHTML = '';
        inList = false;
      }
      result.push(line);
    }
  }
  
  if (inList) {
    listHTML += '</ul>';
    result.push(listHTML);
  }
  
  return result.join('\n');
}

// ============================
// === Indicator și Scroll ====
// ============================
function showTypingIndicator() {
  const existingIndicator = document.getElementById('typingIndicator');
  if (existingIndicator) existingIndicator.remove();

  const typingDiv = document.createElement('div');
  typingDiv.className = 'typing-indicator';
  typingDiv.id = 'typingIndicator';
  typingDiv.innerHTML = `
    <div class="typing-dots">
      <span></span>
      <span></span>
      <span></span>
    </div>
  `;
  chatMessages.appendChild(typingDiv);
  typingDiv.style.display = 'block';
  scrollToBottom();
}

function hideTypingIndicator() {
  const indicator = document.getElementById('typingIndicator');
  if (indicator) indicator.remove();
}

function scrollToBottom() {
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

messageInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') sendMessage();
});

// Send button click handler
const sendBtn = document.getElementById('sendBtn');
if (sendBtn) {
  sendBtn.addEventListener('click', () => {
    sendMessage();
  });
}

// ============================
// === DETECȚIE DINAMICĂ ====
// ============================

/**
 * Încearcă să parseze răspunsul ca JSON și să completeze câmpurile automat
 */
function tryAutoFillFields(text) {
  if (!text || typeof text !== 'string') return;
  
  const trimmedText = text.trim();
  if (!trimmedText) return;

  // 1. Încearcă parsare JSON directă
  try {
    const json = JSON.parse(trimmedText);
    if (json && typeof json === 'object' && !Array.isArray(json) && Object.keys(json).length > 0) {
      autoFillParentFields(json);
      console.log("✅ JSON detectat și completat automat:", json);
      return;
    }
  } catch (e) {
    // Nu e JSON valid, continuă
  }

  // 2. Elimină markdown code blocks dacă există
  let cleanedText = trimmedText;
  // Elimină ```json ... ``` sau ``` ... ```
  cleanedText = cleanedText.replace(/^```(?:json)?\s*\n?/i, '');
  cleanedText = cleanedText.replace(/\n?```\s*$/i, '');
  cleanedText = cleanedText.trim();
  
  // Încearcă din nou după curățare
  try {
    const json = JSON.parse(cleanedText);
    if (json && typeof json === 'object' && !Array.isArray(json) && Object.keys(json).length > 0) {
      autoFillParentFields(json);
      console.log("✅ JSON extras din markdown și completat:", json);
      return;
    }
  } catch (e) {
    // Continuă
  }

  // 3. Încearcă să extragi JSON din text (poate avea text înainte/după)
  // Caută primul obiect JSON valid (începe cu { și se termină cu })
  const jsonPattern = /\{[\s\S]*?\}/;
  let match = cleanedText.match(jsonPattern);
  
  if (!match) {
    // Încearcă pattern mai complex pentru JSON multiline
    const multilinePattern = /\{(?:[^{}]|(?:\{[^{}]*\}))*\}/;
    match = cleanedText.match(multilinePattern);
  }
  
  if (match) {
    try {
      const json = JSON.parse(match[0]);
      if (json && typeof json === 'object' && !Array.isArray(json) && Object.keys(json).length > 0) {
        autoFillParentFields(json);
        console.log("✅ JSON extras din text și completat:", json);
        return;
      }
    } catch (e2) {
      // Ignoră
    }
  }

  // 4. Încearcă să găsească JSON nested sau complex
  // Caută toate obiectele JSON posibile și încearcă să le parseze
  const allJsonMatches = cleanedText.match(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g);
  if (allJsonMatches) {
    for (const match of allJsonMatches) {
      try {
        const json = JSON.parse(match);
        if (json && typeof json === 'object' && !Array.isArray(json) && Object.keys(json).length > 0) {
          autoFillParentFields(json);
          console.log("✅ JSON complex extras și completat:", json);
          return;
        }
      } catch (e3) {
        // Continuă cu următorul
      }
    }
  }

  // 5. Dacă nu e JSON, încearcă să extragi informații structurate din text
  const structuredData = extractStructuredData(cleanedText);
  if (structuredData && Object.keys(structuredData).length > 0) {
    autoFillParentFields(structuredData);
    console.log("✅ Date structurate extrase și completate:", structuredData);
  } else {
    console.log("⚠️ Nu s-a detectat JSON valid în răspuns");
  }
}

/**
 * Extrage date structurate din text natural
 */
function extractStructuredData(text) {
  const data = {};
  
  // Caută perechi cheie-valoare comune (mai flexibil)
  const patterns = [
    { key: 'title', regex: /(?:titlu|title|nume|headline)\s*[:=]\s*["']?([^"'\n]+)["']?/i },
    { key: 'author', regex: /(?:autor|author|scris de|writer)\s*[:=]\s*["']?([^"'\n]+)["']?/i },
    { key: 'category', regex: /(?:categorie|category|tip|type)\s*[:=]\s*["']?([^"'\n]+)["']?/i },
    { key: 'content', regex: /(?:con[țt]inut|content|text|descriere|body)\s*[:=]\s*["']?([\s\S]+?)["']?(?:\n\n|\n[A-Z]|$)/i },
    { key: 'email', regex: /(?:email|e-mail|mail)\s*[:=]\s*["']?([^\s"']+@[^\s"']+)["']?/i },
    { key: 'phone', regex: /(?:telefon|phone|tel|telephone)\s*[:=]\s*["']?([\d\s\+\-\(\)]+)["']?/i },
    { key: 'date', regex: /(?:data|date|zi)\s*[:=]\s*["']?([^"'\n]+)["']?/i },
    { key: 'description', regex: /(?:descriere|description|desc)\s*[:=]\s*["']?([\s\S]+?)["']?(?:\n\n|\n[A-Z]|$)/i },
  ];

  patterns.forEach(({ key, regex }) => {
    const match = text.match(regex);
    if (match && match[1]) {
      const value = match[1].trim();
      // Elimină ghilimele dacă există la început/sfârșit
      data[key] = value.replace(/^["']|["']$/g, '');
    }
  });

  // Dacă nu s-au găsit date, încercă să găsească pattern-uri de tipul "Cheie: Valoare"
  if (Object.keys(data).length === 0) {
    const keyValuePattern = /([a-zA-ZăâîșțĂÂÎȘȚ\s]+)\s*[:=]\s*["']?([^"'\n]+)["']?/g;
    let match;
    while ((match = keyValuePattern.exec(text)) !== null) {
      const key = normalizeKeyForExtraction(match[1].trim());
      const value = match[2].trim().replace(/^["']|["']$/g, '');
      if (key && value && !data[key]) {
        data[key] = value;
      }
    }
  }

  return data;
}

/**
 * Normalizează o cheie pentru extragere (similar cu normalizeKey din autofill)
 */
function normalizeKeyForExtraction(key) {
  return key
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Elimină diacritice
    .replace(/[^a-z0-9]/g, '_') // Înlocuiește caractere speciale cu _
    .replace(/_+/g, '_') // Elimină _ duplicate
    .replace(/^_|_$/g, ''); // Elimină _ de la început și sfârșit
}

/**
 * Completează automat câmpurile din pagina părinte
 */
function autoFillParentFields(data) {
  if (!data || typeof data !== 'object') return;

  // Trimite mesaj către pagina părinte pentru completare automată
  window.parent.postMessage({
    type: "autoFillFields",
    payload: data
  }, "*");

  console.log("📤 Mesaj trimis către parent pentru completare automată");
}

// ============================
// === PDF Upload Funcții ===
// ============================

function setupPdfUpload() {
  // Obține elementele din DOM
  pdfInput = document.getElementById('pdfInput');
  const attachBtn = document.getElementById('attachBtn');
  const uploadPopup = document.getElementById('uploadPopup');
  const uploadPopupBtn = document.getElementById('uploadPopupBtn');
  const uploadPopupClose = document.getElementById('uploadPopupClose');
  pdfFilesList = document.getElementById('pdfFilesList');

  console.log('🔍 Setup PDF Upload - Elemente găsite:', {
    pdfInput: !!pdfInput,
    attachBtn: !!attachBtn,
    uploadPopup: !!uploadPopup,
    uploadPopupBtn: !!uploadPopupBtn,
    pdfFilesList: !!pdfFilesList
  });

  if (!attachBtn || !pdfInput || !uploadPopup) {
    console.error('❌ Elementele PDF upload nu au fost găsite!');
    return;
  }

  // Click pe buton attach deschide popup
  attachBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('📄 Click pe buton attach - deschid popup');
    uploadPopup.classList.add('active');
  });

  // Click pe buton din popup deschide file picker
  uploadPopupBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('📄 Click pe buton upload - deschid file picker');
    pdfInput.click();
  });

  // Închide popup când se apasă pe X
  uploadPopupClose.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    uploadPopup.classList.remove('active');
  });

  // Închide popup când se apasă în afara lui
  uploadPopup.addEventListener('click', (e) => {
    if (e.target === uploadPopup) {
      uploadPopup.classList.remove('active');
    }
  });

  // Când se selectează fișiere (multiple)
  pdfInput.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) {
      console.log('📄 Nu s-au selectat fișiere');
      return;
    }

    console.log(`📄 ${files.length} fișier(e) selectat(e)`);

    // Validează toate fișierele (PDF sau imagini)
    const validFiles = [];
    const invalidFiles = [];
    const allowedTypes = {
      'application/pdf': 'pdf',
      'image/jpeg': 'image',
      'image/jpg': 'image',
      'image/png': 'image',
      'image/gif': 'image',
      'image/bmp': 'image',
      'image/webp': 'image'
    };
    
    for (const file of files) {
      const fileType = allowedTypes[file.type];
      if (!fileType) {
        invalidFiles.push({ file, reason: `${file.name} nu este PDF sau imagine suportată!` });
        continue;
      }

      if (file.size > 10 * 1024 * 1024) {
        invalidFiles.push({ file, reason: `${file.name} este prea mare! Maxim 10MB.` });
        continue;
      }

      // Verifică dacă fișierul nu e deja încărcat
      if (pdfFiles.some(f => f.filename === file.name)) {
        invalidFiles.push({ file, reason: `${file.name} este deja încărcat!` });
        continue;
      }

      validFiles.push({ file, type: fileType });
    }

    // Afișează erorile pentru fișiere invalide (dacă există)
    if (invalidFiles.length > 0) {
      const errorMessages = invalidFiles.map(f => f.reason).join('\n');
      if (invalidFiles.length === files.length) {
        // Toate fișierele sunt invalide - nu închide modalul
        alert(`⚠️ Nu s-au putut încărca fișiere:\n${errorMessages}`);
        pdfInput.value = '';
        return;
      } else {
        // Unele fișiere sunt invalide, dar altele sunt valide
        alert(`⚠️ Unele fișiere nu s-au putut încărca:\n${errorMessages}\n\nFișierele valide vor fi procesate.`);
      }
    }

    if (validFiles.length === 0) {
      pdfInput.value = '';
      return;
    }

    // Închide modalul după validare și înainte de procesare (doar dacă există fișiere valide)
    if (uploadPopup && validFiles.length > 0) {
      uploadPopup.classList.remove('active');
    }

    // Adaugă fișierele la listă și extrage textul
    for (const { file, type } of validFiles) {
      pdfFiles.push({ file, filename: file.name, type });
      if (type === 'pdf') {
        await extractPdfText(file);
      } else {
        await extractImageText(file);
      }
    }

    // Actualizează UI
    updatePdfFilesList();
    pdfInput.value = ''; // Reset pentru a permite selectarea acelorași fișiere din nou
  });

  console.log('✅ PDF Upload setup completat');
}

async function extractPdfText(file) {
  try {
    const formData = new FormData();
    formData.append('pdf', file);

    const response = await fetch('http://127.0.0.1:3000/extract-pdf', {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error);
    }

    // Adaugă textul la listă
    pdfTexts.push({
      filename: file.name,
      text: data.text,
      type: 'pdf',
      pages: data.pages
    });
    
    console.log(`📄 Text extras din PDF ${file.name}: ${data.pages} pagini, ${data.text.length} caractere`);
    
  } catch (error) {
    console.error(`Eroare la extragerea textului din ${file.name}:`, error);
    // Elimină fișierul din listă dacă a eșuat
    pdfFiles = pdfFiles.filter(f => f.filename !== file.name);
    updatePdfFilesList();
    alert(`❌ Eroare la extragerea textului din ${file.name}: ${error.message}`);
  }
}

async function extractImageText(file) {
  try {
    const formData = new FormData();
    formData.append('image', file);
    formData.append('correct_text', 'true'); // Activează corecția automată

    const response = await fetch('http://127.0.0.1:3000/extract-image', {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error);
    }

    // Folosește textul corectat dacă există, altfel textul original
    const finalText = data.corrected_text || data.text || '';
    
    if (!finalText || !finalText.trim()) {
      throw new Error('Nu s-a putut extrage text din imagine');
    }

    // Adaugă textul la listă
    pdfTexts.push({
      filename: file.name,
      text: finalText,
      type: 'image'
    });
    
    console.log(`🖼️ Text extras din imagine ${file.name}: ${finalText.length} caractere${data.corrected_text ? ' (corectat)' : ''}`);
    
  } catch (error) {
    console.error(`Eroare la extragerea textului din ${file.name}:`, error);
    // Elimină fișierul din listă dacă a eșuat
    pdfFiles = pdfFiles.filter(f => f.filename !== file.name);
    updatePdfFilesList();
    alert(`❌ Eroare la extragerea textului din ${file.name}: ${error.message}`);
  }
}

function updatePdfFilesList() {
  if (!pdfFilesList) {
    console.error('❌ pdfFilesList element nu există!');
    return;
  }

  console.log('🔄 Actualizare listă PDF - Total fișiere:', pdfFiles.length);

  // Șterge tot conținutul listei
  pdfFilesList.innerHTML = '';
  
  if (pdfFiles.length === 0) {
    console.log('✅ Lista PDF goală - ascunsă');
    updateInputFilesPreview();
    return;
  }

  // Reconstruiește lista cu toate fișierele rămase
  pdfFiles.forEach((pdfFile, index) => {
    const fileItem = document.createElement('div');
    fileItem.className = 'pdf-file-item';
    fileItem.setAttribute('data-index', index);
    
    const filenameSpan = document.createElement('span');
    filenameSpan.className = 'pdf-filename';
    
    // Adaugă icon SVG pentru tipul de fișier
    const iconSvg = pdfFile.type === 'pdf' 
      ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="flex-shrink: 0;"><path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M14 2V8H20" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
      : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="flex-shrink: 0;"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="8.5" cy="8.5" r="1.5" fill="currentColor"/><path d="M21 15L16 10L5 21" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    
    filenameSpan.innerHTML = `${iconSvg}<span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${pdfFile.filename}</span>`;
    
    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'pdf-remove-btn';
    removeBtn.title = 'Elimină PDF';
    removeBtn.setAttribute('data-filename', pdfFile.filename);
    removeBtn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `;
    
    // Adaugă event listener pentru ștergere
    removeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const currentIndex = pdfFiles.findIndex(f => f.filename === pdfFile.filename);
      if (currentIndex !== -1) {
        removePdfFile(currentIndex);
      } else {
        console.error('❌ Fișierul nu a fost găsit în listă:', pdfFile.filename);
      }
    });
    
    fileItem.appendChild(filenameSpan);
    fileItem.appendChild(removeBtn);
    pdfFilesList.appendChild(fileItem);
    
    console.log(`✅ Adăugat în listă: ${pdfFile.filename} (index: ${index})`);
  });

  // Actualizează butonul din popup
  const uploadPopupBtn = document.getElementById('uploadPopupBtn');
  if (uploadPopupBtn) {
    const textSpan = uploadPopupBtn.querySelector('span');
    if (textSpan) {
      const count = pdfFiles.length;
      if (count > 0) {
        textSpan.textContent = `${count} fișier${count > 1 ? 'e' : ''} încărcat${count > 1 ? 'e' : ''}`;
      } else {
        textSpan.textContent = 'Încarcă fișiere';
      }
    }
  }
  
  // Actualizează preview-ul din input
  updateInputFilesPreview();
  
  console.log('✅ Lista PDF actualizată - Total:', pdfFiles.length);
}

function updateInputFilesPreview() {
  const inputFilesPreview = document.getElementById('inputFilesPreview');
  if (!inputFilesPreview) {
    console.error('❌ inputFilesPreview element nu există!');
    return;
  }

  // Șterge tot conținutul
  inputFilesPreview.innerHTML = '';

  if (pdfFiles.length === 0) {
    return;
  }

  // Adaugă fiecare fișier în preview
  pdfFiles.forEach((file, index) => {
    const fileItem = document.createElement('div');
    fileItem.className = 'input-file-item';
    
    const iconSvg = file.type === 'pdf' 
      ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M14 2V8H20" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
      : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="8.5" cy="8.5" r="1.5" fill="currentColor"/><path d="M21 15L16 10L5 21" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    
    fileItem.innerHTML = `
      ${iconSvg}
      <span>${file.filename}</span>
      <button type="button" class="input-file-remove" data-index="${index}">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
    `;
    
    // Adaugă event listener pentru ștergere
    const removeBtn = fileItem.querySelector('.input-file-remove');
    removeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      // Găsește index-ul actual după ce s-au șters alte fișiere
      const currentIndex = pdfFiles.findIndex(f => f.filename === file.filename);
      if (currentIndex !== -1) {
        removePdfFile(currentIndex);
      }
    });
    
    inputFilesPreview.appendChild(fileItem);
  });
}

function removePdfFile(index) {
  console.log('🗑️ Ștergere PDF la index:', index, 'Total fișiere:', pdfFiles.length);
  
  if (index < 0 || index >= pdfFiles.length) {
    console.error('❌ Index invalid:', index);
    return;
  }
  
  const removedFile = pdfFiles[index];
  console.log('📄 Fișier de șters:', removedFile.filename);
  
  // Șterge din ambele liste
  pdfFiles.splice(index, 1);
  pdfTexts = pdfTexts.filter(p => p.filename !== removedFile.filename);
  
  console.log('📊 După ștergere - Fișiere:', pdfFiles.length, 'Texte:', pdfTexts.length);
  
  // Reconstruiește lista vizuală
  updatePdfFilesList();
  
  console.log(`✅ PDF ${removedFile.filename} eliminat`);
}

function removePdf() {
  pdfTexts = [];
  pdfFiles = [];
  if (pdfInput) pdfInput.value = '';
  updatePdfFilesList();
  console.log('✅ Toate PDF-urile eliminate');
}

// ============================
// === Speech to Text ===
// ============================
let recognition = null;
let isListening = false;

function setupSpeechToText() {
  // Verifică dacă browserul suportă Web Speech API
  if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
    console.warn('⚠️ Speech recognition nu este suportat în acest browser');
    const micBtn = document.getElementById('micBtn');
    if (micBtn) {
      micBtn.style.display = 'none';
    }
    return;
  }

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.lang = 'ro-RO';

  const micBtn = document.getElementById('micBtn');
  if (!micBtn) {
    console.error('❌ Butonul microfon nu a fost găsit!');
    return;
  }

  recognition.onstart = () => {
    isListening = true;
    micBtn.classList.add('listening');
    console.log('🎤 Ascultare activă...');
  };

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    const currentText = messageInput.value.trim();
    messageInput.value = currentText ? `${currentText} ${transcript}` : transcript;
    console.log('📝 Text recunoscut:', transcript);
  };

  recognition.onerror = (event) => {
    console.error('❌ Eroare recunoaștere vocală:', event.error);
    if (event.error === 'no-speech') {
      alert('Nu s-a detectat vorbire. Vă rugăm încercați din nou.');
    } else if (event.error === 'not-allowed') {
      const isInIframe = window.self !== window.top;
      const currentUrl = window.location.origin;
      
      let message = 'Accesul la microfon a fost refuzat.\n\n';
      
      if (isInIframe) {
        message += 'IMPORTANT: Aplicația rulează într-un iframe.\n';
        message += `Trebuie să permiteți accesul pentru: ${currentUrl}\n\n`;
        message += 'Pași:\n';
        message += '1. Click pe iconița de lacăt/informații din stânga adresei\n';
        message += '2. Găsiți secțiunea "Microfon"\n';
        message += '3. Selectați "Permite" pentru ' + currentUrl + '\n';
        message += '4. Reîncărcați pagina (F5)';
      } else {
        message += 'Vă rugăm permiteți accesul în setările browserului:\n';
        message += '1. Click pe iconița de lacăt din stânga adresei\n';
        message += '2. Găsiți "Microfon" → Selectați "Permite"\n';
        message += '3. Reîncărcați pagina';
      }
      
      alert(message);
    } else if (event.error === 'aborted') {
      // Utilizatorul a oprit manual - nu afișăm eroare
      console.log('🎤 Recunoaștere oprită de utilizator');
    } else {
      alert(`Eroare: ${event.error}. Vă rugăm încercați din nou.`);
    }
    isListening = false;
    micBtn.classList.remove('listening');
  };

  recognition.onend = () => {
    isListening = false;
    micBtn.classList.remove('listening');
    console.log('🎤 Ascultare oprită');
  };

  micBtn.addEventListener('click', () => {
    if (isListening) {
      recognition.stop();
    } else {
      try {
        recognition.start();
      } catch (error) {
        console.error('❌ Eroare la pornirea recunoașterii vocale:', error);
        const isInIframe = window.self !== window.top;
        const currentUrl = window.location.origin;
        
        let message = 'Nu s-a putut porni recunoașterea vocală.\n\n';
        
        if (isInIframe) {
          message += 'IMPORTANT: Aplicația rulează într-un iframe.\n';
          message += `Trebuie să permiteți accesul pentru: ${currentUrl}\n\n`;
          message += 'Vă rugăm verificați permisiunile pentru microfon în setările browserului.';
        } else {
          message += 'Vă rugăm verificați permisiunile pentru microfon în setările browserului.';
        }
        
        alert(message);
      }
    }
  });
}

// ============================
// === Text to Speech ===
// ============================
let currentSpeech = null;

function speakText(text, button) {
  if (!text || text.trim() === '') {
    return;
  }

  // Oprește vorbirea curentă dacă există
  if (currentSpeech) {
    window.speechSynthesis.cancel();
    currentSpeech = null;
    if (button) {
      button.classList.remove('speaking');
    }
    return;
  }

  // Verifică dacă browserul suportă Web Speech API
  if (!('speechSynthesis' in window)) {
    alert('Text-to-speech nu este suportat în acest browser.');
    return;
  }

  // Creează un nou utterance
  const utterance = new SpeechSynthesisUtterance(text.trim());
  utterance.lang = 'ro-RO';
  utterance.rate = 1.0;
  utterance.pitch = 1.0;
  utterance.volume = 1.0;

  utterance.onstart = () => {
    currentSpeech = utterance;
    if (button) {
      button.classList.add('speaking');
    }
    console.log('🔊 Început citire text');
  };

  utterance.onend = () => {
    currentSpeech = null;
    if (button) {
      button.classList.remove('speaking');
    }
    console.log('🔊 Sfârșit citire text');
  };

  utterance.onerror = (event) => {
    console.error('❌ Eroare text-to-speech:', event.error);
    currentSpeech = null;
    if (button) {
      button.classList.remove('speaking');
    }
  };

  // Pornește citirea
  window.speechSynthesis.speak(utterance);
}

// Autofocus input
if (messageInput) {
  messageInput.focus();
}