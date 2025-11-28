from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Importă router-urile
from routers import auth, chat, admin, files, static

app = FastAPI(title="Integra AI Builder")

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

if __name__ == "__main__":
    import uvicorn
    # Configurare pentru a preveni oprirea serverului la erori
    uvicorn.run(
        app, 
        host="0.0.0.0", 
        port=8000,
        timeout_keep_alive=75,  # Timeout mai mare pentru procesare OCR
        log_level="info"
    )
