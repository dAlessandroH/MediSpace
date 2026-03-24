document.addEventListener('DOMContentLoaded', () => {
  renderDeckPage();
  document.getElementById('searchInput')?.addEventListener('input', renderDeckCards);
  document.getElementById('resetDeckBtn')?.addEventListener('click', resetDeckProgress);
  document.getElementById('deleteDeckBtn')?.addEventListener('click', deleteDeck);
});

function renderDeckPage() {
  const deckId = getQueryParam('id');
  const deck = getDeckById(deckId);
  const cards = getCards().filter(card => card.deckId === deckId);

  if (!deck) {
    document.getElementById('deckTitle').textContent = 'Deck no encontrado';
    document.getElementById('deckMeta').textContent = 'Ese deck no existe o fue eliminado.';
    document.getElementById('deckCards').innerHTML = '<div class="item"><p>No hay datos para mostrar.</p></div>';
    return;
  }

  const examCount = cards.filter(card => (card.type || 'multiple_choice') === 'multiple_choice').length;
  const flashCount = cards.filter(card => (card.type || 'multiple_choice') === 'flashcard').length;
  document.getElementById('deckTitle').textContent = deck.name;
  document.getElementById('deckMeta').textContent = `${deck.subject || 'Sin materia'} · ${cards.length} tarjetas · ${examCount} examen · ${flashCount} flashcards · creado ${formatDate(deck.createdAt)}`;
  renderDeckCards();
}

function renderDeckCards() {
  const deckId = getQueryParam('id');
  const query = document.getElementById('searchInput').value.trim().toLowerCase();
  const cards = getCards()
    .filter(card => card.deckId === deckId)
    .filter(card => {
      const text = `${card.question || ''} ${card.front || ''} ${card.category || ''} ${card.back || ''}`.toLowerCase();
      return !query || text.includes(query);
    });

  const target = document.getElementById('deckCards');
  target.innerHTML = cards.length
    ? cards.map(card => {
        const type = (card.type || 'multiple_choice') === 'flashcard' ? 'Flashcard' : 'Examen';
        const body = (card.type || 'multiple_choice') === 'flashcard'
          ? `<p><strong>Frente:</strong> ${escapeHtml(card.front || card.question || '')}</p><p><strong>Reverso:</strong> ${escapeHtml((card.back || card.answer || '').slice(0, 240))}</p>`
          : `<h4>${escapeHtml(card.question || '')}</h4><p>${escapeHtml(card.category || 'General')} · ${card.scheduling?.status || 'new'} · lapses ${card.scheduling?.lapses || 0}</p><p>Respuesta: ${escapeHtml(card.correctAnswer || '')}</p>`;
        return `
          <div class="item">
            <div class="chip-row"><span class="tag type-badge">${type}</span><span class="tag">Prioridad ${card.priority || 1}</span></div>
            ${body}
            <p>Proximo repaso: ${formatDate(card.scheduling?.dueDate)}</p>
            <div class="chip-row">
              <span class="tag">Ultimo rating: ${escapeHtml(card.stats?.lastRating || 'ninguno')}</span>
              <span class="tag">Correctas: ${card.stats?.correctReviews || 0}</span>
              <span class="tag">Incorrectas: ${card.stats?.wrongReviews || 0}</span>
            </div>
          </div>
        `;
      }).join('')
    : '<div class="item"><p>No hay tarjetas que coincidan con la busqueda.</p></div>';
}

function resetDeckProgress() {
  const deckId = getQueryParam('id');
  if (!confirm('Se reiniciara el progreso de este deck.')) return;

  const cards = getCards().map(card => {
    if (card.deckId !== deckId) return card;
    return {
      ...card,
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
      }
    };
  });

  saveCards(cards);
  const reviews = getReviews().filter(review => {
    const card = cards.find(item => item.id === review.cardId);
    return card && card.deckId !== deckId;
  });
  saveReviews(reviews);
  renderDeckPage();
}

function deleteDeck() {
  const deckId = getQueryParam('id');
  const deck = getDeckById(deckId);
  if (!deck) return;
  if (!confirm(`Eliminar deck "${deck.name}" y todas sus tarjetas?`)) return;

  const cards = getCards();
  const remainingCards = cards.filter(card => card.deckId !== deckId);
  const removedIds = new Set(cards.filter(card => card.deckId === deckId).map(card => card.id));
  saveCards(remainingCards);
  saveDecks(getDecks().filter(item => item.id !== deckId));
  saveReviews(getReviews().filter(review => !removedIds.has(review.cardId)));
  window.location.href = 'index.html';
}
