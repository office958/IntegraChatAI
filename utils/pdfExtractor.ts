export async function extractPDFText(file: File): Promise<string> {
  try {
    const formData = new FormData();
    formData.append('pdf', file);

    const response = await fetch('/api/extract-pdf', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: `HTTP error! status: ${response.status}` }));
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error);
    }

    if (!data.text || !data.text.trim()) {
      throw new Error('Nu s-a putut extrage text din PDF. PDF-ul poate fi scanat sau protejat.');
    }

    return data.text.trim();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : `Eroare necunoscută la extragerea textului din ${file.name}`;
    console.error(`❌ Eroare la extragerea textului din ${file.name}:`, errorMessage);
    throw new Error(`Nu s-a putut extrage text din ${file.name}: ${errorMessage}`);
  }
}

export async function extractImageText(file: File): Promise<string> {
  try {
    console.log(`📸 Începe extragerea textului din imagine: ${file.name}, type: ${file.type}, size: ${file.size} bytes`);
    
    const formData = new FormData();
    formData.append('image', file);

    console.log(`📤 Trimite cerere la /api/extract-image`);
    const response = await fetch('/api/extract-image', {
      method: 'POST',
      body: formData,
    });

    console.log(`📥 Răspuns primit: status ${response.status}, ok: ${response.ok}`);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: `HTTP error! status: ${response.status}` }));
      console.error(`❌ Eroare HTTP:`, errorData);
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log(`📦 Date primite:`, { hasText: !!data.text, textLength: data.text?.length, error: data.error });

    if (data.error) {
      console.error(`❌ Eroare în răspuns:`, data.error);
      throw new Error(data.error);
    }

    if (!data.text || !data.text.trim()) {
      console.warn(`⚠️ Nu s-a extras text din imagine`);
      throw new Error('Nu s-a putut extrage text din imagine. Imaginea poate să nu conțină text sau calitatea este prea slabă.');
    }

    console.log(`✅ Text extras cu succes: ${data.text.length} caractere`);
    return data.text.trim();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : `Eroare necunoscută la extragerea textului din ${file.name}`;
    console.error(`❌ Eroare la extragerea textului din ${file.name}:`, errorMessage);
    throw new Error(`Nu s-a putut extrage text din ${file.name}: ${errorMessage}`);
  }
}

