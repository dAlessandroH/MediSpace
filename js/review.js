let sessionCards = [];
let currentIndex = 0;
let selectedOption = null;
let answerRevealed = false;
let sessionStart = null;

const reviewPanel = document.getElementById('reviewPanel');
const emptyState = document.getElementById('emptyState');
const progressText = document.getElementById('progressText');
const revealActions = document.getElementById('revealActions');
const ratingActions = document.getElementById('ratingActions');
const answerBlock = document.getElementById('answerBlock');
const ratingHelp = document.getElementById('ratingHelp');

const ratingLabels = {
  again: 'Otra vez',
  hard: 'Dificil',
  good: 'Bien',
  easy: 'Facil'
};

document.addEventListener('DOMContentLoaded', () => {
  setupFilters();
  bindControls();
  loadSession();
});

function setupFilters() {
  const decks = getDecks();
  const deckFilter = document.getElementById('deckFilter');
  const queryDeck = getQueryParam('deck');
  const queryMode = getQueryParam('mode');

  deckFilter.innerHTML = `<option value="all">Todos los decks</option>` + decks.map(deck =>
    `<option value="${escapeHtml(deck.id)}">${escapeHtml(deck.name)}</option>`
  ).join('');

  if (queryDeck && decks.some(deck => deck.id === queryDeck)) deckFilter.value = queryDeck;
  if (queryMode && document.getElementById('modeFilter').querySelector(`option[value="${queryMode}"]`)) {
    document.getElementById('modeFilter').value = queryMode;
  }
}

function bindControls() {
  document.getElementById('startSessionBtn')?.addEventListener('click', loadSession);
  document.getElementById('showAnswerBtn')?.addEventListener('click', revealAnswer);
  document.querySelectorAll('[data-rating]').forEach(button => {
    button.addEventListener('click', () => registerReview(button.dataset.rating));
  });
  document.addEventListener('keydown', handleHotkeys);
}

function handleHotkeys(event) {
  if (event.target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName)) return;
  if (!sessionCards[currentIndex]) return;
  if (event.key.toLowerCase() === 'm') revealAnswer();
  if (!answerRevealed) return;
  if (event.key === '1') registerReview('again');
  if (event.key === '2') registerReview('hard');
  if (event.key === '3') registerReview('good');
  if (event.key === '4') registerReview('easy');
}

function loadSession() {
  const deckId = document.getElementById('deckFilter').value;
  const mode = document.getElementById('modeFilter').value;
  sessionCards = getDueCardsForSession({ deckId, mode });
  currentIndex = 0;
  renderCurrentCard();
}

function renderCurrentCard() {
  selectedOption = null;
  answerRevealed = false;
  sessionStart = Date.now();

  if (!sessionCards.length || currentIndex >= sessionCards.length) {
    reviewPanel.classList.add('hidden');
    emptyState.classList.remove('hidden');
    progressText.textContent = '0 / 0';
    document.getElementById('sessionSubtitle').textContent = 'No hay tarjetas pendientes para esta combinacion.';
    return;
  }

  emptyState.classList.add('hidden');
  reviewPanel.classList.remove('hidden');

  const card = sessionCards[currentIndex];
  const deck = getDeckById(card.deckId);

  document.getElementById('sessionSubtitle').textContent = `${sessionCards.length} tarjetas en la sesion actual. Atajo: M muestra respuesta, 1-4 guardan la calificacion.`;
  progressText.textContent = `${currentIndex + 1} / ${sessionCards.length}`;
  document.getElementById('deckNameTag').textContent = deck?.name || 'Deck';
  document.getElementById('cardCategory').textContent = card.category || 'General';
  document.getElementById('cardPriority').textContent = `Prioridad ${card.priority || 1}`;
  document.getElementById('nextInfoTag').textContent = `Tropiezos: ${card.scheduling?.lapses || 0}`;
  document.getElementById('questionText').innerHTML = `${escapeHtml(card.question)}<small>Marca la opcion, muestra la respuesta y luego califica como se sintio el recuerdo.</small>`;
  document.getElementById('correctAnswerText').textContent = `${card.correctAnswer}. ${getAnswerText(card, card.correctAnswer)}`;
  document.getElementById('explanationText').textContent = card.explanation || 'Sin explicacion disponible.';

  answerBlock.classList.add('hidden');
  revealActions.classList.remove('hidden');
  ratingActions.classList.add('hidden');
  ratingHelp.classList.add('hidden');

  renderOptions(card);
}

function renderOptions(card) {
  const optionsContainer = document.getElementById('optionsContainer');
  const options = [
    ['A', card.optionA],
    ['B', card.optionB],
    ['C', card.optionC],
    ['D', card.optionD]
  ];

  optionsContainer.innerHTML = options.map(([key, text]) => `
    <button class="option-btn" data-key="${key}" type="button">
      <strong>${key}.</strong> ${escapeHtml(text || '')}
    </button>
  `).join('');

  optionsContainer.querySelectorAll('.option-btn').forEach(button => {
    button.addEventListener('click', () => {
      if (answerRevealed) return;
      selectedOption = button.dataset.key;
      optionsContainer.querySelectorAll('.option-btn').forEach(btn => btn.classList.remove('selected'));
      button.classList.add('selected');
    });
  });
}

function revealAnswer() {
  const card = sessionCards[currentIndex];
  if (!card) return;
  answerRevealed = true;
  answerBlock.classList.remove('hidden');
  revealActions.classList.add('hidden');
  ratingActions.classList.remove('hidden');
  ratingHelp.classList.remove('hidden');
  ratingHelp.textContent = '1 = Otra vez, 2 = Dificil, 3 = Bien, 4 = Facil. Lo que marques se guarda y decide cuando vuelve.';

  updateRatingPreviews(card);

  document.querySelectorAll('.option-btn').forEach(button => {
    const key = button.dataset.key;
    button.disabled = true;
    if (key === card.correctAnswer) button.classList.add('correct');
    if (selectedOption && key === selectedOption && selectedOption !== card.correctAnswer) button.classList.add('wrong');
  });
}

function updateRatingPreviews(card) {
  ['again', 'hard', 'good', 'easy'].forEach(rating => {
    const preview = calculateNextSchedule(card.scheduling || {}, rating, card.priority || 1, card);
    const label = humanInterval(preview.intervalDays, preview.dueDate, rating);
    const target = document.getElementById(`preview-${rating}`);
    if (target) target.textContent = label;
  });
}

function registerReview(rating) {
  try {
    const card = sessionCards[currentIndex];
    if (!card) return;

    const cards = getCards();
    const reviews = getReviews();
    const cardIndex = cards.findIndex(item => item.id === card.id);
    if (cardIndex === -1) throw new Error('No se encontro la tarjeta en almacenamiento.');

    const before = { ...(cards[cardIndex].scheduling || {}) };
    const after = calculateNextSchedule(before, rating, cards[cardIndex].priority || 1, cards[cardIndex]);
    const wasCorrect = selectedOption === cards[cardIndex].correctAnswer;

    cards[cardIndex].scheduling = after;
    cards[cardIndex].stats = cards[cardIndex].stats || { totalReviews: 0, correctReviews: 0, wrongReviews: 0, lastRating: null };
    cards[cardIndex].stats.totalReviews += 1;
    cards[cardIndex].stats.lastRating = rating;
    if (wasCorrect) cards[cardIndex].stats.correctReviews += 1;
    else cards[cardIndex].stats.wrongReviews += 1;

    reviews.push({
      id: uid('review'),
      cardId: card.id,
      reviewedAt: nowISO(),
      rating,
      wasCorrect,
      selectedOption,
      correctAnswer: cards[cardIndex].correctAnswer,
      responseTimeMs: Date.now() - sessionStart,
      intervalBefore: before.intervalDays || 0,
      intervalAfter: after.intervalDays || 0,
      easeBefore: before.easeFactor || 2.5,
      easeAfter: after.easeFactor || 2.5
    });

    saveCards(cards);
    saveReviews(reviews);
    logStudyReview(cards[cardIndex], rating, wasCorrect);
    updateStudyStreak();

    if (rating === 'again') {
      const updatedCard = cards[cardIndex];
      sessionCards.splice(currentIndex + 1, 0, updatedCard);
    }

    currentIndex += 1;
    renderCurrentCard();
  } catch (error) {
    alert(error.message || 'Ocurrio un error al guardar la revision.');
    console.error(error);
  }
}

function getAnswerText(card, key) {
  if (key === 'A') return card.optionA || '';
  if (key === 'B') return card.optionB || '';
  if (key === 'C') return card.optionC || '';
  if (key === 'D') return card.optionD || '';
  return '';
}

function humanInterval(intervalDays, dueDate, rating) {
  if (rating === 'again') return 'Vuelve hoy';
  if (intervalDays <= 1) return 'Vuelve mañana';
  return `Vuelve en ${Math.round(intervalDays)} dias (${formatDate(dueDate)})`;
}
