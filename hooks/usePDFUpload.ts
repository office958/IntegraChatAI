import { useState, useCallback, useEffect } from 'react';

export interface PDFFile {
  file: File;
  filename: string;
  type: 'pdf' | 'image';
}

interface StoredPDFFile {
  filename: string;
  type: 'pdf' | 'image';
  data: string; // base64
  mimeType: string;
}

const STORAGE_KEY = 'chat_attached_files';
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB limit pentru localStorage

/**
 * Hook for managing PDF file uploads
 * Provides state and functions to add, remove, and clear PDF files
 * Persists files to localStorage to survive page refresh
 */
export function usePDFUpload() {
  const [pdfFiles, setPdfFiles] = useState<PDFFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Restaurează fișierele din localStorage la mount
  useEffect(() => {
    const loadStoredFiles = async () => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const storedFiles: StoredPDFFile[] = JSON.parse(stored);
          const restoredFiles: PDFFile[] = [];

          for (const storedFile of storedFiles) {
            try {
              // Convertim base64 înapoi în File
              const byteCharacters = atob(storedFile.data);
              const byteNumbers = new Array(byteCharacters.length);
              for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
              }
              const byteArray = new Uint8Array(byteNumbers);
              const blob = new Blob([byteArray], { type: storedFile.mimeType || 'application/octet-stream' });
              const file = new File([blob], storedFile.filename, { type: storedFile.mimeType || 'application/octet-stream' });

              restoredFiles.push({
                file,
                filename: storedFile.filename,
                type: storedFile.type,
              });
            } catch (error) {
              console.error('Error restoring file:', storedFile.filename, error);
            }
          }

          if (restoredFiles.length > 0) {
            setPdfFiles(restoredFiles);
          }
        }
      } catch (error) {
        console.error('Error loading stored files:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadStoredFiles();
  }, []);

  // Salvează fișierele în localStorage când se schimbă
  useEffect(() => {
    if (isLoading) return;

    const saveFiles = async () => {
      try {
        const storedFiles: StoredPDFFile[] = [];

          for (const pdfFile of pdfFiles) {
            try {
              // Convertim File în base64 (optimizat pentru fișiere mari)
              const arrayBuffer = await pdfFile.file.arrayBuffer();
              const bytes = new Uint8Array(arrayBuffer);
              let binary = '';
              const chunkSize = 8192; // Procesăm în chunk-uri pentru a evita stack overflow
              for (let i = 0; i < bytes.length; i += chunkSize) {
                const chunk = bytes.subarray(i, i + chunkSize);
                binary += String.fromCharCode(...chunk);
              }
              const base64 = btoa(binary);

            storedFiles.push({
              filename: pdfFile.filename,
              type: pdfFile.type,
              data: base64,
              mimeType: pdfFile.file.type,
            });
          } catch (error) {
            console.error('Error saving file:', pdfFile.filename, error);
          }
        }

        localStorage.setItem(STORAGE_KEY, JSON.stringify(storedFiles));
      } catch (error) {
        console.error('Error saving files to localStorage:', error);
        // Dacă localStorage este plin, șterge fișierele vechi
        try {
          localStorage.removeItem(STORAGE_KEY);
        } catch (e) {
          console.error('Error clearing localStorage:', e);
        }
      }
    };

    saveFiles();
  }, [pdfFiles, isLoading]);

  /**
   * Adds a PDF file to the list
   * @param file - The file to add
   */
  const addPDFFile = useCallback((file: File) => {
    // Verifică dimensiunea fișierului
    if (file.size > MAX_FILE_SIZE) {
      console.warn(`File ${file.name} is too large (${file.size} bytes). Max size: ${MAX_FILE_SIZE} bytes`);
      alert(`Fișierul ${file.name} este prea mare. Dimensiunea maximă este ${MAX_FILE_SIZE / 1024 / 1024}MB.`);
      return;
    }

    // Determine file type based on MIME type or extension
    const fileType: 'pdf' | 'image' = 
      file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
        ? 'pdf'
        : 'image';
    
    const pdfFile: PDFFile = {
      file,
      filename: file.name,
      type: fileType,
    };

    setPdfFiles((prev) => [...prev, pdfFile]);
  }, []);

  /**
   * Removes a PDF file from the list by index
   * @param index - The index of the file to remove
   */
  const removePDFFile = useCallback((index: number) => {
    setPdfFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  /**
   * Clears all PDF files from the list
   */
  const clearPDFFiles = useCallback(() => {
    setPdfFiles([]);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return {
    pdfFiles,
    addPDFFile,
    removePDFFile,
    clearPDFFiles,
    isLoading,
  };
}

