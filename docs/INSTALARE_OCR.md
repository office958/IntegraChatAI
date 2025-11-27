# 🖼️ Instalare Suport OCR (Extragere Text din Imagini)

Pentru a folosi funcționalitatea de extragere text din imagini (OCR), trebuie să instalezi Tesseract OCR pe sistem.

## Instalare

### Windows

1. **Descarcă Tesseract OCR:**
   - Link: https://github.com/UB-Mannheim/tesseract/wiki
   - Descarcă versiunea pentru Windows (ex: `tesseract-ocr-w64-setup-5.x.x.exe`)

2. **Instalează Tesseract:**
   - Rulează installer-ul
   - **IMPORTANT:** Bifează opțiunea pentru limba română (Romanian) în timpul instalării
   - Instalează în locația default: `C:\Program Files\Tesseract-OCR\`

3. **Adaugă Tesseract în PATH (opțional, dar recomandat):**
   - Deschide "Environment Variables" din Windows
   - Adaugă `C:\Program Files\Tesseract-OCR\` la PATH
   - Sau lasă codul să-l găsească automat (funcționează și fără PATH)

4. **Instalează bibliotecile Python:**
   ```bash
   pip install pytesseract pillow
   ```

### Linux (Ubuntu/Debian)

```bash
# Instalează Tesseract OCR
sudo apt-get update
sudo apt-get install tesseract-ocr

# Instalează limba română (opțional, dar recomandat)
sudo apt-get install tesseract-ocr-ron

# Instalează bibliotecile Python
pip install pytesseract pillow
```

### macOS

```bash
# Instalează Tesseract OCR
brew install tesseract

# Instalează limba română (opțional)
brew install tesseract-lang

# Instalează bibliotecile Python
pip install pytesseract pillow
```

## Verificare

După instalare, când pornești serverul FastAPI, ar trebui să vezi în consolă:
- ✅ **Dacă OCR este disponibil:** `✅ OCR disponibil - Tesseract funcționează`
- ⚠️ **Dacă OCR NU este disponibil:** `⚠️ Tesseract nu este disponibil. Eroare: ...`

## Testare rapidă

Poți testa dacă Tesseract funcționează rulând:

```python
import pytesseract
from PIL import Image

# Test simplu
print(pytesseract.get_tesseract_version())
```

## Utilizare

1. Deschide chat-ul în orice pagină cu formular
2. Click pe butonul **"Încarcă fișiere"** din zona de input
3. Selectează un fișier PDF sau o imagine (JPG, PNG, GIF, BMP, WEBP)
4. Așteaptă extragerea textului (vei vedea un mesaj de confirmare)
5. Spune-i AI-ului: "Completează formularul folosind informațiile din documente"

AI-ul va extrage automat datele din PDF sau imagine și va completa câmpurile formularului!

## Formate suportate

- **PDF**: `.pdf`
- **Imagini**: `.jpg`, `.jpeg`, `.png`, `.gif`, `.bmp`, `.webp`

## Limitări

- Dimensiune maximă fișier: **10MB**
- OCR funcționează mai bine cu imagini de calitate bună și text clar
- Limbi suportate: Română + Engleză (configurate automat)

## Rezolvare probleme

### Eroare: "OCR nu este disponibil"
```bash
pip install pytesseract pillow
```

### Eroare: "TesseractNotFoundError" sau "Tesseract nu este instalat"
- **Windows:** Asigură-te că Tesseract este instalat în `C:\Program Files\Tesseract-OCR\`
- **Linux:** Rulează `sudo apt-get install tesseract-ocr`
- **macOS:** Rulează `brew install tesseract`

### Eroare: "Nu s-a putut extrage text din imagine"
- Imaginea poate să nu conțină text
- Calitatea imaginii poate fi prea slabă
- Textul poate fi prea mic sau blurat
- Încearcă cu o imagine de calitate mai bună

### Eroare: "Fișierul este prea mare"
- Reduce dimensiunea fișierului (max 10MB)
- Comprimă imaginea sau reduce rezoluția

### Eroare 500 la extragerea textului
- Verifică consola serverului Python pentru detalii
- Asigură-te că Tesseract este instalat și funcționează
- Repornește serverul după instalarea Tesseract

