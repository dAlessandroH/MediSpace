document.addEventListener('DOMContentLoaded', () => {
  renderHome();
  bindSearch();
  bindPomodoro();
  requestNotificationPermission();
  restorePomodoroTicker();
});

let pomodoroTicker = null;

function renderHome() {
  const settings = getSettings();
  const decks = getDecks();
  const cards = getCards();
  const streak = getStreak();
  const todayLog = getTodayLog();
  const dueToday = cards.filter(card => isDueToday(card.scheduling?.dueDate)).length;
  const difficult = cards.filter(card => card.scheduling?.rescue).length;
  const mastered = getFriendlyMasteredCount(cards);
  const accuracy = calculateAccuracy(cards);
  const target = settings.dailyTargetReviews || 80;
  const progress = Math.min(100, Math.round((todayLog.reviews / Math.max(1, target)) * 100));
  const pendingTasks = getPendingTasksCount();

  document.getElementById('heroTitle').textContent = `${settings.userName || 'Tu'} plan de hoy`;
  document.getElementById('heroSubtitle').textContent = dueToday
    ? `Hoy te conviene resolver ${dueToday} tarjetas pendientes. Empieza por lo vencido, luego rescata lo dificil y deja pocas nuevas.`
    : `Hoy no tienes deuda fuerte. Buen momento para repaso de rescate, nuevas tarjetas o preparar proximos examenes con calma.`;

  const stats = [
    ['Por repasar hoy', dueToday, 'Las que ya te toca ver hoy o ya se vencieron.'],
    ['Aciertos globales', `${accuracy}%`, 'Que tanto aciertas cuando estudias.'],
    ['Ya bien asentadas', mastered, 'Tarjetas que ya aguantan mejor el paso del tiempo.'],
    ['Necesitan rescate', difficult, 'Tarjetas que se te han complicado varias veces.'],
    ['Meta de hoy', `${todayLog.reviews}/${target}`, 'Cuantas llevas hoy frente a la meta diaria.'],
    ['Racha', `${streak.current || 0} dias`, 'Dias seguidos con al menos un repaso.'],
    ['Pendientes uni', pendingTasks, 'Tareas o entregas que aun no has marcado como hechas.']
  ];

  document.getElementById('homeStats').innerHTML = stats.map(([label, value, help]) => `
    <article class="stat-card">
      <h3>${escapeHtml(value)}</h3>
      <p><strong>${escapeHtml(label)}</strong></p>
      <p class="muted">${escapeHtml(help)}</p>
    </article>
  `).join('');

  renderDecks(decks, cards);
  renderFocusList(cards);
  renderExamUrgency(cards);
  renderTodayPlan(cards, todayLog, progress);
  renderCalendar();
  renderTasks();
  renderPomodoroBox();
}

function renderDecks(decks, cards, search = '') {
  const q = search.trim().toLowerCase();
  const filtered = decks.filter(deck => {
    const text = `${deck.name} ${deck.subject || ''}`.toLowerCase();
    return !q || text.includes(q);
  });

  const container = document.getElementById('deckList');
  if (!filtered.length) {
    container.innerHTML = '<div class="item"><h3>No hay decks con ese filtro</h3><p>Importa un CSV o escribe otra busqueda.</p></div>';
    return;
  }

  container.innerHTML = filtered.map(deck => {
    const deckCards = cards.filter(card => card.deckId === deck.id);
    const due = deckCards.filter(card => isDueToday(card.scheduling?.dueDate)).length;
    const difficultDeck = deckCards.filter(card => card.scheduling?.rescue).length;
    const masteredDeck = deckCards.filter(card => (card.scheduling?.status || '') === 'mature').length;
    return `
      <div class="item">
        <h3>${escapeHtml(deck.name)}</h3>
        <p>${escapeHtml(deck.subject || 'Sin materia')}</p>
        <div class="kv three-cols">
          <div><strong>${deckCards.length}</strong><br><span class="muted">Total</span></div>
          <div><strong>${due}</strong><br><span class="muted">Hoy</span></div>
          <div><strong>${masteredDeck}</strong><br><span class="muted">Asentadas</span></div>
          <div><strong>${difficultDeck}</strong><br><span class="muted">Rescate</span></div>
        </div>
        <div class="item-actions">
          <a class="btn" href="deck.html?id=${encodeURIComponent(deck.id)}">Abrir deck</a>
          <a class="btn primary" href="review.html?deck=${encodeURIComponent(deck.id)}">Repasar</a>
        </div>
      </div>
    `;
  }).join('');
}

function renderFocusList(cards) {
  const breakdown = calculateSubjectBreakdown(cards);
  const rank = Object.entries(breakdown)
    .sort((a, b) => (b[1].difficult * 3 + b[1].due) - (a[1].difficult * 3 + a[1].due))
    .slice(0, 6);

  document.getElementById('focusList').innerHTML = rank.length
    ? rank.map(([name, info]) => `
        <div class="item">
          <h4>${escapeHtml(name)}</h4>
          <p>${info.due} por repasar hoy · ${info.difficult} en rescate · ${info.dominated} ya asentadas</p>
        </div>
      `).join('')
    : '<div class="item"><p>En cuanto metas tarjetas y empieces a estudiar, aqui se vera que materia aprieta mas.</p></div>';
}

function renderExamUrgency(cards) {
  const exams = getUpcomingExams(4);
  const breakdown = calculateSubjectBreakdown(cards);
  const box = document.getElementById('examUrgencyList');

  if (!exams.length) {
    box.innerHTML = '<div class="item"><h4>No has programado examenes</h4><p>Agregalos en Plan y calendario. Eso ayuda a que la app apriete el espaciado cuando se acercan.</p></div>';
    return;
  }

  box.innerHTML = exams.map(exam => {
    const days = daysUntil(exam.date);
    const subjectInfo = breakdown[exam.subject] || { due: 0, difficult: 0, total: 0 };
    return `
      <div class="item">
        <h4>${escapeHtml(exam.title || exam.subject)}</h4>
        <p><strong>${escapeHtml(exam.subject || 'Sin materia')}</strong> · ${days === 0 ? 'Hoy' : `En ${days} dias`} · ${formatDate(exam.date)}</p>
        <p>${subjectInfo.due} por repasar hoy · ${subjectInfo.difficult} en rescate</p>
      </div>
    `;
  }).join('');
}

function renderTodayPlan(cards, todayLog, progress) {
  const due = cards.filter(card => isDueToday(card.scheduling?.dueDate)).length;
  const rescue = cards.filter(card => card.scheduling?.rescue).length;
  const settings = getSettings();
  const urgentExam = getMostUrgentExam();
  const plan = [
    `${due} tarjetas pendientes: empieza por aqui.`,
    `${Math.min(rescue, 15)} tarjetas de rescate: metelas despues si aun tienes gasolina.`,
    `${settings.dailyNewLimit} nuevas maximo: no te entierres vivo con material nuevo.`,
    `${todayLog.focusedMinutes} minutos de enfoque hoy · progreso ${progress}% de la meta diaria.`
  ];

  if (urgentExam) {
    const days = daysUntil(urgentExam.date);
    plan.push(`Examen cercano: ${urgentExam.subject} en ${days} dias. Esa materia merece prioridad.`);
  }

  const urgentTasks = getUpcomingTasks(3);
  if (urgentTasks.length) plan.push(`Tareas cercanas: ${urgentTasks.map(task => `${task.title} (${daysUntil(task.dueDate) === 0 ? 'hoy' : `${daysUntil(task.dueDate)} d`})`).join(', ')}`);
  document.getElementById('todayPlanBox').innerHTML = plan.map(item => `<div class=\"item\"><p>${escapeHtml(item)}</p></div>`).join('');
}

function renderCalendar() {
  const days = getCalendarDays(28);
  const grid = document.getElementById('calendarGrid');
  const legend = document.getElementById('calendarLegend');
  legend.innerHTML = `
    <span class="pill">Bloque = dia</span>
    <span class="pill">Numero grande = tarjetas programadas</span>
    <span class="pill">Minutos = tiempo de enfoque</span>
    <span class="pill">Cinta roja = examen</span>
  `;

  grid.innerHTML = days.map(day => {
    const intensity = day.due >= 80 ? 'heavy' : day.due >= 35 ? 'medium' : day.due > 0 ? 'light' : 'empty';
    return `
      <div class="calendar-day ${intensity} ${day.isToday ? 'today' : ''}">
        <div class="calendar-head">
          <span>${escapeHtml(day.weekday)}</span>
          <strong>${day.dayNumber}</strong>
        </div>
        <div class="calendar-main">
          <div class="calendar-due">${day.due}</div>
          <div class="calendar-label">por repasar</div>
          <div class="calendar-sub">${day.reviews} repasadas · ${day.focusedMinutes} min</div>
        </div>
        ${day.tasks.length ? `<div class="calendar-task">${escapeHtml(day.tasks[0].title || 'Tarea')}</div>` : ''}
        ${day.exams.length ? `<div class=\"calendar-exam\">${escapeHtml(day.exams[0].subject || 'Examen')}</div>` : ''}
      </div>
    `;
  }).join('');
}

function bindSearch() {
  const search = document.getElementById('deckSearch');
  if (!search) return;
  search.addEventListener('input', () => renderDecks(getDecks(), getCards(), search.value));
}

function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission().catch(() => {});
  }
}

function bindPomodoro() {
  document.getElementById('pomodoroToggleBtn')?.addEventListener('click', togglePomodoro);
  document.getElementById('pomodoroResetBtn')?.addEventListener('click', resetPomodoro);
  document.getElementById('pomodoroSkipBtn')?.addEventListener('click', skipPomodoroPhase);
}

function getPomodoroDurations() {
  const s = getSettings();
  return {
    focus: Number(s.pomodoroStudyMin || 25) * 60,
    short: Number(s.pomodoroShortBreak || 5) * 60,
    long: Number(s.pomodoroLongBreak || 15) * 60,
    cycles: Number(s.pomodoroCycles || 4)
  };
}

function renderPomodoroBox() {
  const state = normalizePomodoroState(getPomodoroState());
  const durations = getPomodoroDurations();
  const remaining = getPomodoroRemaining(state);
  document.getElementById('pomodoroTime').textContent = formatSeconds(remaining);
  document.getElementById('pomodoroPhase').textContent = state.phase === 'focus' ? `Enfoque · ciclo ${state.cycle}/${durations.cycles}` : (state.phase === 'short' ? 'Pausa corta' : 'Pausa larga');
  document.getElementById('pomodoroToggleBtn').textContent = state.isRunning ? 'Pausar' : 'Iniciar';

  const todayFocus = getTodayLog().focusedMinutes;
  const sessions = getPomodoroHistory().filter(item => item.date === todayLocalKey()).length;
  document.getElementById('pomodoroTodayBox').innerHTML = `
    <div><strong>${todayFocus} min</strong><span class="muted">enfoque hoy</span></div>
    <div><strong>${sessions}</strong><span class="muted">pomodoros cerrados</span></div>
  `;
}

function normalizePomodoroState(state) {
  const durations = getPomodoroDurations();
  if (state.remainingSeconds === null || state.remainingSeconds === undefined) {
    state.remainingSeconds = durations.focus;
  }
  return state;
}

function getPomodoroRemaining(state) {
  if (!state.isRunning || !state.plannedEndAt) return state.remainingSeconds || getPomodoroDurations().focus;
  const diff = Math.max(0, Math.round((new Date(state.plannedEndAt).getTime() - Date.now()) / 1000));
  return diff;
}

function restorePomodoroTicker() {
  renderPomodoroBox();
  if (pomodoroTicker) clearInterval(pomodoroTicker);
  pomodoroTicker = setInterval(() => {
    const state = normalizePomodoroState(getPomodoroState());
    if (state.isRunning) {
      const remaining = getPomodoroRemaining(state);
      if (remaining <= 0) {
        finishPomodoroPhase();
      }
    }
    renderPomodoroBox();
  }, 1000);
}

function togglePomodoro() {
  const state = normalizePomodoroState(getPomodoroState());
  if (state.isRunning) {
    state.remainingSeconds = getPomodoroRemaining(state);
    state.isRunning = false;
    state.plannedEndAt = null;
    state.startedAt = null;
  } else {
    state.isRunning = true;
    state.startedAt = nowISO();
    state.plannedEndAt = new Date(Date.now() + (state.remainingSeconds * 1000)).toISOString();
  }
  savePomodoroState(state);
  renderPomodoroBox();
}

function resetPomodoro() {
  const durations = getPomodoroDurations();
  const state = { phase: 'focus', cycle: 1, isRunning: false, remainingSeconds: durations.focus, startedAt: null, plannedEndAt: null };
  savePomodoroState(state);
  renderPomodoroBox();
}

function skipPomodoroPhase() {
  const state = normalizePomodoroState(getPomodoroState());
  advancePomodoroPhase(state, false);
}

function finishPomodoroPhase() {
  const state = normalizePomodoroState(getPomodoroState());
  advancePomodoroPhase(state, true);
}

function advancePomodoroPhase(state, completed) {
  const durations = getPomodoroDurations();
  if (completed && state.phase === 'focus') {
    addFocusedMinutes(Math.round((durations.focus) / 60));
    const history = getPomodoroHistory();
    history.push({ id: uid('pom'), date: todayLocalKey(), completedAt: nowISO(), minutes: Math.round(durations.focus / 60) });
    savePomodoroHistory(history);
    safeNotify('Pomodoro terminado', 'Buen bloque. Ahora toca una pausa.');
  }

  if (state.phase === 'focus') {
    const isLong = state.cycle % durations.cycles === 0;
    state.phase = isLong ? 'long' : 'short';
    state.remainingSeconds = isLong ? durations.long : durations.short;
  } else {
    state.phase = 'focus';
    state.cycle = state.phase === 'focus' ? state.cycle : state.cycle + 1;
    if (state.cycle > durations.cycles) state.cycle = 1;
    state.remainingSeconds = durations.focus;
    safeNotify('Pausa terminada', 'Vuelve al ataque. Una tarjeta menos tambien es progreso.');
  }

  if (state.phase === 'focus' && completed) {
    state.cycle += 1;
    if (state.cycle > durations.cycles) state.cycle = 1;
  }

  state.isRunning = false;
  state.startedAt = null;
  state.plannedEndAt = null;
  savePomodoroState(state);
  renderHome();
}

function formatSeconds(totalSeconds) {
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}


function renderTasks() {
  const tasks = getUpcomingTasks(6);
  const box = document.getElementById('taskQuickList');
  if (!box) return;
  if (!tasks.length) {
    box.innerHTML = '<div class="item"><p>No tienes pendientes registrados. Si algo te puede sabotear por olvido, apuntalo en Plan y calendario.</p></div>';
    return;
  }
  box.innerHTML = tasks.map(task => {
    const days = daysUntil(task.dueDate);
    const badge = task.completed ? 'Hecha' : days === 0 ? 'Hoy' : days === 1 ? 'Mañana' : `En ${days} dias`;
    return `<div class="item ${task.completed ? 'task-done' : ''}"><h4>${escapeHtml(task.title)}</h4><p>${escapeHtml(task.subject || 'Universidad')} · ${formatDate(task.dueDate)} · ${badge}</p></div>`;
  }).join('');
}
