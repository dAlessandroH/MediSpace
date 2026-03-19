const STORAGE_KEYS = {
  decks: 'medspace_decks',
  cards: 'medspace_cards',
  reviews: 'medspace_reviews',
  settings: 'medspace_settings',
  streak: 'medspace_streak',
  exams: 'medspace_exams',
  studyLog: 'medspace_study_log',
  pomodoroState: 'medspace_pomodoro_state',
  pomodoroHistory: 'medspace_pomodoro_history',
  tasks: 'medspace_tasks'
};

const DEFAULT_SETTINGS = {
  userName: 'Alessandro',
  dailyNewLimit: 20,
  examDays: 0,
  rescueThreshold: 2,
  dailyTargetReviews: 80,
  pomodoroStudyMin: 25,
  pomodoroShortBreak: 5,
  pomodoroLongBreak: 15,
  pomodoroCycles: 4,
  focusMode: true
};

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (error) {
    console.error('Error leyendo storage', key, error);
    return fallback;
  }
}

function writeJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function getDecks() { return readJSON(STORAGE_KEYS.decks, []); }
function saveDecks(decks) { writeJSON(STORAGE_KEYS.decks, decks); }
function getCards() { return readJSON(STORAGE_KEYS.cards, []); }
function saveCards(cards) { writeJSON(STORAGE_KEYS.cards, cards); }
function getReviews() { return readJSON(STORAGE_KEYS.reviews, []); }
function saveReviews(reviews) { writeJSON(STORAGE_KEYS.reviews, reviews); }
function getSettings() { return { ...DEFAULT_SETTINGS, ...readJSON(STORAGE_KEYS.settings, {}) }; }
function saveSettings(settings) { writeJSON(STORAGE_KEYS.settings, settings); }
function getStreak() { return readJSON(STORAGE_KEYS.streak, { current: 0, lastStudyDate: null, best: 0 }); }
function saveStreak(streak) { writeJSON(STORAGE_KEYS.streak, streak); }
function getExams() { return readJSON(STORAGE_KEYS.exams, []); }
function saveExams(exams) { writeJSON(STORAGE_KEYS.exams, exams); }
function getStudyLog() { return readJSON(STORAGE_KEYS.studyLog, []); }
function saveStudyLog(log) { writeJSON(STORAGE_KEYS.studyLog, log); }
function getPomodoroState() {
  return readJSON(STORAGE_KEYS.pomodoroState, {
    phase: 'focus',
    cycle: 1,
    isRunning: false,
    remainingSeconds: null,
    startedAt: null,
    plannedEndAt: null
  });
}
function savePomodoroState(state) { writeJSON(STORAGE_KEYS.pomodoroState, state); }
function getPomodoroHistory() { return readJSON(STORAGE_KEYS.pomodoroHistory, []); }
function savePomodoroHistory(history) { writeJSON(STORAGE_KEYS.pomodoroHistory, history); }

function clearAllData() {
  Object.values(STORAGE_KEYS).forEach(key => localStorage.removeItem(key));
}

function getTasks() { return readJSON(STORAGE_KEYS.tasks, []); }
function saveTasks(tasks) { writeJSON(STORAGE_KEYS.tasks, tasks); }
