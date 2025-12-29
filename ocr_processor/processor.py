"""
Procesor OCR folosind PaddleOCR cu preprocesare OpenCV.
Preprocesarea include: deskew, binarizare, reducere zgomot.
"""

from typing import Tuple, Optional, List, Dict, Any, Union
import io
import os

# Verifică disponibilitatea numpy
try:
    import numpy as np
    NUMPY_AVAILABLE = True
except ImportError:
    NUMPY_AVAILABLE = False
    np = None

# Verifică disponibilitatea PIL
try:
    from PIL import Image
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False
    Image = None

# Verifică disponibilitatea OpenCV
OPENCV_AVAILABLE = False
try:
    import cv2
    OPENCV_AVAILABLE = True
except ImportError:
    OPENCV_AVAILABLE = False
    cv2 = None

# Verifică disponibilitatea PaddleOCR
PADDLEOCR_AVAILABLE = False
try:
    from paddleocr import PaddleOCR
    PADDLEOCR_AVAILABLE = True
except ImportError:
    PADDLEOCR_AVAILABLE = False

# Verifică disponibilitatea pdf2image
PDF2IMAGE_AVAILABLE = False
try:
    from pdf2image import convert_from_bytes
    PDF2IMAGE_AVAILABLE = True
except ImportError:
    PDF2IMAGE_AVAILABLE = False


class OCRProcessor:
    """
    Procesor OCR care folosește PaddleOCR cu preprocesare OpenCV.
    """
    
    def __init__(self, lang: str = 'ro', use_angle_cls: bool = True):
        """
        Inițializează procesorul OCR.
        
        Args:
            lang: Limba pentru OCR (default: 'ro' pentru română)
            use_angle_cls: Folosește clasificarea unghiului pentru rotirea textului
        """
        if not PADDLEOCR_AVAILABLE:
            raise ImportError("PaddleOCR nu este instalat. Ruleaza: pip install paddleocr")
        
        if not OPENCV_AVAILABLE:
            raise ImportError("OpenCV nu este instalat. Ruleaza: pip install opencv-python")
        
        if not NUMPY_AVAILABLE:
            raise ImportError("numpy nu este instalat. Ruleaza: pip install numpy")
        
        # Inițializează PaddleOCR
        # Versiunea 3.x a PaddleOCR folosește un API diferit
        # Parametrul use_angle_cls nu mai este necesar în versiunile noi
        self.ocr = PaddleOCR(lang=lang)
        self.lang = lang
    
    def preprocess_image(self, image: np.ndarray) -> np.ndarray:
        """
        Preprocesează imaginea pentru OCR (versiune veche - returnează grayscale binarizat).
        Folosit pentru Tesseract sau alte OCR-uri care preferă imagini binarizate.
        
        Args:
            image: Imaginea ca numpy array (BGR format din OpenCV)
        
        Returns:
            Imaginea preprocesată (grayscale binarizat)
        """
        # Convertește la grayscale dacă este color
        if len(image.shape) == 3:
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        else:
            gray = image.copy()
        
        # 1. Deskew (corecție înclinare)
        deskewed = self._deskew(gray)
        
        # 2. Reducere zgomot
        denoised = self._denoise(deskewed)
        
        # 3. Binarizare (conversie la alb-negru)
        binary = self._binarize(denoised)
        
        return binary
    
    def _preprocess_color_image(self, image: np.ndarray) -> np.ndarray:
        """
        Preprocesează imaginea color pentru PaddleOCR:
        - Deskew (corecție înclinare) - păstrează color
        - Reducere zgomot - păstrează color
        - NU binarizează (PaddleOCR preferă imagini color)
        
        Args:
            image: Imaginea ca numpy array (BGR format din OpenCV, 3 canale)
        
        Returns:
            Imaginea preprocesată (color, 3 canale)
        """
        # Asigură-te că imaginea este color
        if len(image.shape) == 2:
            image = cv2.cvtColor(image, cv2.COLOR_GRAY2BGR)
        
        # 1. Deskew pe fiecare canal separat
        b, g, r = cv2.split(image)
        b_deskewed = self._deskew(b)
        g_deskewed = self._deskew(g)
        r_deskewed = self._deskew(r)
        deskewed = cv2.merge([b_deskewed, g_deskewed, r_deskewed])
        
        # 2. Reducere zgomot (pe fiecare canal)
        denoised = cv2.bilateralFilter(deskewed, 5, 50, 50)
        
        return denoised
    
    def _deskew(self, image: np.ndarray) -> np.ndarray:
        """
        Corectează înclinarea textului din imagine.
        
        Args:
            image: Imaginea în grayscale
        
        Returns:
            Imaginea cu textul corectat
        """
        # Detectează unghiul de înclinare folosind transformata Hough
        coords = np.column_stack(np.where(image > 0))
        
        if len(coords) == 0:
            return image
        
        # Calculează unghiul minim de rotație
        angle = cv2.minAreaRect(coords)[-1]
        
        # Corectează unghiul
        if angle < -45:
            angle = -(90 + angle)
        else:
            angle = -angle
        
        # Rotirea doar dacă unghiul este semnificativ (> 0.5 grade)
        if abs(angle) > 0.5:
            (h, w) = image.shape[:2]
            center = (w // 2, h // 2)
            M = cv2.getRotationMatrix2D(center, angle, 1.0)
            rotated = cv2.warpAffine(
                image, M, (w, h), 
                flags=cv2.INTER_CUBIC, 
                borderMode=cv2.BORDER_REPLICATE
            )
            return rotated
        
        return image
    
    def _denoise(self, image: np.ndarray) -> np.ndarray:
        """
        Reduce zgomotul din imagine.
        
        Args:
            image: Imaginea în grayscale
        
        Returns:
            Imaginea cu zgomot redus
        """
        # Folosește filtru median pentru reducerea zgomotului
        denoised = cv2.medianBlur(image, 3)
        
        # Aplică și un filtru Gaussian pentru netezire suplimentară
        denoised = cv2.GaussianBlur(denoised, (3, 3), 0)
        
        return denoised
    
    def _binarize(self, image: np.ndarray) -> np.ndarray:
        """
        Binarizează imaginea (conversie la alb-negru).
        
        Args:
            image: Imaginea în grayscale
        
        Returns:
            Imaginea binarizată
        """
        # Folosește adaptive threshold pentru binarizare
        # Funcționează mai bine decât threshold simplu pentru imagini cu iluminare neuniformă
        binary = cv2.adaptiveThreshold(
            image, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, 
            cv2.THRESH_BINARY, 11, 2
        )
        
        return binary
    
    def extract_text(
        self, 
        image: np.ndarray, 
        return_boxes: bool = False
    ) -> Tuple[str, Optional[List[Dict[str, Any]]]]:
        """
        Extrage textul din imagine folosind OCR.
        
        Args:
            image: Imaginea ca numpy array (BGR sau grayscale)
            return_boxes: Dacă True, returnează și bounding boxes
        
        Returns:
            Tuple (text, boxes)
            - text: Textul extras
            - boxes: Lista de bounding boxes (doar dacă return_boxes=True)
        """
        # PaddleOCR necesită imagini color (RGB), nu grayscale
        # Aplicăm doar preprocesări care nu afectează numărul de canale
        if len(image.shape) == 3:
            # Imagine color - aplicăm doar reducere zgomot și deskew
            processed = self._preprocess_color_image(image)
        else:
            # Imagine grayscale - convertim la RGB
            processed = cv2.cvtColor(image, cv2.COLOR_GRAY2BGR)
            processed = self._preprocess_color_image(processed)
        
        # Extrage textul cu PaddleOCR
        # Versiunea 3.x a PaddleOCR nu acceptă parametrul cls
        result = self.ocr.ocr(processed)
        
        # Procesează rezultatele
        text_lines = []
        boxes = []
        
        # PaddleOCR 3.x returnează o listă de dicționare, nu lista de liste
        if result and len(result) > 0:
            # Rezultatul este o listă de dicționare, fiecare reprezentând o pagină/document
            for page_result in result:
                if isinstance(page_result, dict):
                    # Format nou PaddleOCR 3.x
                    rec_texts = page_result.get('rec_texts', [])
                    rec_scores = page_result.get('rec_scores', [])
                    rec_polys = page_result.get('rec_polys', [])
                    
                    for i, text in enumerate(rec_texts):
                        if text and text.strip():
                            text_lines.append(text.strip())
                            
                            if return_boxes and i < len(rec_polys):
                                # Convertește poly la format box
                                poly = rec_polys[i]
                                if poly is not None and len(poly) > 0:
                                    # Poly este un array numpy cu coordonate
                                    box_coords = poly.tolist() if hasattr(poly, 'tolist') else poly
                                    confidence = rec_scores[i] if i < len(rec_scores) else 0.0
                                    
                                    boxes.append({
                                        'text': text.strip(),
                                        'confidence': float(confidence),
                                        'box': box_coords
                                    })
                elif isinstance(page_result, list):
                    # Format vechi PaddleOCR 2.x (compatibilitate)
                    for line in page_result:
                        if line and len(line) >= 2:
                            box = line[0]
                            text_info = line[1]
                            
                            if isinstance(text_info, (list, tuple)) and len(text_info) >= 2:
                                text = text_info[0]
                                confidence = text_info[1]
                            elif isinstance(text_info, str):
                                text = text_info
                                confidence = 1.0
                            else:
                                continue
                            
                            if text and text.strip():
                                text_lines.append(text.strip())
                                
                                if return_boxes:
                                    boxes.append({
                                        'text': text.strip(),
                                        'confidence': float(confidence),
                                        'box': box
                                    })
        
        full_text = '\n'.join(text_lines)
        
        if return_boxes:
            return full_text, boxes
        else:
            return full_text, None
    
    def process_image_bytes(
        self, 
        image_bytes: bytes, 
        return_boxes: bool = False
    ) -> Tuple[str, Optional[List[Dict[str, Any]]]]:
        """
        Procesează un fișier imagine și extrage textul.
        
        Args:
            image_bytes: Conținutul fișierului imagine ca bytes
            return_boxes: Dacă True, returnează și bounding boxes
        
        Returns:
            Tuple (text, boxes)
        """
        # Convertește bytes la numpy array
        nparr = np.frombuffer(image_bytes, np.uint8)
        image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if image is None:
            raise ValueError("Nu s-a putut decoda imaginea")
        
        return self.extract_text(image, return_boxes)
    
    def process_pil_image(
        self, 
        pil_image: Image.Image, 
        return_boxes: bool = False
    ) -> Tuple[str, Optional[List[Dict[str, Any]]]]:
        """
        Procesează o imagine PIL și extrage textul.
        
        Args:
            pil_image: Imaginea PIL
            return_boxes: Dacă True, returnează și bounding boxes
        
        Returns:
            Tuple (text, boxes)
        """
        # Convertește PIL Image la numpy array
        if pil_image.mode != 'RGB':
            pil_image = pil_image.convert('RGB')
        
        image_array = np.array(pil_image)
        # PIL folosește RGB, OpenCV folosește BGR
        image_bgr = cv2.cvtColor(image_array, cv2.COLOR_RGB2BGR)
        
        return self.extract_text(image_bgr, return_boxes)


def process_image(
    image_bytes: bytes, 
    lang: str = 'ro', 
    return_boxes: bool = False
) -> Tuple[str, Optional[List[Dict[str, Any]]]]:
    """
    Funcție helper pentru procesarea rapidă a unei imagini.
    
    Args:
        image_bytes: Conținutul fișierului imagine ca bytes
        lang: Limba pentru OCR (default: 'ro')
        return_boxes: Dacă True, returnează și bounding boxes
    
    Returns:
        Tuple (text, boxes)
    """
    processor = OCRProcessor(lang=lang)
    return processor.process_image_bytes(image_bytes, return_boxes)


def process_pdf(
    pdf_bytes: bytes,
    lang: str = 'ro',
    return_boxes: bool = False,
    dpi: int = 300
) -> Tuple[str, Optional[List[Dict[str, Any]]]]:
    """
    Funcție helper pentru procesarea rapidă a unui PDF.
    
    Args:
        pdf_bytes: Conținutul fișierului PDF ca bytes
        lang: Limba pentru OCR (default: 'ro')
        return_boxes: Dacă True, returnează și bounding boxes
        dpi: Rezoluția pentru conversia PDF la imagini (default: 300)
    
    Returns:
        Tuple (text, boxes) - textul din toate paginile concatenat
    """
    if not PDF2IMAGE_AVAILABLE:
        raise ImportError("pdf2image nu este instalat. Ruleaza: pip install pdf2image")
    
    processor = OCRProcessor(lang=lang)
    
    # Convertește PDF la imagini
    images = convert_from_bytes(pdf_bytes, dpi=dpi)
    
    all_text_lines = []
    all_boxes = []
    
    # Procesează fiecare pagină
    for page_num, pil_image in enumerate(images):
        text, boxes = processor.process_pil_image(pil_image, return_boxes)
        
        if text:
            all_text_lines.append(f"--- Pagina {page_num + 1} ---")
            all_text_lines.append(text)
        
        if return_boxes and boxes:
            # Adaugă informații despre pagină la fiecare box
            for box in boxes:
                box['page'] = page_num + 1
            all_boxes.extend(boxes)
    
    full_text = '\n'.join(all_text_lines)
    
    if return_boxes:
        return full_text, all_boxes
    else:
        return full_text, None


def process_document(
    file_bytes: bytes,
    file_type: str,
    lang: str = 'ro',
    return_boxes: bool = False
) -> Tuple[str, Optional[List[Dict[str, Any]]]]:
    """
    Funcție helper pentru procesarea unui document (imagine sau PDF).
    
    Args:
        file_bytes: Conținutul fișierului ca bytes
        file_type: Tipul fișierului ('image' sau 'pdf')
        lang: Limba pentru OCR (default: 'ro')
        return_boxes: Dacă True, returnează și bounding boxes
    
    Returns:
        Tuple (text, boxes)
    """
    if file_type.lower() == 'pdf':
        return process_pdf(file_bytes, lang, return_boxes)
    else:
        return process_image(file_bytes, lang, return_boxes)

