from typing import Optional
from database import (
    get_conversation_history as db_get_conversation_history,
    add_message_to_conversation as db_add_message_to_conversation,
    clear_conversation_history as db_clear_conversation_history
)
from core.config import MAX_CONTEXT_CHARS, CONTEXT_RESERVE

# Stocare istoric conversații (keyed by tenant_id/chat_id)
# Format: {tenant_id: {chat_id: [{"role": "user/assistant", "content": "..."}, ...]}}
# Asigură izolarea completă între tenant-i
_conversation_history = {}

# Funcție helper pentru a obține tenant_id din chat_id
def get_tenant_id_from_chat_id(chat_id: str) -> str:
    """
    Extrage tenant_id din chat_id.
    În structura actuală, chat_id este deja identificatorul tenant-ului.
    Pentru compatibilitate, folosim chat_id ca tenant_id.
    """
    return chat_id

def estimate_tokens(text: str) -> int:
    """Estimează numărul de tokens (aproximativ: ~4 caractere = 1 token)"""
    return len(text) // 4

def trim_conversation_history(history: list, max_chars: int = MAX_CONTEXT_CHARS - CONTEXT_RESERVE) -> list:
    """
    Taie istoricul conversației din început dacă depășește limita.
    Păstrează întotdeauna ultimele mesaje (user + assistant).
    """
    if not history:
        return history
    
    # Calculează lungimea totală
    total_chars = sum(len(msg.get("content", "")) for msg in history)
    
    if total_chars <= max_chars:
        return history
    
    # Taie din început, dar păstrează cel puțin ultimele 2 mesaje (user + assistant)
    trimmed = []
    current_chars = 0
    
    # Pornește de la sfârșit și adaugă mesaje până când depășim limita
    for msg in reversed(history):
        msg_chars = len(msg.get("content", ""))
        if current_chars + msg_chars > max_chars and len(trimmed) >= 2:
            # Am adăugat deja cel puțin 2 mesaje, oprește-te
            break
        trimmed.insert(0, msg)
        current_chars += msg_chars
    
    # Dacă tot e prea lung, taie din începutul listei trunchiate
    while current_chars > max_chars and len(trimmed) > 2:
        removed = trimmed.pop(0)
        current_chars -= len(removed.get("content", ""))
    
    print(f"✂️ Istoric trunchiat: {len(history)} -> {len(trimmed)} mesaje ({current_chars} caractere)")
    return trimmed

def get_conversation_history(chat_id: str = None, session_id: int = None, user_id: int = None) -> list:
    """Obține istoricul conversației pentru un chat_id sau session_id din baza de date"""
    # Dacă avem session_id, folosim sesiunea (mod nou)
    if session_id:
        messages = db_get_conversation_history(chat_id=None, session_id=session_id, user_id=user_id)
        return messages
    
    # Dacă avem chat_id, folosim modul vechi (compatibilitate)
    if chat_id:
        # Încearcă să folosească cache-ul în memorie pentru performanță (opțional)
        tenant_id = get_tenant_id_from_chat_id(chat_id)
        if tenant_id in _conversation_history and chat_id in _conversation_history[tenant_id]:
            return _conversation_history[tenant_id][chat_id]
        
        # Încarcă din baza de date
        messages = db_get_conversation_history(chat_id=chat_id, session_id=None, user_id=user_id)
        
        # Salvează în cache pentru performanță
        if tenant_id not in _conversation_history:
            _conversation_history[tenant_id] = {}
        _conversation_history[tenant_id][chat_id] = messages
        
        return messages
    
    return []

def add_to_conversation_history(chat_id: str = None, session_id: int = None, role: str = None, content: str = None, user_id: int = None):
    """Adaugă un mesaj la istoricul conversației (salvează în DB și cache)"""
    # Salvează în baza de date
    db_add_message_to_conversation(session_id=session_id, chat_id=chat_id, role=role, content=content, user_id=user_id)
    
    # Actualizează cache-ul doar pentru modul vechi (chat_id fără session_id)
    if chat_id and not session_id:
        tenant_id = get_tenant_id_from_chat_id(chat_id)
        if tenant_id not in _conversation_history:
            _conversation_history[tenant_id] = {}
        if chat_id not in _conversation_history[tenant_id]:
            _conversation_history[tenant_id][chat_id] = []
    
        _conversation_history[tenant_id][chat_id].append({
        "role": role,
        "content": content
    })
    
    # Aplică limitarea contextului
        _conversation_history[tenant_id][chat_id] = trim_conversation_history(_conversation_history[tenant_id][chat_id])

def clear_conversation_history(chat_id: str, user_id: int = None):
    """Șterge istoricul conversației pentru un chat_id (din DB și cache)"""
    # Șterge din baza de date
    db_clear_conversation_history(chat_id, user_id)
    
    # Șterge din cache
    tenant_id = get_tenant_id_from_chat_id(chat_id)
    if tenant_id in _conversation_history and chat_id in _conversation_history[tenant_id]:
        del _conversation_history[tenant_id][chat_id]
        print(f"🗑️ Istoric șters pentru chat_id: {chat_id} (tenant: {tenant_id})")

def create_default_config(chat_id: str):
    """Creează un config default pentru un chat_id dacă nu există"""
    from core.cache import get_cached_config
    from database import create_client_chat
    
    # Verifică dacă deja există
    existing = get_cached_config(chat_id)
    if existing:
        return existing
    
    # Creează în baza de date
    chat_id_int = create_client_chat(
        name="Chat nou",
        model="gpt-oss:20b",
        prompt="Ești asistentul Integra AI. Răspunde clar și politicos la întrebările utilizatorilor.",
        chat_title="Chat nou",
        chat_subtitle="Asistentul tău inteligent pentru găsirea informațiilor",
        chat_color="#3b82f6"
    )
    
    if not chat_id_int:
        print(f"❌ Nu s-a putut crea config pentru {chat_id}")
        return None
    
    # Reîncarcă config-ul creat
    config = get_cached_config(str(chat_id_int))
    
    print(f"✅ Config default creat pentru chat_id: {chat_id_int}")
    return config

