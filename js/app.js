/* ═══════════════════════════════════════════
   APP.JS — Main Application Controller
═══════════════════════════════════════════ */
'use strict';

/* ── Global Helpers ── */
function $(id) { return document.getElementById(id); }
function $q(sel, ctx = document) { return ctx.querySelector(sel); }
function $qa(sel, ctx = document) { return [...ctx.querySelectorAll(sel)]; }

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const diff = d - now;
  const days = Math.floor(diff / 864e5);
  if (d < now && !sameDay(d, now)) return 'Overdue';
  if (sameDay(d, now)) return 'Today ' + d.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' });
  if (days === 1 || sameDay(d, new Date(now.getTime() + 864e5))) return 'Tomorrow ' + d.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString('en', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function sameDay(a, b) {
  return a.getDate() === b.getDate() && a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
}

function showToast(msg, type = 'info', duration = 3000) {
  const container = $('toast-container');
  if (!container) return;
  const icons = { success: '✓', info: 'ℹ', warning: '⚠', error: '✕' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${icons[type]}</span><span>${msg}</span>`;
  container.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; toast.style.transform = 'translateX(20px)'; setTimeout(() => toast.remove(), 300); }, duration);
}

/* ── Neural Canvas Background ── */
function initNeuralCanvas() {
  const canvas = $('neural-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let W, H, nodes = [];

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
    nodes = Array.from({ length: 70 }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.3, vy: (Math.random() - 0.5) * 0.3,
      r: Math.random() * 2 + 1,
      opacity: Math.random() * 0.5 + 0.2,
    }));
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);

    // Move nodes
    nodes.forEach(n => {
      n.x += n.vx; n.y += n.vy;
      if (n.x < 0 || n.x > W) n.vx *= -1;
      if (n.y < 0 || n.y > H) n.vy *= -1;
    });

    // Draw connections
    nodes.forEach((a, i) => {
      nodes.slice(i + 1).forEach(b => {
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        if (dist < 130) {
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.strokeStyle = `rgba(0, 212, 255, ${0.08 * (1 - dist / 130)})`;
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      });
    });

    // Draw nodes
    nodes.forEach(n => {
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(0, 212, 255, ${n.opacity})`;
      ctx.shadowColor = '#00d4ff';
      ctx.shadowBlur = 4;
      ctx.fill();
    });

    requestAnimationFrame(draw);
  }

  resize();
  window.addEventListener('resize', resize);
  draw();
}

/* ── UI Helpers ── */
const UI = {
  updateVoiceBtn(listening) {
    const btn = $('voice-btn');
    if (btn) btn.classList.toggle('listening', listening);
  },

  setActiveNav(view) {
    $qa('.nav-item').forEach(el => el.classList.toggle('active', el.dataset.view === view));
    $qa('.mobile-nav-btn').forEach(el => el.classList.toggle('active', el.dataset.view === view));
    $qa('.filter-tab[data-filter]').forEach(el => el.classList.remove('active'));
  },

  showView(viewId) {
    $qa('.view').forEach(v => v.classList.remove('active'));
    const view = $(viewId + '-view');
    if (view) view.classList.add('active');
    this.setActiveNav(viewId);
    const title = { dashboard: 'Dashboard', tasks: 'Tasks', calendar: 'Calendar', habits: 'Habits & Goals', analytics: 'Analytics', settings: 'Settings' };
    const topTitle = $('topbar-title');
    if (topTitle) topTitle.textContent = title[viewId] || viewId;
    App.currentView = viewId;
    App.renderCurrentView();
  },
};

/* ── Task Modal ── */
const TaskModal = {
  editing: null,

  open(task = null) {
    this.editing = task;
    const modal = $('task-modal');
    const overlay = $('task-modal-overlay');
    if (!modal || !overlay) return;

    // Reset form
    $('task-title-input').value        = task?.title || '';
    $('task-desc-input').value         = task?.desc  || '';
    $('task-category-input').value     = task?.category || 'work';
    $('task-date-input').value         = task?.dueDate ? new Date(task.dueDate).toISOString().slice(0,16) : '';
    $('task-duration-input').value     = task?.estimatedMins || 30;
    $('task-repeat-input').value       = task?.repeat || '';
    $q('#task-modal h3').textContent   = task ? 'Edit Task' : 'New Task';

    // Priority selector
    $qa('.priority-opt').forEach(opt => {
      opt.classList.toggle('selected', opt.dataset.val === (task?.priority || 'medium'));
    });

    overlay.classList.add('open');
    setTimeout(() => $('task-title-input').focus(), 100);
  },

  close() {
    const overlay = $('task-modal-overlay');
    if (overlay) overlay.classList.remove('open');
    this.editing = null;
  },

  getSelectedPriority() {
    const sel = $q('.priority-opt.selected');
    return sel ? sel.dataset.val : 'medium';
  },

  async save() {
    const title = $('task-title-input').value.trim();
    if (!title) { showToast('Please enter a task title', 'warning'); return; }

    const data = {
      title,
      desc:          $('task-desc-input').value.trim(),
      category:      $('task-category-input').value,
      priority:      this.getSelectedPriority(),
      dueDate:       $('task-date-input').value ? new Date($('task-date-input').value).toISOString() : null,
      estimatedMins: parseInt($('task-duration-input').value) || 30,
      repeat:        $('task-repeat-input').value || null,
    };

    if (this.editing) {
      const updated = Tasks.update(this.editing.id, data);
      // Sync to DB + Calendar
      DB.updateTask(this.editing.id, data);
      if (this.editing.gcalEventId) GCal.updateEvent(this.editing.gcalEventId, updated);
      showToast('Task updated ✓', 'success');
    } else {
      const task = Tasks.create(data);
      // Sync to DB
      DB.addTask(task);
      // Sync to Google Calendar (only if has due date)
      if (task.dueDate && GCal.isConnected()) {
        const eventId = await GCal.addEvent(task);
        if (eventId) Tasks.update(task.id, { gcalEventId: eventId });
      }
      showToast('Task added! AI scored & prioritized 🧠', 'success');
    }

    this.close();
    App.renderCurrentView();
    App.updateBadges();
    Notifications.scheduleAll(Tasks.getAll());
  },
};

/* ── AI Chat ── */
const AiChat = {
  messages: [],

  open() {
    const panel = $('ai-panel');
    if (panel) { panel.classList.add('open'); panel.classList.remove('hidden-panel'); }
  },

  close() {
    const panel = $('ai-panel');
    if (panel) { panel.classList.remove('open'); }
  },

  toggle() {
    const panel = $('ai-panel');
    if (!panel) return;
    if (panel.classList.contains('open')) this.close();
    else this.open();
  },

  addMessage(role, text) {
    const container = $('ai-messages');
    if (!container) return;

    const msg = document.createElement('div');
    msg.className = `chat-msg ${role}`;
    const initials = role === 'ai' ? '✦' : 'U';
    msg.innerHTML = `
      <div class="chat-avatar">${initials}</div>
      <div class="chat-bubble">${text.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')}</div>
    `;
    container.appendChild(msg);
    container.scrollTop = container.scrollHeight;
  },

  showTyping() {
    const container = $('ai-messages');
    if (!container) return;
    const el = document.createElement('div');
    el.className = 'chat-msg ai';
    el.id = 'typing-indicator';
    el.innerHTML = `<div class="chat-avatar">✦</div><div class="chat-bubble chat-typing"><span></span><span></span><span></span></div>`;
    container.appendChild(el);
    container.scrollTop = container.scrollHeight;
  },

  removeTyping() { const el = $('typing-indicator'); if (el) el.remove(); },

  async respond(input) {
    this.addMessage('user', input);
    this.showTyping();

    await new Promise(r => setTimeout(r, 600 + Math.random() * 600));

    const result = await AI.processInput(input, Tasks.getAll());
    this.removeTyping();
    this.addMessage('ai', result.text);

    if (result.type === 'add_task' && result.data) {
      Tasks.create(result.data);
      App.renderCurrentView();
      App.updateBadges();
      showToast('Task created via AI! 🤖', 'success');
      Notifications.scheduleAll(Tasks.getAll());
    }

    // Speak response (short ones only)
    if (result.text.length < 200 && Voice.isSupported()) {
      // Voice.speak(result.text); // Uncomment to enable auto-speak
    }
  },

  sendMessage() {
    const input = $('ai-chat-input');
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    this.respond(text);
  },

  greet() {
    setTimeout(() => {
      const suggestion = AI.getContextualSuggestion(Tasks.getAll());
      this.addMessage('ai', `Hello! I'm **NEXUS**, your AI productivity companion. ${suggestion.title} — ${suggestion.body}`);
    }, 800);
  },
};

/* ── Calendar ── */
const CalendarView = {
  current: new Date(),

  render() {
    const container = $('calendar-grid-container');
    if (!container) return;
    const year  = this.current.getFullYear();
    const month = this.current.getMonth();

    const title = $('cal-month-title');
    if (title) title.textContent = this.current.toLocaleDateString('en', { month: 'long', year: 'numeric' });

    const first = new Date(year, month, 1).getDay();
    const days  = new Date(year, month + 1, 0).getDate();
    const today = new Date();
    const tasks = Tasks.getAll();

    let html = `<div class="calendar-grid">`;
    ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].forEach(d => { html += `<div class="cal-day-header">${d}</div>`; });

    // Empty slots before
    for (let i = 0; i < first; i++) {
      const prevDay = new Date(year, month, 0 - (first - i - 2));
      html += `<div class="cal-day other-month"><div class="cal-day-num">${prevDay.getDate()}</div></div>`;
    }

    for (let d = 1; d <= days; d++) {
      const date = new Date(year, month, d);
      const isToday = sameDay(date, today);
      const dayTasks = tasks.filter(t => t.dueDate && sameDay(new Date(t.dueDate), date));
      const pColors = { critical: '#ff3366', high: '#ff8c00', medium: '#3b82f6', low: '#6b7280' };

      let dots = dayTasks.slice(0, 3).map(t => `
        <div class="cal-task-dot" style="background:${pColors[t.priority]}22;color:${pColors[t.priority]};border-left:2px solid ${pColors[t.priority]}">
          ${t.title.slice(0, 14)}${t.title.length > 14 ? '…' : ''}
        </div>`).join('');

      if (dayTasks.length > 3) dots += `<div style="font-size:0.6rem;color:var(--text-muted);padding:1px 4px">+${dayTasks.length - 3} more</div>`;

      html += `<div class="cal-day${isToday ? ' today' : ''}" data-date="${date.toISOString()}">
        <div class="cal-day-num">${d}</div>${dots}</div>`;
    }

    html += '</div>';
    container.innerHTML = html;

    $qa('.cal-day:not(.other-month)').forEach(cell => {
      cell.addEventListener('click', () => {
        const iso = cell.dataset.date;
        if (iso) {
          $('task-date-input') && ($('task-date-input').value = iso.slice(0,16));
          TaskModal.open();
        }
      });
    });
  },

  prev() { this.current.setMonth(this.current.getMonth() - 1); this.render(); },
  next() { this.current.setMonth(this.current.getMonth() + 1); this.render(); },
};

/* ── Habits View ── */
const HabitsView = {
  render() {
    this.renderHabits();
    this.renderGoals();
  },

  renderHabits() {
    const container = $('habits-list');
    if (!container) return;
    const habits = Habits.getHabits();
    if (!habits.length) { container.innerHTML = '<div class="empty-state"><div class="empty-icon">🌱</div><h4>No habits yet</h4></div>'; return; }

    container.innerHTML = habits.map(h => {
      const doneToday = Habits.isDoneToday(h);
      return `
        <div class="glass-card hover-lift" style="padding:16px 20px;margin-bottom:10px;display:flex;align-items:center;gap:16px;border-color:${doneToday ? h.color + '44' : 'var(--glass-border)'}">
          <div style="font-size:1.8rem">${h.icon}</div>
          <div style="flex:1">
            <div style="font-weight:600;margin-bottom:4px">${h.name}</div>
            <div style="display:flex;gap:8px;align-items:center">
              <span style="font-size:0.7rem;color:var(--text-muted)">${h.target}</span>
              <span style="font-size:0.78rem;font-weight:700;color:${h.color}">🔥 ${h.streak} day streak</span>
            </div>
          </div>
          <button class="btn ${doneToday ? 'btn-ghost' : 'btn-primary'} btn-sm" onclick="HabitsView.toggleHabit('${h.id}')" style="${doneToday ? 'opacity:0.6' : ''}">
            ${doneToday ? '✓ Done' : 'Mark done'}
          </button>
          <button class="btn-icon btn" onclick="HabitsView.deleteHabit('${h.id}')" style="color:var(--neon-red);flex-shrink:0">🗑</button>
        </div>`;
    }).join('');
  },

  renderGoals() {
    const container = $('goals-list');
    if (!container) return;
    const goals = Habits.getGoals();
    if (!goals.length) { container.innerHTML = '<div class="empty-state"><div class="empty-icon">🎯</div><h4>No goals yet</h4></div>'; return; }

    container.innerHTML = goals.map(g => {
      const pct = Habits.getGoalProgress(g);
      const due = g.deadline ? formatDate(g.deadline) : 'No deadline';
      return `
        <div class="glass-card hover-lift" style="padding:20px;margin-bottom:12px;border-color:${g.color}22">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px">
            <span style="font-size:1.5rem">${g.icon}</span>
            <div style="flex:1">
              <div style="font-weight:700;margin-bottom:2px">${g.title}</div>
              <div style="font-size:0.72rem;color:var(--text-muted)">Due: ${due}</div>
            </div>
            <div style="font-size:1.1rem;font-weight:800;color:${g.color}">${pct}%</div>
          </div>
          <div class="progress-bar-wrap" style="margin-bottom:14px">
            <div class="progress-bar-fill" style="width:${pct}%;background:linear-gradient(90deg,${g.color},${g.color}88)"></div>
          </div>
          <div style="display:flex;flex-direction:column;gap:6px">
            ${g.milestones.map((m, i) => `
              <div style="display:flex;align-items:center;gap:10px;cursor:pointer" onclick="HabitsView.toggleMilestone('${g.id}',${i})">
                <div style="width:16px;height:16px;border-radius:4px;border:1.5px solid ${m.done ? g.color : 'rgba(255,255,255,0.2)'};display:flex;align-items:center;justify-content:center;background:${m.done ? g.color+'22' : 'transparent'};flex-shrink:0">
                  ${m.done ? '<span style="font-size:0.6rem;color:'+g.color+'">✓</span>' : ''}
                </div>
                <span style="font-size:0.83rem;${m.done ? 'text-decoration:line-through;color:var(--text-muted)' : ''}">${m.t}</span>
              </div>`).join('')}
          </div>
        </div>`;
    }).join('');
  },

  toggleHabit(id) {
    Habits.toggleHabitToday(id);
    this.renderHabits();
    showToast('Habit updated! 🔥', 'success');
  },
  toggleMilestone(gid, idx) { Habits.toggleMilestone(gid, idx); this.renderGoals(); },
  deleteHabit(id) { Habits.deleteHabit(id); this.renderHabits(); },
};

/* ── Analytics View ── */
const AnalyticsView = {
  render() {
    const stats = Tasks.getStats();
    const weekly = Tasks.getWeeklyData();

    // Progress ring
    const ring = $('completion-ring');
    if (ring) Analytics.drawProgressRing(ring, stats.rate, '#00d4ff', 120);

    // Bar chart
    const bar = $('weekly-bar-chart');
    if (bar) {
      setTimeout(() => {
        Analytics.drawBarChart(bar, weekly, { barColor: '#00d4ff', barColor2: '#a855f7', height: 180, labelKey: 'label', val1Key: 'done', val2Key: 'due' });
      }, 100);
    }

    // Donut chart
    const donut = $('priority-donut');
    const tasks = Tasks.getAll();
    if (donut) {
      const counts = { critical: 0, high: 0, medium: 0, low: 0 };
      tasks.filter(t => !t.completed).forEach(t => counts[t.priority]++);
      Analytics.drawDonutChart(donut, [
        { value: counts.critical, color: '#ff3366' },
        { value: counts.high,     color: '#ff8c00' },
        { value: counts.medium,   color: '#3b82f6' },
        { value: counts.low,      color: '#6b7280' },
      ], 120);
    }

    // Stats numbers
    const el = (id, val) => { const e = $(id); if (e) e.textContent = val; };
    el('stat-total',     Tasks.getAll().length);
    el('stat-completed', stats.completed);
    el('stat-overdue',   stats.overdue);
    el('stat-rate',      stats.rate + '%');
    el('stat-today',     stats.today);
    el('stat-streak',    '7'); // Placeholder
  },
};

/* ── Settings ── */
const SettingsView = {
  load() {
    const settings = JSON.parse(localStorage.getItem('nexus_settings') || '{}');
    const notifToggle = $('notif-toggle');
    const voiceToggle = $('voice-toggle');
    const aiPersonality = $('ai-personality');

    if (notifToggle) notifToggle.checked = settings.notifications !== false;
    if (voiceToggle) voiceToggle.checked = settings.voice !== false;
    if (aiPersonality) aiPersonality.value = settings.personality || 'coach';
  },

  save() {
    const settings = {
      notifications: $('notif-toggle')?.checked ?? true,
      voice:         $('voice-toggle')?.checked ?? true,
      personality:   $('ai-personality')?.value || 'coach',
    };
    localStorage.setItem('nexus_settings', JSON.stringify(settings));
    showToast('Settings saved!', 'success');
  },

  exportData() {
    const data = { tasks: Tasks.getAll(), habits: Habits.getHabits(), goals: Habits.getGoals(), exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'nexus-backup.json'; a.click();
    URL.revokeObjectURL(url);
    showToast('Data exported!', 'success');
  },

  clearData() {
    if (confirm('Are you sure? This will delete ALL your data.')) {
      localStorage.clear();
      location.reload();
    }
  },
};

/* ── Tasks View ── */
const TasksView = {
  currentFilter: 'all',
  currentList: 'all',
  searchQuery: '',

  render() {
    let tasks;
    if (this.searchQuery) {
      tasks = Tasks.search(this.searchQuery);
    } else {
      tasks = Tasks.getByFilter(this.currentFilter, this.currentList === 'all' ? null : this.currentList);
      if (this.currentFilter === 'all') {
        tasks = Tasks.getAll().filter(t => {
          if (this.currentList !== 'all' && t.category !== this.currentList) return false;
          return !t.completed;
        });
      }
    }

    // Sort by AI score
    const sorted = tasks.sort((a, b) => AI.scorePriority(b) - AI.scorePriority(a));
    this.renderList(sorted, $('tasks-list'));

    // Update count
    const countEl = $('tasks-count');
    if (countEl) countEl.textContent = sorted.length + ' task' + (sorted.length !== 1 ? 's' : '');
  },

  renderList(tasks, container) {
    if (!container) return;
    if (!tasks.length) {
      container.innerHTML = `<div class="empty-state"><div class="empty-icon">🎯</div><h4>All clear!</h4><p>No tasks here. Add one above or ask NEXUS AI to help plan your day.</p></div>`;
      return;
    }

    const pColors = { critical: '#ff3366', high: '#ff8c00', medium: '#3b82f6', low: '#6b7280' };
    container.innerHTML = tasks.map(task => {
      const due = task.dueDate ? formatDate(task.dueDate) : '';
      const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && !task.completed;
      const score = AI.scorePriority(task);

      return `
        <div class="task-card${task.completed ? ' completed' : ''}" data-priority="${task.priority}" data-id="${task.id}">
          <div class="task-check${task.completed ? ' checked' : ''}" data-id="${task.id}" onclick="TasksView.toggleTask(event, '${task.id}')"></div>
          <div class="task-body">
            <div class="task-title">${task.title}</div>
            ${task.desc ? `<div style="font-size:0.78rem;color:var(--text-muted);margin-top:2px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:1;-webkit-box-orient:vertical">${task.desc}</div>` : ''}
            <div class="task-meta">
              <span class="badge badge-${task.priority}">${task.priority}</span>
              ${task.category ? `<span class="task-category-tag">${task.category}</span>` : ''}
              ${due ? `<span class="task-time${isOverdue ? ' overdue' : ''}">🕐 ${due}</span>` : ''}
              ${task.estimatedMins ? `<span class="task-time">⏱ ${task.estimatedMins}m</span>` : ''}
              ${task.repeat ? `<span class="task-time">🔁 ${task.repeat}</span>` : ''}
              <span style="font-size:0.68rem;color:${pColors[task.priority]};margin-left:auto;font-weight:700">AI ${score}/20</span>
            </div>
            ${task.subtasks && task.subtasks.length ? `
              <div style="margin-top:8px;display:flex;gap:4px;flex-wrap:wrap">
                ${task.subtasks.map(s => `<span style="font-size:0.68rem;padding:2px 7px;border-radius:4px;background:rgba(255,255,255,0.05);${s.done?'text-decoration:line-through;opacity:0.5':''}">${s.t}</span>`).join('')}
              </div>` : ''}
          </div>
          <div class="task-actions">
            <button class="task-action-btn" onclick="TaskModal.open(Tasks.getById('${task.id}'))" title="Edit">✏️</button>
            <button class="task-action-btn delete" onclick="TasksView.deleteTask('${task.id}')" title="Delete">🗑</button>
          </div>
        </div>`;
    }).join('');

    // Animate in
    $qa('.task-card', container).forEach((el, i) => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(8px)';
      setTimeout(() => { el.style.transition = 'all 0.3s ease'; el.style.opacity = ''; el.style.transform = ''; }, i * 40);
    });
  },

  toggleTask(e, id) {
    e.stopPropagation();
    const task = Tasks.toggle(id);
    if (task?.completed) showToast('Task completed! 🎉', 'success');
    this.render();
    App.renderDashboard();
    App.updateBadges();
  },

  deleteTask(id) {
    const task = Tasks.getById(id);
    Tasks.remove(id);
    // Sync to DB + Calendar
    DB.deleteTask(id);
    if (task?.gcalEventId) GCal.deleteEvent(task.gcalEventId);
    this.render();
    App.updateBadges();
    showToast('Task deleted', 'info');
  },

  setFilter(filter) {
    this.currentFilter = filter;
    $qa('.filter-tab').forEach(t => t.classList.toggle('active', t.dataset.filter === filter));
    this.render();
  },
};

/* ── Dashboard ── */
const Dashboard = {
  render() {
    const stats = Tasks.getStats();
    const ring = $('dash-ring');
    if (ring) Analytics.drawProgressRing(ring, stats.rate, '#00d4ff', 100);

    const el = (id, v) => { const e = $(id); if (e) e.textContent = v; };
    el('dash-total',     stats.total);
    el('dash-completed', stats.completed);
    el('dash-overdue',   stats.overdue);
    el('dash-today',     stats.today);

    // AI Insight
    const insight = AI.getContextualSuggestion(Tasks.getAll());
    const insEl = $('ai-insight-text');
    const insTitle = $('ai-insight-title');
    const insIcon  = $('ai-insight-icon');
    if (insEl)    insEl.textContent   = insight.body;
    if (insTitle) insTitle.textContent = insight.title;
    if (insIcon)  insIcon.textContent  = insight.icon;

    // Today's tasks
    const todayTasks = Tasks.getByFilter('today').sort((a,b) => AI.scorePriority(b) - AI.scorePriority(a));
    TasksView.renderList(todayTasks, $('dash-today-tasks'));

    // Weekly chart
    const weekly = Tasks.getWeeklyData();
    const chart = $('dash-chart');
    if (chart) setTimeout(() => Analytics.drawBarChart(chart, weekly, { height: 100, labelKey: 'label', val1Key: 'done', val2Key: 'due' }), 100);
  },
};

/* ── Main App ── */
const App = {
  currentView: 'dashboard',

  async init() {
    // ── 1. Load local data immediately (instant UI) ──
    Tasks.load();
    Habits.load();

    // ── 1.5 Setup Extensions ──
    Notifications.init();
    if (typeof Parser !== 'undefined') Parser.init();

    // ── 2. Init Firebase + Auth ──
    if (FIREBASE_ENABLED && window.firebase) {
      try {
        firebase.initializeApp(FIREBASE_CONFIG);
        console.log('[App] Firebase initialized');
      } catch (e) {
        // Already initialized (e.g. hot reload)
        if (!e.message.includes('already exists')) console.error('[App] Firebase init error:', e);
      }
    }

    Auth.init(async (user) => {
      // Auth state changed — re-init DB and reload data
      DB.init(user, () => { Tasks.load(); Habits.load(); this.renderCurrentView(); this.updateBadges(); });
      if (DB.getMode() === 'firestore') {
        const loaded = await DB.loadFromFirestore();
        if (loaded) { Tasks.load(); Habits.load(); }
        showToast('☁ Cloud sync active — data saved to Firebase!', 'success', 3000);
      }
      // Only show toast on explicit sign-in (not on every page load in offline mode)
      this.renderCurrentView();
      this.updateBadges();
    });

    // ── 3. Init canvas ──
    initNeuralCanvas();

    // ── 4. Init voice ──
    Voice.init((transcript) => {
      const input = $('ai-chat-input');
      if (input) {
        input.value = transcript;
        input.focus();
      }
      AiChat.open();
    });

    // ── 5. Init notifications ──
    Notifications.requestPermission().then(granted => {
      if (granted) Notifications.scheduleAll(Tasks.getAll());
    });

    // ── 6. Render ──
    this.showView('dashboard');
    this.updateBadges();
    AiChat.greet();

    // ── 7. Bind events ──
    this.bindEvents();

    if (!localStorage.getItem('nexus_welcomed')) {
      localStorage.setItem('nexus_welcomed', '1');
      setTimeout(() => showToast('Welcome to NEXUS AI! 🚀 Your productivity companion is ready.', 'info', 4000), 1500);
    }
  },

  showView(viewId) { UI.showView(viewId); },

  renderCurrentView() {
    switch (this.currentView) {
      case 'dashboard': Dashboard.render(); break;
      case 'tasks':     TasksView.render(); break;
      case 'calendar':  CalendarView.render(); break;
      case 'habits':    HabitsView.render(); break;
      case 'analytics': AnalyticsView.render(); break;
      case 'settings':  SettingsView.load(); break;
    }
  },

  renderDashboard() { if (this.currentView === 'dashboard') Dashboard.render(); },

  updateBadges() {
    const stats = Tasks.getStats();
    const badges = document.querySelectorAll('.nav-badge[data-type="tasks"]');
    badges.forEach(b => { b.textContent = stats.pending; });
    const overdueBadge = document.querySelectorAll('.nav-badge[data-type="overdue"]');
    overdueBadge.forEach(b => { b.textContent = stats.overdue; b.style.display = stats.overdue ? '' : 'none'; });
  },

  bindEvents() {
    // Sidebar nav
    $qa('.nav-item').forEach(item => {
      item.addEventListener('click', () => this.showView(item.dataset.view));
    });

    // Mobile nav
    $qa('.mobile-nav-btn').forEach(btn => {
      btn.addEventListener('click', () => this.showView(btn.dataset.view));
    });

    // Notifications btn
    const notifBtn = $('notif-btn');
    if (notifBtn) {
      notifBtn.addEventListener('click', async () => {
        const granted = await Notifications.requestPermission();
        if (granted) {
          showToast('Notifications enabled!', 'success');
          Notifications.send('Test Notification', 'Notifications are working correctly!', '✅');
          const dot = notifBtn.querySelector('.notif-dot');
          if (dot) dot.style.display = 'none';
        } else {
          showToast('Notifications permission denied.', 'error');
        }
      });
    }

    // Sidebar toggle
    const sidebarToggle = $('sidebar-toggle');
    if (sidebarToggle) sidebarToggle.addEventListener('click', () => $('sidebar').classList.toggle('collapsed'));

    // Mobile sidebar overlay
    const mobMenuBtn = $('mobile-menu-btn');
    if (mobMenuBtn) mobMenuBtn.addEventListener('click', () => $('sidebar').classList.toggle('mobile-open'));

    // FAB add task
    $qa('.fab-add, #mobile-fab').forEach(btn => btn.addEventListener('click', () => TaskModal.open()));

    // Task modal
    $('task-modal-overlay')?.addEventListener('click', e => { if (e.target === $('task-modal-overlay')) TaskModal.close(); });
    $('modal-close-btn')?.addEventListener('click', () => TaskModal.close());
    $('modal-save-btn')?.addEventListener('click', () => TaskModal.save());

    // Priority selector
    $qa('.priority-opt').forEach(opt => {
      opt.addEventListener('click', () => { $qa('.priority-opt').forEach(o => o.classList.remove('selected')); opt.classList.add('selected'); });
    });

    // AI panel
    $('ai-toggle-btn')?.addEventListener('click', () => AiChat.toggle());
    $('ai-panel-close')?.addEventListener('click', () => AiChat.close());
    $('ai-send-btn')?.addEventListener('click', () => AiChat.sendMessage());
    $('ai-chat-input')?.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); AiChat.sendMessage(); } });

    // Voice btn
    $('voice-btn')?.addEventListener('click', () => Voice.startListening());

    // Quick actions
    $qa('.ai-quick-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        AiChat.open();
        AiChat.respond(btn.textContent.trim());
      });
    });

    // Filter tabs
    $qa('.filter-tab[data-filter]').forEach(tab => {
      tab.addEventListener('click', () => TasksView.setFilter(tab.dataset.filter));
    });

    // Search
    const searchInput = $('global-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        TasksView.searchQuery = e.target.value.trim();
        if (this.currentView !== 'tasks') this.showView('tasks');
        TasksView.render();
      });
    }

    // Calendar nav
    $('cal-prev')?.addEventListener('click', () => CalendarView.prev());
    $('cal-next')?.addEventListener('click', () => CalendarView.next());

    // Settings save
    $('settings-save-btn')?.addEventListener('click', () => SettingsView.save());
    $('export-btn')?.addEventListener('click', () => SettingsView.exportData());
    $('clear-btn')?.addEventListener('click', () => SettingsView.clearData());

    // Add habit modal
    $('add-habit-btn')?.addEventListener('click', () => {
      const name = prompt('Habit name:');
      if (name) {
        Habits.createHabit({ name, icon: '⭐', color: '#00d4ff', target: 'daily' });
        HabitsView.render();
        showToast('Habit created!', 'success');
      }
    });

    $('add-goal-btn')?.addEventListener('click', () => {
      const title = prompt('Goal title:');
      if (title) {
        Habits.createGoal({ title, icon: '🎯', color: '#a855f7' });
        HabitsView.render();
        showToast('Goal created!', 'success');
      }
    });

    // Add task from tasks view header
    $('add-task-btn')?.addEventListener('click', () => TaskModal.open());

    // Keyboard shortcuts
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') { TaskModal.close(); AiChat.close(); }
      if (e.ctrlKey && e.key === 'k') { e.preventDefault(); $('global-search')?.focus(); }
      if (e.ctrlKey && e.key === 'n') { e.preventDefault(); TaskModal.open(); }
      if (e.ctrlKey && e.key === '/') { e.preventDefault(); AiChat.toggle(); }
    });

    // Pomodoro timer (topbar)
    let pomodoroActive = false;
    let pomodoroTimer = null;
    let pomodoroSecs = 25 * 60;
    const pomBtn = $('pomodoro-btn');
    const pomDisplay = $('pomodoro-display');

    function updatePomDisplay() {
      if (!pomDisplay) return;
      const m = Math.floor(pomodoroSecs / 60).toString().padStart(2, '0');
      const s = (pomodoroSecs % 60).toString().padStart(2, '0');
      pomDisplay.textContent = `${m}:${s}`;
    }

    pomBtn?.addEventListener('click', () => {
      if (pomodoroActive) {
        clearInterval(pomodoroTimer);
        pomodoroActive = false;
        pomodoroSecs = 25 * 60;
        pomBtn.title = 'Start Pomodoro';
        if (pomDisplay) pomDisplay.style.display = 'none';
      } else {
        pomodoroActive = true;
        if (pomDisplay) pomDisplay.style.display = 'inline';
        pomBtn.title = 'Stop Pomodoro';
        updatePomDisplay();
        pomodoroTimer = setInterval(() => {
          pomodoroSecs--;
          updatePomDisplay();
          if (pomodoroSecs <= 0) {
            clearInterval(pomodoroTimer);
            pomodoroActive = false;
            pomodoroSecs = 25 * 60;
            if (pomDisplay) pomDisplay.style.display = 'none';
            showToast('🍅 Pomodoro complete! Time for a break.', 'success', 5000);
            Notifications.send('🍅 Pomodoro Done!', 'Time for a 5-minute break. Great work!');
          }
        }, 1000);
      }
    });
  },
};

// Boot the app
document.addEventListener('DOMContentLoaded', () => App.init());

