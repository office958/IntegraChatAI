from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
import traceback

# Importă router-urile
from routers import auth, chat, admin, files, static, ocr

# Importă router PDF (opțional - doar dacă reportlab este disponibil)
# Comentat pentru că router-urile nu există încă
# try:
#     from routers import pdf_generator
#     PDF_GENERATOR_AVAILABLE = True
# except ImportError:
#     PDF_GENERATOR_AVAILABLE = False
PDF_GENERATOR_AVAILABLE = False

# Importă router PDF Form (sistem avansat pentru completare PDF)
# Comentat pentru că router-urile nu există încă
# try:
#     from routers import pdf_form
#     PDF_FORM_AVAILABLE = True
# except ImportError:
#     PDF_FORM_AVAILABLE = False
PDF_FORM_AVAILABLE = False

app = FastAPI(title="Integra AI Builder")

# OCRProcessor se va încărca automat la primul request care necesită OCR (lazy loading)
# Nu mai pre-încărcăm la start-up pentru a accelera pornirea serverului

# Exception handler global pentru a returna erori ca JSON
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Handler global pentru toate excepțiile - returnează JSON"""
    import traceback
    error_details = traceback.format_exc()
    print(f"❌ Eroare neașteptată: {error_details}")
    
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": "Eroare internă a serverului",
            "detail": str(exc),
            "type": type(exc).__name__
        }
    )

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Handler pentru erori de validare"""
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "error": "Eroare de validare",
            "detail": exc.errors()
        }
    )

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Înregistrează router-urile
app.include_router(auth.router)
app.include_router(chat.router)
app.include_router(admin.router)
app.include_router(files.router)
app.include_router(static.router)
app.include_router(ocr.router)

# Înregistrează router PDF dacă este disponibil
if PDF_GENERATOR_AVAILABLE:
    app.include_router(pdf_generator.router)

# Înregistrează router PDF Form dacă este disponibil
if PDF_FORM_AVAILABLE:
    app.include_router(pdf_form.router)

if __name__ == "__main__":
    import uvicorn
    # Configurare pentru a preveni oprirea serverului la erori
    uvicorn.run(
        app, 
        host="0.0.0.0", 
        port=8000,
        timeout_keep_alive=120,  # Timeout mai mare pentru procesare OCR (2 minute)
        timeout_graceful_shutdown=30,  # Timp pentru închidere grațioasă
        log_level="info"
    )
