# Integra AI - Chatbot Platform

Platformă multi-tenant pentru crearea și gestionarea de chatbot-uri inteligente cu suport RAG (Retrieval Augmented Generation).

## 🚀 Quick Start

### Backend (FastAPI)
```bash
# Instalează dependențele
pip install -r requirements.txt

# Pornește serverul
python main.py
# sau
scripts/start-backend.bat
```

### Frontend (Next.js)
```bash
# Instalează dependențele
npm install

# Pornește aplicația
npm run dev
# sau
scripts/start-frontend.bat
```

## 📁 Structura Proiectului

```
chatAI/
├── app/                    # Aplicație Next.js (frontend)
├── components/             # Componente React
├── core/                   # Module Python core
│   ├── auth.py            # Autentificare și JWT
│   ├── cache.py           # Cache pentru config-uri
│   ├── config.py          # Configurație aplicație
│   ├── conversation.py    # Gestionare conversații
│   └── prompt.py         # Gestionare prompt-uri
├── routers/                # Router-uri FastAPI
│   ├── admin.py          # Endpoint-uri administrare
│   ├── auth.py           # Endpoint-uri autentificare
│   ├── chat.py           # Endpoint-uri chat
│   ├── files.py          # Endpoint-uri pentru fișiere
│   └── static.py         # Pagini statice
├── models/                 # Modele Pydantic
│   └── schemas.py        # Schema-uri pentru request/response
├── migrations/             # Scripturi SQL pentru migrări
├── docs/                   # Documentație completă
├── scripts/                # Scripturi de pornire
├── database.py            # Gestionare baza de date
├── rag_manager.py         # Gestionare RAG
└── prompt_builder.py      # Construire prompt-uri dinamice
```

## 📚 Documentație

Toată documentația se află în folderul [`docs/`](docs/):

- **[docs/README.md](docs/README.md)** - Index complet al documentației
- **[docs/PORNIRE.md](docs/PORNIRE.md)** - Ghid pentru pornirea aplicației
- **[docs/CONFIGURARE_BAZA_DATE.md](docs/CONFIGURARE_BAZA_DATE.md)** - Configurare MySQL
- **[docs/SECURITATE_ENV.md](docs/SECURITATE_ENV.md)** - Configurare variabile de mediu
- **[docs/MULTI_TENANT_ARCHITECTURE.md](docs/MULTI_TENANT_ARCHITECTURE.md)** - Arhitectura multi-tenant

## 🛠️ Tehnologii

### Backend
- **FastAPI** - Framework web modern și rapid
- **Ollama** - LLM local pentru generare de răspunsuri
- **MySQL** - Baza de date
- **PyPDF2** - Procesare PDF-uri
- **Tesseract OCR** - Extragere text din imagini

### Frontend
- **Next.js** - Framework React
- **TypeScript** - Tipare statice
- **Tailwind CSS** - Stilizare

## 🔧 Configurare

1. **Baza de date**: Vezi [docs/CONFIGURARE_BAZA_DATE.md](docs/CONFIGURARE_BAZA_DATE.md)
2. **Variabile de mediu**: Vezi [docs/SECURITATE_ENV.md](docs/SECURITATE_ENV.md)
3. **Ollama**: Asigură-te că Ollama rulează și ai modelele necesare instalate

## 📝 Licență

Proiect privat - Integra AI

