# Sistem OCR cu PaddleOCR și OpenCV

## Prezentare

Sistemul OCR folosește **PaddleOCR** pentru extragerea textului și **OpenCV** pentru preprocesarea imaginilor. Preprocesarea include:
- **Deskew** (corecție înclinare text)
- **Binarizare** (conversie la alb-negru)
- **Reducere zgomot** (filtrare)

## Caracteristici

- ✅ Suport pentru imagini (JPG, PNG, GIF, BMP, WEBP)
- ✅ Suport pentru PDF-uri (conversie automată la imagini)
- ✅ Preprocesare avansată cu OpenCV
- ✅ Returnare text brut (fără interpretare semantică)
- ✅ Opțional: bounding boxes pentru fiecare cuvânt/text detectat
- ✅ Suport pentru limba română (și alte limbi)

## API Endpoints

### `POST /ocr/extract`

Extrage textul dintr-un document (imagine sau PDF).

**Parametri:**
- `file` (File): Fișierul de procesat
- `return_boxes` (Form, opțional): Dacă `true`, returnează și bounding boxes (default: `false`)
- `lang` (Form, opțional): Limba pentru OCR (default: `'ro'`)

**Răspuns:**
```json
{
  "success": true,
  "text": "Text extras din document...",
  "filename": "document.pdf",
  "file_type": "pdf",
  "language": "ro",
  "boxes": [
    {
      "text": "Primul cuvant",
      "confidence": 0.95,
      "box": [[x1, y1], [x2, y2], [x3, y3], [x4, y4]]
    }
  ],
  "box_count": 10
}
```

**Exemplu cu curl:**
```bash
curl -X POST "http://localhost:8000/ocr/extract" \
  -F "file=@document.pdf" \
  -F "return_boxes=true" \
  -F "lang=ro"
```

### `GET /ocr/status`

Verifică statusul componentelor OCR.

**Răspuns:**
```json
{
  "paddleocr_available": true,
  "opencv_available": true,
  "pdf2image_available": true,
  "ready": true
}
```

## Utilizare Programatică

### Procesare Imagine

```python
from ocr_processor import process_image

# Procesează o imagine
with open('document.jpg', 'rb') as f:
    image_bytes = f.read()

text, boxes = process_image(image_bytes, lang='ro', return_boxes=True)
print(text)
```

### Procesare PDF

```python
from ocr_processor import process_pdf

# Procesează un PDF
with open('document.pdf', 'rb') as f:
    pdf_bytes = f.read()

text, boxes = process_pdf(pdf_bytes, lang='ro', return_boxes=True)
print(text)
```

### Utilizare Clasă OCRProcessor

```python
from ocr_processor import OCRProcessor

# Creează procesorul
processor = OCRProcessor(lang='ro', use_angle_cls=True)

# Procesează imaginea
text, boxes = processor.process_image_bytes(image_bytes, return_boxes=True)
```

## Preprocesare

Sistemul aplică automat următoarele preprocesări:

### 1. Deskew (Corecție Înclinare)
- Detectează unghiul de înclinare al textului
- Rotește imaginea pentru a corecta înclinarea
- Folosește transformata Hough pentru detectare

### 2. Reducere Zgomot
- Filtru median pentru eliminarea zgomotului
- Filtru Gaussian pentru netezire

### 3. Binarizare
- Adaptive threshold pentru conversie alb-negru
- Funcționează bine și cu iluminare neuniformă

## Dependențe

- `paddleocr>=2.7.0` - Motor OCR
- `opencv-python>=4.8.0` - Preprocesare imagini
- `numpy>=1.24.0,<2.0` - Procesare array-uri
- `Pillow>=10.0.0` - Procesare imagini
- `pdf2image>=1.16.0` - Conversie PDF la imagini (opțional, pentru PDF-uri)

## Instalare

```bash
pip install paddleocr opencv-python numpy pillow pdf2image
```

**Notă:** PaddleOCR va descărca automat modelele necesare la prima utilizare (poate dura câteva minute).

## Limbi Suportate

PaddleOCR suportă multe limbi. Pentru limba română, folosește `lang='ro'`.

Alte limbi disponibile: `en`, `ch`, `fr`, `de`, `es`, etc.

## Performanță

- **Imagini**: Procesare rapidă (< 1 secundă pentru imagini normale)
- **PDF-uri**: Depinde de numărul de pagini (aprox. 2-5 secunde/pagină)
- **Preprocesare**: Adaugă ~10-20% timp suplimentar, dar îmbunătățește acuratețea

## Troubleshooting

### PaddleOCR nu se instalează
```bash
pip install paddleocr --user
```

### NumPy 2.x incompatibil
PaddleOCR necesită NumPy < 2.0:
```bash
pip install "numpy<2.0"
```

### PDF-uri nu se procesează
Asigură-te că `pdf2image` și `poppler` sunt instalate:
- Windows: Descarcă Poppler de la https://github.com/oschwartz10612/poppler-windows/releases
- Linux: `sudo apt-get install poppler-utils`
- macOS: `brew install poppler`

### Erori de encoding
Dacă întâmpini probleme cu caracterele românești, asigură-te că terminalul suportă UTF-8.

