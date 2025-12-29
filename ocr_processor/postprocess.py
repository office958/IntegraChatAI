"""
Post-procesare text OCR pentru corecție automată și identificare date lipsă.
"""

from typing import Dict, Any, List, Tuple, Optional
from core.config import ollama


def _get_default_model() -> str:
    """Obține modelul default din config sau folosește qwen2.5:7b ca fallback"""
    try:
        from core.cache import get_cached_config
        # Încearcă să obțină modelul din primul chat disponibil (sau folosește default)
        # Pentru simplitate, folosim modelul default
        return "qwen2.5:7b"
    except:
        return "qwen2.5:7b"


def correct_ocr_text(ocr_text: str, context: Optional[str] = None, model: Optional[str] = None) -> Dict[str, Any]:
    """
    Corectează textul OCR folosind LLM și identifică datele lipsă.
    
    Args:
        ocr_text: Textul extras prin OCR
        context: Context suplimentar (ex: tipul documentului)
        model: Modelul Ollama de folosit
    
    Returns:
        Dict cu:
        - corrected_text: Textul corectat
        - corrections: Lista de corecții făcute
        - missing_data: Lista de date care lipsesc
        - confidence: Nivel de încredere în corecții
    """
    context_part = f"\n\nContext: {context}" if context else ""
    
    prompt = f"""Analizează următorul text extras prin OCR dintr-un document administrativ și:
1. Corectează erorile de recunoaștere OCR (ex: "0" în loc de "O", "1" în loc de "I", etc.)
2. Identifică ce date importante lipsesc sau nu au putut fi extrase corect
3. Sugerează corecții pentru cuvintele greșit recunoscute

Text OCR:
{ocr_text}
{context_part}

Răspunde în format JSON:
{{
  "corrected_text": "textul corectat complet",
  "corrections": [
    {{
      "original": "text greșit",
      "corrected": "text corect",
      "reason": "explicație scurtă"
    }}
  ],
  "missing_data": [
    {{
      "field": "nume câmp",
      "description": "descriere ce lipsește",
      "suggested_question": "întrebare pentru utilizator"
    }}
  ],
  "confidence": 0.0-1.0
}}

Răspuns (doar JSON):"""
    
    try:
        messages = [{"role": "user", "content": prompt}]
        response = ollama.chat(
            model=model,
            messages=messages,
            options={
                "temperature": 0.3,  # Determinist pentru corecții precise
                "num_predict": 2000
            }
        )
        
        # Handle both dict and Pydantic model responses
        if hasattr(response, 'message'):
            if hasattr(response.message, 'content'):
                response_text = response.message.content.strip()
            elif isinstance(response.message, dict):
                response_text = response.message.get("content", "").strip()
            else:
                response_text = str(response.message).strip()
        elif isinstance(response, dict):
            response_text = response.get("message", {}).get("content", "").strip()
        else:
            response_text = str(response).strip()
        
        # Extrage JSON din răspuns
        json_text = _extract_json_from_response(response_text)
        
        if json_text:
            import json
            return json.loads(json_text)
        else:
            # Fallback: returnează textul original cu corecții minime
            return {
                "corrected_text": ocr_text,
                "corrections": [],
                "missing_data": [],
                "confidence": 0.5
            }
    except Exception as e:
        print(f"⚠️ Eroare la corectarea textului OCR: {e}")
        return {
            "corrected_text": ocr_text,
            "corrections": [],
            "missing_data": [],
            "confidence": 0.0
        }


def identify_missing_fields(
    ocr_text: str,
    expected_fields: List[str],
    context: Optional[str] = None,
    model: Optional[str] = None
) -> Dict[str, Any]:
    """
    Identifică ce câmpuri lipsesc din textul OCR comparativ cu câmpurile așteptate.
    
    Args:
        ocr_text: Textul extras prin OCR
        expected_fields: Lista de câmpuri așteptate (ex: ["nume", "prenume", "cnp", "adresa"])
        context: Context suplimentar
        model: Modelul Ollama de folosit
    
    Returns:
        Dict cu:
        - found_fields: Câmpuri găsite în text
        - missing_fields: Câmpuri care lipsesc
        - suggestions: Sugestii pentru a obține datele lipsă
    """
    # Folosește modelul furnizat sau default
    if not model:
        model = _get_default_model()
    
    context_part = f"\n\nContext: {context}" if context else ""
    fields_list = ", ".join(expected_fields)
    
    prompt = f"""Analizează următorul text extras prin OCR și identifică ce câmpuri sunt prezente și ce lipsesc.

Câmpuri așteptate: {fields_list}

Text OCR:
{ocr_text}
{context_part}

Răspunde în format JSON:
{{
  "found_fields": [
    {{
      "field": "nume câmp",
      "value": "valoare găsită",
      "confidence": 0.0-1.0
    }}
  ],
  "missing_fields": [
    {{
      "field": "nume câmp",
      "reason": "de ce lipsește",
      "suggested_question": "întrebare pentru utilizator"
    }}
  ],
  "suggestions": "sugestii generale pentru a obține datele lipsă"
}}

Răspuns (doar JSON):"""
    
    try:
        messages = [{"role": "user", "content": prompt}]
        response = ollama.chat(
            model=model,
            messages=messages,
            options={
                "temperature": 0.2,
                "num_predict": 1500
            }
        )
        
        # Handle both dict and Pydantic model responses
        if hasattr(response, 'message'):
            if hasattr(response.message, 'content'):
                response_text = response.message.content.strip()
            elif isinstance(response.message, dict):
                response_text = response.message.get("content", "").strip()
            else:
                response_text = str(response.message).strip()
        elif isinstance(response, dict):
            response_text = response.get("message", {}).get("content", "").strip()
        else:
            response_text = str(response).strip()
        json_text = _extract_json_from_response(response_text)
        
        if json_text:
            import json
            return json.loads(json_text)
        else:
            return {
                "found_fields": [],
                "missing_fields": [{"field": f, "reason": "Nu găsit în text", "suggested_question": f"Vă rugăm să furnizați {f}"} for f in expected_fields],
                "suggestions": "Verificați documentul și furnizați datele lipsă manual."
            }
    except Exception as e:
        print(f"⚠️ Eroare la identificarea câmpurilor lipsă: {e}")
        return {
            "found_fields": [],
            "missing_fields": [{"field": f, "reason": "Eroare la procesare", "suggested_question": f"Vă rugăm să furnizați {f}"} for f in expected_fields],
            "suggestions": "Eroare la procesare. Furnizați datele manual."
        }


def _extract_json_from_response(response_text: str) -> Optional[str]:
    """
    Extrage JSON din răspunsul LLM (poate conține text înainte/după JSON).
    """
    # Caută bloc JSON (începe cu { și se termină cu })
    start_idx = response_text.find('{')
    if start_idx == -1:
        return None
    
    # Găsește ultimul } care închide JSON-ul
    brace_count = 0
    end_idx = -1
    
    for i in range(start_idx, len(response_text)):
        if response_text[i] == '{':
            brace_count += 1
        elif response_text[i] == '}':
            brace_count -= 1
            if brace_count == 0:
                end_idx = i + 1
                break
    
    if end_idx > start_idx:
        return response_text[start_idx:end_idx]
    
    return None

