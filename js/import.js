document.addEventListener('DOMContentLoaded', () => {
  const importBtn = document.getElementById('importBtn');
  const loadSampleBtn = document.getElementById('loadSampleBtn');
  const fileInput = document.getElementById('csvFile');
  const importType = document.getElementById('importType');

  importBtn?.addEventListener('click', importDeckFromCSV);
  fileInput?.addEventListener('change', previewSelectedFile);
  loadSampleBtn?.addEventListener('click', loadSampleData);
  importType?.addEventListener('change', () => {
    updateFormatHelp();
    renderPreview([]);
  });
  updateFormatHelp();
});

async function previewSelectedFile() {
  const fileInput = document.getElementById('csvFile');
  const file = fileInput?.files?.[0];
  if (!file) return;
  const text = await file.text();
  const rows = parseCSV(text);
  renderPreview(rows.slice(0, 10));
}

function updateFormatHelp() {
  const type = document.getElementById('importType').value;
  const help = document.getElementById('formatHelp');
  if (type === 'flashcard') {
    help.innerHTML = 'Formato flashcards: <strong>frente, reverso, categoria</strong>. Solo frente y reverso son obligatorios. Tambien acepta aliases como front/back o pregunta/explicacion.';
  } else {
    help.innerHTML = 'Formato examen: <strong>pregunta, opcion_a, opcion_b, opcion_c, opcion_d, respuesta, categoria, explicacion</strong>. Asi se importa al simulador de examen.';
  }
}

async function importDeckFromCSV() {
  const status = document.getElementById('importStatus');
  try {
    const deckName = document.getElementById('deckName').value.trim();
    const deckSubject = document.getElementById('deckSubject').value.trim();
    const file = document.getElementById('csvFile').files?.[0];
    const importType = document.getElementById('importType').value;

    if (!deckName) throw new Error('Escribe un nombre para el deck.');
    if (!file) throw new Error('Selecciona un archivo CSV.');

    const text = await file.text();
    const rows = parseCSV(text);
    if (!rows.length) throw new Error('El CSV esta vacio o no se pudo leer.');

    const decks = getDecks();
    const cards = getCards();
    const deckId = uid('deck');

    decks.push({
      id: deckId,
      name: deckName,
      subject: deckSubject,
      description: importType === 'flashcard' ? 'Flashcards importadas desde CSV' : 'Preguntas de examen importadas desde CSV',
      createdAt: nowISO()
    });

    const importedCards = importType === 'flashcard'
      ? buildFlashcards(rows, deckId)
      : buildExamCards(rows, deckId);

    saveDecks(decks);
    saveCards([...cards, ...importedCards]);

    showNotice(status, `Importacion correcta: ${importedCards.length} tarjetas agregadas a "${deckName}".`, 'success');
    renderPreview(rows.slice(0, 10));
  } catch (error) {
    showNotice(document.getElementById('importStatus'), error.message, 'error');
  }
}

function buildExamCards(rows, deckId) {
  const required = ['pregunta', 'opcion_a', 'opcion_b', 'opcion_c', 'opcion_d', 'respuesta', 'categoria', 'explicacion'];
  const firstRow = rows[0] || {};
  const missing = required.filter(key => !(key in firstRow));
  if (missing.length) throw new Error(`Faltan columnas: ${missing.join(', ')}`);

  return rows.map((row, index) => ({
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
    scheduling: defaultScheduling(),
    stats: defaultStats(),
    createdAt: nowISO()
  }));
}

function buildFlashcards(rows, deckId) {
  const frontKey = resolveColumn(rows[0], ['frente', 'front', 'anverso', 'pregunta']);
  const backKey = resolveColumn(rows[0], ['reverso', 'back', 'detras', 'respuesta', 'explicacion']);
  const categoryKey = resolveColumn(rows[0], ['categoria', 'materia', 'tema'], true);

  if (!frontKey || !backKey) throw new Error('Para flashcards necesitas columnas frente y reverso. Tambien se aceptan front/back o pregunta/explicacion.');

  return rows.map((row, index) => ({
    id: uid('card'),
    deckId,
    type: 'flashcard',
    front: row[frontKey] || `Frente ${index + 1}`,
    back: row[backKey] || '',
    question: row[frontKey] || `Frente ${index + 1}`,
    answer: row[backKey] || '',
    explanation: row[backKey] || '',
    category: categoryKey ? (row[categoryKey] || 'General') : 'General',
    tags: [],
    priority: normalizePriority(categoryKey ? row[categoryKey] : '', row[frontKey]),
    scheduling: defaultScheduling(),
    stats: defaultStats(),
    createdAt: nowISO()
  }));
}

function resolveColumn(row, aliases, optional = false) {
  const keys = Object.keys(row || {});
  const found = aliases.find(alias => keys.includes(alias));
  if (found) return found;
  return optional ? null : null;
}

function defaultScheduling() {
  return {
    repetitions: 0,
    easeFactor: 2.5,
    intervalDays: 0,
    dueDate: nowISO(),
    lastReviewedAt: null,
    lapses: 0,
    status: 'new',
    rescue: false
  };
}

function defaultStats() {
  return {
    totalReviews: 0,
    correctReviews: 0,
    wrongReviews: 0,
    lastRating: null
  };
}

function renderPreview(rows) {
  const preview = document.getElementById('previewTable');
  const count = document.getElementById('previewCount');
  const type = document.getElementById('importType').value;
  count.textContent = `${rows.length} filas`;

  if (!rows.length) {
    preview.innerHTML = '<div class="table-empty">Sin datos para mostrar.</div>';
    return;
  }

  if (type === 'flashcard') {
    const frontKey = resolveColumn(rows[0], ['frente', 'front', 'anverso', 'pregunta'], true) || 'frente';
    const backKey = resolveColumn(rows[0], ['reverso', 'back', 'detras', 'respuesta', 'explicacion'], true) || 'reverso';
    const categoryKey = resolveColumn(rows[0], ['categoria', 'materia', 'tema'], true);
    preview.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Frente</th>
            <th>Reverso</th>
            <th>Categoria</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(row => `
            <tr>
              <td>${escapeHtml(row[frontKey] || '')}</td>
              <td>${escapeHtml((row[backKey] || '').slice(0, 160))}</td>
              <td>${escapeHtml(categoryKey ? row[categoryKey] || 'General' : 'General')}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
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
  const type = document.getElementById('importType').value;
  let sample = '';
  if (type === 'flashcard') {
    sample = `frente,reverso,categoria
"Que inerva el nervio frenico?","El diafragma. Da la inervacion motora principal del diafragma y sensibilidad a parte del pericardio, pleura mediastinica y peritoneo diafragmatico.","Torax"
"Cara esternocostal del corazon","Esta formada principalmente por el ventriculo derecho.","Corazon"
"Surco interventricular anterior","Contiene a la arteria interventricular anterior y la vena cardiaca magna.","Corazon"`;
  } else {
    sample = `pregunta,opcion_a,opcion_b,opcion_c,opcion_d,respuesta,categoria,explicacion
"Cual cavidad cardiaca forma la mayor parte de la cara esternocostal del corazon?","Auricula izquierda","Ventriculo derecho","Ventriculo izquierdo","Auricula derecha","B","Corazon","El ventriculo derecho forma la mayor parte de la cara esternocostal del corazon."
"Que arteria corre en el surco interventricular anterior?","Arteria coronaria derecha","Arteria circunfleja","Arteria interventricular anterior","Arteria marginal izquierda","C","Corazon","La arteria interventricular anterior desciende por el surco interventricular anterior."
"Que nervio inerva el diafragma?","Vago","Frenico","Intercostal","Toracodorsal","B","Torax","El nervio frenico es la inervacion motora principal del diafragma."`;
  }
  const rows = parseCSV(sample);
  document.getElementById('deckName').value = type === 'flashcard' ? 'Flashcards de ejemplo' : 'Deck de ejemplo';
  document.getElementById('deckSubject').value = 'Anatomia';
  renderPreview(rows);
  showNotice(document.getElementById('importStatus'), 'Se cargo una vista previa de ejemplo. Para importarlo de verdad, usa tu CSV.', 'info');
}

function showNotice(target, message, type = 'info') {
  if (!target) return;
  target.className = `notice ${type}`;
  target.textContent = message;
}
