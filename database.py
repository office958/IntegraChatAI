"""
Modul pentru gestionarea conexiunii și operațiilor pe baza de date MySQL.
Folosește mysql-connector-python pentru conexiune.
"""
import os
import mysql.connector
from mysql.connector import Error, pooling
from typing import Optional, List, Dict, Any
from datetime import datetime
import json

# Configurare conexiune din variabile de mediu
DB_CONFIG = {
    'host': os.getenv('DB_HOST', 'localhost'),
    'port': int(os.getenv('DB_PORT', 3306)),
    'user': os.getenv('DB_USER', 'root'),
    'password': os.getenv('DB_PASSWORD', 'root'),
    'database': os.getenv('DB_NAME', 'Integra_chat_ai'),
    'charset': 'utf8mb4',
    'collation': 'utf8mb4_unicode_ci',
    'autocommit': False
}

# Connection pool pentru performanță
_connection_pool: Optional[pooling.MySQLConnectionPool] = None

def get_connection_pool():
    """Creează sau returnează connection pool-ul"""
    global _connection_pool
    if _connection_pool is None:
        try:
            _connection_pool = pooling.MySQLConnectionPool(
                pool_name="integra_pool",
                pool_size=5,
                pool_reset_session=True,
                **DB_CONFIG
            )
            print(f"✅ Connection pool creat pentru {DB_CONFIG['database']}")
        except Error as e:
            print(f"❌ Eroare la crearea connection pool: {e}")
            raise
    return _connection_pool

def get_db_connection():
    """Obține o conexiune din pool"""
    try:
        pool = get_connection_pool()
        connection = pool.get_connection()
        return connection
    except Error as e:
        print(f"❌ Eroare la obținerea conexiunii: {e}")
        raise

# ==================== OPERAȚII PE TABELUL client_chat ====================

def get_client_chat(chat_id: str) -> Optional[Dict[str, Any]]:
    """Obține configurația unui chatbot din baza de date"""
    connection = None
    try:
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)
        
        # Caută după id (chat_id poate fi un string, dar în DB este INT)
        # Încearcă să convertească chat_id la int dacă este posibil
        try:
            chat_id_int = int(chat_id)
            query = "SELECT * FROM client_chat WHERE id = %s"
            cursor.execute(query, (chat_id_int,))
        except ValueError:
            # Dacă chat_id nu este un număr, caută după name sau alt câmp
            query = "SELECT * FROM client_chat WHERE name = %s OR id = %s"
            cursor.execute(query, (chat_id, chat_id))
        
        result = cursor.fetchone()
        
        if result:
            # Convertește datetime objects la string
            if result.get('updated_at'):
                result['updated_at'] = result['updated_at'].isoformat() if hasattr(result['updated_at'], 'isoformat') else str(result['updated_at'])
            
            # Obține și datele instituției
            institution = get_client_type(result['id'])
            if institution:
                result['institution'] = institution
            
            # Obține și fișierele RAG
            rag_files = get_rag_files(result['id'])
            result['rag_files'] = [rf['file'] for rf in rag_files]
            
            return result
        
        return None
    except Error as e:
        print(f"❌ Eroare la citirea client_chat: {e}")
        return None
    finally:
        if connection and connection.is_connected():
            cursor.close()
            connection.close()

def create_client_chat(name: str, model: str, prompt: str, chat_title: str = None, 
                       chat_subtitle: str = None, chat_color: str = None) -> Optional[int]:
    """Creează un nou chatbot și returnează ID-ul"""
    connection = None
    try:
        connection = get_db_connection()
        cursor = connection.cursor()
        
        query = """
            INSERT INTO client_chat (name, model, prompt, chat_title, chat_subtitle, chat_color, is_active)
            VALUES (%s, %s, %s, %s, %s, %s, 1)
        """
        cursor.execute(query, (name, model, prompt, chat_title, chat_subtitle, chat_color))
        connection.commit()
        
        chat_id = cursor.lastrowid
        print(f"✅ Chatbot creat cu ID: {chat_id}")
        return chat_id
    except Error as e:
        print(f"❌ Eroare la crearea client_chat: {e}")
        if connection:
            connection.rollback()
        return None
    finally:
        if connection and connection.is_connected():
            cursor.close()
            connection.close()

def update_client_chat(chat_id: int, name: str = None, model: str = None, prompt: str = None,
                       chat_title: str = None, chat_subtitle: str = None, 
                       chat_color: str = None, is_active: bool = None):
    """Actualizează un chatbot existent"""
    connection = None
    try:
        connection = get_db_connection()
        cursor = connection.cursor()
        
        updates = []
        values = []
        
        if name is not None:
            updates.append("name = %s")
            values.append(name)
        if model is not None:
            updates.append("model = %s")
            values.append(model)
        if prompt is not None:
            updates.append("prompt = %s")
            values.append(prompt)
        if chat_title is not None:
            updates.append("chat_title = %s")
            values.append(chat_title)
        if chat_subtitle is not None:
            updates.append("chat_subtitle = %s")
            values.append(chat_subtitle)
        if chat_color is not None:
            updates.append("chat_color = %s")
            values.append(chat_color)
        if is_active is not None:
            updates.append("is_active = %s")
            values.append(int(is_active))
        
        if not updates:
            return True
        
        values.append(chat_id)
        query = f"UPDATE client_chat SET {', '.join(updates)} WHERE id = %s"
        cursor.execute(query, values)
        connection.commit()
        
        print(f"✅ Chatbot {chat_id} actualizat")
        return True
    except Error as e:
        print(f"❌ Eroare la actualizarea client_chat: {e}")
        if connection:
            connection.rollback()
        return False
    finally:
        if connection and connection.is_connected():
            cursor.close()
            connection.close()

def list_all_client_chats() -> List[Dict[str, Any]]:
    """Listează toate chatbot-urile"""
    connection = None
    try:
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)
        
        query = "SELECT * FROM client_chat ORDER BY updated_at DESC"
        cursor.execute(query)
        results = cursor.fetchall()
        
        # Adaugă informații suplimentare pentru fiecare chatbot
        for result in results:
            # Convertește datetime
            if result.get('updated_at'):
                result['updated_at'] = result['updated_at'].isoformat() if hasattr(result['updated_at'], 'isoformat') else str(result['updated_at'])
            
            # Numără fișierele RAG
            rag_files = get_rag_files(result['id'])
            result['rag_files_count'] = len(rag_files)
            
            # Obține datele instituției
            institution = get_client_type(result['id'])
            result['institution'] = institution
        
        return results
    except Error as e:
        print(f"❌ Eroare la listarea client_chat: {e}")
        return []
    finally:
        if connection and connection.is_connected():
            cursor.close()
            connection.close()

# ==================== OPERAȚII PE TABELUL client_type ====================

def get_client_type(client_chat_id: int) -> Optional[Dict[str, Any]]:
    """Obține datele instituției pentru un chatbot"""
    connection = None
    try:
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)
        
        query = "SELECT * FROM client_type WHERE id_client_chat = %s"
        cursor.execute(query, (client_chat_id,))
        result = cursor.fetchone()
        
        return result
    except Error as e:
        print(f"❌ Eroare la citirea client_type: {e}")
        return None
    finally:
        if connection and connection.is_connected():
            cursor.close()
            connection.close()

def create_or_update_client_type(client_chat_id: int, name: str, type: str,
                                 address: str = None, phone: str = None,
                                 email: str = None, website: str = None):
    """Creează sau actualizează datele instituției"""
    connection = None
    try:
        connection = get_db_connection()
        cursor = connection.cursor()
        
        # Verifică dacă există deja
        check_query = "SELECT id FROM client_type WHERE id_client_chat = %s"
        cursor.execute(check_query, (client_chat_id,))
        exists = cursor.fetchone()
        
        if exists:
            # Actualizează
            query = """
                UPDATE client_type 
                SET name = %s, type = %s, address = %s, phone = %s, email = %s, website = %s
                WHERE id_client_chat = %s
            """
            cursor.execute(query, (name, type, address, phone, email, website, client_chat_id))
        else:
            # Creează
            query = """
                INSERT INTO client_type (name, type, address, phone, email, website, id_client_chat)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
            """
            cursor.execute(query, (name, type, address, phone, email, website, client_chat_id))
        
        connection.commit()
        print(f"✅ Date instituție actualizate pentru chatbot {client_chat_id}")
        return True
    except Error as e:
        print(f"❌ Eroare la actualizarea client_type: {e}")
        if connection:
            connection.rollback()
        return False
    finally:
        if connection and connection.is_connected():
            cursor.close()
            connection.close()

# ==================== OPERAȚII PE TABELUL rag_file ====================

def get_rag_files(client_chat_id: int, include_content: bool = False, include_file_data: bool = False) -> List[Dict[str, Any]]:
    """Obține toate fișierele RAG pentru un chatbot"""
    connection = None
    try:
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)
        
        # Selectează doar câmpurile necesare (exclude content dacă nu e necesar pentru performanță)
        # Verifică mai întâi dacă câmpul file_data există
        cursor.execute("""
            SELECT COUNT(*) as count 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
              AND TABLE_NAME = 'rag_file' 
              AND COLUMN_NAME = 'file_data'
        """)
        has_file_data_column = cursor.fetchone()['count'] > 0
        
        fields = ["id", "file", "id_client_chat", "uploaded_at"]
        if include_content:
            fields.append("content")
        if include_file_data and has_file_data_column:
            fields.append("file_data")
        if not include_content and not include_file_data:
            fields.append("CASE WHEN content IS NOT NULL THEN 1 ELSE 0 END as has_content")
            if has_file_data_column:
                fields.append("CASE WHEN file_data IS NOT NULL THEN 1 ELSE 0 END as has_file_data")
        
        query = f"SELECT {', '.join(fields)} FROM rag_file WHERE id_client_chat = %s ORDER BY uploaded_at DESC"
        cursor.execute(query, (client_chat_id,))
        results = cursor.fetchall()
        
        # Convertește datetime
        for result in results:
            if result.get('uploaded_at'):
                result['uploaded_at'] = result['uploaded_at'].isoformat() if hasattr(result['uploaded_at'], 'isoformat') else str(result['uploaded_at'])
        
        return results
    except Error as e:
        print(f"❌ Eroare la citirea rag_file: {e}")
        # Dacă câmpul content sau file_data nu există încă, încercă fără el
        if "Unknown column" in str(e):
            try:
                # Încearcă fără file_data
                fields = ["id", "file", "id_client_chat", "uploaded_at"]
                if include_content:
                    fields.append("content")
                if not include_content:
                    fields.append("CASE WHEN content IS NOT NULL THEN 1 ELSE 0 END as has_content")
                query = f"SELECT {', '.join(fields)} FROM rag_file WHERE id_client_chat = %s ORDER BY uploaded_at DESC"
                cursor.execute(query, (client_chat_id,))
                results = cursor.fetchall()
                for result in results:
                    if result.get('uploaded_at'):
                        result['uploaded_at'] = result['uploaded_at'].isoformat() if hasattr(result['uploaded_at'], 'isoformat') else str(result['uploaded_at'])
                return results
            except:
                pass
        return []
    finally:
        if connection and connection.is_connected():
            cursor.close()
            connection.close()

def add_rag_file(client_chat_id: int, filename: str, content: str = None, file_data: bytes = None) -> Optional[int]:
    """Adaugă un fișier RAG în baza de date cu conținutul text și fișierul binar"""
    connection = None
    try:
        connection = get_db_connection()
        cursor = connection.cursor()
        
        # Verifică dacă fișierul există deja
        check_query = "SELECT id FROM rag_file WHERE id_client_chat = %s AND file = %s"
        cursor.execute(check_query, (client_chat_id, filename))
        existing = cursor.fetchone()
        
        if existing:
            # Actualizează fișierul existent
            updates = []
            params = []
            
            if content is not None:
                updates.append("content = %s")
                params.append(content)
            
            if file_data is not None:
                updates.append("file_data = %s")
                params.append(file_data)
            
            if updates:
                params.append(existing[0])
                query = f"UPDATE rag_file SET {', '.join(updates)}, uploaded_at = CURRENT_TIMESTAMP WHERE id = %s"
                cursor.execute(query, tuple(params))
            else:
                # Dacă nu avem conținut sau date, doar actualizăm uploaded_at
                query = "UPDATE rag_file SET uploaded_at = CURRENT_TIMESTAMP WHERE id = %s"
                cursor.execute(query, (existing[0],))
            file_id = existing[0]
            print(f"✅ Fișier RAG actualizat în DB: {filename} (ID: {file_id})")
        else:
            # Creează fișier nou
            if file_data is not None:
                if content is not None:
                    query = "INSERT INTO rag_file (file, content, file_data, id_client_chat) VALUES (%s, %s, %s, %s)"
                    cursor.execute(query, (filename, content, file_data, client_chat_id))
                else:
                    query = "INSERT INTO rag_file (file, file_data, id_client_chat) VALUES (%s, %s, %s)"
                    cursor.execute(query, (filename, file_data, client_chat_id))
            elif content is not None:
                query = "INSERT INTO rag_file (file, content, id_client_chat) VALUES (%s, %s, %s)"
                cursor.execute(query, (filename, content, client_chat_id))
            else:
                query = "INSERT INTO rag_file (file, id_client_chat) VALUES (%s, %s)"
                cursor.execute(query, (filename, client_chat_id))
            file_id = cursor.lastrowid
            print(f"✅ Fișier RAG adăugat în DB: {filename} (ID: {file_id})")
        
        connection.commit()
        return file_id
    except Error as e:
        print(f"❌ Eroare la adăugarea rag_file: {e}")
        # Dacă câmpul file_data nu există, încercă fără el
        if "Unknown column 'file_data'" in str(e):
            try:
                if existing:
                    if content is not None:
                        query = "UPDATE rag_file SET content = %s WHERE id = %s"
                        cursor.execute(query, (content, existing[0]))
                    else:
                        query = "UPDATE rag_file SET uploaded_at = CURRENT_TIMESTAMP WHERE id = %s"
                        cursor.execute(query, (existing[0],))
                else:
                    if content is not None:
                        query = "INSERT INTO rag_file (file, content, id_client_chat) VALUES (%s, %s, %s)"
                        cursor.execute(query, (filename, content, client_chat_id))
                    else:
                        query = "INSERT INTO rag_file (file, id_client_chat) VALUES (%s, %s)"
                        cursor.execute(query, (filename, client_chat_id))
                    file_id = cursor.lastrowid
                connection.commit()
                print(f"⚠️ Fișier RAG salvat fără file_data (câmp inexistent): {filename}")
                return file_id if not existing else existing[0]
            except:
                pass
        if connection:
            connection.rollback()
        return None
    finally:
        if connection and connection.is_connected():
            cursor.close()
            connection.close()

def delete_rag_file(client_chat_id: int, filename: str) -> bool:
    """Șterge un fișier RAG din baza de date"""
    connection = None
    try:
        connection = get_db_connection()
        cursor = connection.cursor()
        
        query = "DELETE FROM rag_file WHERE id_client_chat = %s AND file = %s"
        cursor.execute(query, (client_chat_id, filename))
        connection.commit()
        
        deleted = cursor.rowcount > 0
        if deleted:
            print(f"✅ Fișier RAG șters din DB: {filename}")
        else:
            print(f"⚠️ Fișier RAG nu a fost găsit în DB: {filename}")
        
        return deleted
    except Error as e:
        print(f"❌ Eroare la ștergerea rag_file: {e}")
        if connection:
            connection.rollback()
        return False
    finally:
        if connection and connection.is_connected():
            cursor.close()
            connection.close()

# ==================== OPERAȚII PE TABELUL chat_session ====================

def create_chat_session(user_id: int, client_chat_id: int, title: str = None) -> Optional[int]:
    """Creează o nouă sesiune de chat pentru un utilizator"""
    connection = None
    try:
        connection = get_db_connection()
        cursor = connection.cursor()
        
        # Verifică dacă user-ul există, dacă nu, îl creează
        cursor.execute("SELECT id FROM Users WHERE id = %s", (user_id,))
        if not cursor.fetchone():
            # Creează user default
            print(f"⚠️ User {user_id} nu există, creez user default...")
            cursor.execute("""
                INSERT INTO Users (id, name, email, password, role, display, language, spoken_language, created_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, NOW())
            """, (
                user_id,
                f'Utilizator Guest {user_id}',
                f'guest{user_id}@integra.ai',
                os.getenv('GUEST_USER_PASSWORD_HASH', '$2y$10$default'),  # Password hash default din .env
                'user',
                f'Guest {user_id}',
                'ro',
                'ro'
            ))
            connection.commit()
            print(f"✅ User default creat: ID {user_id}")
        
        # Dacă titlul nu este specificat, folosește "Chat nou"
        if title is None:
            title = "Chat nou"
        
        query = """
            INSERT INTO chat_session (user_id, id_client_chat, title)
            VALUES (%s, %s, %s)
        """
        cursor.execute(query, (user_id, client_chat_id, title))
        connection.commit()
        
        session_id = cursor.lastrowid
        print(f"✅ Sesiune de chat creată: ID {session_id} pentru user {user_id}, client_chat {client_chat_id}")
        return session_id
    except Error as e:
        print(f"❌ Eroare la crearea sesiunii de chat: {e}")
        if connection:
            connection.rollback()
        return None
    finally:
        if connection and connection.is_connected():
            cursor.close()
            connection.close()

def get_chat_session(session_id: int) -> Optional[Dict[str, Any]]:
    """Obține o sesiune de chat după ID"""
    connection = None
    try:
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)
        
        query = "SELECT * FROM chat_session WHERE id = %s"
        cursor.execute(query, (session_id,))
        result = cursor.fetchone()
        
        if result:
            if result.get('created_at'):
                result['created_at'] = result['created_at'].isoformat() if hasattr(result['created_at'], 'isoformat') else str(result['created_at'])
            if result.get('updated_at'):
                result['updated_at'] = result['updated_at'].isoformat() if hasattr(result['updated_at'], 'isoformat') else str(result['updated_at'])
        
        return result
    except Error as e:
        print(f"❌ Eroare la citirea sesiunii de chat: {e}")
        return None
    finally:
        if connection and connection.is_connected():
            cursor.close()
            connection.close()

def list_user_chat_sessions(user_id: int, client_chat_id: int = None) -> List[Dict[str, Any]]:
    """Listează toate sesiunile de chat ale unui utilizator"""
    connection = None
    try:
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)
        
        if client_chat_id:
            query = """
                SELECT cs.*, 
                       COUNT(uc.id) as message_count,
                       MAX(uc.created_at) as last_message_at
                FROM chat_session cs
                LEFT JOIN user_chat_id uc ON uc.id_chat_session = cs.id
                WHERE cs.user_id = %s AND cs.id_client_chat = %s
                GROUP BY cs.id
                ORDER BY cs.updated_at DESC
            """
            cursor.execute(query, (user_id, client_chat_id))
        else:
            query = """
                SELECT cs.*, 
                       COUNT(uc.id) as message_count,
                       MAX(uc.created_at) as last_message_at
                FROM chat_session cs
                LEFT JOIN user_chat_id uc ON uc.id_chat_session = cs.id
                WHERE cs.user_id = %s
                GROUP BY cs.id
                ORDER BY cs.updated_at DESC
            """
            cursor.execute(query, (user_id,))
        
        results = cursor.fetchall()
        
        # Convertește datetime
        for result in results:
            if result.get('created_at'):
                result['created_at'] = result['created_at'].isoformat() if hasattr(result['created_at'], 'isoformat') else str(result['created_at'])
            if result.get('updated_at'):
                result['updated_at'] = result['updated_at'].isoformat() if hasattr(result['updated_at'], 'isoformat') else str(result['updated_at'])
            if result.get('last_message_at'):
                result['last_message_at'] = result['last_message_at'].isoformat() if hasattr(result['last_message_at'], 'isoformat') else str(result['last_message_at'])
        
        return results
    except Error as e:
        print(f"❌ Eroare la listarea sesiunilor de chat: {e}")
        return []
    finally:
        if connection and connection.is_connected():
            cursor.close()
            connection.close()

def update_chat_session(session_id: int, title: str = None) -> bool:
    """Actualizează o sesiune de chat"""
    connection = None
    try:
        connection = get_db_connection()
        cursor = connection.cursor()
        
        if title is not None:
            query = "UPDATE chat_session SET title = %s WHERE id = %s"
            cursor.execute(query, (title, session_id))
        else:
            # Doar actualizează updated_at
            query = "UPDATE chat_session SET updated_at = CURRENT_TIMESTAMP WHERE id = %s"
            cursor.execute(query, (session_id,))
        
        connection.commit()
        return True
    except Error as e:
        print(f"❌ Eroare la actualizarea sesiunii de chat: {e}")
        if connection:
            connection.rollback()
        return False
    finally:
        if connection and connection.is_connected():
            cursor.close()
            connection.close()

def delete_chat_session(session_id: int) -> bool:
    """Șterge o sesiune de chat (și toate mesajele asociate prin CASCADE)"""
    connection = None
    try:
        connection = get_db_connection()
        cursor = connection.cursor()
        
        query = "DELETE FROM chat_session WHERE id = %s"
        cursor.execute(query, (session_id,))
        connection.commit()
        
        deleted = cursor.rowcount > 0
        if deleted:
            print(f"✅ Sesiune de chat ștearsă: ID {session_id}")
        
        return deleted
    except Error as e:
        print(f"❌ Eroare la ștergerea sesiunii de chat: {e}")
        if connection:
            connection.rollback()
        return False
    finally:
        if connection and connection.is_connected():
            cursor.close()
            connection.close()

# ==================== OPERAȚII PE TABELUL user_chat_id ====================

def get_conversation_history(chat_id: str = None, session_id: int = None, user_id: int = None) -> List[Dict[str, Any]]:
    """Obține istoricul conversației pentru o sesiune de chat sau un chat vechi (compatibilitate)"""
    connection = None
    try:
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)
        
        # Verifică dacă coloana file_info există
        cursor.execute("""
            SELECT COUNT(*) as count 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
              AND TABLE_NAME = 'user_chat_id' 
              AND COLUMN_NAME = 'file_info'
        """)
        has_file_info = cursor.fetchone()['count'] > 0
        
        # Dacă avem session_id, folosim sesiunea (mod nou)
        if session_id:
            if has_file_info:
                query = """
                    SELECT role, content, created_at, file_info
                    FROM user_chat_id 
                    WHERE id_chat_session = %s 
                    ORDER BY created_at ASC
                """
            else:
                query = """
                    SELECT role, content, created_at
                    FROM user_chat_id 
                    WHERE id_chat_session = %s 
                    ORDER BY created_at ASC
                """
            cursor.execute(query, (session_id,))
        # Dacă avem chat_id, folosim modul vechi (compatibilitate)
        elif chat_id:
            # Convertește chat_id la int
            try:
                client_chat_id = int(chat_id)
            except ValueError:
                # Dacă nu este int, caută după name
                cursor.execute("SELECT id FROM client_chat WHERE name = %s", (chat_id,))
                result = cursor.fetchone()
                if not result:
                    return []
                client_chat_id = result['id']
            
            if user_id:
                if has_file_info:
                    query = """
                        SELECT role, content, created_at, file_info
                        FROM user_chat_id 
                        WHERE id_client_chat = %s AND user_id = %s 
                        ORDER BY created_at ASC
                    """
                else:
                    query = """
                        SELECT role, content, created_at
                        FROM user_chat_id 
                        WHERE id_client_chat = %s AND user_id = %s 
                        ORDER BY created_at ASC
                    """
                cursor.execute(query, (client_chat_id, user_id))
            else:
                # Dacă nu avem user_id, luăm toate mesajele pentru acest chat
                if has_file_info:
                    query = """
                        SELECT role, content, created_at, file_info
                        FROM user_chat_id 
                        WHERE id_client_chat = %s 
                        ORDER BY created_at ASC
                    """
                else:
                    query = """
                        SELECT role, content, created_at
                        FROM user_chat_id 
                        WHERE id_client_chat = %s 
                        ORDER BY created_at ASC
                    """
                cursor.execute(query, (client_chat_id,))
        else:
            return []
        
        results = cursor.fetchall()
        
        # Convertește la formatul așteptat
        messages = []
        for result in results:
            message = {
                "role": result['role'],
                "content": result['content']
            }
            
            # Adaugă file_info dacă există
            if has_file_info:
                file_info_value = result.get('file_info')
                if file_info_value:
                    try:
                        # Parsează JSON dacă este string
                        if isinstance(file_info_value, str):
                            # Verifică dacă string-ul nu este gol
                            if file_info_value.strip():
                                message['file_info'] = json.loads(file_info_value)
                            else:
                                message['file_info'] = None
                        else:
                            message['file_info'] = file_info_value
                    except (json.JSONDecodeError, TypeError) as e:
                        print(f"⚠️ Eroare la parsarea file_info: {e}, valoare: {file_info_value}")
                        message['file_info'] = None
                else:
                    message['file_info'] = None
            
            messages.append(message)
        
        return messages
    except Error as e:
        print(f"❌ Eroare la citirea conversației: {e}")
        # Fallback pentru cazul în care câmpul id_chat_session nu există încă
        if "Unknown column 'id_chat_session'" in str(e):
            return []
        return []
    finally:
        if connection and connection.is_connected():
            cursor.close()
            connection.close()

def add_message_to_conversation(session_id: int = None, chat_id: str = None, role: str = None, content: str = None, user_id: int = None, file_info: dict = None) -> bool:
    print("=" * 80)
    print("🔍 DEBUG add_message_to_conversation - ÎNCEPUT")
    print("=" * 80)
    print(f"  - session_id: {session_id}")
    print(f"  - chat_id: {chat_id}")
    print(f"  - role: {role}")
    print(f"  - content length: {len(content) if content else 0}")
    print(f"  - user_id: {user_id}")
    print(f"  - file_info: {file_info}")
    print(f"  - file_info type: {type(file_info)}")
    if file_info:
        print(f"  - file_info keys: {file_info.keys() if isinstance(file_info, dict) else 'N/A'}")
        print(f"  - file_info content: {json.dumps(file_info, ensure_ascii=False, indent=2)[:500]}")
    """Adaugă un mesaj în conversație (folosește session_id dacă este disponibil, altfel chat_id pentru compatibilitate)
    
    Args:
        session_id: ID-ul sesiunii de chat
        chat_id: ID-ul chat-ului (pentru compatibilitate)
        role: Rolul mesajului ('user' sau 'assistant')
        content: Conținutul mesajului
        user_id: ID-ul utilizatorului
        file_info: Dicționar cu informații despre fișierele atașate (JSON)
    """
    connection = None
    try:
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)
        
        # Convertește file_info la JSON string dacă există
        file_info_json = None
        print(f"🔍 Procesare file_info:")
        print(f"  - file_info este None: {file_info is None}")
        print(f"  - file_info este dict: {isinstance(file_info, dict)}")
        print(f"  - file_info este list: {isinstance(file_info, list)}")
        
        if file_info:
            try:
                print(f"  - Încearcă serializarea file_info...")
                file_info_json = json.dumps(file_info, ensure_ascii=False)
                print(f"✅ file_info serializat cu succes!")
                print(f"  - JSON length: {len(file_info_json)}")
                print(f"  - JSON preview: {file_info_json[:300]}...")
            except Exception as e:
                print(f"❌ EROARE la serializarea file_info:")
                print(f"  - Error: {e}")
                print(f"  - file_info type: {type(file_info)}")
                print(f"  - file_info value: {file_info}")
                file_info_json = None
        else:
            print(f"⚠️ file_info este None sau gol, nu se salvează")
        
        # Dacă avem session_id, folosim sesiunea (mod nou)
        if session_id:
            # Obține id_client_chat din sesiune pentru consistență
            session_query = "SELECT id_client_chat, user_id FROM chat_session WHERE id = %s"
            cursor.execute(session_query, (session_id,))
            session_data = cursor.fetchone()
            
            if not session_data:
                print(f"❌ Sesiune {session_id} nu există")
                return False
            
            # Folosește user_id din sesiune dacă nu este furnizat
            if user_id is None:
                user_id = session_data.get('user_id')
            
            id_client_chat = session_data.get('id_client_chat')
            
            # Verifică dacă coloana file_info există
            print(f"🔍 Verificare coloană file_info în baza de date...")
            cursor.execute("""
                SELECT COUNT(*) as count 
                FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_SCHEMA = DATABASE() 
                  AND TABLE_NAME = 'user_chat_id' 
                  AND COLUMN_NAME = 'file_info'
            """)
            has_file_info = cursor.fetchone()['count'] > 0
            print(f"  - Coloana file_info există: {has_file_info}")
            
            # Inserează mesajul cu atât session_id cât și id_client_chat pentru consistență
            if has_file_info:
                print(f"✅ Coloana file_info există, inserez cu file_info")
                query = """
                    INSERT INTO user_chat_id (role, content, user_id, id_chat_session, id_client_chat, file_info)
                    VALUES (%s, %s, %s, %s, %s, %s)
                """
                print(f"  - Query: {query}")
                print(f"  - Params: role={role}, content_length={len(content) if content else 0}, user_id={user_id}, session_id={session_id}, id_client_chat={id_client_chat}, file_info_json={'DA' if file_info_json else 'NULL'}")
                cursor.execute(query, (role, content, user_id, session_id, id_client_chat, file_info_json))
                print(f"✅ INSERT executat cu succes!")
            else:
                print(f"⚠️ Coloana file_info NU există, inserez fără file_info")
                query = """
                    INSERT INTO user_chat_id (role, content, user_id, id_chat_session, id_client_chat)
                    VALUES (%s, %s, %s, %s, %s)
                """
                print(f"  - Query: {query}")
                cursor.execute(query, (role, content, user_id, session_id, id_client_chat))
                print(f"✅ INSERT executat (fără file_info)!")
            
            connection.commit()
            print(f"✅ COMMIT executat cu succes!")
            print(f"✅ Mesaj salvat în DB:")
            print(f"  - role: {role}")
            print(f"  - user_id: {user_id}")
            print(f"  - session_id: {session_id}")
            print(f"  - chat_id: {id_client_chat}")
            print(f"  - content_length: {len(content) if content else 0}")
            print(f"  - file_info: {'DA' if file_info else 'NU'}")
            if file_info_json:
                print(f"  - file_info_json length: {len(file_info_json)}")
            print("=" * 80)
            
            # Actualizează updated_at pentru sesiune
            update_chat_session(session_id, None)
        # Dacă avem chat_id, folosim modul vechi (compatibilitate)
        elif chat_id:
            # Convertește chat_id la int
            try:
                client_chat_id = int(chat_id)
            except ValueError:
                # Dacă nu este int, caută după name
                cursor.execute("SELECT id FROM client_chat WHERE name = %s", (chat_id,))
                result = cursor.fetchone()
                if not result:
                    print(f"❌ Chat {chat_id} nu există")
                    return False
                client_chat_id = result['id']
            
            # Dacă nu avem user_id, folosim un user_id default (0 sau NULL)
            if user_id is None:
                user_id = 0  # User anonim sau default
            
            # Verifică dacă coloana file_info există
            cursor.execute("""
                SELECT COUNT(*) as count 
                FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_SCHEMA = DATABASE() 
                  AND TABLE_NAME = 'user_chat_id' 
                  AND COLUMN_NAME = 'file_info'
            """)
            has_file_info = cursor.fetchone()['count'] > 0
            
            if has_file_info:
                query = """
                    INSERT INTO user_chat_id (role, content, user_id, id_client_chat, file_info)
                    VALUES (%s, %s, %s, %s, %s)
                """
                cursor.execute(query, (role, content, user_id, client_chat_id, file_info_json))
            else:
                query = """
                    INSERT INTO user_chat_id (role, content, user_id, id_client_chat)
                    VALUES (%s, %s, %s, %s)
                """
                cursor.execute(query, (role, content, user_id, client_chat_id))
            
            connection.commit()
            print(f"✅ Mesaj salvat în DB: role={role}, user_id={user_id}, chat_id={client_chat_id}, content_length={len(content) if content else 0}, file_info={'da' if file_info else 'nu'}")
        else:
            print(f"❌ Trebuie să furnizezi fie session_id, fie chat_id")
            return False
        
        return True
    except Error as e:
        print(f"❌ Eroare la adăugarea mesajului: {e}")
        if connection:
            connection.rollback()
        return False
    finally:
        if connection and connection.is_connected():
            cursor.close()
            connection.close()

def clear_conversation_history(session_id: int = None, chat_id: str = None, user_id: int = None) -> bool:
    """Șterge istoricul conversației pentru o sesiune sau un chat (compatibilitate)"""
    connection = None
    try:
        connection = get_db_connection()
        cursor = connection.cursor()
        
        # Dacă avem session_id, șterge mesajele din sesiune
        if session_id:
            query = "DELETE FROM user_chat_id WHERE id_chat_session = %s"
            cursor.execute(query, (session_id,))
        # Dacă avem chat_id, folosim modul vechi (compatibilitate)
        elif chat_id:
            # Convertește chat_id la int
            try:
                client_chat_id = int(chat_id)
            except ValueError:
                cursor.execute("SELECT id FROM client_chat WHERE name = %s", (chat_id,))
                result = cursor.fetchone()
                if not result:
                    return False
                client_chat_id = result['id']
            
            if user_id:
                query = "DELETE FROM user_chat_id WHERE id_client_chat = %s AND user_id = %s"
                cursor.execute(query, (client_chat_id, user_id))
            else:
                query = "DELETE FROM user_chat_id WHERE id_client_chat = %s"
                cursor.execute(query, (client_chat_id,))
        else:
            return False
        
        connection.commit()
        return True
    except Error as e:
        print(f"❌ Eroare la ștergerea conversației: {e}")
        if connection:
            connection.rollback()
        return False
    finally:
        if connection and connection.is_connected():
            cursor.close()
            connection.close()

# ==================== OPERAȚII PE TABELUL document_templates ====================

def get_document_template(client_chat_id: int, filename: str) -> Optional[Dict[str, Any]]:
    """Obține template-ul pentru un document"""
    connection = None
    try:
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)
        
        query = """
            SELECT id, template_name, template_html, template_json, variables
            FROM document_templates
            WHERE id_client_chat = %s AND filename = %s
        """
        cursor.execute(query, (client_chat_id, filename))
        result = cursor.fetchone()
        
        if result:
            variables = json.loads(result['variables']) if result.get('variables') else []
            return {
                "id": result['id'],
                "template_name": result.get('template_name', filename),
                "template_html": result.get('template_html', ''),
                "template_json": result.get('template_json'),
                "variables": variables
            }
        return None
    except Error as e:
        print(f"❌ Eroare la citirea template: {e}")
        return None
    finally:
        if connection and connection.is_connected():
            cursor.close()
            connection.close()

def save_document_template(
    client_chat_id: int,
    filename: str,
    template_name: str,
    template_html: str,
    variables: List[Dict]
) -> bool:
    """Salvează template-ul pentru un document"""
    connection = None
    try:
        connection = get_db_connection()
        cursor = connection.cursor()
        
        variables_json = json.dumps(variables) if variables else '[]'
        
        # Verifică dacă există deja
        check_query = "SELECT id FROM document_templates WHERE id_client_chat = %s AND filename = %s"
        cursor.execute(check_query, (client_chat_id, filename))
        existing = cursor.fetchone()
        
        if existing:
            # Update
            query = """
                UPDATE document_templates
                SET template_name = %s, template_html = %s, variables = %s, updated_at = CURRENT_TIMESTAMP
                WHERE id = %s
            """
            cursor.execute(query, (template_name, template_html, variables_json, existing[0]))
        else:
            # Insert
            query = """
                INSERT INTO document_templates (id_client_chat, filename, template_name, template_html, variables)
                VALUES (%s, %s, %s, %s, %s)
            """
            cursor.execute(query, (client_chat_id, filename, template_name, template_html, variables_json))
        
        connection.commit()
        return True
    except Error as e:
        print(f"❌ Eroare la salvarea template: {e}")
        if connection:
            connection.rollback()
        return False
    finally:
        if connection and connection.is_connected():
            cursor.close()
            connection.close()

def list_document_templates(client_chat_id: int) -> List[Dict[str, Any]]:
    """Listează toate template-urile de documente pentru un tenant (client_chat_id)"""
    connection = None
    try:
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)
        query = """
            SELECT id, filename, template_name, variables
            FROM document_templates
            WHERE id_client_chat = %s
            ORDER BY template_name
        """
        cursor.execute(query, (client_chat_id,))
        rows = cursor.fetchall()
        result = []
        for row in rows:
            variables = json.loads(row['variables']) if row.get('variables') else []
            result.append({
                "id": row['id'],
                "filename": row['filename'],
                "template_name": row.get('template_name', row['filename']),
                "variables": variables,
            })
        return result
    except Error as e:
        print(f"❌ Eroare la listarea template-urilor: {e}")
        return []
    finally:
        if connection and connection.is_connected():
            cursor.close()
            connection.close()


def get_document_template_content(client_chat_id: int, filename: str) -> Optional[str]:
    """Obține conținutul original al documentului RAG pentru a-l folosi ca bază pentru template"""
    connection = None
    try:
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)
        
        query = """
            SELECT content FROM rag_file
            WHERE id_client_chat = %s AND file = %s
        """
        cursor.execute(query, (client_chat_id, filename))
        result = cursor.fetchone()
        
        if result and result.get('content'):
            return result['content']
        return None
    except Error as e:
        print(f"❌ Eroare la citirea conținutului documentului: {e}")
        return None
    finally:
        if connection and connection.is_connected():
            cursor.close()
            connection.close()

# ==================== OPERAȚII PE TABELUL Users ====================

def get_user(user_id: int = None, email: str = None) -> Optional[Dict[str, Any]]:
    """Obține un utilizator după ID sau email"""
    connection = None
    try:
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)
        
        if user_id:
            query = "SELECT id, name, email, role, display, language, spoken_language, voice, created_at FROM Users WHERE id = %s"
            cursor.execute(query, (user_id,))
        elif email:
            query = "SELECT id, name, email, password, role, display, language, spoken_language, voice, created_at FROM Users WHERE email = %s"
            cursor.execute(query, (email,))
        else:
            return None
        
        result = cursor.fetchone()
        if result and result.get('created_at'):
            result['created_at'] = result['created_at'].isoformat() if hasattr(result['created_at'], 'isoformat') else str(result['created_at'])
        
        return result
    except Error as e:
        print(f"❌ Eroare la citirea user: {e}")
        return None
    finally:
        if connection and connection.is_connected():
            cursor.close()
            connection.close()

def create_user(name: str, email: str, password: str, role: str = 'user') -> Optional[int]:
    """Creează un nou utilizator (parola trebuie să fie deja hash-uită)"""
    connection = None
    try:
        connection = get_db_connection()
        cursor = connection.cursor()
        
        # Verifică dacă email-ul există deja
        cursor.execute("SELECT id FROM Users WHERE email = %s", (email,))
        if cursor.fetchone():
            print(f"❌ Email {email} este deja înregistrat")
            return None
        
        query = """
            INSERT INTO Users (name, email, password, role, display, language, spoken_language)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        """
        cursor.execute(query, (name, email, password, role, name, 'ro', 'ro'))
        connection.commit()
        
        user_id = cursor.lastrowid
        print(f"✅ Utilizator creat cu ID: {user_id}")
        return user_id
    except Error as e:
        print(f"❌ Eroare la crearea user: {e}")
        if connection:
            connection.rollback()
        return None
    finally:
        if connection and connection.is_connected():
            cursor.close()
            connection.close()

