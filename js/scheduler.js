function calculateNextSchedule(scheduling = {}, rating, priority = 1, card = null) {
  let repetitions = scheduling.repetitions || 0;
  let easeFactor = scheduling.easeFactor || 2.5;
  let intervalDays = scheduling.intervalDays || 0;
  let lapses = scheduling.lapses || 0;
  const settings = getSettings();

  if (rating === 'again') {
    repetitions = 0;
    intervalDays = 0;
    easeFactor = Math.max(1.3, easeFactor - 0.2);
    lapses += 1;
  } else if (rating === 'hard') {
    repetitions += 1;
    intervalDays = repetitions <= 1 ? 1 : Math.max(1, intervalDays * 1.2);
    easeFactor = Math.max(1.3, easeFactor - 0.15);
  } else if (rating === 'good') {
    repetitions += 1;
    if (repetitions === 1) intervalDays = 1;
    else if (repetitions === 2) intervalDays = 3;
    else intervalDays = Math.max(1, intervalDays * easeFactor);
  } else if (rating === 'easy') {
    repetitions += 1;
    easeFactor = Math.min(3.5, easeFactor + 0.15);
    if (repetitions === 1) intervalDays = 3;
    else if (repetitions === 2) intervalDays = 6;
    else intervalDays = Math.max(1, intervalDays * easeFactor * 1.35);
  } else {
    throw new Error('Rating invalido');
  }

  if (priority === 3 && intervalDays > 1) intervalDays *= 0.84;
  if (priority === 2 && intervalDays > 1) intervalDays *= 0.92;

  const urgentExamFactor = getExamCompressionFactor(card);
  if (intervalDays > 1) intervalDays *= urgentExamFactor;

  if ((settings.examDays || 0) > 0 && (settings.examDays || 0) <= 14 && intervalDays > 1) {
    intervalDays *= 0.82;
  }

  intervalDays = clamp(Math.round(intervalDays * 100) / 100, 0, 3650);
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + Math.max(0, Math.round(intervalDays)));

  const status = repetitions === 0 ? 'new' : repetitions < 3 ? 'learning' : 'mature';
  const rescue = lapses >= (settings.rescueThreshold || 2);

  return {
    repetitions,
    easeFactor: Number(easeFactor.toFixed(2)),
    intervalDays,
    dueDate: dueDate.toISOString(),
    lastReviewedAt: nowISO(),
    lapses,
    status,
    rescue
  };
}

function getExamCompressionFactor(card) {
  const exams = getUpcomingExams(10);
  if (!exams.length) return 1;
  const deck = card?.deckId ? getDeckById(card.deckId) : null;
  const subject = (deck?.subject || card?.category || '').toLowerCase();
  const relevant = exams.find(exam => {
    const examSubject = (exam.subject || '').toLowerCase();
    return examSubject && subject && (subject.includes(examSubject) || examSubject.includes(subject));
  }) || exams[0];

  const days = daysUntil(relevant.date);
  if (days <= 3) return 0.58;
  if (days <= 7) return 0.72;
  if (days <= 14) return 0.84;
  return 1;
}

function getDueCardsForSession({ deckId = 'all', mode = 'all', cardType = 'all' } = {}) {
  const cards = getCards();
  const settings = getSettings();

  let filtered = cards.filter(card => (deckId === 'all' || card.deckId === deckId));
  if (cardType !== 'all') filtered = filtered.filter(card => (card.type || 'multiple_choice') === cardType);

  if (mode === 'rescue') {
    filtered = filtered.filter(card => (card.scheduling?.lapses || 0) >= settings.rescueThreshold);
  } else if (mode === 'new') {
    filtered = filtered.filter(card => (card.scheduling?.repetitions || 0) === 0);
    filtered = filtered.slice(0, settings.dailyNewLimit || 20);
  } else if (mode === 'focus') {
    filtered = filtered.filter(card => isDueToday(card.scheduling?.dueDate) || card.scheduling?.rescue);
  } else {
    const due = filtered.filter(card => isDueToday(card.scheduling?.dueDate));
    const newCards = filtered.filter(card => (card.scheduling?.repetitions || 0) === 0 && !isDueToday(card.scheduling?.dueDate));
    filtered = [...due, ...newCards.slice(0, settings.dailyNewLimit || 20)];
  }

  return sortByDueThenPriority(filtered);
}
