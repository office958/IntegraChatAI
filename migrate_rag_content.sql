-- Migrare: Adaugă câmpul content în tabelul rag_file
-- Rulează acest script SQL pentru a adăuga suport pentru stocarea conținutului text

USE Integra_chat_ai;

-- Adaugă câmpul content (LONGTEXT) pentru a stoca conținutul text al fișierelor RAG
ALTER TABLE rag_file 
ADD COLUMN content LONGTEXT NULL AFTER file;

-- Adaugă un index pentru căutări mai rapide (opțional)
-- CREATE INDEX idx_rag_file_client ON rag_file(id_client_chat);

-- Verifică structura
DESCRIBE rag_file;

