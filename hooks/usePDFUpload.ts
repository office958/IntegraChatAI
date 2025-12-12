import { useState, useCallback } from 'react';

export interface PDFFile {
  file: File;
  filename: string;
  type: 'pdf' | 'image';
}

/**
 * Hook for managing PDF file uploads
 * Provides state and functions to add, remove, and clear PDF files
 */
export function usePDFUpload() {
  const [pdfFiles, setPdfFiles] = useState<PDFFile[]>([]);

  /**
   * Adds a PDF file to the list
   * @param file - The file to add
   */
  const addPDFFile = useCallback((file: File) => {
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
  }, []);

  return {
    pdfFiles,
    addPDFFile,
    removePDFFile,
    clearPDFFiles,
  };
}

