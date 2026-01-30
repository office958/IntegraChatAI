-- Creează tabelul pentru template-uri de documente
CREATE TABLE IF NOT EXISTS document_templates (
    id INT AUTO_INCREMENT PRIMARY KEY,
    id_client_chat INT NOT NULL,
    filename VARCHAR(255) NOT NULL,
    template_name VARCHAR(255),
    template_html TEXT,
    template_json TEXT,
    variables JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (id_client_chat) REFERENCES client_chat(id) ON DELETE CASCADE,
    UNIQUE KEY unique_template (id_client_chat, filename)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;



