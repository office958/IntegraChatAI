import bcrypt
import jwt
from typing import Optional
from datetime import datetime, timedelta
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from database import get_user
from core.config import JWT_SECRET_KEY, JWT_ALGORITHM, JWT_EXPIRATION_HOURS

# Security - folosit pentru endpoint-uri care necesită autentificare obligatorie
security = HTTPBearer()
# Security optional - pentru endpoint-uri care permit și request-uri fără autentificare
security_optional = HTTPBearer(auto_error=False)

def hash_password(password: str) -> str:
    """Hash-uiește o parolă folosind bcrypt"""
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
    return hashed.decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifică dacă parola este corectă"""
    try:
        return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))
    except Exception as e:
        print(f"❌ Eroare la verificarea parolei: {e}")
        return False

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Creează un JWT token"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(hours=JWT_EXPIRATION_HOURS)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)
    return encoded_jwt

def verify_token(token: str) -> Optional[dict]:
    """Verifică și decodează un JWT token"""
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        print("❌ Token expirat")
        return None
    except jwt.InvalidTokenError:
        print("❌ Token invalid")
        return None

async def get_current_user(credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_optional)) -> Optional[dict]:
    """Obține utilizatorul curent din token (opțional - permite și request-uri fără autentificare)"""
    if credentials is None:
        return None
    token = credentials.credentials
    payload = verify_token(token)
    if payload is None:
        return None
    user_id = payload.get("sub")
    if user_id is None:
        return None
    user = get_user(user_id=int(user_id))
    if user is None:
        return None
    # Elimină parola din răspuns
    if 'password' in user:
        del user['password']
    return user

