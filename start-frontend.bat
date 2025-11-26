@echo off
echo ====================================
echo   Integra AI - Pornire Frontend
echo ====================================
echo.
echo Verificare dependențe...
if not exist "node_modules\" (
    echo ⚠️  node_modules nu există!
    echo Instalează cu: npm install
    pause
    exit /b 1
)
echo.
echo ✅ Dependențe OK
echo.
echo 🚀 Pornire server Next.js pe http://localhost:3000
echo    (Frontend - interfața utilizatorului)
echo.
echo 📝 Asigură-te că backend-ul rulează pe http://127.0.0.1:8000
echo.
npm run dev
pause

