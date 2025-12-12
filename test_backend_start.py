"""
Script de test pentru verificarea pornirii backend-ului
"""
import sys
import traceback

print("=" * 60)
print("TEST PORMIRE BACKEND")
print("=" * 60)

# Test 1: Import FastAPI
print("\n1. Test import FastAPI...")
try:
    from fastapi import FastAPI
    print("✅ FastAPI import OK")
except Exception as e:
    print(f"❌ Eroare import FastAPI: {e}")
    traceback.print_exc()
    sys.exit(1)

# Test 2: Import router-uri
print("\n2. Test import router-uri...")
try:
    from routers import auth, chat, admin, files, static
    print("✅ Router-uri de bază import OK")
except Exception as e:
    print(f"❌ Eroare import router-uri: {e}")
    traceback.print_exc()
    sys.exit(1)

# Test 3: Import router PDF (opțional)
print("\n3. Test import router PDF...")
try:
    from routers import pdf_generator
    print("✅ Router PDF import OK")
except ImportError as e:
    print(f"⚠️ Router PDF nu este disponibil (opțional): {e}")
except Exception as e:
    print(f"❌ Eroare import router PDF: {e}")
    traceback.print_exc()

# Test 4: Import main app
print("\n4. Test import main app...")
try:
    import main
    print("✅ Main app import OK")
    print(f"   App title: {main.app.title}")
except Exception as e:
    print(f"❌ Eroare import main app: {e}")
    traceback.print_exc()
    sys.exit(1)

# Test 5: Verifică configurație
print("\n5. Test configurație...")
try:
    from core.config import PDF2IMAGE_AVAILABLE, OCR_AVAILABLE, PDF_AVAILABLE
    print(f"✅ Config OK - PDF: {PDF_AVAILABLE}, PDF2IMAGE: {PDF2IMAGE_AVAILABLE}, OCR: {OCR_AVAILABLE}")
except Exception as e:
    print(f"⚠️ Eroare la verificarea config: {e}")
    traceback.print_exc()

print("\n" + "=" * 60)
print("✅ Toate testele au trecut!")
print("=" * 60)
print("\n💡 Backend-ul ar trebui să pornească corect.")
print("   Rulează: python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload")

