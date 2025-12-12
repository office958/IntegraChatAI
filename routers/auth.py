from fastapi import APIRouter, HTTPException, status, Depends
from fastapi.responses import JSONResponse
from models.schemas import LoginRequest, RegisterRequest, TokenResponse
from database import get_user, create_user
from core.auth import hash_password, verify_password, create_access_token, get_current_user

router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/register", response_model=TokenResponse)
async def register(request: RegisterRequest):
    """Înregistrare utilizator nou"""
    try:
        # Verifică dacă email-ul există deja
        existing_user = get_user(email=request.email)
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email-ul este deja înregistrat"
            )
        
        # Hash-uiește parola
        hashed_password = hash_password(request.password)
        
        # Creează utilizatorul
        user_id = create_user(
            name=request.name,
            email=request.email,
            password=hashed_password,
            role='user'
        )
        
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Eroare la crearea contului"
            )
        
        # Obține utilizatorul creat
        user = get_user(user_id=user_id)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Eroare la obținerea datelor utilizatorului"
            )
        
        # Creează token JWT
        access_token = create_access_token(data={"sub": str(user_id), "email": request.email})
        
        # Elimină parola din răspuns
        user_response = {k: v for k, v in user.items() if k != 'password'}
        
        return TokenResponse(
            access_token=access_token,
            token_type="bearer",
            user=user_response
        )
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Eroare la înregistrare: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Eroare la înregistrare: {str(e)}"
        )

@router.post("/login", response_model=TokenResponse)
async def login(request: LoginRequest):
    """Autentificare utilizator"""
    try:
        # Obține utilizatorul după email
        user = get_user(email=request.email)
        if not user:
            return JSONResponse(
                status_code=status.HTTP_401_UNAUTHORIZED,
                content={"error": "Email sau parolă incorectă", "detail": "Email-ul nu există în sistem"}
            )
        
        # Verifică dacă parola există în user
        if 'password' not in user:
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content={"error": "Eroare la autentificare", "detail": "Parola utilizatorului nu a fost găsită"}
            )
        
        # Verifică parola
        if not verify_password(request.password, user['password']):
            return JSONResponse(
                status_code=status.HTTP_401_UNAUTHORIZED,
                content={"error": "Email sau parolă incorectă", "detail": "Parola este incorectă"}
            )
        
        # Creează token JWT
        try:
            access_token = create_access_token(data={"sub": str(user['id']), "email": user['email']})
        except Exception as e:
            import traceback
            print(f"❌ Eroare la crearea token-ului: {traceback.format_exc()}")
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content={"error": "Eroare la crearea token-ului", "detail": str(e)}
            )
        
        # Elimină parola din răspuns
        user_response = {k: v for k, v in user.items() if k != 'password'}
        
        return TokenResponse(
            access_token=access_token,
            token_type="bearer",
            user=user_response
        )
    except HTTPException as e:
        # Returnează ca JSON
        return JSONResponse(
            status_code=e.status_code,
            content={"error": e.detail, "detail": e.detail}
        )
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"❌ Eroare la login: {error_details}")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "error": "Eroare la autentificare",
                "detail": str(e),
                "type": type(e).__name__
            }
        )

@router.get("/me")
async def get_current_user_info(current_user: dict = Depends(get_current_user)):
    """Obține informațiile utilizatorului curent"""
    if current_user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Nu ești autentificat"
        )
    return JSONResponse(content=current_user)

@router.post("/logout")
async def logout():
    """Logout (în realitate, clientul trebuie să șteargă token-ul)"""
    return JSONResponse(content={"message": "Logout reușit"})

