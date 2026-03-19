document.addEventListener('DOMContentLoaded', () => {
  renderSettings();
  document.getElementById('saveSettingsBtn')?.addEventListener('click', saveSettingsFromForm);
  document.getElementById('clearAllBtn')?.addEventListener('click', clearEverything);
  document.getElementById('exportBackupBtn')?.addEventListener('click', exportBackup);
  document.getElementById('importBackupInput')?.addEventListener('change', importBackup);
});

function renderSettings() {
  const settings = getSettings();
  document.getElementById('userName').value = settings.userName || 'Alessandro';
  document.getElementById('dailyNewLimit').value = settings.dailyNewLimit;
  document.getElementById('dailyTargetReviews').value = settings.dailyTargetReviews;
  document.getElementById('examDays').value = settings.examDays;
  document.getElementById('rescueThreshold').value = settings.rescueThreshold;
  document.getElementById('focusMode').value = String(settings.focusMode);
  document.getElementById('pomodoroStudyMin').value = settings.pomodoroStudyMin;
  document.getElementById('pomodoroShortBreak').value = settings.pomodoroShortBreak;
  document.getElementById('pomodoroLongBreak').value = settings.pomodoroLongBreak;
  document.getElementById('pomodoroCycles').value = settings.pomodoroCycles;
}

function saveSettingsFromForm() {
  const settings = {
    userName: document.getElementById('userName').value.trim() || 'Alessandro',
    dailyNewLimit: clamp(Number(document.getElementById('dailyNewLimit').value || 20), 1, 100),
    dailyTargetReviews: clamp(Number(document.getElementById('dailyTargetReviews').value || 80), 10, 500),
    examDays: clamp(Number(document.getElementById('examDays').value || 0), 0, 365),
    rescueThreshold: clamp(Number(document.getElementById('rescueThreshold').value || 2), 1, 20),
    focusMode: document.getElementById('focusMode').value === 'true',
    pomodoroStudyMin: clamp(Number(document.getElementById('pomodoroStudyMin').value || 25), 5, 120),
    pomodoroShortBreak: clamp(Number(document.getElementById('pomodoroShortBreak').value || 5), 1, 30),
    pomodoroLongBreak: clamp(Number(document.getElementById('pomodoroLongBreak').value || 15), 5, 60),
    pomodoroCycles: clamp(Number(document.getElementById('pomodoroCycles').value || 4), 2, 8)
  };
  saveSettings(settings);
  showSettingsStatus('Ajustes guardados correctamente.', 'success');
}

function exportBackup() {
  const payload = {
    exportedAt: nowISO(),
    decks: getDecks(),
    cards: getCards(),
    reviews: getReviews(),
    settings: getSettings(),
    streak: getStreak(),
    exams: getExams(),
    studyLog: getStudyLog(),
    pomodoroState: getPomodoroState(),
    pomodoroHistory: getPomodoroHistory(),
    tasks: getTasks()
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `medspace-backup-${todayLocalKey()}.json`;
  link.click();
  URL.revokeObjectURL(url);
  showSettingsStatus('Respaldo exportado. Esto te sirve para mover tus datos entre compu, laptop o cel.', 'success');
}

async function importBackup(event) {
  try {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const data = JSON.parse(text);
    if (!Array.isArray(data.decks) || !Array.isArray(data.cards) || !Array.isArray(data.reviews)) {
      throw new Error('El respaldo no tiene el formato esperado.');
    }
    saveDecks(data.decks);
    saveCards(data.cards);
    saveReviews(data.reviews);
    saveSettings(data.settings || DEFAULT_SETTINGS);
    saveStreak(data.streak || { current: 0, lastStudyDate: null, best: 0 });
    saveExams(data.exams || []);
    saveStudyLog(data.studyLog || []);
    savePomodoroState(data.pomodoroState || getPomodoroState());
    savePomodoroHistory(data.pomodoroHistory || []);
    saveTasks(data.tasks || []);
    showSettingsStatus('Respaldo importado correctamente.', 'success');
    event.target.value = '';
  } catch (error) {
    showSettingsStatus(error.message || 'No se pudo importar el respaldo.', 'error');
  }
}

function clearEverything() {
  if (!confirm('Esto borrara todos los decks, tarjetas, examenes, revisiones y configuracion.')) return;
  clearAllData();
  showSettingsStatus('Todos los datos fueron eliminados.', 'success');
  setTimeout(() => window.location.href = 'index.html', 900);
}

function showSettingsStatus(message, type) {
  const status = document.getElementById('settingsStatus');
  status.className = `notice ${type}`;
  status.textContent = message;
}
