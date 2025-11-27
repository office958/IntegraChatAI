# 📘 Ghid de Integrare - Integra AI Auto-Fill

Acest ghid explică cum să integrezi chat-ul Integra AI în aplicațiile tale pentru a permite administratorilor să completeze formulare automat cu ajutorul AI.

## 🎯 Funcționalități

- ✅ **Detecție automată** a tuturor câmpurilor din formulare
- ✅ **Completare automată** bazată pe răspunsurile AI
- ✅ **Suport pentru toate tipurile de câmpuri**: text, textarea, select, checkbox, radio, date, email, etc.
- ✅ **Comunicare automată** între chat (iframe) și pagina părinte
- ✅ **Parsare inteligentă** a răspunsurilor JSON din AI

## 🚀 Cum să integrezi

### Pasul 1: Adaugă scriptul de autofill în pagina ta

Adaugă acest script în `<head>` sau înainte de `</body>`:

```html
<script src="http://127.0.0.1:3000/scripts/integra_autofill.js"></script>
```

**SAU** copiază conținutul din `public/scripts/integra_autofill.js` direct în pagina ta.

### Pasul 2: Adaugă chat-ul ca iframe

Adaugă codul pentru chat bubble și iframe în pagina ta:

```html
<!-- Chat Bubble -->
<div id="chat-bubble" style="
    position: fixed;
    bottom: 20px;
    right: 20px;
    width: 60px;
    height: 60px;
    background-color: #4A3AFF;
    border-radius: 50%;
    box-shadow: 0 4px 12px rgba(0,0,0,0.25);
    cursor: pointer;
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.3s ease;
">
    <img src="https://cdn-icons-png.flaticon.com/512/4712/4712101.png" 
        style="width: 60%; height: 60%; object-fit: contain;">
</div>

<!-- Chat Iframe -->
<iframe id="chat-frame"
    src="http://127.0.0.1:3000/chat/TU_CHAT_ID"
    style="
        display: none;
        position: fixed;
        bottom: 90px;
        right: 20px;
        width: 650px;
        height: 560px;
        border: none;
        border-radius: 16px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.25);
        z-index: 9999;
        background: transparent;
    "
    allowtransparency="true"
    allow="microphone">
</iframe>

<script>
const bubble = document.getElementById('chat-bubble');
const frame = document.getElementById('chat-frame');
let open = false;

bubble.addEventListener('click', () => {
    open = !open;
    frame.style.display = open ? 'block' : 'none';
    bubble.style.transform = open ? 'rotate(360deg)' : 'rotate(0deg)';
    bubble.style.backgroundColor = open ? '#362FD9' : '#4A3AFF';
});
</script>
```

**Important:** Înlocuiește `TU_CHAT_ID` cu ID-ul chat-ului tău (poți crea unul nou la `/builder`).

### Pasul 3: Asigură-te că formularele au label-uri clare

Pentru cea mai bună detecție, asigură-te că câmpurile tale au:
- `id` sau `name` clar
- `label` asociat (prin `for` sau structură HTML)
- `placeholder` (opțional, dar ajută)

**Exemplu bun:**
```html
<label for="title">Titlu Articol</label>
<input type="text" id="title" name="title" placeholder="Introdu titlul...">
```

## 🔧 Configurare

### Creează un chat personalizat

1. Accesează `http://127.0.0.1:3000/builder`
2. Completează:
   - **Nume chatbot**: Numele asistentului tău
   - **Model LLM**: Alege modelul (ex: `gpt-oss:20b`)
   - **Prompt**: Instrucțiuni pentru AI
3. Copiază codul iframe generat și folosește-l în aplicația ta

### Exemplu de prompt bun

```
Ești un asistent virtual care ajută administratorii să completeze formulare.
Când utilizatorul cere să generezi conținut pentru un formular, răspunde EXCLUSIV 
cu un obiect JSON valid, fără text explicativ.

Folosește numele exacte ale câmpurilor detectate ca chei JSON.
```

## 📝 Cum funcționează

1. **Detecție automată**: Scriptul detectează toate câmpurile din formular
2. **Trimite context**: Informațiile despre câmpuri sunt trimise către chat
3. **AI generează JSON**: Când utilizatorul cere completare, AI generează JSON cu datele
4. **Parsare automată**: Chat-ul parsează JSON-ul din răspuns
5. **Completare automată**: Câmpurile sunt completate automat în formular

## 🎨 Tipuri de câmpuri suportate

- ✅ `text` - Text simplu
- ✅ `textarea` - Text lung
- ✅ `email` - Adrese email
- ✅ `tel` - Numere de telefon
- ✅ `number` - Numere
- ✅ `date` - Date
- ✅ `datetime-local` - Data și ora
- ✅ `select` - Dropdown (cu opțiuni)
- ✅ `checkbox` - Bifare
- ✅ `radio` - Butoane radio

## 🔍 Debugging

Pentru a vedea ce se întâmplă, deschide Console-ul din browser (F12):

```javascript
// Verifică câmpurile detectate
console.log(IntegraAutoFill.detectFields());

// Verifică configurația
console.log(IntegraAutoFill.config);

// Testează completare manuală
IntegraAutoFill.fillData({
    "title": "Test",
    "author": "Test Author"
});
```

## ⚙️ Configurare avansată

Poți modifica comportamentul în `integra_autofill.js`:

```javascript
const CONFIG = {
    debug: true,              // Activează logging
    highlightFields: true,    // Evidențiază câmpurile completate
    showNotifications: true, // Arată notificări
};
```

## 🐛 Rezolvare probleme

### Chat-ul nu detectează câmpurile
- Verifică că scriptul `integra_autofill.js` este încărcat
- Verifică Console-ul pentru erori
- Asigură-te că formularele au `id` sau `name`

### JSON-ul nu este parsat corect
- Verifică că AI-ul returnează JSON valid
- Verifică Console-ul pentru mesaje de eroare
- Asigură-te că prompt-ul instruiește AI-ul să returneze doar JSON

### Câmpurile nu se completează
- Verifică că numele câmpurilor se potrivesc cu cheile din JSON
- Verifică Console-ul pentru potriviri
- Asigură-te că câmpurile nu sunt `disabled`

## 📚 Exemple

Vezi `public/site_primarie.html` pentru un exemplu complet de integrare.

## 🆘 Suport

Pentru probleme sau întrebări, verifică:
- Console-ul browser-ului pentru erori
- Log-urile serverului
- Documentația Ollama pentru modele

---

**Notă**: Asigură-te că serverul FastAPI rulează pe `http://127.0.0.1:3000` sau modifică URL-urile în cod.

