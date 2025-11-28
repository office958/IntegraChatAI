"""
Script de test pentru extragerea textului din imagini
Rulează: python test_image_extraction.py
"""
import sys
import os

# Adaugă directorul rădăcină la path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from core.config import OCR_AVAILABLE, PDF_AVAILABLE
from PIL import Image
import pytesseract

print("=" * 60)
print("TEST CONFIGURAȚIE EXTRAGERE TEXT")
print("=" * 60)

print(f"\n📄 PDF disponibil: {PDF_AVAILABLE}")
print(f"📸 OCR disponibil: {OCR_AVAILABLE}")

if OCR_AVAILABLE:
    try:
        version = pytesseract.get_tesseract_version()
        print(f"✅ Tesseract versiune: {version}")
    except Exception as e:
        print(f"❌ Tesseract nu funcționează: {e}")
        print("💡 Instalează Tesseract OCR de la: https://github.com/UB-Mannheim/tesseract/wiki")
        sys.exit(1)
    
    # Testează dacă limba română este disponibilă
    try:
        langs = pytesseract.get_languages()
        print(f"📚 Limbi disponibile: {', '.join(langs[:10])}...")
        if 'ron' in langs:
            print("✅ Limba română (ron) este disponibilă")
        else:
            print("⚠️ Limba română (ron) NU este disponibilă")
            print("💡 Instalează pachetul de limbi română pentru Tesseract")
    except Exception as e:
        print(f"⚠️ Nu s-a putut verifica limbile: {e}")

print("\n" + "=" * 60)
print("Test finalizat!")
print("=" * 60)

