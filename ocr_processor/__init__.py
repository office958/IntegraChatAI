"""
Modul pentru procesarea OCR folosind PaddleOCR și preprocesare OpenCV.
"""

from .processor import OCRProcessor, process_document, process_image, process_pdf
from .postprocess import correct_ocr_text, identify_missing_fields
from .singleton import get_ocr_processor

__all__ = [
    'OCRProcessor', 
    'process_document', 
    'process_image', 
    'process_pdf',
    'correct_ocr_text',
    'identify_missing_fields',
    'get_ocr_processor'
]

