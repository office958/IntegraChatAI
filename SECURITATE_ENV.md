# 🔒 Securitate - Variabile de Mediu (.env)

Acest document descrie toate variabilele de mediu necesare pentru securitatea și funcționarea aplicației.

## ⚠️ IMPORTANT - SECURITATE

**NICIODATĂ** nu comitați fișierul `.env` în Git! Acesta conține informații sensibile.

Fișierul `.env` este deja adăugat în `.gitignore` pentru a preveni commit-uri accidentale.

## 📋 Variabile de Mediu Necesare

### 1. Baza de Date MySQL

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password_here
DB_NAME=Integra_chat_ai
```

**Securitate:**
- `DB_PASSWORD` - **OBLIGATORIU** să fie setat în producție
- Nu folosi parola default (`''`) în producție

### 2. JWT (JSON Web Tokens)

```env
JWT_SECRET_KEY=your-secret-key-change-in-production-generate-a-secure-random-key
JWT_ALGORITHM=HS256
JWT_EXPIRATION_HOURS=168
```

**Securitate:**
- `JWT_SECRET_KEY` - **CRITIC** - trebuie să fie o cheie aleatorie sigură în producție
- **Generează o cheie sigură:**
  ```bash
  python -c "import secrets; print(secrets.token_urlsafe(32))"
  ```
- `JWT_EXPIRATION_HOURS` - Default: 168 (7 zile). Ajustează după necesități de securitate.

### 3. Ollama

```env
OLLAMA_HOST=localhost:11434
EMBEDDING_MODEL=nomic-embed-text
```

**Securitate:**
- Dacă Ollama rulează pe alt server, actualizează `OLLAMA_HOST`
- Nu expune Ollama la internet fără autentificare

### 4. URL-uri (pentru redirect-uri și link-uri)

```env
NEXTJS_URL=http://localhost:3000
BACKEND_URL=http://127.0.0.1:8000
```

**Securitate:**
- În producție, folosește URL-uri HTTPS
- Nu folosi `localhost` sau `127.0.0.1` în producție

### 5. Configurare Securitate

```env
GUEST_USER_PASSWORD_HASH=$2y$10$default
```

**Securitate:**
- Parolă hash pentru utilizatori guest creați automat
- În producție, dezactivează crearea automată de guest users sau folosește un hash sigur

### 6. Configurare Context Window (Opțional)

```env
MAX_CONTEXT_CHARS=32000
CONTEXT_RESERVE=2000
```

## 🚀 Setup Rapid

1. **Copiază fișierul de exemplu:**
   ```bash
   cp .env.example .env
   ```

2. **Editează `.env` și completează valorile:**
   - Schimbă `DB_PASSWORD` cu parola ta MySQL
   - Generează și setează `JWT_SECRET_KEY` sigur
   - Actualizează URL-urile pentru producție

3. **Verifică că `.env` este în `.gitignore`:**
   ```bash
   cat .gitignore | grep .env
   ```

## 🔍 Verificare Vulnerabilități

### Checklist Securitate:

- [ ] `JWT_SECRET_KEY` este setat și nu este valoarea default
- [ ] `DB_PASSWORD` este setat și nu este gol
- [ ] `GUEST_USER_PASSWORD_HASH` este setat (sau dezactivat crearea automată)
- [ ] URL-urile folosesc HTTPS în producție
- [ ] Nu există credențiale hardcodate în cod
- [ ] `.env` este în `.gitignore` și nu este commitat

## 📝 Note

- Toate valorile default din cod sunt **doar pentru development**
- În producție, **toate** valorile sensibile trebuie să fie în `.env`
- Nu partajați niciodată fișierul `.env` sau conținutul său
- Folosiți variabile de mediu diferite pentru development și producție

