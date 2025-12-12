import os
from ollama import Client

# Incarca variabilele de mediu din .env
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    print("[WARNING] python-dotenv nu este instalat. Pentru a folosi .env, ruleaza: pip install python-dotenv")

# Conectare la Ollama - citeste IP-ul din variabilele de mediu
OLLAMA_HOST = os.getenv('OLLAMA_HOST', 'localhost:11434')
ollama = Client(host=OLLAMA_HOST)

# JWT Configuration
JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY', 'your-secret-key-change-in-production')
JWT_ALGORITHM = os.getenv('JWT_ALGORITHM', 'HS256')
JWT_EXPIRATION_HOURS = int(os.getenv('JWT_EXPIRATION_HOURS', str(24 * 7)))  # Default: 7 zile

# Dimensiune maxima context window (in tokens aproximativi, folosim caractere ca proxy)
# Pentru majoritatea modelelor, ~4 caractere = 1 token
MAX_CONTEXT_CHARS = int(os.getenv('MAX_CONTEXT_CHARS', '32000'))  # ~8000 tokens (ajustabil in functie de model)
CONTEXT_RESERVE = int(os.getenv('CONTEXT_RESERVE', '2000'))  # Rezerva pentru system prompt si mesajul curent

# Verifica disponibilitatea PDF
try:
    import PyPDF2
    PDF_AVAILABLE = True
except ImportError:
    PDF_AVAILABLE = False
    print("[WARNING] PyPDF2 nu este instalat. Ruleaza: pip install PyPDF2")

# Verifica disponibilitatea pdf2image si Poppler
PDF2IMAGE_AVAILABLE = False
try:
    from pdf2image import convert_from_bytes
    import platform
    
    # Pe Windows, verifica daca Poppler este in PATH sau in locatii comune
    if platform.system() == 'Windows':
        import subprocess
        poppler_found = False
        
        # Verifica daca pdftoppm este in PATH
        try:
            result = subprocess.run(['pdftoppm', '-v'], capture_output=True, timeout=2)
            if result.returncode == 0 or 'pdftoppm' in str(result.stderr) or 'pdftoppm' in str(result.stdout):
                poppler_found = True
                print("[OK] Poppler gasit in PATH")
        except:
            pass
        
        # Daca nu este in PATH, verifica locatiile comune
        if not poppler_found:
            possible_paths = [
                r'C:\poppler-23.11.0\Library\bin',  # Versiunea noua (poppler-windows)
            ]
            for poppler_path in possible_paths:
                if os.path.exists(poppler_path):
                    os.environ['PATH'] = poppler_path + os.pathsep + os.environ.get('PATH', '')
                    try:
                        result = subprocess.run(['pdftoppm', '-v'], capture_output=True, timeout=2)
                        if result.returncode == 0 or 'pdftoppm' in str(result.stderr) or 'pdftoppm' in str(result.stdout):
                            poppler_found = True
                            print("[OK] Poppler gasit si configurat la: " + poppler_path)
                            break
                    except:
                        continue
        
        if poppler_found:
            PDF2IMAGE_AVAILABLE = True
        else:
            print("[WARNING] Poppler nu este disponibil. PDF-urile scanate nu pot fi procesate cu OCR.")
            print("[INFO] Instaleaza Poppler de la: https://github.com/oschwartz10612/poppler-windows/releases")
    else:
        # Pe Linux/macOS, verifica daca pdftoppm este disponibil
        import subprocess
        try:
            result = subprocess.run(['pdftoppm', '-v'], capture_output=True, timeout=2)
            if result.returncode == 0 or 'pdftoppm' in str(result.stderr) or 'pdftoppm' in str(result.stdout):
                PDF2IMAGE_AVAILABLE = True
                print("[OK] Poppler disponibil")
        except:
            PDF2IMAGE_AVAILABLE = False
            print("[WARNING] Poppler nu este disponibil. PDF-urile scanate nu pot fi procesate cu OCR.")
except ImportError:
    PDF2IMAGE_AVAILABLE = False
    print("[WARNING] pdf2image nu este instalat. Ruleaza: pip install pdf2image")

# Verifica disponibilitatea OCR
OCR_AVAILABLE = False
try:
    import pytesseract
    from PIL import Image, ImageOps
    import platform
    
    # Verifica daca Tesseract este disponibil
    try:
        pytesseract.get_tesseract_version()
        OCR_AVAILABLE = True
        print("[OK] OCR disponibil - Tesseract functioneaza")
    except Exception as tess_error:
        # Incearca sa configureze calea Tesseract (doar pe Windows, daca nu e in PATH)
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
                        print("[OK] Tesseract gasit si configurat la: " + path)
                        OCR_AVAILABLE = True
                        tesseract_found = True
                        break
                    except:
                        continue
            
            if not tesseract_found:
                OCR_AVAILABLE = False
                print("[WARNING] Tesseract nu este disponibil.")
                print("[INFO] Instaleaza Tesseract OCR de la: https://github.com/UB-Mannheim/tesseract/wiki")
        else:
            OCR_AVAILABLE = False
            print("[WARNING] Tesseract nu este disponibil.")
            print("[INFO] Instaleaza Tesseract OCR: sudo apt-get install tesseract-ocr (Linux) sau brew install tesseract (macOS)")
            
except ImportError:
    OCR_AVAILABLE = False
    print("[WARNING] OCR nu este disponibil. Ruleaza: pip install pytesseract pillow")
except Exception as e:
    OCR_AVAILABLE = False
    print("[WARNING] OCR nu este disponibil. Eroare: " + str(e))

