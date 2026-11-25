// Leitor de CSV (RFC 4180) sem dependências.
// Aceita separador vírgula ou ponto e vírgula (detecção automática pelo cabeçalho),
// campos entre aspas com quebras de linha e BOM UTF-8 (exportação do Excel/Google Planilhas).

export function detectSeparator(text) {
  const firstLine = text.replace(/^﻿/, '').split(/\r?\n/, 1)[0] ?? '';
  const commas = (firstLine.match(/,/g) || []).length;
  const semis = (firstLine.match(/;/g) || []).length;
  return semis > commas ? ';' : ',';
}

export function parseCsv(text, separator) {
  const src = text.replace(/^﻿/, '');
  const sep = separator ?? detectSeparator(src);
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += ch;
      continue;
    }
    if (ch === '"') inQuotes = true;
    else if (ch === sep) { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(field); field = '';
      rows.push(row); row = [];
    } else field += ch;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }

  const nonEmpty = rows.filter((r) => r.some((c) => c.trim() !== ''));
  if (!nonEmpty.length) return { header: [], records: [] };
  const header = nonEmpty[0].map((h) => h.trim());
  const records = nonEmpty.slice(1).map((cells, idx) => {
    const obj = { __linha: idx + 2 };
    header.forEach((h, i) => { obj[h] = (cells[i] ?? '').trim(); });
    return obj;
  });
  return { header, records, separator: sep };
}

export function toCsv(header, records, separator = ',') {
  const esc = (v) => {
    const s = v == null ? '' : String(v);
    return /[",;\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [header.map(esc).join(separator)];
  for (const r of records) lines.push(header.map((h) => esc(r[h])).join(separator));
  return lines.join('\n') + '\n';
}
