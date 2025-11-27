# Instalare și Rulare - Next.js Frontend

## Pași de Instalare

### 1. Instalează Dependențele

```bash
npm install
```

Aceasta va instala:
- Next.js 14
- React 18
- TypeScript
- Tailwind CSS
- Toate dependențele necesare

### 2. Rulează Development Server

```bash
npm run dev
```

Aplicația va rula pe `http://localhost:3000`

**IMPORTANT:** Asigură-te că backend-ul FastAPI rulează pe `http://127.0.0.1:3000` (sau actualizează `next.config.js` dacă backend-ul rulează pe alt port).

### 3. Build pentru Production

```bash
npm run build
npm start
```

## Structura Proiectului

```
├── app/                    # Next.js App Router
│   ├── layout.tsx         # Layout principal
│   ├── page.tsx           # Pagina principală (/)
│   ├── chat/[chatId]/     # Pagini dinamice pentru chat-uri (/chat/:chatId)
│   └── globals.css        # Stiluri globale + Tailwind
├── components/            # Componente React
│   ├── ChatContainer.tsx  # Container principal chat
│   ├── ChatHeader.tsx     # Header cu titlu și subtitlu
│   ├── MessageList.tsx    # Lista de mesaje
│   ├── Message.tsx        # Componentă pentru un mesaj
│   ├── MessageInput.tsx   # Input pentru mesaje + butoane
│   ├── PDFUploadPopup.tsx # Popup pentru upload PDF/imagini
│   ├── TypingIndicator.tsx # Indicator de typing
│   └── WelcomeMessage.tsx # Mesaj de bun venit
├── hooks/                 # Custom React Hooks
│   ├── useChat.ts         # Hook pentru gestionarea chat-ului
│   ├── useChatConfig.ts   # Hook pentru încărcarea configurării
│   ├── usePDFUpload.ts    # Hook pentru gestionarea PDF-urilor
│   └── useSpeechToText.ts # Hook pentru Speech to Text
├── utils/                 # Funcții utilitare
│   ├── messageFormatter.ts # Formatare mesaje (markdown, tabele)
│   ├── textToSpeech.ts    # Text to Speech
│   ├── clipboard.ts       # Copiere în clipboard
│   ├── pdfExtractor.ts   # Extragere text din PDF/imagini
│   └── autoFill.ts       # Auto-fill formulare
└── types/                # TypeScript types
    └── index.ts          # Tipuri comune
```

## Configurare

### Backend URL

Dacă backend-ul rulează pe alt port sau alt host, actualizează `next.config.js`:

```javascript
async rewrites() {
  return [
    {
      source: '/api/:path*',
      destination: 'http://YOUR_BACKEND_HOST:PORT/:path*',
    },
  ];
}
```

## Funcționalități

✅ **Chat cu streaming** - Mesajele AI sunt streamate în timp real
✅ **Upload PDF/imagini** - Suport pentru PDF și imagini cu OCR
✅ **Speech to Text** - Recunoaștere vocală în română
✅ **Text to Speech** - Citire mesaje cu voce
✅ **Auto-fill formulare** - Completare automată a câmpurilor din formulare
✅ **Formatare mesaje** - Markdown, tabele, liste numerotate
✅ **Configurare dinamică** - Fiecare chat poate avea propria configurare

## Compatibilitate

- ✅ Compatibil cu backend-ul FastAPI existent
- ✅ Păstrează toate endpoint-urile existente
- ✅ Funcționează cu scriptul `integra_autofill.js` pentru auto-fill

## Probleme Comune

### Port 3000 deja folosit

Dacă portul 3000 este deja folosit, Next.js va folosi automat următorul port disponibil (3001, 3002, etc.).

### Backend nu este accesibil

Verifică că:
1. Backend-ul FastAPI rulează
2. Portul din `next.config.js` este corect
3. Nu există probleme de CORS (backend-ul are CORS configurat)

### TypeScript Errors

Dacă apar erori TypeScript, rulează:
```bash
npm run build
```
Pentru a vedea toate erorile.

## Next Steps

1. Instalează dependențele: `npm install`
2. Rulează development server: `npm run dev`
3. Deschide `http://localhost:3000` în browser
4. Testează funcționalitățile

