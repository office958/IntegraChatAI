/**
 * Utility functions for PDF generation and download
 */

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://127.0.0.1:8000';

/**
 * Detects if a message contains a request for PDF generation
 * @param message - The message content to check
 * @returns true if the message contains PDF generation keywords
 */
export function detectPDFGenerationRequest(message: string): boolean {
  if (!message) return false;
  
  const pdfKeywords = [
    'generează pdf',
    'genereaza pdf',
    'creează pdf',
    'creeaza pdf',
    'generează document',
    'genereaza document',
    'descarcă pdf',
    'descarca pdf',
    'download pdf',
    'export pdf',
    'pdf document',
    'formular completat',
    'date extrase',
    'datele extrase'
  ];
  
  const lowerMessage = message.toLowerCase();
  return pdfKeywords.some(keyword => lowerMessage.includes(keyword));
}

/**
 * Extracts JSON data from a message
 * @param message - The message content to extract JSON from
 * @returns The parsed JSON object or null if no valid JSON is found
 */
export function extractJSONFromMessage(message: string): any | null {
  if (!message) return null;
  
  // Try to find JSON in code blocks first
  const codeBlockRegex = /```(?:json)?\s*(\{[\s\S]*?\})\s*```/;
  const codeBlockMatch = message.match(codeBlockRegex);
  if (codeBlockMatch) {
    try {
      return JSON.parse(codeBlockMatch[1]);
    } catch (e) {
      // Continue to try other methods
    }
  }
  
  // Try to find JSON object directly
  const jsonRegex = /\{[\s\S]*\}/;
  const jsonMatch = message.match(jsonRegex);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch (e) {
      // Not valid JSON
    }
  }
  
  return null;
}

/**
 * Generates a PDF from chat messages
 * @param chatId - The chat ID
 * @param sessionId - Optional session ID
 * @param token - Optional authentication token
 * @returns A Blob containing the PDF data
 */
export async function generatePDFFromChat(
  chatId: string,
  sessionId: string | null = null,
  token?: string
): Promise<Blob> {
  try {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    const body: any = {
      chat_id: chatId,
    };
    
    if (sessionId) {
      body.session_id = sessionId;
    }
    
    // Try the PDF generation endpoint
    const response = await fetch(`${BACKEND_URL}/chat/${chatId}/generate-pdf`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    
    if (!response.ok) {
      // If endpoint doesn't exist, try alternative or generate client-side
      if (response.status === 404) {
        // Fallback: generate a simple PDF client-side
        return await generateSimplePDF(chatId, sessionId, token);
      }
      
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(errorData.error || `Failed to generate PDF: ${response.statusText}`);
    }
    
    const blob = await response.blob();
    return blob;
  } catch (error) {
    console.error('Error generating PDF:', error);
    // Fallback to client-side generation
    return await generateSimplePDF(chatId, sessionId, token);
  }
}

/**
 * Fallback: Generates a simple PDF client-side using the chat history
 * @param chatId - The chat ID
 * @param sessionId - Optional session ID
 * @param token - Optional authentication token
 * @returns A Blob containing the PDF data
 */
async function generateSimplePDF(
  chatId: string,
  sessionId: string | null = null,
  token?: string
): Promise<Blob> {
  try {
    // Fetch chat history
    const headers: HeadersInit = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    const historyUrl = sessionId
      ? `${BACKEND_URL}/chat/${chatId}/history?session_id=${sessionId}`
      : `${BACKEND_URL}/chat/${chatId}/history`;
    
    const historyResponse = await fetch(historyUrl, { headers });
    
    if (!historyResponse.ok) {
      throw new Error('Failed to fetch chat history');
    }
    
    const historyData = await historyResponse.json();
    const messages = historyData.messages || [];
    
    // Generate PDF using jsPDF (if available) or create a simple text blob
    // For now, create a simple text-based PDF representation
    const pdfContent = generatePDFContent(messages);
    
    // Convert to blob (simple text representation)
    // In a real implementation, you'd use jsPDF or similar library
    const blob = new Blob([pdfContent], { type: 'application/pdf' });
    return blob;
  } catch (error) {
    console.error('Error in fallback PDF generation:', error);
    throw new Error('Failed to generate PDF. Please ensure the backend PDF generation endpoint is available.');
  }
}

/**
 * Generates PDF content from messages (simple text representation)
 * @param messages - Array of chat messages
 * @returns PDF content as string
 */
function generatePDFContent(messages: Array<{ role: string; content: string; timestamp?: string }>): string {
  let content = '%PDF-1.4\n';
  content += '1 0 obj\n<<\n/Type /Catalog\n>>\nendobj\n';
  content += '2 0 obj\n<<\n/Type /Pages\n/Kids [3 0 R]\n/Count 1\n>>\nendobj\n';
  content += '3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/MediaBox [0 0 612 792]\n/Contents 4 0 R\n>>\nendobj\n';
  
  // Generate text content
  let textContent = '';
  messages.forEach((msg, index) => {
    const role = msg.role === 'user' ? 'Utilizator' : 'Asistent';
    const timestamp = msg.timestamp ? new Date(msg.timestamp).toLocaleString('ro-RO') : '';
    textContent += `\n[${role}${timestamp ? ' - ' + timestamp : ''}]\n${msg.content}\n\n`;
  });
  
  // Simple PDF text stream (minimal PDF structure)
  content += `4 0 obj\n<<\n/Length ${textContent.length}\n>>\nstream\n${textContent}\nendstream\nendobj\n`;
  content += 'xref\n0 5\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000205 00000 n \n';
  content += 'trailer\n<<\n/Size 5\n/Root 1 0 R\n>>\n';
  content += 'startxref\n' + (content.length - 100) + '\n%%EOF';
  
  return content;
}

/**
 * Downloads a blob as a file
 * @param blob - The blob to download
 * @param filename - The filename for the downloaded file
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

