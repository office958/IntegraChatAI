"""
Router pentru procesarea OCR a documentelor.
"""

from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import JSONResponse
from typing import Optional
import os

from ocr_processor.processor import (
    OCRProcessor,
    process_image,
    process_pdf,
    process_document,
    PADDLEOCR_AVAILABLE,
    OPENCV_AVAILABLE,
    PDF2IMAGE_AVAILABLE
)

router = APIRouter(prefix="/ocr", tags=["ocr"])


@router.post("/extract")
async def extract_text(
    file: UploadFile = File(...),
    return_boxes: bool = Form(False),
    lang: str = Form("ro")
):
    """
    Extrage textul dintr-un document (imagine sau PDF) folosind OCR.
    
    Args:
        file: Fișierul de procesat (imagine sau PDF)
        return_boxes: Dacă True, returnează și bounding boxes
        lang: Limba pentru OCR (default: 'ro')
    
    Returns:
        JSON cu textul extras și opțional bounding boxes
    """
    if not PADDLEOCR_AVAILABLE:
        raise HTTPException(
            status_code=500,
            detail="PaddleOCR nu este instalat. Ruleaza: pip install paddleocr"
        )
    
    if not OPENCV_AVAILABLE:
        raise HTTPException(
            status_code=500,
            detail="OpenCV nu este instalat. Ruleaza: pip install opencv-python"
        )
    
    try:
        # Citește conținutul fișierului
        file_content = await file.read()
        
        # Determină tipul fișierului
        content_type = file.content_type or ""
        filename = file.filename or ""
        
        is_pdf = (
            content_type == "application/pdf" or 
            filename.lower().endswith('.pdf')
        )
        
        is_image = (
            content_type.startswith("image/") or
            any(filename.lower().endswith(ext) for ext in ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'])
        )
        
        if is_pdf:
            if not PDF2IMAGE_AVAILABLE:
                raise HTTPException(
                    status_code=500,
                    detail="pdf2image nu este instalat. Ruleaza: pip install pdf2image"
                )
            text, boxes = process_pdf(file_content, lang=lang, return_boxes=return_boxes)
        elif is_image:
            text, boxes = process_image(file_content, lang=lang, return_boxes=return_boxes)
        else:
            raise HTTPException(
                status_code=400,
                detail="Tip de fișier neacceptat. Foloseste PDF sau imagini (JPG, PNG, etc.)"
            )
        
        response = {
            "success": True,
            "text": text,
            "filename": filename,
            "file_type": "pdf" if is_pdf else "image",
            "language": lang
        }
        
        if return_boxes and boxes:
            response["boxes"] = boxes
            response["box_count"] = len(boxes)
        
        return JSONResponse(content=response)
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print(f"❌ Eroare la procesarea OCR: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Eroare la procesarea OCR: {str(e)}"
        )


@router.get("/status")
async def get_ocr_status():
    """
    Returnează statusul componentelor OCR.
    """
    return JSONResponse(content={
        "paddleocr_available": PADDLEOCR_AVAILABLE,
        "opencv_available": OPENCV_AVAILABLE,
        "pdf2image_available": PDF2IMAGE_AVAILABLE,
        "ready": PADDLEOCR_AVAILABLE and OPENCV_AVAILABLE
    })

