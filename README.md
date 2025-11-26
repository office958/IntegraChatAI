# 🤖 Integra AI - Chat Assistant cu Auto-Fill

Sistem de chat AI cu suport pentru auto-completare formulare, extragere text din PDF-uri și imagini (OCR).

## 🚀 Pornire Server

### Metoda 1: FastAPI (Recomandat)

Serverul principal este `main.py` care rulează pe portul **3000**.

```bash
# Instalează dependențele (dacă nu sunt deja instalate)
pip install fastapi uvicorn ollama PyPDF2 pytesseract pillow

# Pornește serverul
uvicorn main:app --host 127.0.0.1 --port 3000 --reload
```

Sau folosind Python direct:

```bash
python -m uvicorn main:app --host 127.0.0.1 --port 3000 --reload
```

## 📋 Dependențe

### Python
- `fastapi` - Framework web
- `uvicorn` - Server ASGI
- `ollama` - Client pentru Ollama LLM
- `PyPDF2` - Extragere text din PDF-uri
- `pytesseract` - OCR pentru imagini
- `pillow` - Procesare imagini

### Node.js (opțional)
- `express` - Framework web
- `cors` - CORS middleware

## 🔧 Configurare

### 1. Ollama LLM

Asigură-te că Ollama rulează și este accesibil la adresa configurată în `main.py`:


### 2. Tesseract OCR (pentru imagini)

Vezi `INSTALARE_OCR.md` pentru instrucțiuni detaliate.

**Windows:**
- Descarcă de la: https://github.com/UB-Mannheim/tesseract/wiki
- Instalează și bifează limba română

**Linux:**
```bash
sudo apt-get install tesseract-ocr tesseract-ocr-ron
```

**macOS:**
```bash
brew install tesseract tesseract-lang
```

## 📖 Utilizare

1. **Pornește serverul:**
   ```bash
   uvicorn main:app --host 127.0.0.1 --port 3000 --reload
   ```

2. **Deschide în browser:**
   - Pagina principală: http://127.0.0.1:3000
   - Builder chat: http://127.0.0.1:3000/builder
   - Pagini exemple:
     - http://127.0.0.1:3000/rezervari
     - http://127.0.0.1:3000/evenimente
     - http://127.0.0.1:3000/primarie

3. **Funcționalități:**
   - Chat AI cu streaming
   - Auto-completare formulare
   - Încărcare PDF-uri (extragere text)
   - Încărcare imagini (OCR)
   - Suport pentru multiple fișiere

## 🐛 Rezolvare probleme

### Serverul nu pornește
- Verifică că portul 3000 nu este folosit de alt proces
- Verifică că toate dependențele sunt instalate

### Eroare: "Ollama connection failed"
- Verifică că Ollama rulează
- Verifică adresa IP în `main.py` (linia 20)

### Eroare: "PyPDF2 nu este instalat"
```bash
pip install PyPDF2
```

### Eroare: "OCR nu este disponibil"
- Instalează Tesseract OCR (vezi `INSTALARE_OCR.md`)
- Instalează bibliotecile: `pip install pytesseract pillow`

## 📚 Documentație

- `INSTALARE_PDF.md` - Instalare suport PDF
- `INSTALARE_OCR.md` - Instalare suport OCR (imagini)
- `INTEGRARE.md` - Ghid de integrare chat în pagini

## 🔗 Endpoints API

- `POST /ask` - Chat default
- `POST /chat/{chat_id}/ask` - Chat cu config specific
- `POST /extract-pdf` - Extragere text din PDF
- `POST /extract-image` - Extragere text din imagini (OCR)
- `GET /builder` - Builder pentru creare chat-uri noi

# IntegraChatAI
# IntegraChatAI
