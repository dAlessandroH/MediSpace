document.addEventListener('DOMContentLoaded', renderDashboard);

function renderDashboard() {
  const cards = getCards();
  const reviews = getReviews();
  const streak = getStreak();
  const dueToday = cards.filter(card => isDueToday(card.scheduling?.dueDate)).length;
  const difficult = cards.filter(card => card.scheduling?.rescue).length;
  const accuracy = calculateAccuracy(cards);
  const mastered = getFriendlyMasteredCount(cards);
  const todayLog = getTodayLog();

  document.getElementById('dashboardStats').innerHTML = [
    ['Tarjetas totales', cards.length, 'Todo lo que tienes cargado.'],
    ['Tocan hoy', dueToday, 'Tu deuda de hoy. Esto manda primero.'],
    ['Ya bien asentadas', mastered, 'Lo que ya recuerdas con mayor estabilidad.'],
    ['Todavia fragiles', difficult, 'Lo que te sigue tropezando y pide rescate.'],
    ['Aciertos globales', `${accuracy}%`, 'Tu porcentaje total de respuestas correctas.'],
    ['Repasos hoy', todayLog.reviews, 'Cuantas tarjetas ya trabajaste hoy.'],
    ['Minutos de enfoque hoy', todayLog.focusedMinutes, 'Tiempo real que si se quedo en estudio.'],
    ['Racha actual', `${streak.current || 0} dias`, 'Constancia. El verdadero anabolico de memoria.']
  ].map(([label, value, help]) => `
    <article class="stat-card">
      <h3>${escapeHtml(value)}</h3>
      <p><strong>${escapeHtml(label)}</strong></p>
      <p class="muted">${escapeHtml(help)}</p>
    </article>
  `).join('');

  const categoryMap = calculateSubjectBreakdown(cards);
  const categories = Object.entries(categoryMap).sort((a, b) => (b[1].difficult * 3 + b[1].due) - (a[1].difficult * 3 + a[1].due));
  document.getElementById('categoryStats').innerHTML = categories.length
    ? categories.map(([name, stats]) => {
        const subjectCards = cards.filter(card => {
          const deck = getDeckById(card.deckId);
          return (deck?.subject || card.category || 'General') === name;
        });
        const correct = subjectCards.reduce((sum, card) => sum + (card.stats?.correctReviews || 0), 0);
        const totalReviews = subjectCards.reduce((sum, card) => sum + (card.stats?.totalReviews || 0), 0);
        const subjectAccuracy = totalReviews ? Math.round((correct / totalReviews) * 100) : 0;
        return `
          <div class="item">
            <h3>${escapeHtml(name)}</h3>
            <div class="kv three-cols">
              <div><strong>${stats.total}</strong><br><span class="muted">total</span></div>
              <div><strong>${stats.due}</strong><br><span class="muted">hoy</span></div>
              <div><strong>${stats.difficult}</strong><br><span class="muted">fragiles</span></div>
              <div><strong>${stats.dominated}</strong><br><span class="muted">asentadas</span></div>
              <div><strong>${subjectAccuracy}%</strong><br><span class="muted">aciertos</span></div>
            </div>
          </div>
        `;
      }).join('')
    : '<div class="item"><p>Aun no hay materias disponibles.</p></div>';

  const recent = [...reviews].sort((a, b) => new Date(b.reviewedAt) - new Date(a.reviewedAt)).slice(0, 12);
  document.getElementById('recentReviews').innerHTML = recent.length
    ? recent.map(review => {
        const card = cards.find(item => item.id === review.cardId);
        const map = { again: 'Otra vez', hard: 'Dificil', good: 'Bien', easy: 'Facil' };
        return `
          <div class="item">
            <h4>${escapeHtml(card?.question?.slice(0, 80) || 'Tarjeta eliminada')}</h4>
            <p>${formatDateTime(review.reviewedAt)}</p>
            <p>Marcaste <strong>${map[review.rating] || review.rating}</strong> · ${review.wasCorrect ? 'respuesta correcta' : 'respuesta incorrecta'}</p>
          </div>
        `;
      }).join('')
    : '<div class="item"><p>Todavia no hay revisiones. En cuanto estudies, aqui quedara el rastro.</p></div>';

  const days = getCalendarDays(14);
  document.getElementById('activityCalendar').innerHTML = days.map(day => `
    <div class="calendar-day ${day.reviews >= 80 ? 'heavy' : day.reviews >= 30 ? 'medium' : day.reviews > 0 ? 'light' : 'empty'} ${day.isToday ? 'today' : ''}">
      <div class="calendar-head"><span>${escapeHtml(day.weekday)}</span><strong>${day.dayNumber}</strong></div>
      <div class="calendar-main">
        <div class="calendar-due">${day.reviews}</div>
        <div class="calendar-label">repasadas</div>
        <div class="calendar-sub">${day.focusedMinutes} min</div>
      </div>
    </div>
  `).join('');

  const forecast = getStudyForecast(7);
  document.getElementById('forecastList').innerHTML = forecast.map(item => `
    <div class="item">
      <h4>${formatDate(item.date)}</h4>
      <p>${item.due} tarjetas programadas para ese dia</p>
    </div>
  `).join('');
}
