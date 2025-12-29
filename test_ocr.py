"""
Script de test pentru sistemul OCR.
"""

import sys
import os

# Adaugă directorul curent la path
sys.path.insert(0, os.path.dirname(__file__))

def test_ocr_status():
    """Testează statusul componentelor OCR."""
    print("=" * 50)
    print("Test Status Componente OCR")
    print("=" * 50)
    
    try:
        from ocr_processor.processor import (
            PADDLEOCR_AVAILABLE,
            OPENCV_AVAILABLE,
            PDF2IMAGE_AVAILABLE,
            NUMPY_AVAILABLE,
            PIL_AVAILABLE
        )
        
        print(f"PaddleOCR: {'[OK] Disponibil' if PADDLEOCR_AVAILABLE else '[X] Nu este instalat'}")
        print(f"OpenCV: {'[OK] Disponibil' if OPENCV_AVAILABLE else '[X] Nu este instalat'}")
        print(f"NumPy: {'[OK] Disponibil' if NUMPY_AVAILABLE else '[X] Nu este instalat'}")
        print(f"Pillow: {'[OK] Disponibil' if PIL_AVAILABLE else '[X] Nu este instalat'}")
        print(f"pdf2image: {'[OK] Disponibil' if PDF2IMAGE_AVAILABLE else '[X] Nu este instalat'}")
        
        if PADDLEOCR_AVAILABLE and OPENCV_AVAILABLE and NUMPY_AVAILABLE:
            print("\n[OK] Sistemul OCR este gata de utilizare!")
            return True
        else:
            print("\n[X] Sistemul OCR nu este complet configurat.")
            return False
            
    except Exception as e:
        print(f"[ERROR] Eroare la verificarea statusului: {e}")
        return False


def test_ocr_processor():
    """Testeaza initializarea procesorului OCR."""
    print("\n" + "=" * 50)
    print("Test Initializare OCRProcessor")
    print("=" * 50)
    
    try:
        from ocr_processor import OCRProcessor
        
        processor = OCRProcessor(lang='ro')
        print("[OK] OCRProcessor inițializat cu succes!")
        return True
        
    except ImportError as e:
        print(f"[ERROR] Eroare de import: {e}")
        return False
    except Exception as e:
        print(f"[ERROR] Eroare la initializare: {e}")
        return False


def test_preprocessing():
    """Testeaza functiile de preprocesare."""
    print("\n" + "=" * 50)
    print("Test Preprocesare")
    print("=" * 50)
    
    try:
        import numpy as np
        import cv2
        from ocr_processor import OCRProcessor
        
        processor = OCRProcessor(lang='ro')
        
        # Creează o imagine de test (alb cu text negru)
        test_image = np.ones((100, 200), dtype=np.uint8) * 255
        cv2.putText(test_image, 'Test', (50, 50), cv2.FONT_HERSHEY_SIMPLEX, 1, 0, 2)
        
        # Testează preprocesarea
        processed = processor.preprocess_image(test_image)
        
        print(f"[OK] Preprocesare functioneaza!")
        print(f"   Dimensiune originala: {test_image.shape}")
        print(f"   Dimensiune procesata: {processed.shape}")
        return True
        
    except Exception as e:
        print(f"[ERROR] Eroare la preprocesare: {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    print("\nTestare Sistem OCR\n")
    
    status_ok = test_ocr_status()
    
    if status_ok:
        test_ocr_processor()
        test_preprocessing()
    
    print("\n" + "=" * 50)
    print("Testare finalizata!")
    print("=" * 50)

