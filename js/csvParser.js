function parseCSV(text) {
  if (!text || !text.trim()) return [];
  const rows = [];
  let current = '';
  let row = [];
  let insideQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"') {
      if (insideQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        insideQuotes = !insideQuotes;
      }
      continue;
    }

    if (char === ',' && !insideQuotes) {
      row.push(current);
      current = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !insideQuotes) {
      if (char === '\r' && next === '\n') i += 1;
      row.push(current);
      if (row.some(cell => String(cell).trim() !== '')) rows.push(row);
      row = [];
      current = '';
      continue;
    }

    current += char;
  }

  row.push(current);
  if (row.some(cell => String(cell).trim() !== '')) rows.push(row);
  if (!rows.length) return [];

  const headers = rows[0].map(value => String(value).trim().toLowerCase());
  return rows.slice(1).map(cols => {
    const obj = {};
    headers.forEach((header, index) => { obj[header] = String(cols[index] ?? '').trim(); });
    return obj;
  }).filter(rowObj => Object.values(rowObj).some(value => value));
}
