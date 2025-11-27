from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse, JSONResponse, HTMLResponse
from typing import Optional
import asyncio
from models.schemas import ChatRequest
from database import (
    get_client_chat, create_client_chat,
    get_chat_session, create_chat_session, list_user_chat_sessions,
    update_chat_session as db_update_chat_session, delete_chat_session as db_delete_chat_session,
    get_conversation_history as db_get_conversation_history,
    add_message_to_conversation as db_add_message_to_conversation
)
from core.auth import get_current_user
from core.cache import get_cached_config, invalidate_config_cache
from core.conversation import get_tenant_id_from_chat_id, create_default_config
from core.prompt import enhance_prompt_for_autofill
from core.config import ollama
from core.title_generator import generate_chat_title

router = APIRouter(prefix="/chat", tags=["chat"])

# === Stream răspuns cu prompt îmbunătățit ===
async def stream_response(messages, model, page_context=None, pdf_text=None, rag_content=None, institution_data=None, rag_search_query=None, tenant_id=None):
    # Îmbunătățește primul mesaj (system prompt) dacă există context
    if len(messages) > 0:
        messages[0]['content'] = enhance_prompt_for_autofill(
            messages[0]['content'], 
            page_context,
            pdf_text,
            rag_content,
            institution_data,
            rag_search_query,
            tenant_id
        )
    
    # Parametrii optimizați pentru viteză (doar când există context de formular)
    options = {}
    if page_context and page_context.get("has_form"):
        # Optimizări doar pentru generare JSON (mai rapid)
        options = {
            "temperature": 0.2,  # Foarte determinist pentru JSON rapid
            "top_p": 0.85,  # Redus pentru generare mai rapidă
            "top_k": 20,  # Limitează opțiunile pentru viteză
            "num_predict": 2000,  # Suficient pentru JSON complet
            "repeat_penalty": 1.1,  # Evită repetări
        }
    
    stream = ollama.chat(
        model=model, 
        messages=messages, 
        stream=True,
        options=options if options else None
    )
    
    for chunk in stream:
        if "message" in chunk and "content" in chunk["message"]:
            content = chunk["message"]["content"]
            if content:
                yield content
        await asyncio.sleep(0)

@router.post("/{chat_id}/ask")
async def ask_dynamic(chat_id: str, request: ChatRequest, current_user: dict = Depends(get_current_user)):
    # Verifică autentificarea (opțional - poate fi dezactivat pentru guest users)
    # Dacă nu există current_user, folosește user_id din request sau default
    user_id = None
    if current_user:
        user_id = current_user.get('id')
    else:
        user_id = getattr(request, 'user_id', None) or 1  # Default user_id = 1 pentru guest
    
    # Folosește cache pentru config (mult mai rapid)
    config = get_cached_config(chat_id)
    
    # Dacă config-ul nu există, creează unul default
    if not config:
        print(f"⚠️ Config nu există pentru {chat_id}, creez config default...")
        config = create_default_config(chat_id)
    
    # Extrage session_id din request (dacă există)
    session_id = getattr(request, 'session_id', None)
    
    # Dacă avem session_id, folosim sesiunea; altfel folosim modul vechi (compatibilitate)
    if session_id:
        # Verifică dacă sesiunea există
        session = get_chat_session(session_id)
        if not session:
            return JSONResponse(
                status_code=404,
                content={"error": f"Session {session_id} not found"}
            )
        # Verifică dacă sesiunea aparține user-ului curent (dacă este autentificat)
        if current_user and session.get('user_id') != current_user.get('id'):
            return JSONResponse(
                status_code=403,
                content={"error": "Nu ai acces la această sesiune de chat"}
            )
        # Folosește user_id din sesiune
        user_id = session.get('user_id', user_id)
    else:
        # Dacă nu avem session_id dar avem user_id, creează o sesiune nouă
        try:
            client_chat_id = int(chat_id)
        except ValueError:
            # Dacă nu este int, caută după name
            client = get_client_chat(chat_id)
            if not client:
                return JSONResponse(
                    status_code=404,
                    content={"error": f"Chat {chat_id} not found"}
                )
            client_chat_id = client['id']
        
        # Creează o sesiune nouă (funcția create_chat_session va crea automat user-ul dacă nu există)
        session_id = create_chat_session(user_id, client_chat_id, None)
        if not session_id:
            return JSONResponse(
                status_code=500,
                content={"error": "Failed to create chat session"}
            )
        print(f"✅ Sesiune nouă creată: {session_id} pentru user {user_id}, chat {chat_id}")
    
    # Extrage conținutul RAG din config dacă există
    rag_content = config.get("rag_content", [])
    rag_files = config.get("rag_files", [])
    
    # Log pentru debugging
    if rag_content:
        valid_rag = [r for r in rag_content if r.get("content", "").strip() and r.get("content", "") != "\n"]
        print(f"📚 RAG pentru {chat_id}: {len(valid_rag)} fișiere valide din {len(rag_content)} totale")
        if len(valid_rag) == 0:
            if rag_files:
                print(f"⚠️ ATENȚIE: Există {len(rag_files)} fișiere RAG pentru {chat_id}, dar toate sunt goale (probabil PDF-uri scanate). Re-procesează cu OCR sau convertează manual la text.")
            else:
                print(f"⚠️ ATENȚIE: Toate fișierele RAG sunt goale pentru {chat_id}! Re-procesează fișierele.")
    else:
        if rag_files:
            print(f"ℹ️ Există {len(rag_files)} fișiere RAG pentru {chat_id}, dar nu au conținut extractibil (probabil PDF-uri scanate). Re-procesează cu OCR.")
        else:
            print(f"ℹ️ Nu există RAG content pentru {chat_id}")
    
    # === GESTIONARE ISTORIC CONVERSAȚIE ===
    # Obține istoricul existent folosind session_id sau chat_id (compatibilitate)
    conversation_history = db_get_conversation_history(chat_id=chat_id if not session_id else None, session_id=session_id, user_id=user_id)
    
    # Adaugă mesajul nou al utilizatorului în istoric
    user_message = request.message
    db_add_message_to_conversation(session_id=session_id, chat_id=chat_id if not session_id else None, role="user", content=user_message, user_id=user_id)
    
    # Obține istoricul actualizat
    updated_history = db_get_conversation_history(chat_id=chat_id if not session_id else None, session_id=session_id, user_id=user_id)
    
    # Extrage datele instituției și tenant_id
    tenant_id = get_tenant_id_from_chat_id(chat_id)
    institution_data = config.get("institution")
    
    # Construiește mesajele cu istoricul complet
    # System prompt-ul va fi generat dinamic în stream_response
    messages = [{"role": "system", "content": config["prompt"]}]
    
    # Adaugă istoricul conversației complet (inclusiv mesajul nou al utilizatorului)
    messages.extend(updated_history)
    
    # Log pentru debugging
    print(f"💬 Conversație pentru {chat_id} (session: {session_id}, tenant: {tenant_id}): {len(conversation_history)} mesaje istorice + 1 mesaj nou = {len(updated_history)} mesaje totale în context")
    
    # === STREAM RĂSPUNS CU COLECTARE ===
    # Folosim un wrapper care colectează răspunsul complet
    full_response = ""
    user_message_for_title = user_message  # Salvează pentru generarea titlului
    
    # Folosește mesajul utilizatorului pentru căutare RAG semantică
    rag_search_query = request.message if request.message else None
    
    async def stream_with_collection():
        nonlocal full_response
        async for chunk in stream_response(
            messages, 
            config["model"], 
            request.page_context, 
            request.pdf_text, 
            rag_content,
            institution_data,
            rag_search_query,
            tenant_id
        ):
            full_response += chunk
            yield chunk
        
        # După ce s-a terminat streaming-ul, salvează răspunsul în istoric
        if full_response.strip():
            db_add_message_to_conversation(session_id=session_id, chat_id=chat_id if not session_id else None, role="assistant", content=full_response, user_id=user_id)
            print(f"✅ Răspuns salvat în istoric pentru {chat_id} (session: {session_id}): {len(full_response)} caractere")
            
            # Generează titlu automat dacă este prima conversație (doar 2 mesaje: user + assistant)
            if session_id:
                session = get_chat_session(session_id)
                if session and session.get('title') == 'Chat nou':
                    # Verifică dacă sunt doar 2 mesaje (primul user + primul assistant)
                    history_after = db_get_conversation_history(chat_id=None, session_id=session_id, user_id=user_id)
                    if len(history_after) == 2:  # Doar primul mesaj user și primul răspuns assistant
                        try:
                            # Generează titlu automat
                            auto_title = await generate_chat_title(user_message_for_title, full_response)
                            if auto_title and auto_title != "Chat nou":
                                db_update_chat_session(session_id, auto_title)
                                print(f"✅ Titlu generat automat pentru sesiune {session_id}: {auto_title}")
                        except Exception as e:
                            print(f"⚠️ Eroare la generarea titlului automat: {e}")
   
    return StreamingResponse(
        stream_with_collection(), 
        media_type="text/plain; charset=utf-8"
    )

@router.get("/{chat_id}/config")
async def get_chat_config(chat_id: str, current_user: dict = Depends(get_current_user)):
    # Verifică dacă chat-ul există
    # Folosește cache pentru config (mult mai rapid)
    config = get_cached_config(chat_id)
    
    # Dacă config-ul nu există, returnează 404 (nu creează automat)
    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Chat {chat_id} nu există"
        )
    
    # Nu returnăm conținutul RAG complet (prea mare), doar metadata
    response_config = {**config}
    if "rag_content" in response_config:
        # Returnăm doar informații despre fișiere, nu conținutul complet
        rag_info = []
        for item in response_config["rag_content"]:
            content = item.get("content", "")
            rag_info.append({
                "filename": item.get("filename", ""),
                "content_length": len(content),
                "has_content": bool(content and content.strip() and content != "\n")
            })
        response_config["rag_content_info"] = rag_info
        # Nu trimitem conținutul complet în response (prea mare pentru frontend)
        del response_config["rag_content"]
    
    return JSONResponse(content=response_config)

@router.post("/{chat_id}/session/create")
async def create_session(chat_id: str, request: dict, current_user: dict = Depends(get_current_user)):
    """Creează o nouă sesiune de chat pentru un utilizator"""
    try:
        # Verifică dacă chat-ul există
        config = get_cached_config(chat_id)
        if not config:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Chat {chat_id} nu există"
            )
        
        user_id = current_user.get('id') if current_user else request.get("user_id", 1)
        title = request.get("title", None)
        
        # Convertește chat_id la int
        try:
            client_chat_id = int(chat_id)
        except ValueError:
            # Dacă nu este int, caută după name
            client = get_client_chat(chat_id)
            if not client:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Chat {chat_id} nu există"
                )
            client_chat_id = client['id']
        
        session_id = create_chat_session(user_id, client_chat_id, title)
        if not session_id:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Eroare la crearea sesiunii de chat"
            )
        
        return JSONResponse(content={
            "success": True,
            "session_id": session_id,
            "message": f"Sesiune de chat creată cu succes"
        })
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Eroare la crearea sesiunii: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@router.get("/{chat_id}/sessions")
async def list_sessions(chat_id: str, current_user: dict = Depends(get_current_user)):
    """Listează toate sesiunile de chat ale unui utilizator pentru un chatbot"""
    try:
        # Verifică dacă chat-ul există
        config = get_cached_config(chat_id)
        if not config:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Chat {chat_id} nu există"
            )
        
        # Convertește chat_id la int
        try:
            client_chat_id = int(chat_id)
        except ValueError:
            # Dacă nu este int, caută după name
            client = get_client_chat(chat_id)
            if not client:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Chat {chat_id} nu există"
                )
            client_chat_id = client['id']
        
        # Obține user_id din token sau default
        user_id = current_user.get('id') if current_user else 1
        
        sessions = list_user_chat_sessions(user_id, client_chat_id)
        
        return JSONResponse(content={
            "success": True,
            "sessions": sessions
        })
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Eroare la listarea sesiunilor: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@router.post("/{chat_id}/clear")
async def clear_chat_history(chat_id: str, session_id: Optional[int] = None, current_user: dict = Depends(get_current_user)):
    """Șterge istoricul conversației pentru un chat sau o sesiune"""
    from database import clear_conversation_history as db_clear_conversation_history
    
    # Dacă avem session_id, verifică că sesiunea aparține user-ului
    if session_id:
        session = get_chat_session(session_id)
        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Sesiune {session_id} nu există"
            )
        if current_user and session.get('user_id') != current_user.get('id'):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Nu ai acces la această sesiune"
            )
    
    user_id = current_user.get('id') if current_user else None
    db_clear_conversation_history(session_id=session_id, chat_id=chat_id if not session_id else None, user_id=user_id)
    return JSONResponse(content={
        "success": True,
        "message": f"Istoricul conversației a fost șters"
    })

@router.put("/{chat_id}/session/{session_id}")
async def update_session(chat_id: str, session_id: int, request: dict, current_user: dict = Depends(get_current_user)):
    """Actualizează o sesiune de chat (redenumire)"""
    try:
        # Verifică că sesiunea există
        session = get_chat_session(session_id)
        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Sesiune {session_id} nu există"
            )
        
        # Verifică accesul
        if current_user and session.get('user_id') != current_user.get('id'):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Nu ai acces la această sesiune"
            )
        
        # Extrage title din request
        title = request.get('title')
        if title is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Câmpul 'title' este obligatoriu"
            )
        
        # Actualizează sesiunea
        success = db_update_chat_session(session_id, title)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Eroare la actualizarea sesiunii"
            )
        
        return JSONResponse(content={
            "success": True,
            "message": "Sesiunea a fost actualizată cu succes",
            "session": get_chat_session(session_id)
        })
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Eroare la actualizarea sesiunii: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@router.delete("/{chat_id}/session/{session_id}")
async def delete_session(chat_id: str, session_id: int, current_user: dict = Depends(get_current_user)):
    """Șterge o sesiune de chat și toate mesajele asociate"""
    try:
        # Verifică că sesiunea există
        session = get_chat_session(session_id)
        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Sesiune {session_id} nu există"
            )
        
        # Verifică accesul
        if current_user and session.get('user_id') != current_user.get('id'):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Nu ai acces la această sesiune"
            )
        
        # Șterge sesiunea (mesajele se șterg automat prin CASCADE)
        success = db_delete_chat_session(session_id)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Eroare la ștergerea sesiunii"
            )
        
        return JSONResponse(content={
            "success": True,
            "message": "Sesiunea și toate mesajele au fost șterse cu succes"
        })
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Eroare la ștergerea sesiunii: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@router.get("/{chat_id}/history")
async def get_chat_history(chat_id: str, session_id: Optional[int] = None, current_user: dict = Depends(get_current_user)):
    """Obține istoricul conversației pentru frontend"""
    # Extrage user_id
    user_id = None
    if current_user:
        user_id = current_user.get('id')
    else:
        # Dacă nu este autentificat, folosește default user
        user_id = 1  # Default user
    
    # Dacă avem session_id, verifică că sesiunea aparține user-ului
    if session_id:
        session = get_chat_session(session_id)
        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Sesiune {session_id} nu există"
            )
        # Verifică accesul (dacă este autentificat)
        if current_user and session.get('user_id') != current_user.get('id'):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Nu ai acces la această sesiune"
            )
        # Folosește user_id din sesiune
        user_id = session.get('user_id', user_id)
    
    # Obține istoricul
    history = db_get_conversation_history(chat_id=chat_id if not session_id else None, session_id=session_id, user_id=user_id)
    
    return JSONResponse(content={
        "chat_id": chat_id,
        "session_id": session_id,
        "message_count": len(history),
        "messages": history
    })

@router.get("/{chat_id}", response_class=HTMLResponse)
async def serve_chat(chat_id: str):
    # Verifică dacă chat-ul există în baza de date
    config = get_cached_config(chat_id)
    if not config:
        return HTMLResponse("<h3>Chat configurat inexistent.</h3>")
    with open("public/index.html", "r", encoding="utf-8") as f:
        return HTMLResponse(f.read())

@router.get("/list")
async def list_chats():
    """Listează toate chaturile disponibile"""
    from database import list_all_client_chats
    
    # Încarcă din baza de date
    db_chats = list_all_client_chats()
    
    chats = []
    for db_chat in db_chats:
        chats.append({
            "id": str(db_chat.get("id", "")),
            "name": db_chat.get("name", "Unknown"),
            "model": db_chat.get("model", "unknown")
        })
    
    return JSONResponse(content={"chats": chats})

