document.addEventListener('DOMContentLoaded', () => {
  const importBtn = document.getElementById('importBtn');
  const loadSampleBtn = document.getElementById('loadSampleBtn');
  const fileInput = document.getElementById('csvFile');

  importBtn?.addEventListener('click', importDeckFromCSV);
  fileInput?.addEventListener('change', previewSelectedFile);
  loadSampleBtn?.addEventListener('click', loadSampleData);
});

async function previewSelectedFile() {
  const fileInput = document.getElementById('csvFile');
  const file = fileInput?.files?.[0];
  if (!file) return;
  const text = await file.text();
  const rows = parseCSV(text);
  renderPreview(rows.slice(0, 10));
}

async function importDeckFromCSV() {
  const status = document.getElementById('importStatus');
  try {
    const deckName = document.getElementById('deckName').value.trim();
    const deckSubject = document.getElementById('deckSubject').value.trim();
    const file = document.getElementById('csvFile').files?.[0];

    if (!deckName) throw new Error('Escribe un nombre para el deck.');
    if (!file) throw new Error('Selecciona un archivo CSV.');

    const text = await file.text();
    const rows = parseCSV(text);
    if (!rows.length) throw new Error('El CSV esta vacio o no se pudo leer.');

    const required = ['pregunta', 'opcion_a', 'opcion_b', 'opcion_c', 'opcion_d', 'respuesta', 'categoria', 'explicacion'];
    const firstRow = rows[0] || {};
    const missing = required.filter(key => !(key in firstRow));
    if (missing.length) throw new Error(`Faltan columnas: ${missing.join(', ')}`);

    const decks = getDecks();
    const cards = getCards();
    const deckId = uid('deck');

    decks.push({
      id: deckId,
      name: deckName,
      subject: deckSubject,
      description: 'Importado desde CSV',
      createdAt: nowISO()
    });

    const importedCards = rows.map((row, index) => ({
      id: uid('card'),
      deckId,
      type: 'multiple_choice',
      question: row.pregunta || `Pregunta ${index + 1}`,
      optionA: row.opcion_a || '',
      optionB: row.opcion_b || '',
      optionC: row.opcion_c || '',
      optionD: row.opcion_d || '',
      correctAnswer: String(row.respuesta || '').trim().toUpperCase(),
      explanation: row.explicacion || '',
      category: row.categoria || 'General',
      tags: [],
      priority: normalizePriority(row.categoria, row.pregunta),
      scheduling: {
        repetitions: 0,
        easeFactor: 2.5,
        intervalDays: 0,
        dueDate: nowISO(),
        lastReviewedAt: null,
        lapses: 0,
        status: 'new',
        rescue: false
      },
      stats: {
        totalReviews: 0,
        correctReviews: 0,
        wrongReviews: 0,
        lastRating: null
      },
      createdAt: nowISO()
    }));

    saveDecks(decks);
    saveCards([...cards, ...importedCards]);

    showNotice(status, `Importacion correcta: ${importedCards.length} tarjetas agregadas a "${deckName}".`, 'success');
    renderPreview(rows.slice(0, 10));
  } catch (error) {
    showNotice(document.getElementById('importStatus'), error.message, 'error');
  }
}

function renderPreview(rows) {
  const preview = document.getElementById('previewTable');
  const count = document.getElementById('previewCount');
  count.textContent = `${rows.length} filas`;

  if (!rows.length) {
    preview.innerHTML = '<div class="table-empty">Sin datos para mostrar.</div>';
    return;
  }

  preview.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Pregunta</th>
          <th>Categoria</th>
          <th>Respuesta</th>
          <th>Explicacion</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map(row => `
          <tr>
            <td>${escapeHtml(row.pregunta || '')}</td>
            <td>${escapeHtml(row.categoria || '')}</td>
            <td>${escapeHtml(row.respuesta || '')}</td>
            <td>${escapeHtml((row.explicacion || '').slice(0, 120))}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function loadSampleData() {
  const sample = `pregunta,opcion_a,opcion_b,opcion_c,opcion_d,respuesta,categoria,explicacion\n"Cual cavidad cardiaca forma la mayor parte de la cara esternocostal del corazon?","Auricula izquierda","Ventriculo derecho","Ventriculo izquierdo","Auricula derecha","B","Corazon","El ventriculo derecho forma la mayor parte de la cara esternocostal del corazon."\n"Que arteria corre en el surco interventricular anterior?","Arteria coronaria derecha","Arteria circunfleja","Arteria interventricular anterior","Arteria marginal izquierda","C","Corazon","La arteria interventricular anterior desciende por el surco interventricular anterior."\n"Que nervio inerva el diafragma?","Vago","Frenico","Intercostal","Toracodorsal","B","Torax","El nervio frenico es la inervacion motora principal del diafragma."`;
  const rows = parseCSV(sample);
  document.getElementById('deckName').value = 'Deck de ejemplo';
  document.getElementById('deckSubject').value = 'Anatomia';
  renderPreview(rows);
  showNotice(document.getElementById('importStatus'), 'Se cargo una vista previa de ejemplo. Para importarlo de verdad, usa tu CSV.', 'info');
}

function showNotice(target, message, type = 'info') {
  if (!target) return;
  target.className = `notice ${type}`;
  target.textContent = message;
}
