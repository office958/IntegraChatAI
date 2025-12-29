"""
Singleton pentru OCRProcessor pentru a evita reinițializarea modelelor PaddleOCR.
"""

from typing import Optional
from .processor import OCRProcessor, PADDLEOCR_AVAILABLE, OPENCV_AVAILABLE

# Cache pentru instanțe OCRProcessor (per limbă)
_processor_cache: dict[str, OCRProcessor] = {}


def get_ocr_processor(lang: str = 'ro') -> Optional[OCRProcessor]:
    """
    Obține o instanță OCRProcessor (singleton per limbă).
    Dacă nu există, o creează și o cache-uiește.
    
    Args:
        lang: Limba pentru OCR (default: 'ro')
    
    Returns:
        OCRProcessor instance sau None dacă nu este disponibil
    """
    if not PADDLEOCR_AVAILABLE or not OPENCV_AVAILABLE:
        return None
    
    # Verifică dacă există deja în cache
    if lang in _processor_cache:
        return _processor_cache[lang]
    
    # Creează o nouă instanță și o adaugă în cache
    try:
        processor = OCRProcessor(lang=lang)
        _processor_cache[lang] = processor
        print(f"✅ OCRProcessor inițializat pentru limba '{lang}' (cache)")
        return processor
    except Exception as e:
        print(f"⚠️ Eroare la inițializarea OCRProcessor pentru limba '{lang}': {e}")
        return None


def clear_cache():
    """Șterge cache-ul de procesori OCR."""
    global _processor_cache
    _processor_cache.clear()
    print("🗑️ Cache OCRProcessor șters")

