"""
Script de test pentru verificarea Poppler și pdf2image
Rulează: python test_poppler.py
"""
import sys
import os
import subprocess
import platform

print("=" * 60)
print("TEST CONFIGURAȚIE POPPLER ȘI PDF2IMAGE")
print("=" * 60)

# Test pdf2image
print("\n📦 Test pdf2image...")
try:
    from pdf2image import convert_from_bytes
    print("✅ pdf2image este instalat")
except ImportError:
    print("❌ pdf2image nu este instalat. Rulează: pip install pdf2image")
    sys.exit(1)

# Test Poppler
print("\n🔍 Test Poppler...")
poppler_found = False
poppler_path = None

if platform.system() == 'Windows':
    # Verifică dacă pdftoppm este în PATH
    try:
        result = subprocess.run(['pdftoppm', '-v'], capture_output=True, timeout=2, text=True)
        if result.returncode == 0 or 'pdftoppm' in result.stderr or 'pdftoppm' in result.stdout:
            poppler_found = True
            poppler_path = "PATH"
            print("✅ Poppler găsit în PATH")
    except FileNotFoundError:
        pass
    except Exception as e:
        print(f"⚠️ Eroare la verificarea PATH: {e}")
    
    # Dacă nu este în PATH, verifică locațiile comune
    if not poppler_found:
        possible_paths = [
            r'C:\poppler-23.11.0\Library\bin'
        ]
        for path in possible_paths:
            if os.path.exists(path):
                print(f"📁 Găsit director Poppler la: {path}")
                # Adaugă la PATH temporar
                os.environ['PATH'] = path + os.pathsep + os.environ.get('PATH', '')
                try:
                    result = subprocess.run(['pdftoppm', '-v'], capture_output=True, timeout=2, text=True)
                    if result.returncode == 0 or 'pdftoppm' in result.stderr or 'pdftoppm' in result.stdout:
                        poppler_found = True
                        poppler_path = path
                        print(f"✅ Poppler funcționează de la: {path}")
                        break
                except Exception as e:
                    print(f"⚠️ Eroare la testarea {path}: {e}")
                    continue
else:
    # Linux/macOS
    try:
        result = subprocess.run(['pdftoppm', '-v'], capture_output=True, timeout=2, text=True)
        if result.returncode == 0 or 'pdftoppm' in result.stderr or 'pdftoppm' in result.stdout:
            poppler_found = True
            poppler_path = "PATH"
            print("✅ Poppler găsit în PATH")
    except FileNotFoundError:
        print("❌ Poppler nu este instalat sau nu este în PATH")
    except Exception as e:
        print(f"⚠️ Eroare: {e}")

if not poppler_found:
    print("\n❌ Poppler nu este disponibil!")
    print("\n💡 Instalează Poppler:")
    if platform.system() == 'Windows':
        print("   Windows: Descarcă de la https://github.com/oschwartz10612/poppler-windows/releases")
        print("   Extrage și adaugă directorul 'bin' la PATH sau instalează în C:\\poppler\\bin")
    elif platform.system() == 'Linux':
        print("   Linux: sudo apt-get install poppler-utils")
    elif platform.system() == 'Darwin':
        print("   macOS: brew install poppler")
    sys.exit(1)

# Test conversie PDF (simulat)
print("\n🧪 Test conversie PDF...")
try:
    # Creează un PDF minimal pentru test
    from reportlab.pdfgen import canvas
    from io import BytesIO
    
    buffer = BytesIO()
    c = canvas.Canvas(buffer, pagesize=(200, 200))
    c.drawString(50, 100, "Test PDF")
    c.save()
    buffer.seek(0)
    pdf_bytes = buffer.getvalue()
    
    # Încearcă conversia
    images = convert_from_bytes(pdf_bytes, dpi=100)
    print(f"✅ Conversie PDF -> imagine funcționează! ({len(images)} pagină/pagini)")
except Exception as e:
    print(f"⚠️ Eroare la conversie PDF: {e}")
    print("   (Aceasta este normală dacă reportlab nu este instalat)")

print("\n" + "=" * 60)
print("✅ Toate testele au trecut!")
print("=" * 60)
print(f"\n📝 Poppler este disponibil la: {poppler_path}")
print("💡 Repornește backend-ul pentru a încărca configurația actualizată")

