/**
 * Utility functions for extracting text from PDFs and images
 */

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://127.0.0.1:8000';

/**
 * Extracts text from a PDF file using the backend API
 * @param file - The PDF file to extract text from
 * @returns A promise that resolves to the extracted text
 */
export async function extractPDFText(file: File): Promise<string> {
  if (!file) {
    throw new Error('Fișierul PDF nu este valid');
  }

  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
    throw new Error('Fișierul trebuie să fie PDF');
  }

  try {
    const formData = new FormData();
    formData.append('pdf', file);

    // Creează AbortController pentru timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000); // 120 secunde

    const response = await fetch(`${BACKEND_URL}/extract-pdf?max_pages=5`, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Eroare necunoscută' }));
      throw new Error(errorData.error || `Eroare HTTP: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error);
    }

    if (!data.text || !data.text.trim()) {
      throw new Error('Nu s-a putut extrage text din PDF');
    }

    return data.text.trim();
  } catch (error) {
    console.error('Error extracting PDF text:', error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Eroare necunoscută la extragerea textului din PDF');
  }
}

/**
 * Extracts text from an image file using OCR via the backend API
 * @param file - The image file to extract text from
 * @returns A promise that resolves to the extracted text
 */
export async function extractImageText(
  file: File,
  correctText: boolean = true,
  expectedFields?: string[]
): Promise<{ text: string; correctedText?: string; corrections?: any[]; missingFields?: any[] }> {
  if (!file) {
    throw new Error('Fișierul imagine nu este valid');
  }

  // Check if it's an image file
  const isImage = file.type.startsWith('image/') || 
    /\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(file.name);

  if (!isImage) {
    throw new Error('Fișierul trebuie să fie o imagine');
  }

  try {
    const formData = new FormData();
    formData.append('image', file);
    formData.append('correct_text', correctText.toString());

    if (expectedFields && expectedFields.length > 0) {
      formData.append('expected_fields', JSON.stringify(expectedFields));
    }

    const response = await fetch(`${BACKEND_URL}/extract-image`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Eroare necunoscută' }));
      throw new Error(errorData.error || `Eroare HTTP: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error);
    }

    if (!data.text || !data.text.trim()) {
      throw new Error('Nu s-a putut extrage text din imagine. Imaginea poate să nu conțină text sau calitatea este prea slabă.');
    }

    // Returnează obiect cu text și informații suplimentare
    return {
      text: data.text.trim(),
      correctedText: data.corrected_text || data.text.trim(),
      corrections: data.corrections || [],
      missingFields: data.missing_fields || []
    };
  } catch (error) {
    console.error('Error extracting image text:', error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Eroare necunoscută la extragerea textului din imagine');
  }
}

