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

  getGreeting(name) {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return `Good Morning, ${name} ☀️`;
    if (hour >= 12 && hour < 17) return `Good Afternoon, ${name} 🌤`;
    if (hour >= 17 && hour < 21) return `Good Evening, ${name} 🌇`;
    return `Good Night, ${name} 🌙`;
  },

  showView(viewId) {
    App.currentView = viewId;
    $qa('.view').forEach(v => v.classList.remove('active'));
    const view = $(viewId + '-view');
    if (view) view.classList.add('active');
    this.setActiveNav(viewId);
    
    const title = { dashboard: 'Dashboard', tasks: 'Tasks', calendar: 'Calendar', habits: 'Habits & Goals', analytics: 'Analytics', settings: 'Settings' };
    const topTitle = $('topbar-title');
    
    if (topTitle) {
      if (viewId === 'dashboard') {
        const updateGreeting = (profile) => {
          if (App.currentView !== 'dashboard') return;
          if (profile && profile.fullName) {
            topTitle.textContent = this.getGreeting(profile.fullName.split(' ')[0]);
          } else {
            topTitle.textContent = 'Welcome Back 👋';
          }
        };

        const cached = typeof DB !== 'undefined' && DB.getCachedProfile ? DB.getCachedProfile() : null;
        if (cached) {
          updateGreeting(cached);
        } else {
          topTitle.innerHTML = '<span style="opacity:0.5;">Loading...</span>';
          if (typeof DB !== 'undefined' && DB.getUserProfile) {
            DB.getUserProfile().then(p => updateGreeting(p)).catch(() => {
              if (App.currentView === 'dashboard') topTitle.textContent = 'Welcome Back 👋';
            });
          } else {
            topTitle.textContent = 'Welcome Back 👋';
          }
        }
      } else {
        topTitle.textContent = title[viewId] || viewId;
      }
    }
    
    App.renderCurrentView();
  },
};

/* ── Task Modal ── */
const TaskModal = {
  editing: null,

  open(task = null, prefill = {}) {
    this.editing = task;
    const modal = $('task-modal');
    const overlay = $('task-modal-overlay');
    if (!modal || !overlay) return;

    // Reset form
    $('task-title-input').value        = task?.title || prefill.title || '';
    $('task-desc-input').value         = task?.desc  || prefill.desc || '';
    $('task-category-input').value     = task?.category || prefill.category || 'work';
    $('task-date-input').value         = task?.dueDate ? new Date(task.dueDate).toISOString().slice(0,16) : (prefill.dueDate || '');
    $('task-duration-input').value     = task?.estimatedMins || prefill.estimatedMins || 30;
    $('task-repeat-input').value       = task?.repeat || prefill.repeat || '';
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
        if (eventId) {
          Tasks.update(task.id, { gcalEventId: eventId });
          DB.updateTask(task.id, { gcalEventId: eventId });
        }
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
    const initials = role === 'ai' ? '<img src="logo.png" alt="AI">' : 'U';
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
    el.innerHTML = `<div class="chat-avatar"><img src="logo.png" alt="AI"></div><div class="chat-bubble chat-typing"><span></span><span></span><span></span></div>`;
    container.appendChild(el);
    container.scrollTop = container.scrollHeight;
  },

  removeTyping() { const el = $('typing-indicator'); if (el) el.remove(); },

  addStructuredMessage(role, data) {
    const container = $('ai-messages');
    if (!container) return;

    const msg = document.createElement('div');
    msg.className = `chat-msg ${role}`;
    const initials = role === 'ai' ? '<img src="logo.png" alt="AI">' : 'U';
    
    msg.innerHTML = `
      <div class="chat-avatar">${initials}</div>
      <div class="chat-bubble" style="padding: 0; background: transparent; border: none; box-shadow: none;">
        <div class="ai-resp-container">
          <div class="ai-resp-section">
            <span class="ai-resp-label answer">Answer</span>
            <span class="ai-resp-text">${data.answer}</span>
          </div>
          ${data.reasoning ? `
          <div class="ai-resp-section">
            <span class="ai-resp-label reason">Reasoning</span>
            <span class="ai-resp-text">${data.reasoning}</span>
          </div>` : ''}
          ${data.action ? `
          <div class="ai-resp-section">
            <span class="ai-resp-label action">Recommendation</span>
            <span class="ai-resp-text">${data.action}</span>
          </div>` : ''}
          ${data.confidence ? `
          <div class="ai-resp-confidence">Confidence: ${data.confidence}%</div>
          ` : ''}
        </div>
      </div>
    `;
    
    container.appendChild(msg);
    container.scrollTop = container.scrollHeight;
  },

  async respond(input) {
    this.addMessage('user', input);
    this.showTyping();

    await new Promise(r => setTimeout(r, 600 + Math.random() * 600));

    if (typeof AIContextService !== 'undefined' && typeof AIChatService !== 'undefined') {
      const context = AIContextService.buildContext();
      const result = AIChatService.processQuery(input, context);
      this.removeTyping();
      this.addStructuredMessage('ai', result);
    } else {
      const result = await AI.processInput(input, Tasks.getAll());
      this.removeTyping();
      this.addMessage('ai', result.text);

      if (result.type === 'add_task' && result.data) {
        const createdTask = Tasks.create(result.data);
        if (typeof DB !== 'undefined') DB.addTask(createdTask);
        App.renderCurrentView();
        App.updateBadges();
        showToast('Task created via AI! 🤖', 'success');
        Notifications.scheduleAll(Tasks.getAll());
      }
    }
  },

  sendMessage() {
    const input = $('ai-chat-input');
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    input.style.height = 'auto'; // Reset height after sending
    
    // Un-hide quick actions when input is cleared
    const quickActions = document.querySelector('.ai-quick-actions');
    if (quickActions) quickActions.classList.remove('hidden');
    
    this.respond(text);
  },

  greet() {
    setTimeout(() => {
      const suggestion = AI.getContextualSuggestion(Tasks.getAll());
      this.addMessage('ai', `Hello! I'm **TACTIC**, your AI productivity companion. ${suggestion.title} — ${suggestion.body}`);
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

    // Empty slots before (padding from previous month)
    for (let i = 0; i < first; i++) {
      const prevDay = new Date(year, month, 0 - first + i + 1);
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

      // Safe local date string for ID mapping
      const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

      html += `<div class="cal-day${isToday ? ' today' : ''}" data-date="${date.toISOString()}">
        <div class="cal-day-num">${d}</div>
        ${dots}
        <div id="gcal-events-${dateStr}"></div>
      </div>`;
    }

    html += '</div>';
    container.innerHTML = html;

    // Render Upcoming Ops
    const upcomingContainer = $('calendar-upcoming-ops');
    if (upcomingContainer) {
      const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const upcomingTasks = tasks
        .filter(t => t.dueDate && new Date(t.dueDate) >= todayStart)
        .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
        .slice(0, 5); // Limit to 5
      
      if (upcomingTasks.length === 0) {
        upcomingContainer.innerHTML = '<div style="font-size:0.75rem; color:var(--text-muted); padding: 16px;">NO UPCOMING OPS. SYSTEM IDLE.</div>';
      } else {
        upcomingContainer.innerHTML = upcomingTasks.map(t => {
          const tDate = new Date(t.dueDate);
          const pColors = { critical: '#ff3366', high: '#ff8c00', medium: '#3b82f6', low: '#6b7280' };
          const monthStr = tDate.toLocaleDateString('en-US', { month: 'short' });
          const dayStr = String(tDate.getDate()).padStart(2, '0');
          const timeStr = tDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
          const isAllDay = (timeStr === '12:00 AM');
          return `
            <div class="upcoming-op-item" onclick="TaskModal.open(Tasks.getById('${t.id}'))">
              <div class="upcoming-op-date">
                <strong>${dayStr}</strong>
                <span>${monthStr}</span>
              </div>
              <div class="upcoming-op-details">
                <div class="upcoming-op-title" style="color: ${pColors[t.priority] || 'var(--neon-cyan)'}">${t.title}</div>
                <div class="upcoming-op-time">
                  ${t.category ? `<span style="border: 1px solid ${pColors[t.priority] || 'var(--neon-cyan)'}; padding: 1px 4px; border-radius: 2px; margin-right: 6px;">${t.category}</span>` : ''}
                  ${isAllDay ? 'ALL DAY' : timeStr}
                </div>
              </div>
            </div>
          `;
        }).join('');
      }
    }

    $qa('.cal-day:not(.other-month)').forEach(cell => {
      cell.addEventListener('click', () => {
        const iso = cell.dataset.date;
        if (iso) {
          TaskModal.open(null, { dueDate: iso.slice(0,16) });
        }
      });
    });

    // ── Asynchronous Google Calendar Two-Way Sync ──
    if (typeof GCal !== 'undefined' && GCal.isConnected()) {
      const start = new Date(year, month, 1);
      const end = new Date(year, month + 1, 0);
      GCal.getExternalEvents(start, end).then(events => {
        
        // Group events by date string
        const eventsByDate = {};
        events.forEach(e => {
          if (!e.start) return;
          const eDateStr = e.start.slice(0, 10);
          if (!eventsByDate[eDateStr]) eventsByDate[eDateStr] = [];
          eventsByDate[eDateStr].push(e);
        });

        // Render into containers safely
        for (const [dateStr, dayEvents] of Object.entries(eventsByDate)) {
          const c = document.getElementById(`gcal-events-${dateStr}`);
          if (!c) continue;
          
          c.innerHTML = ''; // Clear to prevent double-renders if user clicked quickly
          dayEvents.forEach(e => {
            const div = document.createElement('div');
            div.className = 'cal-task-dot';
            div.title = e.title;
            div.style.cssText = `background:rgba(66, 133, 244, 0.05);color:var(--text-secondary);border-left:2px solid ${e.isHoliday ? 'var(--neon-purple)' : '#4285f4'}; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; cursor:pointer;`;
            div.innerHTML = `${e.isHoliday ? '🎉 ' : '📅 '}${e.title}`;
            
            // Prepopulate New Task with holiday name
            div.onclick = (evt) => {
              evt.stopPropagation();
              TaskModal.open(null, { title: `Plan for ${e.title}`, dueDate: `${dateStr}T09:00` });
            };
            c.appendChild(div);
          });
        }
      });
    }
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

    const topStreakEl = $('top-streak');
    const doneTodayEl = $('habits-done-today');
    if (topStreakEl) {
      const topStreak = habits.reduce((max, h) => Math.max(max, h.streak), 0);
      topStreakEl.textContent = topStreak;
    }
    if (doneTodayEl) {
      const doneToday = habits.filter(h => Habits.isDoneToday(h)).length;
      doneTodayEl.textContent = `${doneToday} done`;
    }
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
            
            <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px">
              <button class="btn btn-ghost btn-sm" onclick="HabitsView.addMilestone('${g.id}')">+ Add Milestone</button>
              <button class="btn-icon btn" onclick="HabitsView.deleteGoal('${g.id}')" style="color:var(--neon-red);width:30px;height:30px;border:none" title="Delete Goal">🗑</button>
            </div>
          </div>
        </div>`;
    }).join('');
  },

  toggleHabit(id) {
    Habits.toggleHabitToday(id);
    DB.saveHabits(Habits.getHabits());
    this.renderHabits();
    showToast('Habit updated! 🔥', 'success');
  },
  toggleMilestone(gid, idx) { 
    Habits.toggleMilestone(gid, idx); 
    DB.saveGoals(Habits.getGoals());
    this.renderGoals(); 
  },
  async addMilestone(gid) {
    const title = await window.tacticModal.open({ type: 'milestone', title: 'Add Milestone' });
    if (title) {
      Habits.addMilestone(gid, title);
      DB.saveGoals(Habits.getGoals());
      this.renderGoals();
      showToast('Milestone added!', 'success');
    }
  },
  async deleteGoal(id) {
    const confirmed = await window.tacticModal.open({ type: 'confirm', title: 'Delete Goal?', message: 'Are you sure you want to delete this goal?' });
    if (confirmed) {
      Habits.deleteGoal(id);
      DB.saveGoals(Habits.getGoals());
      this.renderGoals();
      showToast('Goal deleted', 'info');
    }
  },
  async deleteHabit(id) { 
    const confirmed = await window.tacticModal.open({ type: 'confirm', title: 'Delete Habit?', message: 'Are you sure you want to delete this habit?' });
    if (confirmed) {
      Habits.deleteHabit(id); 
      DB.saveHabits(Habits.getHabits());
      this.renderHabits(); 
      showToast('Habit deleted', 'info');
    }
  },
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
  async load() {
    const settings = JSON.parse(localStorage.getItem('nexus_settings') || '{}');
    const notifToggle = $('notif-toggle');
    const voiceToggle = $('voice-toggle');
    const aiPersonality = $('ai-personality');

    if (notifToggle) notifToggle.checked = settings.notifications !== false;
    if (voiceToggle) voiceToggle.checked = settings.voice !== false;
    if (aiPersonality) aiPersonality.value = settings.personality || 'coach';

    // Helper to disable input fields during loading
    const setFieldsDisabled = (disabled) => {
      $qa('#settings-view .form-input, #settings-view .form-select, #settings-save-btn').forEach(el => {
        el.disabled = disabled;
      });
    };


    setFieldsDisabled(true);

    try {
      // Load Routine
      if (typeof ScheduleService !== 'undefined') {
        const routine = await ScheduleService.getRoutine(true);
        
        if (routine) {
          if ($('routine-wakeup')) $('routine-wakeup').value = routine.wakeUp || '';
          if ($('routine-sleep')) $('routine-sleep').value = routine.sleep || '';
          if ($('routine-collegestart')) $('routine-collegestart').value = routine.collegeStart || '';
          if ($('routine-collegeend')) $('routine-collegeend').value = routine.collegeEnd || '';
          if ($('routine-travel')) $('routine-travel').value = routine.travelTimeMins || '';
          if ($('routine-lunch')) $('routine-lunch').value = routine.lunchTime || '';
          if ($('routine-dinner')) $('routine-dinner').value = routine.dinnerTime || '';
          if ($('routine-gym')) $('routine-gym').value = routine.gymTime || '';
          if ($('routine-studydur')) $('routine-studydur').value = routine.studyDurMins || '';
          if ($('routine-pomodoro')) $('routine-pomodoro').value = routine.pomodoroMins || '';
          if ($('routine-peakstart')) $('routine-peakstart').value = routine.peakFocusStart || '';
          if ($('routine-peakend')) $('routine-peakend').value = routine.peakFocusEnd || '';
        }
      }
    } catch (e) {
      console.error('[SettingsView] Load settings error:', e);
      showToast('Error loading routine settings', 'error');
    } finally {
      setFieldsDisabled(false);
    }


  },

  async save() {
    const saveBtn = $('settings-save-btn');
    const setFieldsDisabled = (disabled) => {
      $qa('#settings-view .form-input, #settings-view .form-select').forEach(el => {
        el.disabled = disabled;
      });
      if (saveBtn) {
        saveBtn.disabled = disabled;
        saveBtn.textContent = disabled ? 'Saving settings... ⏳' : 'Save Settings';
      }
    };

    setFieldsDisabled(true);

    try {
      const settings = {
        notifications: $('notif-toggle')?.checked ?? true,
        voice:         $('voice-toggle')?.checked ?? true,
        personality:   $('ai-personality')?.value || 'coach',
      };
      localStorage.setItem('nexus_settings', JSON.stringify(settings));

      // Save Routine
      if (typeof ScheduleService !== 'undefined') {
        const routineData = {
          wakeUp: $('routine-wakeup')?.value,
          sleep: $('routine-sleep')?.value,
          collegeStart: $('routine-collegestart')?.value,
          collegeEnd: $('routine-collegeend')?.value,
          travelTimeMins: $('routine-travel')?.value,
          lunchTime: $('routine-lunch')?.value,
          dinnerTime: $('routine-dinner')?.value,
          gymTime: $('routine-gym')?.value,
          studyDurMins: $('routine-studydur')?.value,
          pomodoroMins: $('routine-pomodoro')?.value,
          peakFocusStart: $('routine-peakstart')?.value,
          peakFocusEnd: $('routine-peakend')?.value
        };
        
        try {
          console.log('[SettingsView] Calling updateRoutine with:', routineData);
          await ScheduleService.updateRoutine(routineData);
        } catch (err) {
          console.error('[SettingsView] updateRoutine error:', err);
          showToast('Invalid routine data', 'error');
          return;
        }
      }

      showToast('Settings saved!', 'success');
    } catch (e) {
      console.error('[SettingsView] Save settings error:', e);
      showToast('Failed to save settings', 'error');
    } finally {
      setFieldsDisabled(false);
    }
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
      container.innerHTML = `<div class="empty-state"><div class="empty-icon">🎯</div><h4>All clear!</h4><p>No tasks here. Add one above or ask TACTIC to help plan your day.</p></div>`;
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
          <div class="task-body" style="cursor:pointer;" onclick="TasksView.handleTaskBodyClick('${task.id}')">
            <div class="task-title">${task.title}</div>
            ${task.desc ? `<div style="font-size:0.78rem;color:var(--text-muted);margin-top:2px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:1;-webkit-box-orient:vertical">${task.desc}</div>` : ''}
            <div class="task-meta">
              <span class="badge badge-${task.priority}">${task.priority}</span>
              ${task.category ? `<span class="task-category-tag">${task.category}</span>` : ''}
              ${due ? `<span class="task-time${isOverdue ? ' overdue' : ''}">🕐 ${due}</span>` : ''}
              ${task.estimatedMins ? `<span class="task-time">⏱ ${task.estimatedMins}m</span>` : ''}
              ${task.repeat ? `<span class="task-time">🔁 ${task.repeat}</span>` : ''}
              <span style="font-size:0.68rem;color:${pColors[task.priority]};margin-left:auto;font-weight:700">AI ${score}/100</span>
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

  async handleTaskBodyClick(id) {
    const task = Tasks.getById(id);
    if (!task) return;

    const now = new Date();
    const isOverdue = task.dueDate && new Date(task.dueDate) < now && new Date(task.dueDate).toDateString() !== now.toDateString();

    if (isOverdue && !task.completed) {
      AiChat.open();
      AiChat.addMessage('ai', `I see you're looking at **${task.title}** which is overdue. Let me give you a quick personalized strategy...`);
      AiChat.showTyping();
      
      const prompt = `My task "${task.title}" is overdue. CRITICAL INSTRUCTION: ONLY give advice regarding this specific task. DO NOT mention any other tasks. Give me a highly motivating 2-sentence personalized tip on exactly how to start and complete it right now.`;
      const res = await AI.processInput(prompt, [task], true);
      
      AiChat.removeTyping();
      AiChat.addMessage('ai', res.text);
    } else {
      TaskModal.open(task);
    }
  },

  toggleTask(e, id) {
    e.stopPropagation();
    const task = Tasks.toggle(id);
    if (task) {
      // Sync to DB + Calendar
      DB.updateTask(id, { completed: task.completed });
      if (task.gcalEventId) GCal.updateEvent(task.gcalEventId, task);
      
      if (task.completed) showToast('Task completed! 🎉', 'success');
    }
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
  showTimelineActivity(metaStr) {
    if (typeof TacticModal === 'undefined') return;
    try {
      const meta = JSON.parse(decodeURIComponent(metaStr));
      const html = `
        <div style="font-size:0.9rem; color:var(--text-secondary); line-height:1.6;">
          <div style="margin-bottom:12px;"><strong>Scheduled Time:</strong> ${meta.startTime} – ${meta.endTime} (${meta.duration}m)</div>
          <div style="margin-bottom:12px;"><strong>Category:</strong> ${meta.category}</div>
          <div style="margin-bottom:12px;"><strong>Priority:</strong> ${meta.priority}</div>
          <div style="margin-bottom:12px;"><strong>Status:</strong> ${meta.status || 'Pending'}</div>
          ${meta.confidence ? `<div style="margin-bottom:12px;"><strong>AI Confidence:</strong> ${meta.confidence}%</div>` : ''}
          <div style="margin-top:20px; text-align:center;">
             ${meta.id ? `<button class="btn btn-primary" style="margin-right:8px;" onclick="console.log('Go to Task', '${meta.id}')">Open</button>` : ''}
             <button class="btn" style="background:rgba(255,255,255,0.1); border:1px solid rgba(255,255,255,0.2);" onclick="TacticModal.hide()">Close Details</button>
          </div>
        </div>
      `;
      TacticModal.show(html, { title: meta.title });
    } catch (e) {
      console.error('Failed to parse timeline activity meta', e);
    }
  },
  showTooltip(e, metaStr) {
    let tt = document.getElementById('gantt-custom-tooltip');
    if (!tt) {
      tt = document.createElement('div');
      tt.id = 'gantt-custom-tooltip';
      document.body.appendChild(tt);
    }
    try {
      const meta = JSON.parse(decodeURIComponent(metaStr));
      tt.innerHTML = `
        <div class="gantt-tooltip-title">${meta.title}</div>
        <div class="gantt-tooltip-row"><span class="gantt-tooltip-label">Category:</span><span>${meta.category}</span></div>
        <div class="gantt-tooltip-row"><span class="gantt-tooltip-label">Time:</span><span>${meta.startTime} - ${meta.endTime} (${meta.duration}m)</span></div>
        <div class="gantt-tooltip-row"><span class="gantt-tooltip-label">Priority:</span><span>${meta.priority}</span></div>
        <div class="gantt-tooltip-row"><span class="gantt-tooltip-label">Status:</span><span>${meta.status || 'Pending'}</span></div>
        <div class="gantt-tooltip-row"><span class="gantt-tooltip-label">Est. Completion:</span><span>${meta.probability || '95%'}</span></div>
        <div class="gantt-tooltip-row" style="margin-top:8px; padding-top:8px; border-top:1px solid rgba(255,255,255,0.1);">
          <span class="gantt-tooltip-label" style="color:var(--neon-green);">AI Recommendation:</span>
          <span>${meta.recommendation || 'Proceed as scheduled.'}</span>
        </div>
      `;
      tt.style.display = 'block';
      let x = e.clientX + 15;
      let y = e.clientY + 15;
      if (x + 280 > window.innerWidth) x = e.clientX - 290;
      if (y + 180 > window.innerHeight) y = e.clientY - 190;
      tt.style.left = x + 'px';
      tt.style.top = y + 'px';
    } catch(err) {
      console.error(err);
    }
  },
  hideTooltip() {
    const tt = document.getElementById('gantt-custom-tooltip');
    if (tt) tt.style.display = 'none';
  },
  async planDay(forceRegenerate = false) {
    const container = $('todays-plan-content');
    const section = $('todays-plan-section');
    if (!container || !section) return;

    section.style.display = 'block';

    const todayStr = new Date().toISOString().split('T')[0];
    
    // Check for existing plan if not regenerating
    if (!forceRegenerate && typeof DB !== 'undefined') {
      const existingPlan = await DB.getDailyPlan(todayStr);
      if (existingPlan) {
        this.renderPlan(existingPlan);
        container.innerHTML = `
          <div style="background:rgba(255,255,255,0.05); padding:16px; border-radius:8px; margin-bottom:20px; text-align:center; border: 1px solid rgba(255,255,255,0.1);">
            <div style="margin-bottom:12px; font-weight:600;">You already have a generated plan for today.</div>
            <div style="display:flex; gap:12px; justify-content:center;">
              <button class="btn btn-primary" onclick="Dashboard.planDay(true)">Regenerate Plan</button>
            </div>
          </div>
        ` + container.innerHTML;
        return;
      }
    }

    container.innerHTML = '<div style="color:var(--text-muted);font-size:0.9rem;text-align:center;padding:20px;">Analyzing workload and generating intelligent schedule... ⏳</div>';

    if (typeof AIPlannerService !== 'undefined') {
      const user = typeof Auth !== 'undefined' ? Auth.getUser() : null;
      const plan = await AIPlannerService.generateDailyPlan(user ? user.uid : 'guest');
      this.renderPlan(plan);
    } else {
      container.innerHTML = '<div style="color:red;text-align:center;">AIPlannerService not found</div>';
    }
  },

  renderPlan(plan) {
    const container = $('todays-plan-content');
    if (!container) return;

    // Build Strategy block
    let strategyHtml = `
      <div style="margin-bottom: 20px; padding: 15px; background: rgba(168,85,247,0.1); border: 1px solid rgba(168,85,247,0.2); border-radius: 8px;">
        <h4 style="color:var(--neon-purple); margin:0 0 10px 0; font-family:'Orbitron', sans-serif;">🧠 TACTIC AI Strategy</h4>
        <div style="font-size: 0.85rem; color: var(--text-secondary); line-height:1.6;">
          ${plan.strategy.summary.replace(/\n/g, '<br>')}
        </div>
        ${plan.strategy.studyAnalysis ? `
        <div style="margin-top: 10px; font-size: 0.85rem; color: var(--neon-cyan); border-top: 1px solid rgba(255,255,255,0.1); padding-top: 10px;">
          ${plan.strategy.studyAnalysis}
        </div>` : ''}
        <div style="margin-top: 10px; font-size: 0.85rem; color: var(--text-primary); border-top: 1px solid rgba(255,255,255,0.1); padding-top: 10px;">
          ${plan.strategy.recommendation}
        </div>
        <div style="margin-top: 10px; font-size: 0.85rem; font-style: italic; color: var(--neon-green);">
          "${plan.strategy.motivation}"
        </div>
      </div>
    `;

    // Timeline HTML generation removed in favor of Premium Gantt Chart below

    // Build Available Study Time block (Redesigned to "Best Study Window")
    let studyHtml = `
      <div style="background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.05); border-radius:8px; padding:15px; position:sticky; top:20px;">
        <h4 style="color:var(--neon-cyan); margin:0 0 15px 0; font-family:'Orbitron', sans-serif;">⭐ Best Study Window</h4>
    `;
    
    if (plan.remainingStudyMins > 0 && plan.goalSuggestions && plan.goalSuggestions.length > 0) {
      const bestSlot = plan.goalSuggestions.reduce((prev, curr) => (prev.duration > curr.duration) ? prev : curr);
      
      studyHtml += `
        <div class="best-study-window">
          <div style="font-size:1.2rem; font-weight:700; color:var(--text-primary); margin-bottom:8px;">${bestSlot.startTime} – ${bestSlot.endTime}</div>
          <div style="font-size:0.85rem; color:var(--text-secondary); margin-bottom:12px;">Longest uninterrupted focus session (${bestSlot.duration}m).</div>
        </div>
      `;

      studyHtml += `
        <h4 style="color:var(--neon-green); margin:0 0 10px 0; font-size:0.9rem; text-transform:uppercase;">🎯 Goal Recommendations</h4>
        <div style="display:flex; flex-direction:column; gap:12px;">
      `;
      plan.goalSuggestions.forEach(s => {
        studyHtml += `
          <div style="background:rgba(0,255,136,0.05); border:1px solid rgba(0,255,136,0.1); border-radius:6px; padding:12px;">
            <div style="font-weight:600; font-size:0.9rem; color:var(--text-primary); margin-bottom:4px;">${s.goalTitle}</div>
            <div style="font-size:0.75rem; color:var(--neon-cyan); margin-bottom:8px;">Recommended: ${s.startTime} – ${s.endTime}</div>
            <div style="font-size:0.8rem; color:var(--text-secondary); line-height:1.4;">${s.reason}</div>
          </div>
        `;
      });
      studyHtml += `</div>`;
    } else {
      studyHtml += `<div style="font-size:0.9rem; color:var(--text-muted);">Your schedule is fully packed today! No free study windows remaining.</div>`;
    }
    
    studyHtml += `</div>`;

    // ==========================================
    // SPRINT: AI Execution Summary & Gantt Chart
    // ==========================================
    
    let plannedMins = 0;
    let studyMins = 0;
    let goalMins = 0;
    let habitCount = 0;
    let taskCount = 0;
    let totalWorkingMins = 0;

    let minStartMins = 1440;
    let maxEndMins = 0;

    plan.timeline.forEach(block => {
      if (block.startMins < minStartMins) minStartMins = block.startMins;
      if (block.endMins > maxEndMins) maxEndMins = block.endMins;
      
      const dur = block.endMins - block.startMins;
      
      if (block.type === 'task') {
        taskCount++;
        plannedMins += dur;
        totalWorkingMins += dur;
        if (block.category && typeof block.category === 'string' && (block.category.toLowerCase().includes('study') || block.category.toLowerCase().includes('learning'))) studyMins += dur;
        else studyMins += dur; 
      } else if (block.type === 'habit') {
        habitCount++;
        plannedMins += dur;
        totalWorkingMins += dur;
      } else if (block.type === 'goal') {
        goalMins += dur;
        plannedMins += dur;
        totalWorkingMins += dur;
      }
    });

    const formatDur = mins => {
      if (mins === 0) return '0m';
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      return `${h > 0 ? h + 'h ' : ''}${m > 0 ? m + 'm' : ''}`.trim();
    };

    const totalAvailable = totalWorkingMins + plan.remainingStudyMins;
    const prodUtil = totalAvailable > 0 ? Math.round((totalWorkingMins / totalAvailable) * 100) : 0;
    const aiScore = Math.min(100, Math.max(0, prodUtil > 0 ? prodUtil + (habitCount * 2) + (plan.remainingStudyMins > 0 ? 5 : -5) : 85));

    let bestFocus = 'Flexible';
    if (plan.routineSnapshot && plan.routineSnapshot.peakFocusStart && plan.routineSnapshot.peakFocusEnd) {
      bestFocus = `${plan.routineSnapshot.peakFocusStart} – ${plan.routineSnapshot.peakFocusEnd}`;
    }

    let mainFocus = 'Daily Productivity';
    if (plan.goalSuggestions && plan.goalSuggestions.length > 0) {
      mainFocus = plan.goalSuggestions[0].goalTitle;
    }
    
    let highestPriorityTask = 'None';
    let hpBlock = plan.timeline.find(b => b.priority === 'critical');
    if (!hpBlock) hpBlock = plan.timeline.find(b => b.priority === 'high' || b.priority === 'urgent');
    if (hpBlock) highestPriorityTask = hpBlock.title;

    // Insights extraction
    const now = new Date();
    const currentMins = now.getHours() * 60 + now.getMinutes();
    
    let nextBlock = plan.timeline.find(b => b.endMins > currentMins && b.type !== 'break' && b.status !== 'completed');
    let nextBestActionTitle = 'No pending actions';
    let nextBestActionDesc = 'You have finished everything for today!';
    if (nextBlock) {
      nextBestActionTitle = nextBlock.title;
      let dur = nextBlock.endMins - Math.max(currentMins, nextBlock.startMins);
      nextBestActionDesc = `Do this for the next ${dur} minutes.`;
    }

    let priorityAlertTitle = "No urgent tasks today.";
    let priorityAlertDesc = "You have a great opportunity for deep work.";
    let priorityClass = "";
    if (hpBlock) {
      priorityAlertTitle = hpBlock.title;
      priorityAlertDesc = `This task is marked as ${hpBlock.priority}. Ensure it is completed today.`;
      priorityClass = "alert-urgent";
    }

    let goalProgressStr = "No goals scheduled today.";
    if (plan.goalSuggestions && plan.goalSuggestions.length > 0) {
      goalProgressStr = `Scheduled ${formatDur(plan.goalSuggestions[0].duration)} for "${plan.goalSuggestions[0].goalTitle}".`;
    }

    let aiTipStr = "Maintain a steady pace and avoid distractions.";
    if (plan.remainingStudyMins > 120) {
      aiTipStr = "You have plenty of free time today. Consider using a 90-minute block for deep learning.";
    } else if (plan.strategy?.workload === 'High') {
      aiTipStr = "Your workload is high today. Stick strictly to your schedule and don't skip your breaks.";
    } else if (habitCount > 3) {
      aiTipStr = "You have a strong habit stack today. Complete them early for momentum.";
    }

    const aiInsightsHtml = `
      <div style="margin-bottom: 24px;">
        <h3 style="color:var(--text-primary); margin:0 0 4px 0; font-family:'Orbitron', sans-serif;">🤖 AI Productivity Insights</h3>
        <div style="color:var(--text-muted); font-size:0.85rem; margin-bottom: 16px;">Real-time analysis of your optimized schedule.</div>
        
        <div class="ai-insights-grid">
          <!-- Card: Main Goal -->
          <div class="ai-insight-card-premium">
            <div class="insight-header"><span class="icon">🎯</span> Today's Main Goal</div>
            <div class="insight-value">${mainFocus}</div>
          </div>

          <!-- Card: Best Study Window -->
          <div class="ai-insight-card-premium">
            <div class="insight-header"><span class="icon">📚</span> Best Study Window</div>
            <div class="insight-value">${bestFocus}</div>
            <div class="insight-desc">Reason: Highest focus period with no conflicts.</div>
          </div>

          <!-- Card: Next Best Action -->
          <div class="ai-insight-card-premium">
            <div class="insight-header"><span class="icon">⚡</span> Next Best Action</div>
            <div class="insight-value">${nextBestActionTitle}</div>
            <div class="insight-desc">${nextBestActionDesc}</div>
          </div>

          <!-- Card: Priority Alert -->
          <div class="ai-insight-card-premium ${priorityClass}">
            <div class="insight-header"><span class="icon">🔥</span> Priority Alert</div>
            <div class="insight-value">${priorityAlertTitle}</div>
            <div class="insight-desc">${priorityAlertDesc}</div>
          </div>

          <!-- Card: Free Productive Time -->
          <div class="ai-insight-card-premium">
            <div class="insight-header"><span class="icon">🟢</span> Free Productive Time</div>
            <div class="insight-value">${formatDur(plan.remainingStudyMins)} available</div>
          </div>

          <!-- Card: Goal Progress -->
          <div class="ai-insight-card-premium">
            <div class="insight-header"><span class="icon">🎯</span> Goal Progress</div>
            <div class="insight-value">${goalProgressStr}</div>
          </div>

          <!-- Card: AI Tip of the Day -->
          <div class="ai-insight-card-premium tip-card">
            <div class="insight-header"><span class="icon">💡</span> AI Tip of the Day</div>
            <div class="insight-desc" style="font-size:0.95rem; line-height:1.5;">${aiTipStr}</div>
          </div>
        </div>
      </div>
    `;

    if (window.ganttInterval) clearInterval(window.ganttInterval);

    // Build Premium Gantt Chart
    let ganttHeaderHours = '';
    for (let i = 0; i < 24; i++) {
      ganttHeaderHours += `<div class="gantt-hour-marker">${i.toString().padStart(2, '0')}:00</div>`;
    }

    let ganttRowsHtml = '';
    plan.timeline.forEach(block => {
      let barClass = 'routine';
      let icon = '🕒';
      
      if (block.status === 'completed') {
        barClass = 'completed';
        icon = '✓';
      } else if (block.type === 'habit') {
        barClass = 'habit';
        icon = '🌱';
      } else if (block.type === 'goal') {
        barClass = 'goal';
        icon = '🎯';
      } else if (block.type === 'task') {
        icon = '📝';
        let cat = (block.category || '').toLowerCase();
        if (cat.includes('study') || cat.includes('learning')) {
          barClass = 'study';
          icon = '📚';
        } else if (block.priority === 'critical' || block.priority === 'urgent') {
          barClass = 'task-critical';
          icon = '🔥';
        } else if (block.priority === 'high') {
          barClass = 'task-high';
          icon = '⚡';
        } else if (block.priority === 'medium') {
          barClass = 'task-medium';
        } else {
          barClass = 'task-low';
        }
      } else if (block.type === 'break') {
        icon = '☕';
        barClass = 'routine';
      }

      const dt = new Date();
      const currentMins = dt.getHours() * 60 + dt.getMinutes();
      if (block.status !== 'completed' && block.startMins <= currentMins && block.endMins >= currentMins) {
        barClass += ' current';
      } else if (block.status !== 'completed' && block.endMins < currentMins && block.type === 'task') {
        barClass += ' overdue';
      }

      let leftPct = (block.startMins / 1440) * 100;
      let widthPct = (block.duration / 1440) * 100;
      if (widthPct < 0.5) widthPct = 0.5;

      const priorityStr = block.priority ? block.priority.charAt(0).toUpperCase() + block.priority.slice(1) : 'Normal';
      const catStr = block.category || 'General';
      const confStr = block.confidence !== undefined ? `${block.confidence}%` : 'N/A';
      const statusStr = block.status === 'completed' ? 'Completed' : (barClass.includes('current') ? 'In Progress' : (barClass.includes('overdue') ? 'Overdue' : 'Pending'));
      const reasonStr = block.reason ? `<div class="gantt-tooltip-row" style="margin-top:6px; border-top:1px solid rgba(255,255,255,0.1); padding-top:6px;"><span class="gantt-tooltip-label">AI Reason:</span><span class="gantt-tooltip-value" style="text-align:right;">${block.reason}</span></div>` : '';

      const tooltipHtml = `
          <div class="gantt-tooltip-header">${icon} ${block.title}</div>
          <div class="gantt-tooltip-row"><span class="gantt-tooltip-label">Category:</span><span class="gantt-tooltip-value">${catStr}</span></div>
          <div class="gantt-tooltip-row"><span class="gantt-tooltip-label">Priority:</span><span class="gantt-tooltip-value">${priorityStr}</span></div>
          <div class="gantt-tooltip-row"><span class="gantt-tooltip-label">Date:</span><span class="gantt-tooltip-value">Today</span></div>
          <div class="gantt-tooltip-row"><span class="gantt-tooltip-label">Time:</span><span class="gantt-tooltip-value">${block.startTime} – ${block.endTime}</span></div>
          <div class="gantt-tooltip-row"><span class="gantt-tooltip-label">Duration:</span><span class="gantt-tooltip-value">${block.duration}m</span></div>
          <div class="gantt-tooltip-row"><span class="gantt-tooltip-label">AI Confidence:</span><span class="gantt-tooltip-value">${confStr}</span></div>
          <div class="gantt-tooltip-row"><span class="gantt-tooltip-label">Status:</span><span class="gantt-tooltip-value">${statusStr}</span></div>
          ${reasonStr}
      `;

      let overdueBadge = '';
      if (barClass.includes('overdue')) overdueBadge = '<div class="gantt-overdue-badge">⚠ Overdue</div>';
      else if (block.isRescheduled) overdueBadge = '<div class="gantt-rescheduled-badge">Rescheduled by AI</div>';

      ganttRowsHtml += `
        <div class="gantt-row">
          <div class="gantt-sidebar-cell">
            <span class="gantt-sidebar-cell-icon">${icon}</span>
            <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${block.title}</span>
          </div>
          <div class="gantt-timeline-area">
            <div class="gantt-bar-wrapper" style="left: ${leftPct}%; width: ${widthPct}%;">
              <div class="gantt-bar ${barClass}">
                <span class="gantt-bar-icon">${icon}</span>
                <div class="gantt-bar-title">
                  <span>${block.title}</span>
                  <span class="gantt-bar-time">${block.startTime} – ${block.endTime}</span>
                </div>
                ${overdueBadge}
              </div>
              ${barClass.includes('current') ? '<div class="gantt-live-badge">LIVE</div>' : ''}
              <template class="tooltip-data">${tooltipHtml}</template>
            </div>
          </div>
        </div>
      `;
    });

    if (plan.timeline.length === 0) {
      ganttRowsHtml = `<div style="padding: 30px; text-align: center; color: var(--text-muted); font-size: 0.9rem;">No activity scheduled for today.</div>`;
    }

    const ganttLegendHtml = `
      <div class="gantt-legend">
        <div class="gantt-legend-item" data-cat="routine"><div class="gantt-legend-dot" style="background: var(--gantt-routine-bg);"></div> Routine</div>
        <div class="gantt-legend-item" data-cat="task-low"><div class="gantt-legend-dot" style="background: var(--gantt-task-low-bg);"></div> Low Priority Task</div>
        <div class="gantt-legend-item" data-cat="task-medium"><div class="gantt-legend-dot" style="background: var(--gantt-task-med-bg);"></div> Medium Priority Task</div>
        <div class="gantt-legend-item" data-cat="task-high"><div class="gantt-legend-dot" style="background: var(--gantt-task-high-bg);"></div> High Priority Task</div>
        <div class="gantt-legend-item" data-cat="task-critical"><div class="gantt-legend-dot" style="background: var(--gantt-task-crit-bg);"></div> Urgent / Overdue</div>
        <div class="gantt-legend-item" data-cat="habit"><div class="gantt-legend-dot" style="background: var(--gantt-habit-bg);"></div> Habit</div>
        <div class="gantt-legend-item" data-cat="goal"><div class="gantt-legend-dot" style="background: var(--gantt-goal-bg);"></div> Goal</div>
        <div class="gantt-legend-item" data-cat="study"><div class="gantt-legend-dot" style="background: var(--gantt-study-bg);"></div> Study</div>
        <div class="gantt-legend-item" data-cat="completed"><div class="gantt-legend-dot" style="background: var(--gantt-completed-bg);"></div> Completed</div>
      </div>
    `;

    let ganttHtml = `
      <div class="gantt-wrapper" id="plan-gantt-chart">
        ${ganttLegendHtml}
        <div class="gantt-header-row">
          <div class="gantt-sidebar-header" style="display:flex; flex-direction:column; align-items:flex-start; justify-content:center;">
            <div style="font-size:0.95rem; font-weight:800;">🚀 Today's AI Timeline</div>
            <div style="font-size:0.65rem; color:var(--text-muted); font-weight:normal; margin-top:2px;">Generated from your routine, tasks, habits and goals.</div>
          </div>
          <div class="gantt-timeline-header" id="gantt-header-scroll">
            ${ganttHeaderHours}
          </div>
        </div>
        <div class="gantt-body-scroll" id="gantt-body-scroll">
          ${ganttRowsHtml}
          <div class="gantt-now-indicator" id="gantt-now-indicator"><div class="gantt-now-label">NOW</div></div>
        </div>
      </div>
    `;

    container.innerHTML = `
      <div style="display:flex; gap:24px; flex-wrap:wrap; align-items:flex-start;">
        <div style="flex:2; min-width:300px;">
          ${strategyHtml}
          ${aiInsightsHtml}
        </div>
        <div style="flex:1; min-width:260px;">
          ${studyHtml}
        </div>
      </div>
      ${ganttHtml}
    `;

    // Sync scroll, handle tooltips and set interval
    setTimeout(() => {
      const header = document.getElementById('gantt-header-scroll');
      const body = document.getElementById('gantt-body-scroll');
      let initialScrolled = false;
      if (header && body) {
        body.addEventListener('scroll', () => {
          header.scrollLeft = body.scrollLeft;
        });
      }

      // Portal Tooltip Setup
      let globalTooltip = document.getElementById('global-gantt-tooltip');
      if (!globalTooltip) {
        globalTooltip = document.createElement('div');
        globalTooltip.id = 'global-gantt-tooltip';
        globalTooltip.className = 'gantt-tooltip-global';
        document.body.appendChild(globalTooltip);
      }
      
      const bars = document.querySelectorAll('.gantt-bar-wrapper');
      bars.forEach(bar => {
        bar.addEventListener('mouseenter', (e) => {
          const tmpl = bar.querySelector('.tooltip-data');
          if (tmpl) {
            globalTooltip.innerHTML = tmpl.innerHTML;
            globalTooltip.style.display = 'block';
            const rect = bar.getBoundingClientRect();
            // Position tooltip above the bar, centered
            globalTooltip.style.left = (rect.left + rect.width / 2) + 'px';
            globalTooltip.style.top = (rect.top - 10) + 'px';
            globalTooltip.style.transform = 'translate(-50%, -100%)';
            setTimeout(() => globalTooltip.style.opacity = '1', 10);
          }
        });
        bar.addEventListener('mouseleave', () => {
          globalTooltip.style.opacity = '0';
          setTimeout(() => globalTooltip.style.display = 'none', 200);
        });
      });

      const updateNowIndicator = () => {
        const ind = document.getElementById('gantt-now-indicator');
        if (ind && body) {
          const nowDt = new Date();
          const mins = nowDt.getHours() * 60 + nowDt.getMinutes();
          const pct = (mins / 1440) * 100;
          ind.style.left = pct + '%';
          
          const label = ind.querySelector('.gantt-now-label');
          if (label) {
            const timeStr = nowDt.getHours().toString().padStart(2, '0') + ':' + nowDt.getMinutes().toString().padStart(2, '0');
            label.textContent = 'NOW • ' + timeStr;
          }
          
          if (!initialScrolled) {
             const targetScroll = (body.scrollWidth * (pct / 100)) - (body.clientWidth / 2) + 100;
             if (targetScroll > 0) body.scrollLeft = targetScroll;
             initialScrolled = true;
          }
        }
      };
      updateNowIndicator();
      window.ganttInterval = setInterval(updateNowIndicator, 60000);
    }, 100);
  },

  render() {
    const stats = Tasks.getStats();
    const ring = $('dash-ring');
    if (ring) Analytics.drawProgressRing(ring, stats.rate, '#00d4ff', 100);

    const el = (id, v) => { const e = $(id); if (e) e.textContent = v; };
    el('dash-total',     stats.total);
    el('dash-completed', stats.completed);
    el('dash-overdue',   stats.overdue);
    el('dash-today',     stats.today);

    // Dynamic Progress Trend
    const trendEl = $('dash-completed-trend');
    if (trendEl) {
      if (stats.completed === 0) {
        trendEl.textContent = "— let's begin";
        trendEl.className = 'stat-trend';
        trendEl.style.color = 'var(--text-muted)';
      } else if (stats.rate === 100) {
        trendEl.textContent = '↑ perfect score! 🌟';
        trendEl.className = 'stat-trend up';
        trendEl.style.color = 'var(--neon-green)';
      } else if (stats.rate >= 50) {
        trendEl.textContent = '↑ great progress';
        trendEl.className = 'stat-trend up';
        trendEl.style.color = 'var(--neon-green)';
      } else {
        trendEl.textContent = '↑ gaining momentum';
        trendEl.className = 'stat-trend up';
        trendEl.style.color = 'var(--neon-green)';
      }
    }

    // Smart AI Coach Recommendations
    if (typeof AIRecommendationService !== 'undefined') {
      AIRecommendationService.renderToDashboard();
    }

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
      
      let onboardingCompleted = true;
      if (DB.getMode() === 'firestore' && user && !user.isGuest) {
        try {
          const profile = await DB.getUserProfile();
          if (profile && profile.onboardingCompleted) {
            onboardingCompleted = true;
            // Pre-load default daily routine settings in ScheduleService
            const routine = await DB.getRoutine();
            if (routine && typeof ScheduleService !== 'undefined') {
              await ScheduleService.updateRoutine(ScheduleService.mapDbToInternal(routine));
            }
          } else {
            onboardingCompleted = false;
          }
        } catch (e) {
          console.warn('[App] Onboarding status check error:', e);
        }
      }

      if (DB.getMode() === 'firestore') {
        const loaded = await DB.loadFromFirestore();
        if (loaded) { Tasks.load(); Habits.load(); }
        if (onboardingCompleted) {
          showToast('☁ Cloud sync active — data saved to Firebase!', 'success', 3000);
        }
      }

      // If onboarding is NOT completed, trigger onboarding flow
      if (!onboardingCompleted && user && !user.isGuest) {
        if (typeof Onboarding !== 'undefined') {
          Onboarding.start(user);
        }
      } else {
        const obScreen = document.getElementById('onboarding-screen');
        if (obScreen) obScreen.style.display = 'none';
      }

      UI.showView(this.currentView);
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
    if (typeof AIRecommendationService !== 'undefined') {
      AIRecommendationService.initAutoRefresh();
    }

    // ── 7. Bind events ──
    this.bindEvents();

    if (!localStorage.getItem('nexus_welcomed')) {
      localStorage.setItem('nexus_welcomed', '1');
      setTimeout(() => showToast('Welcome to TACTIC! 🚀 Your productivity companion is ready.', 'info', 4000), 1500);
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
    
    // Hide quick actions when typing and auto-resize input
    $('ai-chat-input')?.addEventListener('input', e => {
      e.target.style.height = 'auto';
      e.target.style.height = e.target.scrollHeight + 'px';

      const quickActions = document.querySelector('.ai-quick-actions');
      if (quickActions) {
        if (e.target.value.trim().length > 0) quickActions.classList.add('hidden');
        else quickActions.classList.remove('hidden');
      }
    });

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
    $('add-habit-btn')?.addEventListener('click', async () => {
      const data = await window.tacticModal.open({ type: 'habit', title: 'Create Habit' });
      if (data) {
        Habits.createHabit(data);
        DB.saveHabits(Habits.getHabits());
        HabitsView.render();
        showToast('Habit created!', 'success');
      }
    });

    $('add-goal-btn')?.addEventListener('click', async () => {
      const data = await window.tacticModal.open({ type: 'goal', title: 'Create Goal' });
      if (data) {
        Habits.createGoal(data);
        DB.saveGoals(Habits.getGoals());
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
      if (e.altKey && e.key === 'n') { e.preventDefault(); TaskModal.open(); }
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

