document.addEventListener('DOMContentLoaded', () => {
  renderDeckOptions();
  document.getElementById('saveCardBtn')?.addEventListener('click', saveManualCard);
  document.getElementById('cardTypeInput')?.addEventListener('change', toggleManualFields);
  toggleManualFields();
});

function renderDeckOptions() {
  const deckSelect = document.getElementById('deckSelect');
  const decks = getDecks();
  deckSelect.innerHTML = `<option value="">Selecciona un deck existente</option>` + decks.map(deck => `
    <option value="${escapeHtml(deck.id)}">${escapeHtml(deck.name)}</option>
  `).join('');
}

function toggleManualFields() {
  const type = document.getElementById('cardTypeInput').value;
  document.getElementById('examFields').classList.toggle('hidden', type !== 'multiple_choice');
  document.getElementById('flashcardFields').classList.toggle('hidden', type !== 'flashcard');
}

function saveManualCard() {
  try {
    const type = document.getElementById('cardTypeInput').value;
    const deckIdFromSelect = document.getElementById('deckSelect').value;
    const newDeckName = document.getElementById('newDeckName').value.trim();
    const newDeckSubject = document.getElementById('newDeckSubject').value.trim();
    const category = document.getElementById('categoryInput').value.trim() || 'General';

    let deckId = deckIdFromSelect;
    const decks = getDecks();
    if (!deckId) {
      if (!newDeckName) throw new Error('Selecciona un deck o crea uno nuevo.');
      deckId = uid('deck');
      decks.push({
        id: deckId,
        name: newDeckName,
        subject: newDeckSubject,
        description: 'Creado manualmente',
        createdAt: nowISO()
      });
      saveDecks(decks);
      renderDeckOptions();
      document.getElementById('deckSelect').value = deckId;
    }

    const cards = getCards();

    if (type === 'flashcard') {
      const front = document.getElementById('frontInput').value.trim();
      const back = document.getElementById('backInput').value.trim();
      const priority = Number(document.getElementById('flashPriorityInput').value || 2);
      if (!front || !back) throw new Error('Completa frente y reverso de la flashcard.');
      cards.push({
        id: uid('card'),
        deckId,
        type: 'flashcard',
        front,
        back,
        question: front,
        answer: back,
        explanation: back,
        category,
        tags: [],
        priority,
        scheduling: defaultScheduling(),
        stats: defaultStats(),
        createdAt: nowISO()
      });
    } else {
      const question = document.getElementById('questionInput').value.trim();
      const optionA = document.getElementById('optionAInput').value.trim();
      const optionB = document.getElementById('optionBInput').value.trim();
      const optionC = document.getElementById('optionCInput').value.trim();
      const optionD = document.getElementById('optionDInput').value.trim();
      const correctAnswer = document.getElementById('correctAnswerInput').value;
      const priority = Number(document.getElementById('priorityInput').value || 2);
      const explanation = document.getElementById('explanationInput').value.trim();
      if (!question) throw new Error('Escribe la pregunta.');
      if (!optionA || !optionB || !optionC || !optionD) throw new Error('Completa las 4 opciones.');
      cards.push({
        id: uid('card'),
        deckId,
        type: 'multiple_choice',
        question,
        optionA,
        optionB,
        optionC,
        optionD,
        correctAnswer,
        explanation,
        category,
        tags: [],
        priority,
        scheduling: defaultScheduling(),
        stats: defaultStats(),
        createdAt: nowISO()
      });
    }

    saveCards(cards);
    showManualStatus('Tarjeta guardada correctamente.', 'success');
    clearForm();
  } catch (error) {
    showManualStatus(error.message, 'error');
  }
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

function clearForm() {
  ['questionInput','optionAInput','optionBInput','optionCInput','optionDInput','categoryInput','explanationInput','frontInput','backInput'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  document.getElementById('correctAnswerInput').value = 'A';
  document.getElementById('priorityInput').value = '2';
  document.getElementById('flashPriorityInput').value = '2';
}

function showManualStatus(message, type) {
  const status = document.getElementById('manualStatus');
  status.className = `notice ${type}`;
  status.textContent = message;
}
