"""
Funcții pentru generarea automată a titlurilor pentru conversații
"""
from core.config import ollama
import re

async def generate_chat_title(user_message: str, assistant_response: str, max_length: int = 50) -> str:
    """
    Generează un titlu pentru conversație bazat pe primul mesaj și răspuns
    Similar cu ChatGPT - generează un titlu scurt și descriptiv
    """
    if not user_message or not assistant_response:
        return "Chat nou"
    
    # Limitează lungimea mesajelor pentru prompt
    user_msg_limited = user_message[:200] if len(user_message) > 200 else user_message
    assistant_msg_limited = assistant_response[:300] if len(assistant_response) > 300 else assistant_response
    
    # Construiește prompt-ul pentru generarea titlului
    title_prompt = f"""Generează un titlu scurt și descriptiv (maximum {max_length} caractere) pentru această conversație, bazat pe următoarele mesaje:

Utilizator: {user_msg_limited}
Asistent: {assistant_msg_limited}

Titlul trebuie să fie:
- Scurt și concis (maximum {max_length} caractere)
- Descriptiv pentru subiectul conversației
- În limba română
- Fără ghilimele sau puncte finale
- Doar text, fără emoji-uri

Răspunde DOAR cu titlul, fără explicații sau text suplimentar:"""

    try:
        # Folosește Ollama pentru a genera titlul
        response = ollama.chat(
            model="qwen2.5:7b",  # Sau alt model disponibil
            messages=[
                {"role": "user", "content": title_prompt}
            ],
            options={
                "temperature": 0.7,
                "top_p": 0.9,
                "num_predict": 50,  # Limitează la 50 tokens pentru titlu
            }
        )
        
        # Extrage titlul din răspuns
        title = response.get("message", {}).get("content", "").strip()
        
        # Curăță titlul - elimină ghilimele, puncte finale, etc.
        title = re.sub(r'^["\']|["\']$', '', title)  # Elimină ghilimele de la început/șfârșit
        title = re.sub(r'\.$', '', title)  # Elimină punctul final
        title = title.strip()
        
        # Limitează lungimea
        if len(title) > max_length:
            title = title[:max_length].rsplit(' ', 1)[0]  # Taie la ultimul cuvânt complet
        
        # Dacă titlul este gol sau prea scurt, folosește primul mesaj trunchiat
        if not title or len(title) < 3:
            title = user_message[:max_length].strip()
            if len(title) > max_length:
                title = title[:max_length].rsplit(' ', 1)[0]
        
        return title if title else "Chat nou"
        
    except Exception as e:
        print(f"⚠️ Eroare la generarea titlului: {e}")
        # Fallback: folosește primul mesaj trunchiat
        title = user_message[:max_length].strip()
        if len(title) > max_length:
            title = title[:max_length].rsplit(' ', 1)[0]
        return title if title else "Chat nou"

