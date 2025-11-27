@echo off
echo ====================================
echo   Integra AI - Pornire Backend
echo ====================================
echo.
echo Verificare dependențe...
python -c "import fastapi, uvicorn, ollama" 2>nul
if errorlevel 1 (
    echo ⚠️  Unele dependențe lipsesc!
    echo Instalează cu: pip install -r requirements.txt
    pause
    exit /b 1
)
echo.
echo ✅ Dependențe OK
echo.
echo 🚀 Pornire server FastAPI pe http://127.0.0.1:8000
echo    (Backend pentru API-uri și panoul de administrare)
echo.
echo 📝 Asigură-te că Ollama rulează pe localhost:11434
echo.
python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload
pause

