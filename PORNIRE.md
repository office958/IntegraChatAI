# Ghid de Pornire - Integra AI Multi-Tenant

## Pornirea Serviciilor

Platforma Integra AI necesită două servicii care trebuie pornite separat:

### 1. Backend FastAPI (Port 8000)

Backend-ul gestionează:
- API-urile pentru chat
- Panoul de administrare
- Procesarea RAG
- Vector stores

**Pornire:**
```bash
# Windows
start-backend.bat

# Sau manual:
python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```

**Verificare:**
- Deschide în browser: http://127.0.0.1:8000/docs
- Ar trebui să vezi documentația Swagger a API-urilor

### 2. Frontend Next.js (Port 3000)

Frontend-ul oferă:
- Interfața de chat
- Panoul de administrare
- Gestionarea utilizatorilor

**Pornire:**
```bash
# Windows
start-frontend.bat

# Sau manual:
npm run dev
```

**Verificare:**
- Deschide în browser: http://localhost:3000
- Panou admin: http://localhost:3000/admin

## Ordinea de Pornire

1. **Primul pas:** Pornește backend-ul (port 8000)
   - Verifică că Ollama rulează pe localhost:11434
   - Verifică că toate dependențele Python sunt instalate

2. **Al doilea pas:** Pornește frontend-ul (port 3000)
   - Verifică că node_modules există
   - Verifică că toate dependențele npm sunt instalate

## Verificare Dependențe

### Backend (Python)
```bash
pip install -r requirements.txt
```

Dependențe necesare:
- fastapi
- uvicorn
- ollama
- PyPDF2
- pytesseract
- Pillow
- numpy
- python-dotenv
- python-docx

### Frontend (Node.js)
```bash
npm install
```

## Rezolvare Probleme

### Eroare: "ERR_CONNECTION_REFUSED"
**Cauză:** Backend-ul nu rulează pe port 8000

**Soluție:**
1. Verifică că backend-ul este pornit: `start-backend.bat`
2. Verifică că portul 8000 este liber
3. Verifică că nu există firewall care blochează conexiunea

### Eroare: "Failed to fetch" în panoul de administrare
**Cauză:** Backend-ul nu este accesibil

**Soluție:**
1. Verifică că backend-ul rulează: http://127.0.0.1:8000/docs
2. Verifică că URL-ul din frontend este corect: `http://127.0.0.1:8000`
3. Verifică CORS în `main.py` (ar trebui să fie configurat pentru `*`)

### Eroare: "Ollama connection failed"
**Cauză:** Ollama nu rulează sau nu este accesibil

**Soluție:**
1. Pornește Ollama: `ollama serve`
2. Verifică că rulează pe localhost:11434
3. Verifică variabila de mediu `OLLAMA_HOST` dacă Ollama rulează pe alt port

## Porturi Utilizate

- **8000:** Backend FastAPI (API-uri)
- **3000:** Frontend Next.js (interfață web)
- **11434:** Ollama (LLM server) - default

## Testare Rapidă

1. Pornește backend-ul
2. Deschide: http://127.0.0.1:8000/admin/tenants
3. Ar trebui să vezi JSON cu lista de tenant-i (sau `{"tenants": []}` dacă nu există)

4. Pornește frontend-ul
5. Deschide: http://localhost:3000/admin
6. Ar trebui să vezi panoul de administrare

## Note

- Backend-ul și frontend-ul pot rula simultan
- Backend-ul trebuie să fie pornit înainte de a accesa panoul de administrare
- Pentru producție, folosește un reverse proxy (nginx) și configurare HTTPS

