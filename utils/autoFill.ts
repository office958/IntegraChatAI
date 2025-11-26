export function tryAutoFillFields(text: string) {
  if (!text || typeof text !== 'string') return;

  const trimmedText = text.trim();
  if (!trimmedText) return;

  // 1. Încearcă parsare JSON directă
  try {
    const json = JSON.parse(trimmedText);
    if (json && typeof json === 'object' && !Array.isArray(json) && Object.keys(json).length > 0) {
      autoFillParentFields(json);
      console.log('✅ JSON detectat și completat automat:', json);
      return;
    }
  } catch (e) {
    // Nu e JSON valid, continuă
  }

  // 2. Elimină markdown code blocks dacă există
  let cleanedText = trimmedText;
  cleanedText = cleanedText.replace(/^```(?:json)?\s*\n?/i, '');
  cleanedText = cleanedText.replace(/\n?```\s*$/i, '');
  cleanedText = cleanedText.trim();

  // Încearcă din nou după curățare
  try {
    const json = JSON.parse(cleanedText);
    if (json && typeof json === 'object' && !Array.isArray(json) && Object.keys(json).length > 0) {
      autoFillParentFields(json);
      console.log('✅ JSON extras din markdown și completat:', json);
      return;
    }
  } catch (e) {
    // Continuă
  }

  // 3. Încearcă să extragi JSON din text
  const jsonPattern = /\{[\s\S]*?\}/;
  let match = cleanedText.match(jsonPattern);

  if (!match) {
    const multilinePattern = /\{(?:[^{}]|(?:\{[^{}]*\}))*\}/;
    match = cleanedText.match(multilinePattern);
  }

  if (match) {
    try {
      const json = JSON.parse(match[0]);
      if (json && typeof json === 'object' && !Array.isArray(json) && Object.keys(json).length > 0) {
        autoFillParentFields(json);
        console.log('✅ JSON extras din text și completat:', json);
        return;
      }
    } catch (e2) {
      // Ignoră
    }
  }

  // 4. Încearcă să găsească JSON nested sau complex
  const allJsonMatches = cleanedText.match(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g);
  if (allJsonMatches) {
    for (const match of allJsonMatches) {
      try {
        const json = JSON.parse(match);
        if (json && typeof json === 'object' && !Array.isArray(json) && Object.keys(json).length > 0) {
          autoFillParentFields(json);
          console.log('✅ JSON complex extras și completat:', json);
          return;
        }
      } catch (e3) {
        // Continuă cu următorul
      }
    }
  }

  // 5. Dacă nu e JSON, încearcă să extragi informații structurate din text
  const structuredData = extractStructuredData(cleanedText);
  if (structuredData && Object.keys(structuredData).length > 0) {
    autoFillParentFields(structuredData);
    console.log('✅ Date structurate extrase și completate:', structuredData);
  } else {
    console.log('⚠️ Nu s-a detectat JSON valid în răspuns');
  }
}

function extractStructuredData(text: string): Record<string, string> {
  const data: Record<string, string> = {};

  const patterns = [
    { key: 'title', regex: /(?:titlu|title|nume|headline)\s*[:=]\s*["']?([^"'\n]+)["']?/i },
    { key: 'author', regex: /(?:autor|author|scris de|writer)\s*[:=]\s*["']?([^"'\n]+)["']?/i },
    { key: 'category', regex: /(?:categorie|category|tip|type)\s*[:=]\s*["']?([^"'\n]+)["']?/i },
    { key: 'content', regex: /(?:con[țt]inut|content|text|descriere|body)\s*[:=]\s*["']?([\s\S]+?)["']?(?:\n\n|\n[A-Z]|$)/i },
    { key: 'email', regex: /(?:email|e-mail|mail)\s*[:=]\s*["']?([^\s"']+@[^\s"']+)["']?/i },
    { key: 'phone', regex: /(?:telefon|phone|tel|telephone)\s*[:=]\s*["']?([\d\s\+\-\(\)]+)["']?/i },
    { key: 'date', regex: /(?:data|date|zi)\s*[:=]\s*["']?([^"'\n]+)["']?/i },
    { key: 'description', regex: /(?:descriere|description|desc)\s*[:=]\s*["']?([\s\S]+?)["']?(?:\n\n|\n[A-Z]|$)/i },
  ];

  patterns.forEach(({ key, regex }) => {
    const match = text.match(regex);
    if (match && match[1]) {
      const value = match[1].trim();
      data[key] = value.replace(/^["']|["']$/g, '');
    }
  });

  return data;
}

function autoFillParentFields(data: Record<string, any>) {
  if (!data || typeof data !== 'object') return;

  // Trimite mesaj către pagina părinte pentru completare automată
  if (typeof window !== 'undefined' && window.parent !== window.self) {
    window.parent.postMessage(
      {
        type: 'autoFillFields',
        payload: data,
      },
      '*'
    );

    console.log('📤 Mesaj trimis către parent pentru completare automată');
  }
}

