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
});

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
    } else {
      fullMessage = 'Completează formularul folosind informațiile din documentele încărcate.';
    }
    
    // Adaugă fiecare fișier ca mesaj separat în chat
    pdfFiles.forEach((file) => {
      addFileMessage(file);
    });
  } else {
    // Dacă nu sunt fișiere, adaugă doar mesajul text
    addUserMessage(displayMessage);
  }

  messageInput.value = '';

  showTypingIndicator();

  setTimeout(() => {
    startStreamingResponse(fullMessage);
    
    // Șterge PDF-urile după trimitere (după ce mesajul a fost trimis)
    if (pdfFiles.length > 0) {
      setTimeout(() => {
        removePdf();
      }, 200);
    }
  }, 500);
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
async function startStreamingResponse(message) {
  try {
    const chatId = window.location.pathname.split('/')[2];
    const endpoint = chatId
      ? `http://127.0.0.1:3000/chat/${chatId}/ask`
      : `http://127.0.0.1:3000/ask`;

    // Construiește payload-ul cu context
    const payload = {
      message: message
    };

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
    if (pdfTexts.length > 0) {
      let combinedPdfText = pdfTexts.map(p => `\n--- ${p.filename} ---\n${p.text}`).join('\n\n');
      // Limitează la 5000 caractere pentru requesturi mai rapide
      if (combinedPdfText.length > 5000) {
        combinedPdfText = combinedPdfText.substring(0, 5000) + '\n\n[... text trunchiat pentru viteză ...]';
      }
      payload.pdf_text = combinedPdfText;
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let accumulatedText = '';

    let messageDiv = null;
    let messageContent = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      accumulatedText += chunk;

      if (!messageDiv) {
        // Adaugă clasa pentru a indica că există mesaje
        chatContainer.classList.add('has-messages');
        
        // Ascunde mesajul de bun venit când începe streaming-ul
        const welcomeMessage = chatMessages.querySelector('.welcome-message');
        if (welcomeMessage) {
          welcomeMessage.style.display = 'none';
        }
        
        messageDiv = document.createElement('div');
        messageDiv.className = 'message ai';
        messageDiv.innerHTML = `
          <div class="message-content">
            <div class="message-text"></div>
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
        messageContent = messageDiv.querySelector('.message-text');
        hideTypingIndicator();
        
        // Adaugă event listener pentru copiere când se termină streaming-ul
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
      }

      // Formatează textul pentru afișare frumoasă
      messageContent.innerHTML = formatMessageText(accumulatedText);
      scrollToBottom();

      await new Promise(resolve => setTimeout(resolve, 20));
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

  } catch (error) {
    hideTypingIndicator();
    addAiMessage("Îmi pare rău, momentan nu pot accesa serverul. Vă rog încercați mai târziu.");
    console.error('Streaming error:', error);
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
        alert(`⚠️ ${file.name} nu este PDF sau imagine suportată!`);
        continue;
      }

      if (file.size > 10 * 1024 * 1024) {
        alert(`⚠️ ${file.name} este prea mare! Maxim 10MB.`);
        continue;
      }

      // Verifică dacă fișierul nu e deja încărcat
      if (pdfFiles.some(f => f.filename === file.name)) {
        alert(`⚠️ ${file.name} este deja încărcat!`);
        continue;
      }

      validFiles.push({ file, type: fileType });
    }

    if (validFiles.length === 0) {
      pdfInput.value = '';
      return;
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
    
    // Închide popup după selectarea fișierelor valide
    if (validFiles.length > 0 && uploadPopup) {
      uploadPopup.classList.remove('active');
    }
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

    // Adaugă textul la listă
    pdfTexts.push({
      filename: file.name,
      text: data.text,
      type: 'image'
    });
    
    console.log(`🖼️ Text extras din imagine ${file.name}: ${data.text.length} caractere`);
    
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