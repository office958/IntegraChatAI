# Configurare Baza de Date MySQL

## Pași de configurare

### 1. Creează baza de date și tabelele

Rulează scriptul SQL furnizat pentru a crea baza de date și toate tabelele necesare:

```sql
CREATE DATABASE IF NOT EXISTS Integra_chat_ai
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE Integra_chat_ai;

-- Tabelele sunt definite în scriptul SQL furnizat
```

### 2. Adaugă câmpul content pentru RAG (MIGRARE)

**IMPORTANT:** După crearea tabelelor, rulează scriptul de migrare pentru a adăuga suport pentru stocarea conținutului text al fișierelor RAG:

```bash
mysql -u root -p Integra_chat_ai < migrate_rag_content.sql
```

Sau rulează manual în MySQL:

```sql
USE Integra_chat_ai;
ALTER TABLE rag_file ADD COLUMN content LONGTEXT NULL AFTER file;
```

### 3. Configurează variabilele de mediu

Creează un fișier `.env` în directorul rădăcină al proiectului:

```env
# Configurare Ollama
OLLAMA_HOST=localhost:11434
EMBEDDING_MODEL=nomic-embed-text

# Configurare MySQL
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password_here
DB_NAME=Integra_chat_ai
```

### 4. Instalează dependențele

```bash
pip install -r requirements.txt
```

Dependența nouă adăugată:
- `mysql-connector-python>=8.2.0`

### 5. Verifică conexiunea

La pornirea backend-ului, ar trebui să vezi mesajul:
```
✅ Connection pool creat pentru Integra_chat_ai
```

## Structura bazei de date

### Tabelul `client_chat`
Stochează configurația fiecărui chatbot:
- `id` (INT, PRIMARY KEY, AUTO_INCREMENT)
- `name` (VARCHAR) - numele chatbot-ului
- `model` (VARCHAR) - modelul LLM folosit
- `prompt` (TEXT) - promptul de sistem
- `chat_title`, `chat_subtitle`, `chat_color` - setări UI
- `updated_at` (TIMESTAMP) - data ultimei actualizări
- `is_active` (TINYINT) - starea activ/inactiv

### Tabelul `client_type`
Stochează datele instituției pentru fiecare chatbot:
- `id` (INT, PRIMARY KEY, AUTO_INCREMENT)
- `name` (VARCHAR) - numele instituției
- `type` (VARCHAR) - tipul (primarie, scoala, ong, companie, dsp, alta)
- `address`, `phone`, `email`, `website` - date de contact
- `id_client_chat` (INT, FOREIGN KEY) - referință la `client_chat`

### Tabelul `rag_file`
Stochează fișierele RAG pentru fiecare chatbot:
- `id` (INT, PRIMARY KEY, AUTO_INCREMENT)
- `file` (VARCHAR) - numele fișierului
- `content` (LONGTEXT) - **conținutul text extras din fișier** (adăugat prin migrare)
- `id_client_chat` (INT, FOREIGN KEY) - referință la `client_chat`
- `uploaded_at` (TIMESTAMP) - data încărcării

**IMPORTANT:** Câmpul `content` este adăugat prin scriptul de migrare `migrate_rag_content.sql`. Fără acest câmp, conținutul text nu va fi salvat în baza de date.

### Tabelul `user_chat_id`
Stochează conversațiile utilizatorilor:
- `id` (INT, PRIMARY KEY, AUTO_INCREMENT)
- `role` (ENUM) - 'user', 'assistant', 'system'
- `content` (LONGTEXT) - conținutul mesajului
- `user_id` (INT, FOREIGN KEY) - referință la `Users`
- `id_client_chat` (INT, FOREIGN KEY) - referință la `client_chat`
- `created_at` (TIMESTAMP) - data mesajului

### Tabelul `Users`
Stochează utilizatorii:
- `id` (INT, PRIMARY KEY, AUTO_INCREMENT)
- `name`, `email`, `password` - date utilizator
- `role` (ENUM) - 'admin', 'client_admin', 'user'
- `display`, `language`, `spoken_language`, `voice` - preferințe

## Migrare de la JSON la MySQL

### Date existente

Dacă ai deja date în fișiere JSON (`configs/*.json`), poți migra datele:

1. **Configurații chatbot**: Creează manual în baza de date sau folosește endpoint-ul `/builder/create`
2. **Fișiere RAG**: Reîncarcă fișierele prin panoul de administrare - acum conținutul text va fi salvat în DB
3. **Conversații**: Conversațiile vechi din memorie nu vor fi migrate automat, dar noile conversații vor fi salvate în DB

### Compatibilitate

Codul actual suportă atât `chat_id` ca string cât și ca int:
- Dacă `chat_id` este un număr, se folosește direct ca `id` în `client_chat`
- Dacă `chat_id` este un string, se caută după `name` în `client_chat`

## Stocarea conținutului RAG

### Cum funcționează

1. **La upload**: Când încarci un fișier RAG (PDF, TXT, DOCX, etc.):
   - Fișierul este salvat pe disk în `rag/{chat_id}/`
   - Textul este extras din fișier
   - **Conținutul text este salvat în baza de date** în tabelul `rag_file`, câmpul `content`
   - Conținutul este adăugat și în vector store pentru căutare semantică

2. **La utilizare**: Când se face o interogare RAG:
   - Conținutul este încărcat din baza de date (nu din fișiere JSON)
   - Se folosește pentru căutare semantică în vector store
   - Se include în prompt-ul LLM-ului

### Avantaje

- **Persistență**: Conținutul RAG este salvat permanent în baza de date
- **Performanță**: Nu trebuie să re-extragi textul la fiecare request
- **Scalabilitate**: Poți gestiona milioane de documente RAG
- **Backup**: Datele sunt în baza de date, ușor de făcut backup

## Verificare funcționare

1. **Creează un chatbot nou** prin `/builder/create` sau panoul de administrare
2. **Verifică în baza de date** că a fost creat în `client_chat`
3. **Încarcă un fișier RAG** și verifică că apare în `rag_file` cu conținutul text
4. **Trimite un mesaj** în chat și verifică că apare în `user_chat_id`

## Troubleshooting

### Eroare: "Connection pool could not be created"
- Verifică că MySQL rulează
- Verifică că datele de conectare din `.env` sunt corecte
- Verifică că baza de date `Integra_chat_ai` există

### Eroare: "Table doesn't exist"
- Rulează scriptul SQL pentru a crea tabelele
- Verifică că folosești baza de date corectă (`USE Integra_chat_ai`)

### Eroare: "Unknown column 'content'"
- **Rulează scriptul de migrare** `migrate_rag_content.sql` pentru a adăuga câmpul `content`
- Sau rulează manual: `ALTER TABLE rag_file ADD COLUMN content LONGTEXT NULL AFTER file;`

### Chat-urile vechi nu apar
- Chat-urile create înainte de migrare nu vor apărea automat
- Creează-le din nou prin panoul de administrare sau `/builder/create`

### Conținutul RAG nu se salvează
- Verifică că ai rulat scriptul de migrare pentru a adăuga câmpul `content`
- Verifică că fișierul are conținut text extractibil (nu este scanat/protejat)
- Verifică log-urile backend-ului pentru erori
