import { useState, useCallback } from 'react';
import { PDFFile } from '@/types';

export function usePDFUpload() {
  const [pdfFiles, setPdfFiles] = useState<PDFFile[]>([]);

  const addPDFFile = useCallback((file: PDFFile) => {
    setPdfFiles((prev) => [...prev, file]);
  }, []);

  const removePDFFile = useCallback((index: number) => {
    setPdfFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

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

