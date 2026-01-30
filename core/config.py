import os
from ollama import Client

# Incarca variabilele de mediu din .env
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    print("[WARNING] python-dotenv nu este instalat. Pentru a folosi .env, ruleaza: pip install python-dotenv")

# Conectare la Ollama - citeste IP-ul din variabilele de mediu
OLLAMA_HOST = os.getenv('OLLAMA_HOST', '127.0.0.1:11434')
OLLAMA_FALLBACK_HOST = '127.0.0.1:11434'

def get_ollama_client(host: str = None) -> Client:
    """
    Creează un client Ollama cu fallback automat la 127.0.0.1:11434 dacă host-ul configurat eșuează.
    
    Args:
        host: Host-ul Ollama de folosit. Dacă None, folosește OLLAMA_HOST din config.
    
    Returns:
        Client Ollama funcțional (fie cu host-ul configurat, fie cu fallback)
    """
    if host is None:
        host = OLLAMA_HOST
    
    # OPTIMIZARE: Pentru 127.0.0.1 sau localhost, skip testul (local, sigur și rapid)
    # Curăță host-ul de protocol pentru comparație
    host_clean = host
    if host_clean.startswith('http://'):
        host_clean = host_clean[7:]
    elif host_clean.startswith('https://'):
        host_clean = host_clean[8:]
    
    is_local = (host_clean == OLLAMA_FALLBACK_HOST or 
                host_clean == '127.0.0.1:11434' or 
                host_clean == 'localhost:11434' or
                host_clean.startswith('127.0.0.1:') or
                host_clean.startswith('localhost:'))
    
    if is_local:
        # Pentru localhost, returnează direct fără test (viteză maximă)
        return Client(host=host)
    
    # Pentru host-uri remote, testează conexiunea
    try:
        client = Client(host=host)
        # Testează conexiunea doar pentru host-uri remote (timeout scurt)
        try:
            import socket
            # Curăță host-ul de protocol (http:// sau https://)
            host_clean = host
            if host_clean.startswith('http://'):
                host_clean = host_clean[7:]  # Elimină 'http://'
            elif host_clean.startswith('https://'):
                host_clean = host_clean[8:]  # Elimină 'https://'
            
            # Extrage hostname și port din host
            if ':' in host_clean:
                hostname, port = host_clean.split(':')
                port = int(port)
            else:
                hostname = host_clean
                port = 11434
            
            # Test rapid de conectivitate TCP (mult mai rapid decât HTTP request)
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(1)  # Redus la 1 secundă pentru viteză
            result = sock.connect_ex((hostname, port))
            sock.close()
            
            if result == 0:
                # Portul este deschis, înseamnă că Ollama rulează
                print(f"✅ Ollama conectat la {host}")
                return client
            else:
                raise ConnectionError(f"Port {port} nu este accesibil pe {hostname}")
        except (socket.timeout, socket.gaierror, ConnectionError, ValueError) as test_error:
            print(f"⚠️ Ollama host {host} nu este accesibil: {test_error}")
            print(f"🔄 Fallback la {OLLAMA_FALLBACK_HOST}")
            # Creează clientul cu fallback (fără test, e local)
            fallback_client = Client(host=OLLAMA_FALLBACK_HOST)
            print(f"✅ Ollama client creat pentru {OLLAMA_FALLBACK_HOST} (fallback)")
            return fallback_client
    except Exception as e:
        print(f"⚠️ Eroare la crearea clientului Ollama pentru {host}: {e}")
        print(f"🔄 Fallback la {OLLAMA_FALLBACK_HOST}")
        # Creează clientul cu fallback
        try:
            fallback_client = Client(host=OLLAMA_FALLBACK_HOST)
            print(f"✅ Ollama client creat pentru {OLLAMA_FALLBACK_HOST} (fallback)")
            return fallback_client
        except Exception as fallback_error:
            print(f"❌ Eroare: Nici fallback-ul nu funcționează: {fallback_error}")
            # Returnează totuși clientul fallback (poate funcționează la următorul request)
            return fallback_client

# Creează clientul Ollama cu fallback automat
ollama = get_ollama_client()

# Configurație performanță Ollama
def get_ollama_performance_options(base_options: dict = None) -> dict:
    """
    Returnează opțiuni optimizate pentru performanță Ollama.
    Optimizat pentru laptop-uri cu CPU sau GPU slab.
    
    Args:
        base_options: Opțiuni de bază de suprapus
    
    Returns:
        Dict cu opțiuni optimizate pentru performanță
    """
    import os
    import multiprocessing
    
    # Detectează numărul optim de thread-uri
    # Folosește 75% din CPU cores pentru a lăsa resurse pentru sistem
    cpu_count = multiprocessing.cpu_count()
    default_threads = max(2, int(cpu_count * 0.75))
    num_threads = int(os.getenv('OLLAMA_NUM_THREADS', str(default_threads)))
    
    # Opțiuni default optimizate pentru viteză maximă
    perf_options = {
        "num_thread": num_threads,
        "numa": False,  # NUMA poate încetini pe sisteme simple
        "top_k": 8,  # Redus pentru viteză maximă
        "top_p": 0.7,  # Redus pentru viteză maximă
        "keep_alive": "5m",  # Păstrează modelul în memorie pentru 5 minute (reduce latența)
    }
    
    # Suprapune cu opțiunile de bază dacă există
    if base_options:
        perf_options.update(base_options)
    
    return perf_options

# Log configurație performanță la start
try:
    import multiprocessing
    cpu_count = multiprocessing.cpu_count()
    num_threads = int(os.getenv('OLLAMA_NUM_THREADS', str(max(2, int(cpu_count * 0.75)))))
    print(f"⚡ Configurație Ollama performanță: {num_threads} thread-uri (din {cpu_count} CPU cores)")
    print(f"💡 Pentru optimizare, setează OLLAMA_NUM_THREADS în .env (ex: OLLAMA_NUM_THREADS={cpu_count})")
except:
    pass

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

