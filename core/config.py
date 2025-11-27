import os
from ollama import Client

# Încarcă variabilele de mediu din .env
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    print("⚠️ python-dotenv nu este instalat. Pentru a folosi .env, rulează: pip install python-dotenv")

# Conectare la Ollama - citeste IP-ul din variabilele de mediu
OLLAMA_HOST = os.getenv('OLLAMA_HOST', 'localhost:11434')
ollama = Client(host=OLLAMA_HOST)

# JWT Configuration
JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY', 'your-secret-key-change-in-production')
JWT_ALGORITHM = os.getenv('JWT_ALGORITHM', 'HS256')
JWT_EXPIRATION_HOURS = int(os.getenv('JWT_EXPIRATION_HOURS', str(24 * 7)))  # Default: 7 zile

# Dimensiune maximă context window (în tokens aproximativi, folosim caractere ca proxy)
# Pentru majoritatea modelelor, ~4 caractere = 1 token
MAX_CONTEXT_CHARS = int(os.getenv('MAX_CONTEXT_CHARS', '32000'))  # ~8000 tokens (ajustabil în funcție de model)
CONTEXT_RESERVE = int(os.getenv('CONTEXT_RESERVE', '2000'))  # Rezervă pentru system prompt și mesajul curent

# Verifică disponibilitatea PDF
try:
    import PyPDF2
    PDF_AVAILABLE = True
except ImportError:
    PDF_AVAILABLE = False
    print("⚠️ PyPDF2 nu este instalat. Rulează: pip install PyPDF2")

# Verifică disponibilitatea OCR
try:
    import pytesseract
    from PIL import Image
    import platform
    
    # Verifică dacă Tesseract este disponibil
    try:
        pytesseract.get_tesseract_version()
        OCR_AVAILABLE = True
        print("✅ OCR disponibil - Tesseract funcționează")
    except Exception as tess_error:
        # Încearcă să configureze calea Tesseract (doar pe Windows, dacă nu e în PATH)
        if platform.system() == 'Windows':
            possible_paths = [
                r'C:\Program Files\Tesseract-OCR\tesseract.exe',
                r'C:\Program Files (x86)\Tesseract-OCR\tesseract.exe',
            ]
            tesseract_found = False
            for path in possible_paths:
                if os.path.exists(path):
                    pytesseract.pytesseract.tesseract_cmd = path
                    try:
                        pytesseract.get_tesseract_version()
                        print(f"✅ Tesseract găsit și configurat la: {path}")
                        OCR_AVAILABLE = True
                        tesseract_found = True
                        break
                    except:
                        continue
            
            if not tesseract_found:
                OCR_AVAILABLE = False
                print(f"⚠️ Tesseract nu este disponibil. Eroare: {str(tess_error)}")
                print("💡 Instalează Tesseract OCR de la: https://github.com/UB-Mannheim/tesseract/wiki")
        else:
            OCR_AVAILABLE = False
            print(f"⚠️ Tesseract nu este disponibil. Eroare: {str(tess_error)}")
            print("💡 Instalează Tesseract OCR: sudo apt-get install tesseract-ocr (Linux) sau brew install tesseract (macOS)")
            
except ImportError:
    OCR_AVAILABLE = False
    print("⚠️ OCR nu este disponibil. Rulează: pip install pytesseract pillow")
except Exception as e:
    OCR_AVAILABLE = False
    print(f"⚠️ OCR nu este disponibil. Eroare: {str(e)}")

