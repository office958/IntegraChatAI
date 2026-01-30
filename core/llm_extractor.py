"""
Extractor de date din conversație folosind LLM
"""
import os
import json
import re
from typing import Dict, List, Optional
from ollama import Client

# Obține host-ul Ollama din variabile de mediu (același format ca în config.py)
from core.config import get_ollama_client
OLLAMA_HOST = os.getenv('OLLAMA_HOST', '127.0.0.1:11434')

def extract_data_from_conversation(
    conversation: List[Dict],
    field_keys: List[str],
    field_labels: List[str],
    model: str = 'qwen2.5:7b'
) -> Dict[str, str]:
    """Extrage date din conversație folosind LLM"""
    
    # Construiește descrierea câmpurilor
    fields_description = "\n".join([
        f"- {label} (cheie: {key}): folosește placeholder {{ $key }}"
        for key, label in zip(field_keys, field_labels)
    ])
    
    # Extrage ultimele mesaje relevante (maxim 15)
    conversation_text = "\n".join([
        f"{msg.get('role', 'user').upper()}: {msg.get('content', '')}"
        for msg in conversation[-15:]
    ])
    
    # Construiește prompt-ul
    prompt = f"""Extrage următoarele informații din conversația de mai jos.
Returnează DOAR un JSON valid, fără text suplimentar, fără explicații, fără markdown.

Câmpuri necesare:
{fields_description}

Conversație:
{conversation_text}

IMPORTANT: 
- Returnează DOAR JSON valid
- Folosește cheile exacte: {', '.join(field_keys)}
- Dacă o valoare nu este găsită, folosește string gol ""
- Nu adăuga text înainte sau după JSON
- Nu folosi markdown code blocks

JSON:"""
    
    try:
        # Apelează LLM cu fallback automat (optimizat pentru viteză)
        import os
        num_threads = int(os.getenv('OLLAMA_NUM_THREADS', '4'))
        client = get_ollama_client(OLLAMA_HOST)
        response = client.generate(
            model=model,
            prompt=prompt,
            options={
                'temperature': 0.1,  # Low temperature pentru răspunsuri deterministe
                'top_p': 0.85,  # Redus pentru viteză
                'top_k': 20,  # Adăugat pentru viteză
                'num_predict': 500,
                'num_thread': num_threads,  # Optimizare CPU
            }
        )
        
        response_text = response.get('response', '{}')
        
        # Curăță răspunsul (elimină markdown code blocks dacă există)
        response_text = re.sub(r'```json\s*', '', response_text)
        response_text = re.sub(r'```\s*', '', response_text)
        response_text = response_text.strip()
        
        # Extrage JSON din răspuns (poate conține text înainte/după)
        json_match = re.search(r'\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}', response_text, re.DOTALL)
        if json_match:
            try:
                extracted_data = json.loads(json_match.group())
                
                # Validează că toate cheile necesare sunt prezente
                result = {}
                for key in field_keys:
                    result[key] = extracted_data.get(key, "")
                
                print(f"✅ Date extrase cu LLM: {len([v for v in result.values() if v])} câmpuri completate")
                return result
            except json.JSONDecodeError as e:
                print(f"⚠️ Eroare la parsarea JSON: {e}")
                print(f"   Răspuns LLM: {response_text[:200]}")
        else:
            print(f"⚠️ Nu s-a găsit JSON în răspunsul LLM")
            print(f"   Răspuns: {response_text[:200]}")
        
    except Exception as e:
        print(f"❌ Eroare la extragerea datelor cu LLM: {e}")
        import traceback
        traceback.print_exc()
    
    # Fallback: returnează dict gol
    return {key: "" for key in field_keys}

def extract_data_for_template(
    conversation: List[Dict],
    template_variables: List[Dict],
    model: str = 'qwen2.5:7b'
) -> Dict[str, str]:
    """Extrage date pentru un template specific"""
    
    field_keys = [v.get('key') for v in template_variables]
    field_labels = [v.get('label', v.get('key')) for v in template_variables]
    
    return extract_data_from_conversation(conversation, field_keys, field_labels, model)

