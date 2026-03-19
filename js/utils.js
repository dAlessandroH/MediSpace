function uid(prefix = 'id') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function nowISO() { return new Date().toISOString(); }

function todayLocalKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function startOfDay(date = new Date()) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function addDays(date, days) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function isDueToday(dueDate) {
  return !dueDate || new Date(dueDate).getTime() <= Date.now();
}

function formatDate(dateString) {
  if (!dateString) return 'Sin fecha';
  const date = new Date(dateString);
  return Number.isNaN(date.getTime())
    ? 'Fecha invalida'
    : date.toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatDateTime(dateString) {
  if (!dateString) return 'Sin fecha';
  const date = new Date(dateString);
  return Number.isNaN(date.getTime())
    ? 'Fecha invalida'
    : date.toLocaleString('es-MX', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]));
}

function getDeckById(deckId) {
  return getDecks().find(deck => deck.id === deckId) || null;
}

function getQueryParam(name) {
  const params = new URLSearchParams(window.location.search);
  return params.get(name);
}

function normalizePriority(category = '', question = '') {
  const text = `${category} ${question}`.toLowerCase();
  if (/(coron|plex|inerv|irrig|mediast|tronco|aorta|valvula|nervio|arteria|vena)/.test(text)) return 3;
  if (/(hist|fisi|bioq|metab|embri|ciclo|enz|horm)/.test(text)) return 2;
  return 1;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function sortByDueThenPriority(cards) {
  return [...cards].sort((a, b) => {
    const dueA = new Date(a.scheduling?.dueDate || 0).getTime();
    const dueB = new Date(b.scheduling?.dueDate || 0).getTime();
    if (dueA !== dueB) return dueA - dueB;
    return (b.priority || 1) - (a.priority || 1);
  });
}

function calculateAccuracy(cards) {
  const totals = cards.reduce((acc, card) => {
    const stats = card.stats || { correctReviews: 0, totalReviews: 0 };
    acc.correct += stats.correctReviews || 0;
    acc.total += stats.totalReviews || 0;
    return acc;
  }, { correct: 0, total: 0 });
  return totals.total ? Math.round((totals.correct / totals.total) * 100) : 0;
}

function updateStudyStreak() {
  const streak = getStreak();
  const today = todayLocalKey();
  if (streak.lastStudyDate === today) return streak;

  const yesterday = addDays(new Date(), -1);
  const yesterdayKey = todayLocalKey(yesterday);

  if (streak.lastStudyDate === yesterdayKey) streak.current += 1;
  else streak.current = 1;

  streak.lastStudyDate = today;
  streak.best = Math.max(streak.best || 0, streak.current);
  saveStreak(streak);
  return streak;
}

function logStudyReview(card, rating, wasCorrect) {
  const log = getStudyLog();
  const today = todayLocalKey();
  let day = log.find(item => item.date === today);
  if (!day) {
    day = { date: today, reviews: 0, correct: 0, again: 0, hard: 0, good: 0, easy: 0, focusedMinutes: 0 };
    log.push(day);
  }
  day.reviews += 1;
  if (wasCorrect) day.correct += 1;
  if (rating && day[rating] !== undefined) day[rating] += 1;
  saveStudyLog(log);
}

function addFocusedMinutes(minutes) {
  const log = getStudyLog();
  const today = todayLocalKey();
  let day = log.find(item => item.date === today);
  if (!day) {
    day = { date: today, reviews: 0, correct: 0, again: 0, hard: 0, good: 0, easy: 0, focusedMinutes: 0 };
    log.push(day);
  }
  day.focusedMinutes += minutes;
  saveStudyLog(log);
}

function getTodayLog() {
  const today = todayLocalKey();
  return getStudyLog().find(item => item.date === today) || { date: today, reviews: 0, correct: 0, again: 0, hard: 0, good: 0, easy: 0, focusedMinutes: 0 };
}

function daysUntil(dateString) {
  const date = startOfDay(new Date(dateString));
  const today = startOfDay(new Date());
  return Math.round((date - today) / 86400000);
}

function getUpcomingExams(limit = 5) {
  return [...getExams()]
    .filter(exam => daysUntil(exam.date) >= 0)
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(0, limit);
}

function getMostUrgentExam() {
  return getUpcomingExams(1)[0] || null;
}

function calculateSubjectBreakdown(cards) {
  const map = {};
  cards.forEach(card => {
    const deck = getDeckById(card.deckId);
    const key = deck?.subject || card.category || 'General';
    if (!map[key]) map[key] = { total: 0, due: 0, difficult: 0, dominated: 0 };
    map[key].total += 1;
    if (isDueToday(card.scheduling?.dueDate)) map[key].due += 1;
    if (card.scheduling?.rescue) map[key].difficult += 1;
    if ((card.scheduling?.status || '') === 'mature') map[key].dominated += 1;
  });
  return map;
}

function getCalendarDays(span = 28) {
  const cards = getCards();
  const exams = getExams();
  const tasks = getTasks();
  const log = getStudyLog();
  const start = addDays(startOfDay(new Date()), -7);
  const days = [];

  for (let i = 0; i < span; i += 1) {
    const date = addDays(start, i);
    const key = todayLocalKey(date);
    const due = cards.filter(card => {
      const dueDate = card.scheduling?.dueDate ? todayLocalKey(new Date(card.scheduling.dueDate)) : todayLocalKey(new Date());
      return dueDate === key;
    }).length;
    const examsToday = exams.filter(exam => exam.date === key);
    const tasksToday = tasks.filter(task => task.dueDate === key);
    const logDay = log.find(item => item.date === key);
    days.push({
      key,
      dayNumber: date.getDate(),
      weekday: date.toLocaleDateString('es-MX', { weekday: 'short' }),
      due,
      reviews: logDay?.reviews || 0,
      focusedMinutes: logDay?.focusedMinutes || 0,
      exams: examsToday,
      tasks: tasksToday,
      isToday: key === todayLocalKey(),
      isPast: date < startOfDay(new Date())
    });
  }

  return days;
}

function getStudyForecast(days = 7) {
  const cards = getCards();
  const out = [];
  for (let i = 0; i < days; i += 1) {
    const targetDate = todayLocalKey(addDays(new Date(), i));
    const due = cards.filter(card => todayLocalKey(new Date(card.scheduling?.dueDate || nowISO())) === targetDate).length;
    out.push({ date: targetDate, due });
  }
  return out;
}

function getFriendlyMasteredCount(cards) {
  return cards.filter(card => (card.scheduling?.status || '') === 'mature').length;
}

function safeNotify(title, body) {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'granted') new Notification(title, { body });
}


function getUpcomingTasks(limit = 8, includeDone = false) {
  return [...getTasks()]
    .filter(task => includeDone || !task.completed)
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
    .slice(0, limit);
}

function getTasksForDate(dateKey) {
  return getTasks().filter(task => task.dueDate === dateKey);
}

function getPendingTasksCount() {
  return getTasks().filter(task => !task.completed).length;
}
