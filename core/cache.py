from database import get_client_chat, get_rag_files

# Cache pentru config-uri (se reîncarcă automat când se modifică)
_config_cache = {}
_config_cache_timestamps = {}

def get_cached_config(chat_id: str):
    """Obține config-ul din cache sau din baza de date"""
    # Verifică cache-ul
    if chat_id in _config_cache:
        return _config_cache[chat_id]
    
    # Încarcă din baza de date
    db_config = get_client_chat(chat_id)
    if not db_config:
        return None
    
    # Încarcă conținutul RAG din baza de date
    client_chat_id = db_config.get("id")
    rag_files_db = get_rag_files(client_chat_id, include_content=True)
    
    # Construiește rag_content din baza de date
    rag_content = []
    for rf in rag_files_db:
        if rf.get("content"):
            rag_content.append({
                "filename": rf.get("file", ""),
                "content": rf.get("content", "")
            })
    
    # Convertește la formatul așteptat
    config = {
        "name": db_config.get("name", "Chat nou"),
        "tenant_id": str(db_config.get("id", chat_id)),
        "model": db_config.get("model", "qwen2.5:7b"),
        "prompt": db_config.get("prompt", ""),
        "chat_title": db_config.get("chat_title"),
        "chat_subtitle": db_config.get("chat_subtitle"),
        "chat_color": db_config.get("chat_color", "#3b82f6"),
        "rag_files": db_config.get("rag_files", []),
        "rag_content": rag_content,  # Conținutul RAG din baza de date
        "institution": db_config.get("institution"),
        "created_at": db_config.get("created_at"),
        "updated_at": db_config.get("updated_at"),
        "is_active": bool(db_config.get("is_active", True))
    }
    
    # Salvează în cache
    _config_cache[chat_id] = config
    
    return config

def invalidate_config_cache(chat_id: str):
    """Invalidează cache-ul pentru un chat_id"""
    if chat_id in _config_cache:
        del _config_cache[chat_id]
    if chat_id in _config_cache_timestamps:
        del _config_cache_timestamps[chat_id]

