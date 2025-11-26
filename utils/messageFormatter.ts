export function formatMessageText(text: string): string {
  if (!text) return '';

  // Convertim tabele markdown în HTML
  let formatted = formatMarkdownTables(text);

  // Convertim listele numerotate
  formatted = formatNumberedLists(formatted);

  // Split pe linii pentru a procesa fiecare parte separat
  const parts = formatted.split(/(<div class="message-table-wrapper">[\s\S]*?<\/div>|<ul class="message-numbered-list">[\s\S]*?<\/ul>)/);

  formatted = parts
    .map((part) => {
      // Dacă este deja HTML (tabel sau listă), nu-l procesăm
      if (part.includes('message-table-wrapper') || part.includes('message-numbered-list')) {
        return part;
      }

      // Escape HTML pentru securitate
      let processed = part
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

      // Convertim formatări bold (**text**)
      processed = processed.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

      // Convertim date structurate (cheie: valoare) în carduri
      processed = formatStructuredData(processed);

      // Convertim linii noi în <br>
      processed = processed.replace(/\n/g, '<br>');

      return processed;
    })
    .join('');

  return formatted;
}

function formatMarkdownTables(text: string): string {
  const lines = text.split('\n');
  const tables: Array<{ start: number; end: number; rows: string[] }> = [];
  let currentTable: string[] | null = null;
  let tableStartIndex = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (line.includes('|') && line.includes('-')) {
      if (currentTable) {
        tables.push({
          start: tableStartIndex,
          end: i - 1,
          rows: currentTable,
        });
      }
      if (i > 0 && lines[i - 1].trim().includes('|')) {
        currentTable = [lines[i - 1].trim()];
        tableStartIndex = i - 1;
      }
    } else if (line.includes('|') && currentTable) {
      currentTable.push(line);
    } else if (currentTable && !line.includes('|')) {
      tables.push({
        start: tableStartIndex,
        end: i - 1,
        rows: currentTable,
      });
      currentTable = null;
    }
  }

  if (currentTable) {
    tables.push({
      start: tableStartIndex,
      end: lines.length - 1,
      rows: currentTable,
    });
  }

  // Procesează tabelele de la sfârșit la început
  for (let t = tables.length - 1; t >= 0; t--) {
    const table = tables[t];
    const htmlTable = convertTableToHTML(table.rows);
    lines.splice(table.start, table.end - table.start + 1, htmlTable);
  }

  return lines.join('\n');
}

function convertTableToHTML(rows: string[]): string {
  if (!rows || rows.length < 2) return '';

  const headerRow = rows[0];
  const dataRows = rows.slice(2);

  const headerCells = headerRow.split('|').map((cell) => cell.trim()).filter((cell) => cell);
  const headerHTML = headerCells
    .map((cell) => {
      const escaped = cell.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const bolded = escaped.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
      return `<th>${bolded}</th>`;
    })
    .join('');

  let bodyHTML = '';
  for (const row of dataRows) {
    const cells = row.split('|').map((cell) => cell.trim()).filter((cell) => cell);
    if (cells.length > 0) {
      bodyHTML +=
        '<tr>' +
        cells
          .map((cell) => {
            const escaped = cell.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            const bolded = escaped.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
            return `<td>${bolded}</td>`;
          })
          .join('') +
        '</tr>';
    }
  }

  return `<div class="message-table-wrapper"><table class="message-table"><thead><tr>${headerHTML}</tr></thead><tbody>${bodyHTML}</tbody></table></div>`;
}

function formatStructuredData(text: string): string {
  return text.replace(/\*\*([^*:]+)\*\*:\s*([^\n*]+)/g, (match, key, value) => {
    return `<div class="structured-data-item"><span class="data-key">${key}</span><span class="data-value">${value.trim()}</span></div>`;
  });
}

function formatNumberedLists(text: string): string {
  const lines = text.split('\n');
  let inList = false;
  let listHTML = '';
  const result: string[] = [];

  for (const line of lines) {
    const numberedMatch = line.match(/^(\d+)\.\s+(.+)$/);
    if (numberedMatch) {
      if (!inList) {
        inList = true;
        listHTML = '<ul class="message-numbered-list">';
      }
      listHTML += `<li>${numberedMatch[2]}</li>`;
    } else {
      if (inList) {
        listHTML += '</ul>';
        result.push(listHTML);
        listHTML = '';
        inList = false;
      }
      result.push(line);
    }
  }

  if (inList) {
    listHTML += '</ul>';
    result.push(listHTML);
  }

  return result.join('\n');
}

