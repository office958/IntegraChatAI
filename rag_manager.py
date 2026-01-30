"""
Modul pentru gestionarea RAG-ului cu vector store izolat per tenant.
Folosește Ollama embeddings pentru semantic search.
"""
import os
import json
import pickle
import numpy as np
from typing import List, Dict, Optional, Tuple
from ollama import Client
import hashlib

# Conectare la Ollama pentru embeddings cu fallback automat
from core.config import get_ollama_client
OLLAMA_HOST = os.getenv('OLLAMA_HOST', '127.0.0.1:11434')  # Folosim 127.0.0.1 în loc de localhost pentru viteză
ollama = get_ollama_client(OLLAMA_HOST)

# Model pentru embeddings (folosește același model ca pentru chat sau unul specializat)
EMBEDDING_MODEL = os.getenv('EMBEDDING_MODEL', 'nomic-embed-text')  # Model optimizat pentru embeddings
DEFAULT_CHAT_MODEL = os.getenv('DEFAULT_CHAT_MODEL', 'qwen2.5:7b')  # Model default pentru chat

# Lista de modele de embeddings de încercat (în ordine de preferință)
EMBEDDING_MODELS_TO_TRY = [
    'nomic-embed-text',
    'all-minilm',
    'mxbai-embed-large',
    'bge-large',
]

# Cache pentru modelul de embeddings validat
_validated_embedding_model = None

# Director pentru stocarea vector stores per tenant
VECTOR_STORE_DIR = "vector_stores"

def get_tenant_vector_store_path(tenant_id: str) -> str:
    """Returnează calea către vector store-ul unui tenant"""
    return os.path.join(VECTOR_STORE_DIR, tenant_id)

def _find_available_embedding_model() -> Optional[str]:
    """
    Găsește primul model de embeddings disponibil din lista de modele.
    Returnează None dacă nu găsește niciunul.
    """
    global _validated_embedding_model
    
    # Dacă deja am validat un model, îl folosim
    if _validated_embedding_model:
        return _validated_embedding_model
    
    # Listează modelele disponibile
    try:
        models_response = ollama.list()
        available_models = []
        
        # Extrage numele modelelor din răspuns (poate fi Pydantic model, dict sau list)
        models_list = []
        if hasattr(models_response, 'models'):
            models_list = models_response.models
        elif isinstance(models_response, dict) and 'models' in models_response:
            models_list = models_response['models']
        elif isinstance(models_response, list):
            models_list = models_response
        
        # Extrage numele modelului corect (poate fi atribut, dict key sau string)
        for m in models_list:
            model_name = None
            if isinstance(m, dict):
                model_name = m.get('name') or m.get('model')
            elif hasattr(m, 'name'):
                model_name = m.name
            elif hasattr(m, 'model'):
                model_name = m.model
            elif isinstance(m, str):
                model_name = m
            
            if model_name:
                available_models.append(model_name)
        
        # Caută primul model de embeddings disponibil
        for model_name_to_find in EMBEDDING_MODELS_TO_TRY:
            # Verifică dacă modelul există (poate fi cu sau fără tag)
            for available_name in available_models:
                # Verifică dacă numele modelului se potrivește (cu sau fără tag)
                if available_name == model_name_to_find or available_name.startswith(model_name_to_find + ':'):
                    _validated_embedding_model = available_name
                    print(f"✅ Model de embeddings găsit: {available_name}")
                    return available_name
        
        # Dacă nu găsește un model de embeddings, încearcă să folosească modelul de chat
        for available_name in available_models:
            if available_name == DEFAULT_CHAT_MODEL or available_name.startswith(DEFAULT_CHAT_MODEL + ':'):
                _validated_embedding_model = available_name
                print(f"⚠️ Nu s-a găsit model de embeddings dedicat, folosind modelul de chat: {available_name}")
                print(f"💡 Pentru performanță mai bună, instalează un model de embeddings: ollama pull nomic-embed-text")
                return available_name
                
    except Exception as e:
        print(f"⚠️ Eroare la listarea modelelor Ollama: {e}")
    
    return None

def get_embedding(text: str) -> List[float]:
    """
    Obține embedding-ul pentru un text folosind Ollama.
    Dacă modelul de embeddings nu este disponibil, folosește un fallback.
    """
    global _validated_embedding_model
    
    # Găsește un model disponibil
    model_to_use = _validated_embedding_model or _find_available_embedding_model()
    
    # Dacă nu găsește niciun model, folosește modelul configurat sau default
    if not model_to_use:
        model_to_use = EMBEDDING_MODEL
    
    # Încearcă să obțină embedding-ul
    try:
        response = ollama.embeddings(model=model_to_use, prompt=text)
        if response and 'embedding' in response:
            embedding = response['embedding']
            # Verifică că embedding-ul este valid
            if embedding and len(embedding) > 0:
                return embedding
    except Exception as e:
        # Dacă modelul configurat nu funcționează, încearcă să găsească altul
        if model_to_use == EMBEDDING_MODEL:
            print(f"⚠️ Modelul {EMBEDDING_MODEL} nu este disponibil: {e}")
            # Resetează cache-ul și încearcă să găsească alt model
            _validated_embedding_model = None
            model_to_use = _find_available_embedding_model()
            
            if model_to_use and model_to_use != EMBEDDING_MODEL:
                try:
                    response = ollama.embeddings(model=model_to_use, prompt=text)
                    if response and 'embedding' in response:
                        embedding = response['embedding']
                        if embedding and len(embedding) > 0:
                            return embedding
                except Exception as e2:
                    print(f"⚠️ Eroare și cu modelul alternativ {model_to_use}: {e2}")
        else:
            print(f"⚠️ Eroare la obținerea embedding-ului cu {model_to_use}: {e}")
    
    # Mesaj informativ despre instalarea modelului
    if not _validated_embedding_model or _validated_embedding_model == EMBEDDING_MODEL:
        print(f"💡 Pentru embeddings semantice, instalează un model: ollama pull {EMBEDDING_MODEL}")
        print("💡 Folosind fallback: hash-based similarity (nu este semantic)")
    
    # Fallback: folosește hash pentru simplitate (nu este semantic, dar funcționează)
    # În producție, ar trebui să folosești un model de embeddings real
    # Folosim dimensiunea standard de 768 pentru a se potrivi cu majoritatea modelelor
    hash_obj = hashlib.md5(text.encode())
    hash_bytes = hash_obj.digest()
    # Generează un vector de 768 dimensiuni (standard pentru multe modele)
    # Repetă hash-ul pentru a obține dimensiunea dorită
    vector = []
    target_dim = 768  # Dimensiune standard pentru compatibilitate
    while len(vector) < target_dim:
        for byte in hash_bytes:
            vector.append(float(byte) / 255.0)
            if len(vector) >= target_dim:
                break
        # Dacă nu am ajuns la dimensiunea dorită, extinde hash-ul
        if len(vector) < target_dim:
            hash_obj.update(text.encode())
            hash_bytes = hash_obj.digest()
    
    return vector[:target_dim]

def cosine_similarity(vec1: List[float], vec2: List[float]) -> float:
    """Calculează similaritatea cosinus între doi vectori"""
    vec1 = np.array(vec1)
    vec2 = np.array(vec2)
    dot_product = np.dot(vec1, vec2)
    norm1 = np.linalg.norm(vec1)
    norm2 = np.linalg.norm(vec2)
    if norm1 == 0 or norm2 == 0:
        return 0.0
    return float(dot_product / (norm1 * norm2))

class TenantRAGStore:
    """Stocare RAG izolată per tenant cu vector store"""
    
    def __init__(self, tenant_id: str):
        self.tenant_id = tenant_id
        self.store_path = get_tenant_vector_store_path(tenant_id)
        self.embeddings_file = os.path.join(self.store_path, "embeddings.pkl")
        self.metadata_file = os.path.join(self.store_path, "metadata.json")
        
        # Încarcă datele existente
        self.embeddings: List[List[float]] = []
        self.metadata: List[Dict] = []  # [{filename, content, chunk_index}, ...]
        
        self._load_store()
    
    def _load_store(self):
        """Încarcă vector store-ul din disk"""
        os.makedirs(self.store_path, exist_ok=True)
        
        if os.path.exists(self.embeddings_file) and os.path.exists(self.metadata_file):
            try:
                with open(self.embeddings_file, 'rb') as f:
                    self.embeddings = pickle.load(f)
                with open(self.metadata_file, 'r', encoding='utf-8') as f:
                    self.metadata = json.load(f)
                print(f"✅ Vector store încărcat pentru tenant {self.tenant_id}: {len(self.embeddings)} documente")
            except Exception as e:
                print(f"⚠️ Eroare la încărcarea vector store pentru {self.tenant_id}: {e}")
                self.embeddings = []
                self.metadata = []
    
    def _save_store(self):
        """Salvează vector store-ul pe disk"""
        os.makedirs(self.store_path, exist_ok=True)
        
        try:
            with open(self.embeddings_file, 'wb') as f:
                pickle.dump(self.embeddings, f)
            with open(self.metadata_file, 'w', encoding='utf-8') as f:
                json.dump(self.metadata, f, ensure_ascii=False, indent=2)
            print(f"✅ Vector store salvat pentru tenant {self.tenant_id}")
        except Exception as e:
            print(f"❌ Eroare la salvarea vector store pentru {self.tenant_id}: {e}")
    
    def _chunk_text(self, text: str, chunk_size: int = 1000, overlap: int = 200) -> List[str]:
        """Împarte textul în chunk-uri pentru o indexare mai bună"""
        if len(text) <= chunk_size:
            return [text]
        
        chunks = []
        start = 0
        while start < len(text):
            end = start + chunk_size
            chunk = text[start:end]
            chunks.append(chunk)
            start = end - overlap  # Overlap pentru context
        
        return chunks
    
    def add_document(self, filename: str, content: str):
        """
        Adaugă un document în vector store.
        Dacă documentul există deja, îl înlocuiește.
        """
        # Șterge documentul existent dacă există
        self.remove_document(filename)
        
        # Împarte în chunk-uri
        chunks = self._chunk_text(content)
        
        # Generează embeddings pentru fiecare chunk
        for chunk_idx, chunk in enumerate(chunks):
            embedding = get_embedding(chunk)
            self.embeddings.append(embedding)
            self.metadata.append({
                "filename": filename,
                "content": chunk,
                "chunk_index": chunk_idx,
                "total_chunks": len(chunks)
            })
        
        self._save_store()
        print(f"✅ Document {filename} adăugat în vector store pentru tenant {self.tenant_id} ({len(chunks)} chunk-uri)")
    
    def remove_document(self, filename: str):
        """Șterge un document din vector store"""
        initial_count = len(self.embeddings)
        
        # Găsește toate chunk-urile pentru acest document
        indices_to_remove = [
            i for i, meta in enumerate(self.metadata)
            if meta.get("filename") == filename
        ]
        
        # Șterge în ordine inversă pentru a nu afecta indicii
        for idx in reversed(indices_to_remove):
            self.embeddings.pop(idx)
            self.metadata.pop(idx)
        
        if len(self.embeddings) < initial_count:
            self._save_store()
            print(f"✅ Document {filename} șters din vector store pentru tenant {self.tenant_id}")
    
    def search(self, query: str, top_k: int = 5) -> List[Dict]:
        """
        Caută în vector store și returnează top_k rezultate relevante.
        Returnează: [{filename, content, score}, ...]
        OPTIMIZAT: Limitează la primele 30 embedding-uri pentru viteză maximă
        """
        if not self.embeddings:
            return []
        
        # OPTIMIZARE: Limitează la primele 30 embedding-uri pentru viteză maximă (era 50)
        max_embeddings_to_check = min(30, len(self.embeddings))
        
        # Generează embedding pentru query
        query_embedding = get_embedding(query)
        query_dim = len(query_embedding)
        
        # Verifică și aliniază dimensiunile embedding-urilor existente
        # OPTIMIZARE: Folosește doar primele max_embeddings_to_check pentru viteză
        valid_embeddings = []
        valid_indices = []
        
        for i, doc_embedding in enumerate(self.embeddings[:max_embeddings_to_check]):
            doc_dim = len(doc_embedding) if isinstance(doc_embedding, (list, np.ndarray)) else 0
            
            # Dacă dimensiunile nu se potrivesc, încearcă să le alinieze
            if doc_dim != query_dim:
                # Dacă embedding-ul documentului este mai mare, trunchiază
                if doc_dim > query_dim:
                    if isinstance(doc_embedding, np.ndarray):
                        doc_embedding = doc_embedding[:query_dim].tolist()
                    else:
                        doc_embedding = doc_embedding[:query_dim]
                # Dacă embedding-ul documentului este mai mic, pad cu zerouri
                elif doc_dim < query_dim:
                    if isinstance(doc_embedding, np.ndarray):
                        padding = np.zeros(query_dim - doc_dim)
                        doc_embedding = np.concatenate([doc_embedding, padding]).tolist()
                    else:
                        doc_embedding = list(doc_embedding) + [0.0] * (query_dim - doc_dim)
            
            # Verifică că dimensiunile se potrivesc acum
            if len(doc_embedding) == query_dim:
                valid_embeddings.append(doc_embedding)
                valid_indices.append(i)
            else:
                print(f"⚠️ Skip embedding {i}: dimensiuni nealiniate (doc: {len(doc_embedding)}, query: {query_dim})")
        
        if not valid_embeddings:
            print(f"⚠️ Nu există embedding-uri valide pentru search (query dim: {query_dim})")
            return []
        
        # Calculează similarități doar pentru embedding-urile valide (optimizat cu numpy)
        try:
            # Convert to numpy arrays pentru viteză maximă
            query_vec = np.array(query_embedding, dtype=np.float32)
            doc_vecs = np.array(valid_embeddings, dtype=np.float32)
            
            # Calcul vectorizat pentru toate embedding-urile simultan (mult mai rapid)
            dot_products = np.dot(doc_vecs, query_vec)
            query_norm = np.linalg.norm(query_vec)
            doc_norms = np.linalg.norm(doc_vecs, axis=1)
            
            # Evită împărțirea la zero
            norms = query_norm * doc_norms
            norms[norms == 0] = 1.0
            
            similarities = dot_products / norms
            similarities = [(valid_indices[i], float(sim)) for i, sim in enumerate(similarities)]
        except Exception as e:
            # Fallback la metoda veche dacă numpy vectorizat eșuează
            print(f"⚠️ Eroare la calcul vectorizat, folosind fallback: {e}")
            similarities = []
            for idx, doc_embedding in zip(valid_indices, valid_embeddings):
                try:
                    similarity = cosine_similarity(query_embedding, doc_embedding)
                    similarities.append((idx, similarity))
                except Exception as e2:
                    continue
        
        # Sortează după similaritate
        similarities.sort(key=lambda x: x[1], reverse=True)
        
        # Returnează top_k rezultate
        results = []
        seen_files = set()  # Pentru a evita duplicatele
        
        for idx, score in similarities[:top_k * 3]:  # Luăm mai multe pentru a filtra duplicatele
            meta = self.metadata[idx]
            filename = meta.get("filename", "unknown")
            
            # Adaugă doar dacă nu am văzut deja acest fișier sau dacă avem puține rezultate
            if filename not in seen_files or len(results) < top_k:
                results.append({
                    "filename": filename,
                    "content": meta.get("content", ""),
                    "score": score,
                    "chunk_index": meta.get("chunk_index", 0),
                    "total_chunks": meta.get("total_chunks", 1)
                })
                seen_files.add(filename)
            
            if len(results) >= top_k:
                break
        
        return results
    
    def get_all_documents(self) -> List[Dict]:
        """Returnează toate documentele (fără duplicate)"""
        seen = set()
        documents = []
        
        for meta in self.metadata:
            filename = meta.get("filename", "unknown")
            if filename not in seen:
                # Colectează toate chunk-urile pentru acest document
                chunks = [
                    m.get("content", "")
                    for m in self.metadata
                    if m.get("filename") == filename
                ]
                documents.append({
                    "filename": filename,
                    "content": "\n\n".join(chunks)  # Reconstituie documentul complet
                })
                seen.add(filename)
        
        return documents
    
    def clear(self):
        """Șterge tot vector store-ul"""
        self.embeddings = []
        self.metadata = []
        self._save_store()
        print(f"✅ Vector store șters pentru tenant {self.tenant_id}")

# Cache pentru store-uri per tenant
_tenant_stores: Dict[str, TenantRAGStore] = {}

def get_tenant_rag_store(tenant_id: str) -> TenantRAGStore:
    """Obține sau creează vector store-ul pentru un tenant"""
    if tenant_id not in _tenant_stores:
        _tenant_stores[tenant_id] = TenantRAGStore(tenant_id)
    return _tenant_stores[tenant_id]

