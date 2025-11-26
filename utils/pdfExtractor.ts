export async function extractPDFText(file: File): Promise<string> {
  try {
    const formData = new FormData();
    formData.append('pdf', file);

    const response = await fetch('/api/extract-pdf', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error);
    }

    return data.text || '';
  } catch (error) {
    console.error(`Eroare la extragerea textului din ${file.name}:`, error);
    throw error;
  }
}

export async function extractImageText(file: File): Promise<string> {
  try {
    const formData = new FormData();
    formData.append('image', file);

    const response = await fetch('/api/extract-image', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error);
    }

    return data.text || '';
  } catch (error) {
    console.error(`Eroare la extragerea textului din ${file.name}:`, error);
    throw error;
  }
}

