# Arhitectură Porturi - Integra AI

## Configurație Porturi

### Backend FastAPI
- **Port:** `8000`
- **URL:** `http://127.0.0.1:8000`
- **Responsabilități:**
  - API-uri pentru chat (`/chat/{chat_id}/ask`)
  - API-uri pentru administrare (`/admin/*`)
  - Procesare RAG și vector stores
  - Gestionare conversații

### Frontend Next.js
- **Port:** `3000`
- **URL:** `http://localhost:3000`
- **Responsabilități:**
  - Interfață utilizator (chat, admin panel)
  - Proxy pentru request-uri către backend
  - Gestionare UI/UX

## Proxy Next.js

Next.js configurează automat un proxy pentru request-urile către backend:

```javascript
// next.config.js
async rewrites() {
  return [
    {
      source: '/api/:path*',
      destination: 'http://127.0.0.1:8000/:path*',
    },
    {
      source: '/admin/:path*',
      destination: 'http://127.0.0.1:8000/admin/:path*',
    },
    {
      source: '/chat/:path*',
      destination: 'http://127.0.0.1:8000/chat/:path*',
    },
  ];
}
```

### Avantaje Proxy
- ✅ Evită probleme CORS
- ✅ URL-uri relative mai simple (`/admin/tenants` în loc de `http://127.0.0.1:8000/admin/tenants`)
- ✅ Cod mai curat și mai ușor de întreținut
- ✅ Funcționează și în producție cu configurare corectă

## Flux de Request-uri

### Exemplu: Panou Admin
1. **Browser:** `http://localhost:3000/admin` → Next.js (port 3000)
2. **Next.js:** `/admin/tenants` → Proxy → `http://127.0.0.1:8000/admin/tenants`
3. **Backend:** Procesează request-ul și returnează JSON
4. **Next.js:** Returnează răspunsul către browser

### Exemplu: Chat
1. **Browser:** `http://localhost:3000/chat/{chatId}` → Next.js
2. **Next.js:** `/chat/{chatId}/ask` → Proxy → `http://127.0.0.1:8000/chat/{chatId}/ask`
3. **Backend:** Procesează mesajul și stream-ează răspunsul
4. **Next.js:** Stream-ează răspunsul către browser

## Pornire Servicii

### Opțiunea 1: Scripturi Separate (Recomandat)
```bash
# Terminal 1: Backend
start-backend.bat
# Sau: python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload

# Terminal 2: Frontend
start-frontend.bat
# Sau: npm run dev
```

### Opțiunea 2: Manual
```bash
# Terminal 1
cd chatAI
python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload

# Terminal 2
cd chatAI
npm run dev
```

## Verificare Configurație

### Test Backend
```bash
# Deschide în browser:
http://127.0.0.1:8000/docs
# Ar trebui să vezi Swagger UI cu toate API-urile

# Test direct endpoint:
http://127.0.0.1:8000/admin/tenants
# Ar trebui să returneze JSON: {"tenants": [...]}
```

### Test Frontend
```bash
# Deschide în browser:
http://localhost:3000
# Ar trebui să vezi interfața principală

# Test admin panel:
http://localhost:3000/admin
# Ar trebui să vezi panoul de administrare
```

### Test Proxy
```bash
# Deschide în browser:
http://localhost:3000/admin/tenants
# Ar trebui să returneze același JSON ca direct de la backend
```

## Note Importante

1. **Ordinea de pornire:** Backend-ul trebuie pornit înainte de frontend
2. **Porturi diferite:** Backend (8000) și Frontend (3000) rulează pe porturi diferite
3. **Proxy doar în development:** În producție, configurează un reverse proxy (nginx)
4. **CORS:** Backend-ul are CORS configurat pentru `*` (permite toate originile)

## Troubleshooting

### Eroare: "ERR_CONNECTION_REFUSED"
**Cauză:** Backend-ul nu rulează pe port 8000

**Soluție:**
1. Verifică că backend-ul rulează: `start-backend.bat`
2. Verifică că portul 8000 este liber
3. Testează direct: `http://127.0.0.1:8000/docs`

### Eroare: "Failed to fetch" în frontend
**Cauză:** Proxy-ul Next.js nu funcționează sau backend-ul nu este accesibil

**Soluție:**
1. Verifică `next.config.js` - rewrites trebuie să fie configurate corect
2. Repornește Next.js după modificarea `next.config.js`
3. Verifică că backend-ul rulează pe port 8000

### Eroare: "CORS policy"
**Cauză:** Backend-ul blochează request-urile din cauza CORS

**Soluție:**
1. Verifică că `main.py` are CORS configurat:
   ```python
   app.add_middleware(
       CORSMiddleware,
       allow_origins=["*"],
       allow_methods=["*"],
       allow_headers=["*"],
   )
   ```
2. Folosește proxy-ul Next.js (evită probleme CORS)

## Diagramă Flux

```
┌─────────────┐
│   Browser   │
│  localhost: │
│    3000     │
└──────┬──────┘
       │
       │ HTTP Request
       │ /admin/tenants
       ▼
┌─────────────┐
│   Next.js   │
│  (Proxy)    │
│  Port 3000  │
└──────┬──────┘
       │
       │ Rewrite
       │ http://127.0.0.1:8000/admin/tenants
       ▼
┌─────────────┐
│  FastAPI    │
│  Backend    │
│  Port 8000  │
└─────────────┘
```

