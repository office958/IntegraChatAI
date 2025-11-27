-- Migrare: Adaugă tabelul chat_session pentru sesiunile de chat ale utilizatorilor
-- Rulează acest script SQL pentru a adăuga suport pentru sesiuni multiple de chat per utilizator

USE Integra_chat_ai;

-- Creează un user default dacă nu există (pentru sesiuni anonime/guest)
INSERT IGNORE INTO Users (id, name, email, password, role, display, language, spoken_language, created_at)
VALUES (1, 'Utilizator Guest', 'guest@integra.ai', '$2y$10$default', 'user', 'Guest', 'ro', 'ro', NOW());

-- Creează tabelul pentru sesiunile de chat
CREATE TABLE IF NOT EXISTS chat_session (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    id_client_chat INT NOT NULL,
    title VARCHAR(255) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE,
    FOREIGN KEY (id_client_chat) REFERENCES client_chat(id) ON DELETE CASCADE,
    INDEX idx_user_client (user_id, id_client_chat),
    INDEX idx_updated_at (updated_at)
) ENGINE=InnoDB;

-- Adaugă câmpul id_chat_session în tabelul user_chat_id
ALTER TABLE user_chat_id 
ADD COLUMN id_chat_session INT NULL AFTER id_client_chat,
ADD FOREIGN KEY (id_chat_session) REFERENCES chat_session(id) ON DELETE CASCADE,
ADD INDEX idx_chat_session (id_chat_session);

-- Verifică structura
DESCRIBE chat_session;
DESCRIBE user_chat_id;

