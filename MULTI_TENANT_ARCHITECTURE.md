# Arhitectură Multi-Tenant pentru Integra AI

## Prezentare Generală

Platforma Integra AI permite folosirea aceluiași model LLM (de ex. `gpt-oss:20b` sau alt model local) pentru mai multe instituții diferite (primării, școli, ONG-uri, companii etc.), fiecare cu propriile date, documente și instrucțiuni. Fiecare chatbot este complet izolat și se comportă ca și cum ar fi antrenat special pentru instituția respectivă.

## Componente Principale

### 1. Izolarea per Tenant

#### Structura de Date
- Fiecare tenant (instituție) are un `tenant_id` unic
- Configurațiile sunt stocate în `configs/{chat_id}.json`
- Documentele RAG sunt stocate în `rag/{chat_id}/`
- Vector stores sunt izolate în `vector_stores/{tenant_id}/`

#### Istoric Conversații
- Istoricul conversațiilor este izolat per tenant în memorie
- Format: `{tenant_id: {chat_id: [messages]}}`
- Fiecare tenant vede doar propriile conversații

### 2. Vector Store Izolat per Tenant

#### Implementare
- Modul: `rag_manager.py`
- Clasă: `TenantRAGStore`
- Folosește embeddings din Ollama (sau fallback hash-based)
- Similaritate cosinus pentru căutare semantică
- Chunk-uri de text pentru indexare optimă

#### Funcționalități
- `add_document(filename, content)`: Adaugă document în vector store
- `remove_document(filename)`: Șterge document din vector store
- `search(query, top_k)`: Caută documente relevante
- `clear()`: Șterge tot vector store-ul

### 3. Generare Dinamică a Promptului de Sistem

#### Modul: `prompt_builder.py`
Funcția `build_dynamic_system_prompt()` construiește promptul final din:

1. **Promptul de bază** (instrucțiuni generale)
2. **Datele instituției**:
   - Nume și tip instituție
   - Date de contact (adresă, telefon, email, website)
   - Program de lucru
   - Servicii disponibile
   - Taxe și tarife
   - Atribuții principale
   - Politici de răspuns (ton, nivel de detaliere, limbă)
3. **Contextul RAG** (documente relevante găsite prin căutare semantică)

### 4. Panou de Administrare

#### Acces
- URL: `http://localhost:3000/admin`
- Next.js component: `app/admin/page.tsx`

#### Funcționalități
- **Listare tenant-i**: Vezi toți tenant-ii configurați
- **Editare date instituție**: Nume, tip, contact, program, servicii, taxe, politici
- **Editare configurație**: Prompt, model LLM, setări UI (titlu, culoare)
- **Gestionare documente RAG**: Încărcare și ștergere fișiere
- **Vizualizare informații**: Status, date creare/actualizare

## API Endpoints

### Endpoints pentru Chat
- `POST /chat/{chat_id}/ask` - Trimite mesaj către chatbot
- `GET /chat/{chat_id}/config` - Obține configurația chat-ului
- `POST /chat/{chat_id}/clear` - Șterge istoricul conversației
- `GET /chat/{chat_id}/history` - Obține istoricul conversației

### Endpoints pentru RAG
- `POST /chat/{chat_id}/reprocess-rag` - Re-procesează documentele RAG și actualizează vector store-ul

### Endpoints pentru Administrare
- `GET /admin/tenants` - Listează toți tenant-ii
- `PUT /admin/tenant/{chat_id}/institution` - Actualizează datele instituției
- `PUT /admin/tenant/{chat_id}/config` - Actualizează configurația tenant-ului
- `POST /admin/tenant/{chat_id}/rag/upload` - Încarcă document RAG
- `DELETE /admin/tenant/{chat_id}/rag/{filename}` - Șterge document RAG

## Flux de Date

### La fiecare request către LLM:

1. **Obținere config**: Se încarcă configurația tenant-ului din cache sau fișier
2. **Extragere date instituție**: Se extrag datele instituției din config
3. **Căutare RAG**: Se caută documente relevante în vector store-ul tenant-ului folosind mesajul utilizatorului ca query
4. **Generare prompt dinamic**: Se construiește promptul final combinând:
   - Promptul de bază
   - Datele instituției
   - Contextul RAG găsit
   - Istoricul conversației
5. **Trimitere către LLM**: Se trimite request-ul către Ollama cu promptul generat
6. **Salvare răspuns**: Răspunsul se salvează în istoricul conversației (izolat per tenant)

## Securitate și Izolare

### Garantii de Izolare
1. **Date separate**: Fiecare tenant are propriile fișiere de config și documente
2. **Vector stores separate**: Fiecare tenant are propriul vector store
3. **Istoric izolat**: Conversațiile sunt izolate la nivel de tenant
4. **Validare tenant_id**: Toate operațiunile verifică tenant_id pentru a preveni accesul cross-tenant

### Best Practices
- Nu expune tenant_id-uri în URL-uri publice (folosește chat_id)
- Validează întotdeauna tenant_id înainte de accesarea datelor
- Folosește cache pentru performanță, dar invalidează-l când se modifică datele

## Configurare și Utilizare

### Creare Tenant Nou
1. Accesează panoul de administrare: `http://localhost:3000/admin`
2. Creează un chat nou folosind builder-ul existent sau direct prin API
3. Configurează datele instituției
4. Încarcă documentele RAG
5. Personalizează promptul și setările UI

### Actualizare Date Instituție
1. Selectează tenant-ul din panoul de administrare
2. Click pe "Editează Date Instituție"
3. Completează informațiile (nume, contact, program, servicii, taxe, etc.)
4. Salvează modificările

### Adăugare Documente RAG
1. Selectează tenant-ul
2. În secțiunea "Documente RAG", click pe "Încarcă document"
3. Selectează fișierul (PDF, TXT, MD, DOC, DOCX)
4. Fișierul va fi procesat automat și adăugat în vector store

## Structura Fișierelor

```
chatAI/
├── configs/                    # Configurări per tenant
│   └── {chat_id}.json
├── rag/                       # Documente RAG per tenant
│   └── {chat_id}/
│       └── *.pdf, *.txt, etc.
├── vector_stores/             # Vector stores per tenant
│   └── {tenant_id}/
│       ├── embeddings.pkl
│       └── metadata.json
├── rag_manager.py             # Gestionare vector stores
├── prompt_builder.py          # Generare prompturi dinamice
├── main.py                    # Backend FastAPI
└── app/
    └── admin/
        ├── page.tsx           # Panou administrare
        └── Admin.module.css
```

## Exemple de Utilizare

### Exemplu 1: Primăria A
- **Tenant ID**: `primaria-a-abc123`
- **Instituție**: Primăria Orașului A
- **Servicii**: Eliberare certificate, programări, sesizări
- **Documente RAG**: Hotărâri consiliu, formulare, ghiduri
- **Prompt**: "Ești asistentul digital al Primăriei Orașului A..."

### Exemplu 2: Școala B
- **Tenant ID**: `scoala-b-def456`
- **Instituție**: Școala Gimnazială B
- **Servicii**: Înscrieri, programe, activități
- **Documente RAG**: Regulamente, programe de studiu, formulare
- **Prompt**: "Ești asistentul digital al Școlii Gimnaziale B..."

Fiecare chatbot funcționează complet independent, folosind același model LLM dar cu date și instrucțiuni complet diferite.

## Note Tehnice

### Embeddings
- Model default: `nomic-embed-text` (configurabil prin `EMBEDDING_MODEL`)
- Fallback: Hash-based similarity dacă embeddings nu sunt disponibile
- Dimensiune vector: 128 (fallback) sau dimensiunea modelului de embeddings

### Performanță
- Cache pentru config-uri (se invalidează automat la modificare)
- Chunk-uri de text pentru documente mari
- Limitare context pentru a evita depășirea token limit-ului

### Scalabilitate
- Vector stores pot fi migrate la soluții externe (ChromaDB, Pinecone, etc.)
- Istoricul conversațiilor poate fi migrat la baze de date persistente
- Config-urile pot fi migrate la baze de date NoSQL

