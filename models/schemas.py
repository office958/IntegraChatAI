from pydantic import BaseModel, EmailStr
from typing import Optional

# === Modele pentru autentificare ===
class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class RegisterRequest(BaseModel):
    name: str
    email: EmailStr
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict

# === Model pentru cererea de chat ===
class ChatRequest(BaseModel):
    message: str
    page_context: dict = None  # Context opțional despre pagina unde se află chatul
    pdf_text: str = None  # Text extras din PDF
    session_id: Optional[int] = None  # ID-ul sesiunii de chat (opțional)
    user_id: Optional[int] = None  # ID-ul utilizatorului (opțional)

