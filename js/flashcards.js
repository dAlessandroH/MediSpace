let sessionCards = [];
let currentIndex = 0;
let isFlipped = false;
let sessionStart = null;

const flashPanel = document.getElementById('flashPanel');
const emptyState = document.getElementById('emptyState');
const progressText = document.getElementById('progressText');
const ratingActions = document.getElementById('ratingActions');
const ratingHelp = document.getElementById('ratingHelp');
const board = document.getElementById('flashcardBoard');

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
  document.getElementById('flipBtn')?.addEventListener('click', toggleFlip);
  board?.addEventListener('click', toggleFlip);
  document.querySelectorAll('[data-rating]').forEach(button => {
    button.addEventListener('click', () => registerReview(button.dataset.rating));
  });
  document.addEventListener('keydown', handleHotkeys);
}

function handleHotkeys(event) {
  if (event.target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName)) return;
  if (!sessionCards[currentIndex]) return;
  if (event.code === 'Space') {
    event.preventDefault();
    toggleFlip();
    return;
  }
  if (!isFlipped) return;
  if (event.key === '1') registerReview('again');
  if (event.key === '2') registerReview('hard');
  if (event.key === '3') registerReview('good');
  if (event.key === '4') registerReview('easy');
}

function loadSession() {
  const deckId = document.getElementById('deckFilter').value;
  const mode = document.getElementById('modeFilter').value;
  sessionCards = getDueCardsForSession({ deckId, mode, cardType: 'flashcard' });
  currentIndex = 0;
  renderCurrentCard();
}

function renderCurrentCard() {
  isFlipped = false;
  sessionStart = Date.now();
  board.classList.remove('is-flipped');
  ratingActions.classList.add('hidden');
  ratingHelp.classList.add('hidden');

  if (!sessionCards.length || currentIndex >= sessionCards.length) {
    flashPanel.classList.add('hidden');
    emptyState.classList.remove('hidden');
    progressText.textContent = '0 / 0';
    document.getElementById('sessionSubtitle').textContent = 'No hay flashcards pendientes para esta combinacion.';
    return;
  }

  emptyState.classList.add('hidden');
  flashPanel.classList.remove('hidden');

  const card = sessionCards[currentIndex];
  const deck = getDeckById(card.deckId);

  document.getElementById('sessionSubtitle').textContent = `${sessionCards.length} flashcards en la sesion. Piensa, voltea y guarda la sensacion real del recuerdo.`;
  progressText.textContent = `${currentIndex + 1} / ${sessionCards.length}`;
  document.getElementById('deckNameTag').textContent = deck?.name || 'Deck';
  document.getElementById('cardCategory').textContent = card.category || 'General';
  document.getElementById('cardPriority').textContent = `Prioridad ${card.priority || 1}`;
  document.getElementById('nextInfoTag').textContent = `Tropiezos: ${card.scheduling?.lapses || 0}`;
  document.getElementById('frontText').textContent = card.front || card.question || 'Sin frente';
  document.getElementById('backText').textContent = card.back || card.answer || card.explanation || 'Sin reverso';
}

function toggleFlip() {
  const card = sessionCards[currentIndex];
  if (!card) return;
  isFlipped = !isFlipped;
  board.classList.toggle('is-flipped', isFlipped);
  if (isFlipped) {
    updateRatingPreviews(card);
    ratingActions.classList.remove('hidden');
    ratingHelp.classList.remove('hidden');
    ratingHelp.textContent = 'Al marcar una opcion, se guarda tu decision y se reprograma la siguiente vez que aparecera esta flashcard.';
  } else {
    ratingActions.classList.add('hidden');
    ratingHelp.classList.add('hidden');
  }
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
    if (cardIndex === -1) throw new Error('No se encontro la flashcard en almacenamiento.');

    const before = { ...(cards[cardIndex].scheduling || {}) };
    const after = calculateNextSchedule(before, rating, cards[cardIndex].priority || 1, cards[cardIndex]);
    const wasCorrect = rating !== 'again';

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
      selectedOption: null,
      correctAnswer: null,
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

function humanInterval(intervalDays, dueDate, rating) {
  if (rating === 'again') return 'Vuelve hoy';
  if (intervalDays <= 1) return 'Vuelve mañana';
  return `Vuelve en ${Math.round(intervalDays)} dias (${formatDate(dueDate)})`;
}
