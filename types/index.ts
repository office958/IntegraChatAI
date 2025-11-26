// Date specifice instituției pentru generarea dinamică a promptului
export interface InstitutionData {
  name: string; // Numele complet al instituției
  type: 'primarie' | 'scoala' | 'ong' | 'companie' | 'dsp' | 'alta';
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  working_hours?: {
    monday?: string;
    tuesday?: string;
    wednesday?: string;
    thursday?: string;
    friday?: string;
    saturday?: string;
    sunday?: string;
  };
  services?: string[]; // Lista serviciilor oferite
  fees?: Array<{ service: string; amount: string; description?: string }>;
  responsibilities?: string[]; // Atribuții și competențe
  policies?: {
    tone?: 'formal' | 'simplu' | 'prietenos' | 'profesionist';
    detail_level?: 'scurt' | 'mediu' | 'detaliat';
    language?: 'ro' | 'en' | 'hu' | 'de';
  };
}

export interface ChatConfig {
  name: string;
  tenant_id: string; // ID unic pentru tenant (instituție)
  model: string;
  prompt: string; // Prompt de bază - va fi îmbunătățit dinamic
  chat_title?: string;
  chat_subtitle?: string;
  chat_color?: string;
  rag_content?: Array<{ filename: string; content: string }>;
  rag_files?: string[];
  // Date specifice instituției
  institution?: InstitutionData;
  // Metadata
  created_at?: string;
  updated_at?: string;
  is_active?: boolean;
}

export interface MessageType {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  files?: Array<{ filename: string; type: 'pdf' | 'image' }>;
}

export interface PDFFile {
  file: File;
  filename: string;
  type: 'pdf' | 'image';
}

