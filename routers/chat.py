from fastapi import APIRouter, Depends, HTTPException, status, Query, Body
from fastapi.responses import StreamingResponse, JSONResponse, HTMLResponse, FileResponse
from typing import Optional
import asyncio
import os
import json
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
    
    # Parametrii optimizați pentru viteză
    # Folosim parametri mai agresivi pentru a accelera generarea
    options = {
        "temperature": 0.3,  # Determinist dar nu prea rigid
        "top_p": 0.9,  # Balanță între calitate și viteză
        "top_k": 40,  # Limitează opțiunile pentru viteză
        "num_predict": 3000,  # Suficient pentru răspunsuri complete
        "repeat_penalty": 1.1,  # Evită repetări
    }
    
    # Dacă există context de formular, optimizează mai mult pentru JSON
    if page_context and page_context.get("has_form"):
        options.update({
            "temperature": 0.2,  # Foarte determinist pentru JSON rapid
            "top_p": 0.85,
            "top_k": 20,
            "num_predict": 2000,
        })
    
    print(f"🤖 Apel Ollama: model={model}, {len(messages)} mesaje, options={options}")
    
    try:
        stream = ollama.chat(
            model=model, 
            messages=messages, 
            stream=True,
            options=options
        )
        print(f"✅ Stream Ollama creat cu succes")
    except Exception as e:
        print(f"❌ Eroare la apelul Ollama: {e}")
        import traceback
        traceback.print_exc()
        # Returnează un mesaj de eroare
        yield f"Eroare: Nu s-a putut conecta la Ollama ({str(e)}). Verifică dacă Ollama rulează și dacă modelul '{model}' este instalat."
        return
    
    chunk_count = 0
    has_content = False
    total_content = ""
    
    try:
        print(f"🔄 Începe streaming de la Ollama...")
        for chunk in stream:
            chunk_count += 1
            
            # Convert chunk to dict if it's a Pydantic model
            chunk_dict = None
            if hasattr(chunk, 'model_dump'):
                chunk_dict = chunk.model_dump()
            elif hasattr(chunk, 'dict'):
                chunk_dict = chunk.dict()
            elif isinstance(chunk, dict):
                chunk_dict = chunk
            
            # Log primele câteva chunk-uri pentru debugging
            if chunk_count <= 3:
                chunk_info = f"type={type(chunk).__name__}"
                if chunk_dict:
                    chunk_info += f", keys={list(chunk_dict.keys())}"
                    if "message" in chunk_dict:
                        msg = chunk_dict["message"]
                        if isinstance(msg, dict):
                            chunk_info += f", message_keys={list(msg.keys()) if msg else 'None'}"
                        elif hasattr(msg, '__dict__'):
                            chunk_info += f", message_attrs={list(msg.__dict__.keys()) if msg else 'None'}"
                print(f"📦 Chunk {chunk_count}: {chunk_info}")
            
            # Extrage conținutul din chunk - folosește o abordare unificată
            content = None
            done = False
            
            # Convertește chunk la dict dacă este Pydantic model
            if not chunk_dict:
                if hasattr(chunk, 'model_dump'):
                    chunk_dict = chunk.model_dump()
                elif hasattr(chunk, 'dict'):
                    chunk_dict = chunk.dict()
                elif isinstance(chunk, dict):
                    chunk_dict = chunk
            
            # Extrage conținutul din message
            if chunk_dict and "message" in chunk_dict:
                msg = chunk_dict["message"]
                
                # Dacă message este un obiect Pydantic, convertește-l la dict
                if hasattr(msg, 'model_dump'):
                    msg = msg.model_dump()
                elif hasattr(msg, 'dict'):
                    msg = msg.dict()
                
                # Dacă message este dict, extrage content
                if isinstance(msg, dict):
                    content = msg.get("content", None)
                # Dacă message este obiect cu atribut content, accesează direct
                elif hasattr(msg, 'content'):
                    content = msg.content
            
            # Încearcă și acces direct la chunk.message.content (pentru Pydantic)
            if not content and hasattr(chunk, 'message') and chunk.message:
                if hasattr(chunk.message, 'content'):
                    content = chunk.message.content
            
            # Extrage done
            if chunk_dict:
                done = chunk_dict.get("done", False)
            elif hasattr(chunk, 'done'):
                done = chunk.done
            
            # Debug pentru primele chunk-uri
            if chunk_count <= 3:
                content_preview = content[:50] + "..." if content and len(content) > 50 else (content if content else "None")
                print(f"🔍 Chunk {chunk_count} - content={content_preview}, done={done}")
            
            if content:
                has_content = True
                total_content += content
                # Trimite conținutul direct (fără delay pentru fiecare caracter) pentru viteză mai mare
                yield content
                # Delay minim doar pentru a permite browser-ului să proceseze
                await asyncio.sleep(0.001)
            
            # Verifică dacă stream-ul s-a terminat
            if done:
                print(f"✅ Streaming terminat: {chunk_count} chunk-uri, {len(total_content)} caractere")
                break
    except Exception as e:
        print(f"❌ Eroare la streaming de la Ollama: {e}")
        import traceback
        traceback.print_exc()
        if not has_content:
            yield f"Eroare: Nu s-a primit răspuns de la Ollama ({str(e)}). Verifică dacă modelul '{model}' este corect și Ollama rulează."
    
    if chunk_count == 0:
        print(f"⚠️ Nu s-au primit chunk-uri de la Ollama (model: {model})")
        yield f"Eroare: Nu s-a primit răspuns de la Ollama. Verifică dacă modelul '{model}' este instalat (ollama pull {model}) și Ollama rulează."
    elif not has_content:
        print(f"⚠️ S-au primit {chunk_count} chunk-uri dar fără conținut")
        yield f"Eroare: Ollama a răspuns dar fără conținut. Verifică log-urile pentru detalii."

@router.post("/{chat_id}/ask")
async def ask_dynamic(chat_id: str, request: ChatRequest, current_user: dict = Depends(get_current_user)):
    print("\n" + "=" * 80)
    print("🚀🚀🚀 ask_dynamic APELAT 🚀🚀🚀")
    print("=" * 80)
    print(f"📥 Request object type: {type(request)}")
    print(f"📥 Request.message: {getattr(request, 'message', 'N/A')[:50] if hasattr(request, 'message') else 'N/A'}")
    print(f"📥 Request.files_info EXISTS: {hasattr(request, 'files_info')}")
    print(f"📥 Request.files_info VALUE: {getattr(request, 'files_info', 'N/A')}")
    print(f"📥 Request.files_info TYPE: {type(getattr(request, 'files_info', None))}")
    
    # Verifică model_dump pentru a vedea toate valorile
    try:
        request_dict = request.model_dump() if hasattr(request, 'model_dump') else request.dict() if hasattr(request, 'dict') else {}
        print(f"📥 Request.model_dump(): {json.dumps(request_dict, indent=2, ensure_ascii=False)[:2000]}")
    except Exception as e:
        print(f"📥 Eroare la model_dump: {e}")
    
    if hasattr(request, 'files_info') and request.files_info is not None:
        print(f"📥✅ Request.files_info IS NOT NONE!")
        print(f"📥 Request.files_info LENGTH: {len(request.files_info) if isinstance(request.files_info, list) else 'N/A'}")
        print(f"📥 Request.files_info CONTENT: {json.dumps(request.files_info, indent=2, ensure_ascii=False)[:1000]}")
    else:
        print(f"📥❌ Request.files_info IS NONE sau nu există!")
    print("=" * 80 + "\n")
    
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
    
    # Colectează textele din fișierele din istoric (din file_info)
    files_text_from_history = []
    for msg in conversation_history:
        if msg.get('file_info') and msg['file_info'].get('text'):
            files_text_from_history.append({
                'filename': msg['file_info'].get('filename', 'necunoscut'),
                'text': msg['file_info'].get('text', '')
            })
    
    # Adaugă mesajul nou al utilizatorului în istoric
    user_message = request.message
    
    print("\n" + "=" * 80)
    print("🔍🔍🔍 DEBUG ask_dynamic - PRIMIRE REQUEST 🔍🔍🔍")
    print("=" * 80)
    print(f"📨 Request primit:")
    print(f"  - chat_id: {chat_id}")
    print(f"  - session_id: {session_id}")
    print(f"  - user_id: {user_id}")
    print(f"  - message: {user_message[:100] if user_message else 'EMPTY'}...")
    print(f"  - message length: {len(user_message) if user_message else 0}")
    # IMPORTANT: Folosește model_dump pentru a vedea valorile reale din request
    request_dict = {}
    try:
        if hasattr(request, 'model_dump'):
            request_dict = request.model_dump()
        elif hasattr(request, 'dict'):
            request_dict = request.dict()
        print(f"  - request_dict keys: {list(request_dict.keys())}")
        print(f"  - request_dict['files_info']: {request_dict.get('files_info')}")
        print(f"  - request_dict['files_info'] type: {type(request_dict.get('files_info'))}")
    except Exception as e:
        print(f"⚠️ Eroare la model_dump: {e}")
    
    print(f"  - hasattr files_info: {hasattr(request, 'files_info')}")
    print(f"  - request.files_info direct: {getattr(request, 'files_info', 'ATTR_NOT_EXISTS')}")
    print(f"  - request.files_info type: {type(getattr(request, 'files_info', None))}")
    
    # Verifică dacă există fișiere în request și salvează-le
    # IMPORTANT: Folosește request_dict pentru a obține valoarea reală
    file_info_to_save = None
    files_info_raw = request_dict.get('files_info') if request_dict else getattr(request, 'files_info', None)
    
    if files_info_raw is not None:
        print(f"✅✅✅ files_info_raw EXISTS și nu este None! ✅✅✅")
        print(f"  - files_info_raw type: {type(files_info_raw)}")
        print(f"  - files_info_raw value: {files_info_raw}")
        
        if isinstance(files_info_raw, list) and len(files_info_raw) > 0:
            print(f"✅✅✅ EXISTĂ {len(files_info_raw)} FIȘIER(E) ÎN REQUEST! ✅✅✅")
            for idx, file_data in enumerate(files_info_raw):
                print(f"  📄 Fișier {idx + 1}:")
                print(f"    - filename: {file_data.get('filename', 'N/A')}")
                print(f"    - type: {file_data.get('type', 'N/A')}")
                print(f"    - has text: {bool(file_data.get('text'))}")
                if file_data.get('text'):
                    print(f"    - text length: {len(file_data.get('text', ''))}")
            
            # Dacă există mai multe fișiere, salvează primul (sau combină informațiile)
            # Pentru simplitate, salvăm primul fișier sau combinăm toate într-un singur file_info
            first_file = files_info_raw[0]
            file_info_to_save = {
                "type": "file",
                "filename": first_file.get("filename", "necunoscut"),
                "fileType": first_file.get("type", "pdf")
            }
            # Dacă există text extras, îl adăugăm
            if first_file.get("text"):
                text_content = first_file["text"]
                file_info_to_save["text"] = text_content[:10000]  # Limitează la 10000 caractere
                file_info_to_save["textLength"] = len(text_content)
                print(f"✅ Text extras adăugat: {len(file_info_to_save['text'])} caractere")
            
            print(f"📎✅✅✅ file_info_to_save CONSTRUIT ✅✅✅:")
            print(f"  - type: {file_info_to_save.get('type')}")
            print(f"  - filename: {file_info_to_save.get('filename')}")
            print(f"  - fileType: {file_info_to_save.get('fileType')}")
            print(f"  - has text: {bool(file_info_to_save.get('text'))}")
            if file_info_to_save.get('text'):
                print(f"  - text length: {len(file_info_to_save.get('text', ''))}")
        elif isinstance(files_info_raw, list) and len(files_info_raw) == 0:
            print(f"⚠️ files_info este listă goală")
        else:
            print(f"⚠️ files_info nu este listă validă: {type(files_info_raw)}")
    else:
        print(f"❌❌❌ NU EXISTĂ files_info în request (este None) ❌❌❌")
        print(f"  - files_info_raw: {files_info_raw}")
        print(f"  - request.files_info direct: {getattr(request, 'files_info', 'ATTR_NOT_EXISTS')}")
    
    print("=" * 80)
    print("💾 SALVARE ÎN BAZA DE DATE")
    print("=" * 80)
    print(f"  - session_id: {session_id}")
    print(f"  - chat_id: {chat_id if not session_id else None}")
    print(f"  - role: user")
    print(f"  - content: {user_message[:50]}..." if user_message else "empty")
    print(f"  - user_id: {user_id}")
    print(f"  - file_info_to_save: {file_info_to_save}")
    
    # Salvează mesajul utilizatorului cu file_info dacă există
    result = db_add_message_to_conversation(
        session_id=session_id, 
        chat_id=chat_id if not session_id else None, 
        role="user", 
        content=user_message, 
        user_id=user_id,
        file_info=file_info_to_save
    )
    
    print(f"✅ Rezultat salvare: {result}")
    print("=" * 80)
    
    # Obține istoricul actualizat
    updated_history = db_get_conversation_history(chat_id=chat_id if not session_id else None, session_id=session_id, user_id=user_id)
    
    # Extrage datele instituției și tenant_id
    tenant_id = get_tenant_id_from_chat_id(chat_id)
    institution_data = config.get("institution")
    
    # Construiește mesajele cu istoricul complet
    # System prompt-ul va fi generat dinamic în stream_response
    messages = [{"role": "system", "content": config["prompt"]}]
    
    # Procesează istoricul pentru a include informații despre fișiere în context
    processed_history = []
    for msg in updated_history:
        processed_msg = {"role": msg["role"], "content": msg["content"]}
        
        # Dacă mesajul are file_info, adaugă informații despre fișier în conținut pentru LLM
        if msg.get('file_info') and msg['file_info'].get('type') == 'file':
            file_info = msg['file_info']
            filename = file_info.get('filename', 'necunoscut')
            file_type = file_info.get('fileType', 'pdf')
            
            # Adaugă informații despre fișier în conținutul mesajului pentru LLM
            file_context = f"\n[Fișier atașat: {filename} ({file_type})"
            if file_info.get('text'):
                file_context += f" - Text extras: {file_info['text'][:500]}..."
            file_context += "]"
            
            # Adaugă contextul fișierului la conținutul mesajului
            processed_msg["content"] = msg["content"] + file_context
        
        processed_history.append(processed_msg)
    
    # Adaugă istoricul procesat
    messages.extend(processed_history)
    
    # Combină textele din fișierele din istoric cu pdf_text din request (dacă există)
    combined_pdf_text = request.pdf_text or ""
    if files_text_from_history:
        history_files_text = "\n\n".join([
            f"--- {f['filename']} (din istoric) ---\n{f['text']}"
            for f in files_text_from_history
        ])
        if combined_pdf_text:
            combined_pdf_text = history_files_text + "\n\n--- Fișiere noi ---\n" + combined_pdf_text
        else:
            combined_pdf_text = history_files_text
    
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
            combined_pdf_text,  # Folosește combined_pdf_text care include și fișierele din istoric
            rag_content,
            institution_data,
            rag_search_query,
            tenant_id
        ):
            full_response += chunk
            yield chunk
        
        # După ce s-a terminat streaming-ul, salvează răspunsul în istoric
        if full_response.strip():
            # Verifică dacă răspunsul conține link-uri către PDF-uri generate
            import re
            pdf_url_pattern = r'(?:https?://[^\s]+)?/pdf_generated/[^\s\)]+\.pdf'
            pdf_matches = re.findall(pdf_url_pattern, full_response, re.IGNORECASE)
            
            file_info_for_response = None
            if pdf_matches:
                # Dacă există PDF-uri generate, salvează informații despre ele
                first_pdf = pdf_matches[0]
                filename = first_pdf.split('/')[-1] if '/' in first_pdf else first_pdf
                file_info_for_response = {
                    "type": "file",
                    "filename": filename,
                    "fileType": "pdf",
                    "url": first_pdf,
                    "generated": True
                }
                print(f"📎 Răspuns conține PDF generat: {filename}")
            
            db_add_message_to_conversation(
                session_id=session_id, 
                chat_id=chat_id if not session_id else None, 
                role="assistant", 
                content=full_response, 
                user_id=user_id,
                file_info=file_info_for_response
            )
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
        # Obține user_id din token sau default
        user_id = current_user.get('id') if current_user else 1
        
        # Convertește chat_id la int
        client_chat_id = None
        try:
            client_chat_id = int(chat_id)
        except ValueError:
            # Dacă nu este int, caută după name
            try:
                from database import get_client_chat
                client = get_client_chat(chat_id)
                if not client:
                    # Returnează lista goală în loc de 404 pentru a evita erori în frontend
                    return JSONResponse(content={
                        "success": True,
                        "sessions": []
                    })
                client_chat_id = client['id']
            except Exception as db_error:
                print(f"⚠️ Eroare la căutarea chat-ului {chat_id}: {db_error}")
                # Returnează lista goală în loc de eroare pentru a evita crash-uri
                return JSONResponse(content={
                    "success": True,
                    "sessions": []
                })
        
        if client_chat_id is None:
            return JSONResponse(content={
                "success": True,
                "sessions": []
            })
        
        # Listă sesiunile
        try:
            from database import list_user_chat_sessions
            sessions = list_user_chat_sessions(user_id, client_chat_id)
        except Exception as db_error:
            print(f"⚠️ Eroare la listarea sesiunilor din baza de date: {db_error}")
            import traceback
            traceback.print_exc()
            # Returnează lista goală în loc să crape
            sessions = []
        
        return JSONResponse(content={
            "success": True,
            "sessions": sessions
        })
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"❌ Eroare neașteptată la listarea sesiunilor: {error_details}")
        # Returnează lista goală în loc de eroare pentru a evita crash-uri în frontend
        return JSONResponse(
            status_code=200,  # Returnează 200 cu lista goală în loc de 500
            content={
                "success": True,
                "sessions": []
            }
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

@router.post("/{chat_id}/save-message")
async def save_message(
    chat_id: str,
    request: dict = Body(...),
    current_user: dict = Depends(get_current_user)
):
    """Salvează un mesaj în baza de date (folosit pentru mesaje cu imagini/PDF-uri)"""
    import sys
    sys.stdout.flush()  # Forțează afișarea
    
    print("\n" + "=" * 80)
    print("🔍🔍🔍 save_message - ENDPOINT APELAT 🔍🔍🔍")
    print("=" * 80)
    print(f"📥 Request primit:")
    print(f"  - chat_id: {chat_id}")
    print(f"  - request type: {type(request)}")
    print(f"  - request keys: {request.keys() if isinstance(request, dict) else 'N/A'}")
    print(f"  - request complet: {json.dumps(request, indent=2, ensure_ascii=False)[:2000]}")
    print("=" * 80)
    sys.stdout.flush()
    
    from database import add_message_to_conversation, get_client_chat, create_chat_session
    
    # Obține user_id
    user_id = None
    if current_user:
        user_id = current_user.get('id')
    else:
        user_id = 1  # Default user
    
    # Obține session_id din request sau creează una nouă
    session_id = request.get('session_id')
    
    # Dacă nu avem session_id, obține ultima sesiune sau creează una nouă
    if not session_id:
        from database import list_user_chat_sessions, get_client_chat
        # Obține client_chat_id
        client_chat = get_client_chat(chat_id)
        if not client_chat:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Chat {chat_id} nu există"
            )
        client_chat_id = client_chat['id']
        
        sessions = list_user_chat_sessions(user_id, client_chat_id)
        if sessions:
            session_id = sessions[0]['id']  # Folosește ultima sesiune
        else:
            # Creează o sesiune nouă
            session_id = create_chat_session(user_id, client_chat_id, "Chat nou")
    
    # Salvează mesajul
    role = request.get('role', 'user')
    content = request.get('content', '')
    file_info = request.get('file_info', None)  # Obține file_info dacă există
    
    # Log pentru debugging
    import sys
    sys.stdout.flush()
    print(f"\n🔍 DEBUG save_message - PRELUARE DATE:")
    print(f"  - role: {role}")
    print(f"  - content: {content[:100]}..." if content else "  - content: EMPTY")
    print(f"  - content_length: {len(content) if content else 0}")
    print(f"  - file_info EXISTS: {'file_info' in request}")
    print(f"  - file_info VALUE: {file_info}")
    print(f"  - file_info type: {type(file_info)}")
    if file_info:
        print(f"  - file_info keys: {file_info.keys() if isinstance(file_info, dict) else 'N/A'}")
        print(f"📎✅✅✅ SALVARE MESAJE CU FIȘIER ✅✅✅:")
        print(f"    - filename: {file_info.get('filename', 'N/A')}")
        print(f"    - fileType: {file_info.get('fileType', 'N/A')}")
        print(f"    - has_text: {bool(file_info.get('text'))}")
        if file_info.get('text'):
            print(f"    - text_length: {len(file_info.get('text', ''))}")
    else:
        print(f"💬❌ Salvare mesaj text (FĂRĂ file_info) ❌")
    print("=" * 80)
    sys.stdout.flush()
    
    success = add_message_to_conversation(
        session_id=session_id,
        chat_id=chat_id,
        role=role,
        content=content,
        user_id=user_id,
        file_info=file_info
    )
    
    if success:
        return JSONResponse(content={"status": "success", "session_id": session_id})
    else:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Eroare la salvarea mesajului"
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

@router.get("/{chat_id}/rag-files")
async def list_rag_files(chat_id: str, current_user: dict = Depends(get_current_user)):
    """Listează toate fișierele RAG disponibile pentru un chat"""
    from database import get_client_chat, get_rag_files
    import os
    
    # Obține client_chat_id
    client_chat = get_client_chat(chat_id)
    
    if not client_chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    
    # Obține fișierele RAG din baza de date
    rag_files = get_rag_files(client_chat['id'], include_content=False)
    
    # Verifică și fișierele de pe disk (pentru debugging)
    rag_dir = os.path.join("rag", str(client_chat['id']))
    disk_files = []
    if os.path.exists(rag_dir):
        disk_files = [f for f in os.listdir(rag_dir) if os.path.isfile(os.path.join(rag_dir, f))]
    
    files = []
    for rf in rag_files:
        filename = rf.get('file')
        has_file_data = rf.get('has_file_data', 0) if 'has_file_data' in rf else 0
        exists_on_disk = filename in disk_files
        
        files.append({
            "filename": filename,
            "uploaded_at": rf.get('uploaded_at'),
            "has_content": rf.get('has_content', 0) if 'has_content' in rf else 1,
            "has_file_data": has_file_data,
            "exists_on_disk": exists_on_disk,
            "can_download": has_file_data > 0 or exists_on_disk
        })
    
    return JSONResponse(content={"files": files})

@router.get("/{chat_id}/rag-files/download")
async def download_rag_file(
    chat_id: str,
    filename: str = Query(..., description="Numele fișierului de descărcat"),
    current_user: dict = Depends(get_current_user)
):
    """Descarcă un fișier RAG"""
    from database import get_client_chat, get_rag_files
    from core.conversation import get_tenant_id_from_chat_id
    
    # Obține client_chat_id
    client_chat = get_client_chat(chat_id)
    
    if not client_chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    
    # Obține fișierul din baza de date
    rag_files = get_rag_files(client_chat['id'], include_content=False, include_file_data=True)
    rag_file = next((rf for rf in rag_files if rf.get('file') == filename), None)
    
    if not rag_file:
        raise HTTPException(status_code=404, detail=f"File '{filename}' not found in RAG")
    
    # Verifică dacă fișierul are date binare în baza de date
    file_data = rag_file.get('file_data')
    
    # Dacă nu are file_data în DB, încercă să îl citească de pe disk (pentru fișiere vechi)
    if not file_data:
        import os
        # Încearcă mai multe locații posibile
        possible_paths = [
            os.path.join("rag", str(client_chat['id']), filename),
            os.path.join("rag", chat_id, filename),
            os.path.join("rag", str(client_chat['id']), filename.replace(' ', '_')),
            os.path.join("rag", chat_id, filename.replace(' ', '_')),
        ]
        
        file_path = None
        for path in possible_paths:
            if os.path.exists(path):
                file_path = path
                print(f"✅ Fișier găsit pe disk la: {path}")
                break
        
        if file_path:
            # Citește de pe disk
            try:
                with open(file_path, "rb") as f:
                    file_data = f.read()
                print(f"✅ Fișier citit de pe disk: {len(file_data)} bytes")
                
                # Opțional: salvează în baza de date pentru viitor
                try:
                    from database import add_rag_file
                    add_rag_file(client_chat['id'], filename, None, file_data)
                    print(f"✅ Fișier salvat în baza de date pentru viitor")
                except Exception as e:
                    print(f"⚠️ Nu s-a putut salva în DB (poate câmpul file_data nu există): {e}")
            except Exception as e:
                print(f"❌ Eroare la citirea fișierului de pe disk: {e}")
                raise HTTPException(
                    status_code=500,
                    detail=f"Error reading file from disk: {str(e)}"
                )
        else:
            # Listă fișierele disponibile pentru debugging
            rag_dir = os.path.join("rag", str(client_chat['id']))
            available_files = []
            if os.path.exists(rag_dir):
                available_files = [f for f in os.listdir(rag_dir) if os.path.isfile(os.path.join(rag_dir, f))]
            
            error_msg = f"File '{filename}' has no binary data in database and not found on disk."
            if available_files:
                error_msg += f" Available files: {', '.join(available_files[:5])}"
            error_msg += " Please re-upload the file."
            
            raise HTTPException(status_code=404, detail=error_msg)
    
    # Returnează fișierul pentru descărcare
    import io
    return StreamingResponse(
        io.BytesIO(file_data),
        media_type='application/pdf',
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"'
        }
    )

@router.post("/{chat_id}/generate-pdf")
async def generate_pdf(
    chat_id: str,
    request: Optional[dict] = Body(None),
    current_user: dict = Depends(get_current_user)
):
    """Generează un PDF din conversația chat-ului sau un document RAG"""
    from database import get_client_chat, get_conversation_history, get_rag_files
    from core.conversation import get_tenant_id_from_chat_id
    import io
    import json
    
    # Obține session_id și rag_filename din body dacă există
    session_id = None
    rag_filename = None
    if request:
        if isinstance(request, dict):
            session_id = request.get('session_id')
            rag_filename = request.get('rag_filename')
        elif isinstance(request, str):
            try:
                request_dict = json.loads(request)
                session_id = request_dict.get('session_id')
                rag_filename = request_dict.get('rag_filename')
            except:
                pass
    
    # Obține client_chat_id
    client_chat = get_client_chat(chat_id)
    
    if not client_chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    
    # Dacă este cerut un document RAG, returnează-l direct din baza de date
    if rag_filename:
        # Obține fișierul din baza de date
        rag_files = get_rag_files(client_chat['id'], include_content=False, include_file_data=True)
        rag_file = next((rf for rf in rag_files if rf.get('file') == rag_filename), None)
        
        if not rag_file:
            raise HTTPException(status_code=404, detail=f"File '{rag_filename}' not found in RAG")
        
        # Verifică dacă fișierul are date binare în baza de date
        file_data = rag_file.get('file_data')
        if not file_data:
            raise HTTPException(status_code=404, detail=f"File '{rag_filename}' has no binary data in database")
        
        # Returnează fișierul din baza de date
        import io
        return StreamingResponse(
            io.BytesIO(file_data),
            media_type='application/pdf',
            headers={
                "Content-Disposition": f'attachment; filename="{rag_filename}"'
            }
        )
    
    # Altfel, generează PDF din conversație
    # Obține istoricul conversației
    history = get_conversation_history(client_chat['id'], session_id)
    
    # Verifică dacă history este un dicționar sau o listă
    if isinstance(history, dict):
        messages = history.get('messages', [])
    elif isinstance(history, list):
        messages = history
    else:
        messages = []
    
    if not messages:
        raise HTTPException(status_code=400, detail="No messages found in conversation")
    
    # Generează conținutul PDF simplu (text formatat)
    pdf_content = generate_simple_pdf_content(messages, client_chat.get('name', 'Chat'))
    
    # Returnează PDF-ul ca răspuns
    # pdf_content este deja bytes dacă folosește reportlab sau generate_minimal_pdf
    if isinstance(pdf_content, str):
        pdf_bytes = pdf_content.encode('utf-8')
    else:
        pdf_bytes = pdf_content
    
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type='application/pdf',
        headers={
            "Content-Disposition": f'attachment; filename="chat_{chat_id}_{session_id or "default"}.pdf"'
        }
    )

def generate_simple_pdf_content(messages: list, chat_name: str) -> bytes:
    """Generează conținut PDF simplu din mesaje folosind reportlab sau PDF minimal"""
    try:
        # Încearcă să folosească reportlab dacă este disponibil
        from reportlab.lib.pagesizes import letter
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.units import inch
        from reportlab.lib import colors
        from io import BytesIO
        
        buffer = BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter)
        story = []
        styles = getSampleStyleSheet()
        
        # Stiluri personalizate
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontSize=16,
            textColor=colors.HexColor('#1a1a1a'),
            spaceAfter=30,
        )
        
        role_style = ParagraphStyle(
            'CustomRole',
            parent=styles['Heading2'],
            fontSize=12,
            textColor=colors.HexColor('#3b82f6'),
            spaceAfter=10,
        )
        
        # Titlu
        story.append(Paragraph(chat_name, title_style))
        story.append(Spacer(1, 0.2*inch))
        
        # Mesaje
        for msg in messages:
            role = "Utilizator" if msg.get('role') == 'user' else "Asistent"
            timestamp = msg.get('created_at', '') or msg.get('timestamp', '')
            if timestamp:
                try:
                    from datetime import datetime
                    if isinstance(timestamp, str):
                        dt = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
                        timestamp = dt.strftime('%Y-%m-%d %H:%M:%S')
                except:
                    pass
            
            role_text = f"[{role}"
            if timestamp:
                role_text += f" - {timestamp}"
            role_text += "]"
            
            story.append(Paragraph(role_text, role_style))
            
            # Conținut mesaj
            content = msg.get('content', '').replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
            story.append(Paragraph(content, styles['Normal']))
            story.append(Spacer(1, 0.3*inch))
        
        doc.build(story)
        buffer.seek(0)
        return buffer.getvalue()
        
    except ImportError:
        # Fallback: generează un PDF minimal valid manual
        return generate_minimal_pdf(messages, chat_name)

def generate_minimal_pdf(messages: list, chat_name: str) -> bytes:
    """Generează un PDF minimal valid manual"""
    # Structură PDF minimală
    pdf_parts = []
    
    # Header PDF
    pdf_parts.append(b"%PDF-1.4\n")
    
    # Generează textul pentru conținut
    text_lines = [chat_name.encode('utf-8'), b"\n\n"]
    for msg in messages:
        role = b"Utilizator" if msg.get('role') == 'user' else b"Asistent"
        timestamp = msg.get('created_at', '') or msg.get('timestamp', '')
        if timestamp:
            try:
                from datetime import datetime
                if isinstance(timestamp, str):
                    dt = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
                    timestamp = dt.strftime('%Y-%m-%d %H:%M:%S').encode('utf-8')
                else:
                    timestamp = b''
            except:
                timestamp = b''
        
        text_lines.append(b"[" + role)
        if timestamp:
            text_lines.append(b" - " + timestamp)
        text_lines.append(b"]\n")
        text_lines.append(b"-" * 50 + b"\n")
        content = msg.get('content', '').encode('utf-8')
        text_lines.append(content)
        text_lines.append(b"\n\n")
    
    text_content = b''.join(text_lines)
    
    # Objetele PDF (simplificate)
    # Catalog
    catalog_obj = b"1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n"
    
    # Pages
    pages_obj = b"2 0 obj\n<<\n/Type /Pages\n/Kids [3 0 R]\n/Count 1\n>>\nendobj\n"
    
    # Page
    page_obj = b"3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/MediaBox [0 0 612 792]\n/Contents 4 0 R\n/Resources <<\n/Font <<\n/F1 <<\n/Type /Font\n/Subtype /Type1\n/BaseFont /Helvetica\n>>\n>>\n>>\n>>\nendobj\n"
    
    # Content stream
    content_length = len(text_content)
    content_obj = b"4 0 obj\n<<\n/Length " + str(content_length).encode() + b"\n>>\nstream\n"
    content_obj += text_content
    content_obj += b"\nendstream\nendobj\n"
    
    # Construiește PDF-ul
    pdf_content = pdf_parts[0]
    pdf_content += catalog_obj
    pdf_content += pages_obj
    pdf_content += page_obj
    pdf_content += content_obj
    
    # Xref
    xref_offset = len(pdf_content)
    pdf_content += b"xref\n0 5\n"
    pdf_content += b"0000000000 65535 f \n"
    pdf_content += b"0000000009 00000 n \n"
    pdf_content += f"{len(pdf_parts[0] + catalog_obj):06d}".encode() + b" 00000 n \n"
    pdf_content += f"{len(pdf_parts[0] + catalog_obj + pages_obj):06d}".encode() + b" 00000 n \n"
    pdf_content += f"{len(pdf_parts[0] + catalog_obj + pages_obj + page_obj):06d}".encode() + b" 00000 n \n"
    pdf_content += b"trailer\n<<\n/Size 5\n/Root 1 0 R\n>>\n"
    pdf_content += f"startxref\n{xref_offset}\n%%EOF".encode()
    
    return pdf_content

