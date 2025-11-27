from fastapi import APIRouter, UploadFile, File
from fastapi.responses import JSONResponse
import io
from core.config import PDF_AVAILABLE, OCR_AVAILABLE
import PyPDF2
from PIL import Image
import pytesseract

router = APIRouter(tags=["files"])

@router.post("/extract-pdf")
async def extract_pdf(pdf: UploadFile = File(...)):
    """
    Extrage textul dintr-un fișier PDF
    """
    if not PDF_AVAILABLE:
        return JSONResponse(
            status_code=500,
            content={"error": "PyPDF2 nu este instalat. Rulează: pip install PyPDF2"}
        )
    
    if pdf.content_type != "application/pdf":
        return JSONResponse(
            status_code=400,
            content={"error": "Fișierul trebuie să fie PDF"}
        )
    
    try:
        # Citește conținutul PDF
        pdf_content = await pdf.read()
        
        # Extrage textul folosind PyPDF2
        pdf_reader = PyPDF2.PdfReader(io.BytesIO(pdf_content))
        text = ""
        
        for page_num, page in enumerate(pdf_reader.pages):
            try:
                page_text = page.extract_text()
                text += f"\n--- Pagina {page_num + 1} ---\n"
                text += page_text
            except Exception as e:
                print(f"Eroare la extragerea paginii {page_num + 1}: {e}")
                continue
        
        if not text.strip():
            return JSONResponse(
                status_code=400,
                content={"error": "Nu s-a putut extrage text din PDF. PDF-ul poate fi scanat sau protejat."}
            )
        
        return JSONResponse(content={
            "text": text.strip(),
            "pages": len(pdf_reader.pages),
            "filename": pdf.filename
        })
        
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"error": f"Eroare la procesarea PDF: {str(e)}"}
        )

@router.post("/extract-image")
async def extract_image(image: UploadFile = File(...)):
    """
    Extrage textul dintr-o imagine folosind OCR
    """
    if not OCR_AVAILABLE:
        return JSONResponse(
            status_code=500,
            content={"error": "OCR nu este disponibil. Rulează: pip install pytesseract pillow. Asigură-te că Tesseract OCR este instalat pe sistem."}
        )
    
    # Verifică tipul de fișier
    allowed_types = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/bmp", "image/webp"]
    if image.content_type not in allowed_types:
        return JSONResponse(
            status_code=400,
            content={"error": f"Fișierul trebuie să fie o imagine. Tip primit: {image.content_type}. Tipuri acceptate: {', '.join(allowed_types)}"}
        )
    
    try:
        # Citește conținutul imaginii
        image_content = await image.read()
        
        if not image_content:
            return JSONResponse(
                status_code=400,
                content={"error": "Fișierul este gol sau nu a putut fi citit."}
            )
        
        # Deschide imaginea cu PIL
        try:
            img = Image.open(io.BytesIO(image_content))
        except Exception as e:
            return JSONResponse(
                status_code=400,
                content={"error": f"Nu s-a putut deschide imaginea: {str(e)}"}
            )
        
        # Extrage textul folosind OCR
        text = None
        error_msg = None
        
        # Verifică dacă Tesseract este disponibil încă o dată (în caz că OCR_AVAILABLE era True dar Tesseract nu funcționează)
        try:
            pytesseract.get_tesseract_version()
        except Exception as tess_check_error:
            error_msg = str(tess_check_error)
            if "tesseract" in error_msg.lower() or "not found" in error_msg.lower() or "no such file" in error_msg.lower():
                return JSONResponse(
                    status_code=500,
                    content={"error": f"Tesseract OCR nu este instalat sau nu este în PATH. Eroare: {error_msg}. Instalează Tesseract OCR de la: https://github.com/UB-Mannheim/tesseract/wiki"}
                )
        
        # Încearcă cu diferite configurații de limbi
        lang_configs = ['ron+eng', 'eng', 'ron', None]  # None = default
        
        for lang_config in lang_configs:
            try:
                if lang_config:
                    text = pytesseract.image_to_string(img, lang=lang_config)
                else:
                    text = pytesseract.image_to_string(img)
                
                if text and text.strip():
                    break  # Dacă am obținut text, ieșim din loop
            except Exception as e:
                error_msg = str(e)
                # Dacă e eroare de Tesseract, oprește imediat
                if "tesseract" in error_msg.lower() or "not found" in error_msg.lower() or "no such file" in error_msg.lower():
                    return JSONResponse(
                        status_code=500,
                        content={"error": f"Tesseract OCR nu este instalat sau nu este în PATH. Eroare: {error_msg}. Instalează Tesseract OCR de la: https://github.com/UB-Mannheim/tesseract/wiki"}
                    )
                # Continuă cu următoarea configurație pentru alte erori
                continue
        
        # Dacă nu am reușit să extragem text, verifică eroarea
        if not text or not text.strip():
            if error_msg:
                if "tesseract" in error_msg.lower() or "not found" in error_msg.lower() or "no such file" in error_msg.lower():
                    return JSONResponse(
                        status_code=500,
                        content={"error": f"Tesseract OCR nu este instalat sau nu este în PATH. Eroare: {error_msg}. Vezi INSTALARE_OCR.md pentru instrucțiuni."}
                    )
                else:
                    return JSONResponse(
                        status_code=500,
                        content={"error": f"Eroare la extragerea textului cu OCR: {error_msg}"}
                    )
            else:
                # Nu am eroare, dar nici text - probabil imaginea nu conține text
                return JSONResponse(
                    status_code=400,
                    content={"error": "Nu s-a putut extrage text din imagine. Imaginea poate să nu conțină text sau calitatea este prea slabă. Încearcă cu o imagine de calitate mai bună."}
                )
        
        return JSONResponse(content={
            "text": text.strip(),
            "filename": image.filename,
            "type": "image"
        })
        
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"❌ Eroare detaliată la procesarea imaginii: {error_details}")
        return JSONResponse(
            status_code=500,
            content={"error": f"Eroare la procesarea imaginii: {str(e)}. Verifică consola serverului pentru detalii."}
        )

