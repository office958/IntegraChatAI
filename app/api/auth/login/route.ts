import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Timeout de 10 secunde pentru request
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    try {
      const response = await fetch('http://127.0.0.1:8000/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Eroare la autentificare' }));
        return NextResponse.json(
          { error: error.detail || error.error || 'Eroare la autentificare' },
          { status: response.status }
        );
      }
      
      const data = await response.json();
      return NextResponse.json(data);
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      
      if (fetchError.name === 'AbortError') {
        return NextResponse.json(
          { error: 'Timeout: Serverul nu răspunde. Verifică dacă backend-ul rulează.' },
          { status: 504 }
        );
      }
      
      if (fetchError.code === 'ECONNREFUSED' || fetchError.code === 'ECONNRESET') {
        return NextResponse.json(
          { error: 'Nu se poate conecta la server. Verifică dacă backend-ul rulează pe portul 8000.' },
          { status: 503 }
        );
      }
      
      throw fetchError;
    }
  } catch (error: any) {
    console.error('Error in login API route:', error);
    return NextResponse.json(
      { error: error.message || 'Eroare internă la autentificare' },
      { status: 500 }
    );
  }
}







