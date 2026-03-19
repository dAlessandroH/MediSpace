document.addEventListener('DOMContentLoaded', () => {
  renderPlanner();
  document.getElementById('saveExamBtn')?.addEventListener('click', saveExam);
  document.getElementById('saveTaskBtn')?.addEventListener('click', saveTask);
});

function renderPlanner() {
  renderExamList();
  renderTaskList();
  renderAttackPlan();
  renderPlannerCalendar();
}

function saveExam() {
  const subject = document.getElementById('examSubject').value.trim();
  const title = document.getElementById('examTitle').value.trim();
  const date = document.getElementById('examDate').value;
  if (!subject || !date) return showPlannerStatus('Pon al menos materia y fecha.', 'error');

  const exams = getExams();
  exams.push({ id: uid('exam'), subject, title: title || subject, date });
  exams.sort((a, b) => new Date(a.date) - new Date(b.date));
  saveExams(exams);
  document.getElementById('examSubject').value = '';
  document.getElementById('examTitle').value = '';
  document.getElementById('examDate').value = '';
  showPlannerStatus('Examen guardado. La app ya lo tomara en cuenta.', 'success');
  renderPlanner();
}

function saveTask() {
  const title = document.getElementById('taskTitle').value.trim();
  const subject = document.getElementById('taskSubject').value.trim();
  const dueDate = document.getElementById('taskDate').value;
  if (!title || !dueDate) return showPlannerStatus('Pon al menos la tarea y la fecha.', 'error');

  const tasks = getTasks();
  tasks.push({ id: uid('task'), title, subject, dueDate, completed: false, createdAt: nowISO() });
  tasks.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
  saveTasks(tasks);
  document.getElementById('taskTitle').value = '';
  document.getElementById('taskSubject').value = '';
  document.getElementById('taskDate').value = '';
  showPlannerStatus('Tarea guardada. Ya quedo en el calendario para que no se te pierda.', 'success');
  renderPlanner();
}

function renderExamList() {
  const exams = getExams().sort((a, b) => new Date(a.date) - new Date(b.date));
  const container = document.getElementById('examList');
  if (!exams.length) {
    container.innerHTML = '<div class="item"><h4>Aun no tienes examenes cargados</h4><p>En cuanto los pongas aqui, la app puede adelantarse mejor.</p></div>';
    return;
  }

  container.innerHTML = exams.map(exam => {
    const days = daysUntil(exam.date);
    return `<div class="item"><h4>${escapeHtml(exam.title)}</h4><p><strong>${escapeHtml(exam.subject)}</strong> · ${formatDate(exam.date)} · ${days < 0 ? 'Ya paso' : days === 0 ? 'Es hoy' : `Faltan ${days} dias`}</p><div class="item-actions"><button class="btn danger" type="button" onclick="deleteExam('${exam.id}')">Eliminar</button></div></div>`;
  }).join('');
}

function renderTaskList() {
  const tasks = [...getTasks()].sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
  const container = document.getElementById('taskList');
  if (!tasks.length) {
    container.innerHTML = '<div class="item"><h4>Sin tareas aun</h4><p>Apunta aqui entregas y pendientes rapidos para que el olvido no te haga la cama.</p></div>';
    return;
  }
  container.innerHTML = tasks.map(task => {
    const days = daysUntil(task.dueDate);
    const status = task.completed ? 'Completada' : days === 0 ? 'Se entrega hoy' : days === 1 ? 'Se entrega mañana' : `Se entrega en ${days} dias`;
    return `<div class="item ${task.completed ? 'task-done' : ''}"><h4>${escapeHtml(task.title)}</h4><p><strong>${escapeHtml(task.subject || 'Universidad')}</strong> · ${formatDate(task.dueDate)} · ${status}</p><div class="item-actions"><button class="btn ${task.completed ? '' : 'success'}" type="button" onclick="toggleTask('${task.id}')">${task.completed ? 'Desmarcar' : 'Marcar hecha'}</button><button class="btn danger" type="button" onclick="deleteTask('${task.id}')">Eliminar</button></div></div>`;
  }).join('');
}

function toggleTask(id) {
  const tasks = getTasks().map(task => task.id === id ? { ...task, completed: !task.completed } : task);
  saveTasks(tasks);
  renderPlanner();
}

function deleteTask(id) {
  saveTasks(getTasks().filter(task => task.id !== id));
  renderPlanner();
}

function deleteExam(id) {
  saveExams(getExams().filter(exam => exam.id !== id));
  renderPlanner();
}

function renderAttackPlan() {
  const cards = getCards();
  const upcoming = getUpcomingExams(3);
  const tasks = getUpcomingTasks(3);
  const breakdown = calculateSubjectBreakdown(cards);
  const container = document.getElementById('attackPlan');
  const items = [];

  upcoming.forEach(exam => {
    const stats = breakdown[exam.subject] || { due: 0, difficult: 0, total: 0, dominated: 0 };
    const days = daysUntil(exam.date);
    let advice = 'Mantener repaso normal.';
    if (days <= 3) advice = 'Apretar fuerte: repaso diario + rescate.';
    else if (days <= 7) advice = 'Subir frecuencia y bajar nuevas.';
    else if (days <= 14) advice = 'Construir base y limpiar pendientes.';
    items.push(`<div class="item"><h4>${escapeHtml(exam.subject)}</h4><p>${escapeHtml(advice)}</p><p>${stats.due} por repasar hoy · ${stats.difficult} fragiles · ${stats.dominated} asentadas</p></div>`);
  });

  tasks.forEach(task => {
    const days = daysUntil(task.dueDate);
    items.push(`<div class="item"><h4>Pendiente: ${escapeHtml(task.title)}</h4><p>${escapeHtml(task.subject || 'Universidad')} · ${days === 0 ? 'hoy' : days === 1 ? 'mañana' : `en ${days} dias`}</p></div>`);
  });

  container.innerHTML = items.length ? items.join('') : '<div class="item"><p>Sin examenes ni tareas cargadas. Mientras tanto, enfocate en pendientes de hoy y rescate.</p></div>';
}

function renderPlannerCalendar() {
  const days = getCalendarDays(28);
  document.getElementById('plannerCalendar').innerHTML = days.map(day => `
    <div class="calendar-day ${day.due >= 80 ? 'heavy' : day.due >= 35 ? 'medium' : day.due > 0 ? 'light' : 'empty'} ${day.isToday ? 'today' : ''}">
      <div class="calendar-head"><span>${escapeHtml(day.weekday)}</span><strong>${day.dayNumber}</strong></div>
      <div class="calendar-main">
        <div class="calendar-due">${day.due}</div>
        <div class="calendar-label">programadas</div>
        <div class="calendar-sub">${day.focusedMinutes} min · ${day.tasks.length} tarea${day.tasks.length === 1 ? '' : 's'}</div>
      </div>
      ${day.tasks.length ? `<div class="calendar-task">${escapeHtml(day.tasks[0].title)}</div>` : ''}
      ${day.exams.length ? `<div class="calendar-exam">${escapeHtml(day.exams[0].title)}</div>` : ''}
    </div>
  `).join('');
}

function showPlannerStatus(message, type) {
  const status = document.getElementById('plannerStatus');
  status.className = `notice ${type}`;
  status.textContent = message;
}
