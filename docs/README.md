# Integra AI - Documentație

Această documentație conține toate ghidurile și informațiile necesare pentru proiectul Integra AI.

## Documentație disponibilă

### Instalare și configurare
- **[PORNIRE.md](PORNIRE.md)** - Ghid pentru pornirea aplicației
- **[INSTALARE_NEXTJS.md](INSTALARE_NEXTJS.md)** - Instalare și configurare Next.js
- **[INSTALARE_OCR.md](INSTALARE_OCR.md)** - Instalare și configurare OCR (Tesseract)
- **[INSTALARE_PDF.md](INSTALARE_PDF.md)** - Instalare și configurare pentru procesarea PDF-urilor
- **[CONFIGURARE_BAZA_DATE.md](CONFIGURARE_BAZA_DATE.md)** - Configurare baza de date MySQL
- **[SECURITATE_ENV.md](SECURITATE_ENV.md)** - Configurare variabile de mediu și securitate

### Arhitectură și integrare
- **[ARHITECTURA_PORTURI.md](ARHITECTURA_PORTURI.md)** - Arhitectura și porturile aplicației
- **[MULTI_TENANT_ARCHITECTURE.md](MULTI_TENANT_ARCHITECTURE.md)** - Arhitectura multi-tenant
- **[INTEGRARE.md](INTEGRARE.md)** - Ghid de integrare
- **[README_NEXTJS.md](README_NEXTJS.md)** - Documentație specifică Next.js

## Structura proiectului

```
chatAI/
├── app/                    # Aplicație Next.js (frontend)
├── components/             # Componente React
├── core/                  # Module Python core (config, auth, cache, etc.)
├── routers/               # Router-uri FastAPI (auth, chat, admin, files, static)
├── models/                # Modele Pydantic
├── database.py            # Gestionare baza de date
├── rag_manager.py         # Gestionare RAG (Retrieval Augmented Generation)
├── prompt_builder.py      # Construire prompt-uri dinamice
├── migrations/            # Scripturi SQL pentru migrări
├── docs/                  # Documentație (acest folder)
├── scripts/               # Scripturi de pornire (.bat)
├── public/                # Fișiere statice
├── rag/                   # Fișiere RAG pentru fiecare tenant
└── vector_stores/         # Vector stores pentru fiecare tenant
```

## Quick Start

1. Instalează dependențele Python: `pip install -r requirements.txt`
2. Configurează baza de date (vezi [CONFIGURARE_BAZA_DATE.md](CONFIGURARE_BAZA_DATE.md))
3. Configurează variabilele de mediu (vezi [SECURITATE_ENV.md](SECURITATE_ENV.md))
4. Pornește backend-ul: `python main.py` sau `scripts/start-backend.bat`
5. Pornește frontend-ul: `npm run dev` sau `scripts/start-frontend.bat`

Pentru detalii complete, vezi [PORNIRE.md](PORNIRE.md).
