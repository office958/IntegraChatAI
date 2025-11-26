# ChatAI - Next.js Frontend

Acest proiect a fost migrat de la HTML/JS vanilla la React + Next.js.

## Structura Proiectului

```
├── app/                    # Next.js App Router
│   ├── layout.tsx         # Layout principal
│   ├── page.tsx           # Pagina principală
│   ├── chat/[chatId]/     # Pagini dinamice pentru chat-uri
│   └── globals.css        # Stiluri globale
├── components/            # Componente React
│   ├── ChatContainer.tsx
│   ├── ChatHeader.tsx
│   ├── MessageList.tsx
│   ├── Message.tsx
│   ├── MessageInput.tsx
│   ├── PDFUploadPopup.tsx
│   ├── TypingIndicator.tsx
│   └── WelcomeMessage.tsx
├── hooks/                 # Custom React Hooks
│   ├── useChat.ts
│   ├── useChatConfig.ts
│   ├── usePDFUpload.ts
│   └── useSpeechToText.ts
├── utils/                 # Funcții utilitare
│   ├── messageFormatter.ts
│   ├── textToSpeech.ts
│   ├── clipboard.ts
│   ├── pdfExtractor.ts
│   └── autoFill.ts
└── public/                # Fișiere statice (păstrate pentru compatibilitate)
```

## Instalare

```bash
npm install
```

## Rulare Development

```bash
npm run dev
```

Aplicația va rula pe `http://localhost:3000`

## Build Production

```bash
npm run build
npm start
```

## Funcționalități Migrate

✅ Chat cu streaming responses
✅ Upload PDF/imagini cu OCR
✅ Speech to Text
✅ Text to Speech
✅ Auto-fill formulare
✅ Formatare mesaje (markdown, tabele, liste)
✅ Configurare dinamică pentru chaturi
✅ Compatibilitate cu backend-ul existent (FastAPI)

## Compatibilitate Backend

Backend-ul existent (FastAPI pe portul 3000) este accesat prin API routes configurate în `next.config.js`. Toate endpoint-urile existente funcționează fără modificări.

## Note

- Frontend-ul vechi (HTML/JS) este păstrat în `public/` pentru referință
- Backend-ul Python (FastAPI) rămâne neschimbat
- Toate funcționalitățile existente sunt migrate și funcționale

