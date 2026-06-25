/* ═══════════════════════════════════════════
   TASKS.JS — Task Data Model & Storage
═══════════════════════════════════════════ */
'use strict';

const Tasks = (() => {
  const STORAGE_KEY = 'nexus_tasks';
  const LIST_KEY    = 'nexus_lists';

  const defaultLists = [
    { id: 'all',      name: 'All Tasks',  icon: '⚡', color: '#00d4ff' },
    { id: 'work',     name: 'Work',       icon: '💼', color: '#a855f7' },
    { id: 'personal', name: 'Personal',   icon: '🌱', color: '#00ff88' },
    { id: 'shopping', name: 'Shopping',   icon: '🛍️', color: '#ffb800' },
    { id: 'health',   name: 'Health',     icon: '💊', color: '#ff3366' },
  ];

  let tasks = [];
  let lists = [...defaultLists];

  // ── Load / Save ──
  function load() {
    try {
      const t = localStorage.getItem(STORAGE_KEY);
      const l = localStorage.getItem(LIST_KEY);
      tasks = t ? JSON.parse(t) : getSampleTasks();
      lists = l ? JSON.parse(l) : [...defaultLists];
    } catch {
      tasks = getSampleTasks();
      lists = [...defaultLists];
    }
  }

  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    localStorage.setItem(LIST_KEY, JSON.stringify(lists));
  }

  // ── Sample Data ──
  function getSampleTasks() {
    const now = new Date();
    const d = (offsetDays, h = 10, m = 0) => {
      const dt = new Date(now);
      dt.setDate(dt.getDate() + offsetDays);
      dt.setHours(h, m, 0, 0);
      return dt.toISOString();
    };

    return [
      { id: uid(), title: 'Finalize hackathon presentation deck', desc: 'Prepare slides covering problem statement, solution, demo, and impact', priority: 'critical', category: 'work',     dueDate: d(0, 17, 0),  completed: false, subtasks: [{ t: 'Problem slide', done: true }, { t: 'Demo screenshot', done: false }], tags: ['hackathon', 'urgent'], estimatedMins: 120, createdAt: d(-1), repeat: null },
      { id: uid(), title: 'Code review for feature branch', desc: '',           priority: 'high',     category: 'work',     dueDate: d(0, 14, 0),  completed: false, subtasks: [], tags: ['code'],     estimatedMins: 45,  createdAt: d(-1), repeat: null },
      { id: uid(), title: 'Team standup call', desc: 'Daily sync at noon',      priority: 'medium',   category: 'work',     dueDate: d(0, 12, 0),  completed: true,  subtasks: [], tags: ['meeting'],  estimatedMins: 30,  createdAt: d(-2), repeat: 'daily' },
      { id: uid(), title: 'Gym session — leg day', desc: '',                    priority: 'medium',   category: 'health',   dueDate: d(0, 18, 30), completed: false, subtasks: [], tags: ['fitness'],  estimatedMins: 60,  createdAt: d(-1), repeat: null },
      { id: uid(), title: 'Submit project report',  desc: 'Final report PDF',   priority: 'critical', category: 'work',     dueDate: d(1, 23, 59), completed: false, subtasks: [{ t: 'Write conclusion', done: false }, { t: 'Add references', done: false }], tags: ['deadline'], estimatedMins: 90, createdAt: d(-3), repeat: null },
      { id: uid(), title: 'Buy groceries', desc: 'Milk, eggs, bread, fruits',   priority: 'low',      category: 'shopping', dueDate: d(1, 19, 0),  completed: false, subtasks: [], tags: [],           estimatedMins: 30,  createdAt: d(-1), repeat: null },
      { id: uid(), title: 'Read design systems book', desc: '2 chapters',       priority: 'low',      category: 'personal', dueDate: d(3, 21, 0),  completed: false, subtasks: [], tags: ['learning'], estimatedMins: 50,  createdAt: d(-2), repeat: null },
      { id: uid(), title: 'Doctor appointment', desc: 'Annual checkup',         priority: 'high',     category: 'health',   dueDate: d(2, 11, 0),  completed: false, subtasks: [], tags: ['health'],   estimatedMins: 60,  createdAt: d(-2), repeat: null },
      { id: uid(), title: 'Pay monthly bills', desc: 'Electricity + internet',  priority: 'high',     category: 'personal', dueDate: d(2, 20, 0),  completed: false, subtasks: [], tags: ['finance'],  estimatedMins: 15,  createdAt: d(-1), repeat: 'monthly' },
      { id: uid(), title: 'Meditation morning routine', desc: '15 mins',        priority: 'low',      category: 'health',   dueDate: d(0, 7, 0),   completed: true,  subtasks: [], tags: ['wellness'], estimatedMins: 15,  createdAt: d(-5), repeat: 'daily' },
    ];
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  // ── CRUD ──
  function getAll()  { return [...tasks]; }
  function getLists() { return [...lists]; }

  function getById(id) { return tasks.find(t => t.id === id); }

  function create(data) {
    const task = {
      id:           uid(),
      title:        data.title || 'Untitled Task',
      desc:         data.desc || '',
      priority:     data.priority || 'medium',
      category:     data.category || 'personal',
      dueDate:      data.dueDate || null,
      completed:    false,
      subtasks:     data.subtasks || [],
      tags:         data.tags || [],
      estimatedMins: data.estimatedMins || 30,
      repeat:       data.repeat || null,
      createdAt:    new Date().toISOString(),
    };
    tasks.unshift(task);
    save();
    return task;
  }

  function update(id, data) {
    const idx = tasks.findIndex(t => t.id === id);
    if (idx === -1) return null;
    tasks[idx] = { ...tasks[idx], ...data };
    save();
    return tasks[idx];
  }

  function toggle(id) {
    const task = getById(id);
    if (!task) return null;
    return update(id, { completed: !task.completed });
  }

  function remove(id) {
    tasks = tasks.filter(t => t.id !== id);
    save();
  }

  function createList(name, icon = '📋', color = '#00d4ff') {
    const list = { id: uid(), name, icon, color };
    lists.push(list);
    save();
    return list;
  }

  // ── Filters ──
  function getByFilter(filter, listId) {
    const now = new Date();
    const startOfDay = (d) => { const x = new Date(d); x.setHours(0,0,0,0); return x; };
    const today = startOfDay(now);
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
    const weekEnd  = new Date(today); weekEnd.setDate(weekEnd.getDate() + 7);

    let filtered = [...tasks];

    // Category filter
    if (listId && listId !== 'all') {
      filtered = filtered.filter(t => t.category === listId);
    }

    switch (filter) {
      case 'today':
        return filtered.filter(t => t.dueDate && startOfDay(new Date(t.dueDate)).getTime() === today.getTime() && !t.completed);
      case 'tomorrow':
        return filtered.filter(t => t.dueDate && startOfDay(new Date(t.dueDate)).getTime() === tomorrow.getTime() && !t.completed);
      case 'week':
        return filtered.filter(t => t.dueDate && new Date(t.dueDate) >= today && new Date(t.dueDate) <= weekEnd && !t.completed);
      case 'overdue':
        return filtered.filter(t => t.dueDate && new Date(t.dueDate) < now && !t.completed);
      case 'completed':
        return filtered.filter(t => t.completed);
      default:
        return filtered.filter(t => !t.completed);
    }
  }

  function search(query) {
    const q = query.toLowerCase();
    return tasks.filter(t => t.title.toLowerCase().includes(q) || t.desc.toLowerCase().includes(q) || t.tags.some(tag => tag.includes(q)));
  }

  // ── Stats ──
  function getStats() {
    const total     = tasks.length;
    const completed = tasks.filter(t => t.completed).length;
    const overdue   = tasks.filter(t => t.dueDate && new Date(t.dueDate) < new Date() && !t.completed).length;
    const pending   = total - completed;
    const today     = getByFilter('today').length;
    const rate      = total ? Math.round((completed / total) * 100) : 0;
    return { total, completed, pending, overdue, today, rate };
  }

  function getWeeklyData() {
    const data = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i); d.setHours(0,0,0,0);
      const next = new Date(d); next.setDate(next.getDate() + 1);
      const done = tasks.filter(t => t.completed && t.dueDate && new Date(t.dueDate) >= d && new Date(t.dueDate) < next).length;
      const due  = tasks.filter(t => t.dueDate && new Date(t.dueDate) >= d && new Date(t.dueDate) < next).length;
      data.push({ label: d.toLocaleDateString('en', { weekday: 'short' }), done, due });
    }
    return data;
  }

  return { load, save, getAll, getLists, getById, create, update, toggle, remove, createList, getByFilter, search, getStats, getWeeklyData, uid };
})();
