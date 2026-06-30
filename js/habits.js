/* ═══════════════════════════════════════════
   HABITS.JS — Habits & Goal Tracking
═══════════════════════════════════════════ */
'use strict';

const Habits = (() => {
  const STORAGE_KEY = 'nexus_habits';
  const GOAL_KEY    = 'nexus_goals';

  let habits = [];
  let goals  = [];

  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 5); }

  function load() {
    try {
      const hStr = localStorage.getItem(STORAGE_KEY);
      const gStr = localStorage.getItem(GOAL_KEY);
      const isAuth = typeof Auth !== 'undefined' && Auth.isLoggedIn();
      
      let parsedHabits = hStr ? JSON.parse(hStr) : (isAuth ? [] : getSampleHabits());
      let parsedGoals  = gStr ? JSON.parse(gStr) : (isAuth ? [] : getSampleGoals());
      
      if (isAuth) {
        parsedHabits = parsedHabits.filter(h => !h.isDemo);
        parsedGoals = parsedGoals.filter(g => !g.isDemo);
      }
      
      habits = parsedHabits;
      goals = parsedGoals;
    } catch {
      const isAuth = typeof Auth !== 'undefined' && Auth.isLoggedIn();
      habits = isAuth ? [] : getSampleHabits();
      goals  = isAuth ? [] : getSampleGoals();
    }
  }

  function save() {
    if (window.isGuestMode) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(habits));
    localStorage.setItem(GOAL_KEY, JSON.stringify(goals));
  }

  function setDemoData(demoHabits) {
    habits = demoHabits;
  }

  function setDemoGoals(demoGoals) {
    goals = demoGoals;
  }

  function getSampleHabits() {
    return [
      { id: uid(), isDemo: true, name: 'Morning meditation', icon: '🧘', color: '#a855f7', streak: 7,  completedDates: generatePastDates(7),  target: 'daily',   createdAt: new Date(Date.now() - 7*864e5).toISOString() },
      { id: uid(), isDemo: true, name: 'Exercise 30 mins',   icon: '🏃', color: '#00ff88', streak: 14, completedDates: generatePastDates(14), target: 'daily',   createdAt: new Date(Date.now() - 14*864e5).toISOString() },
      { id: uid(), isDemo: true, name: 'Read 20 pages',       icon: '📚', color: '#00d4ff', streak: 5,  completedDates: generatePastDates(5),  target: 'daily',   createdAt: new Date(Date.now() - 5*864e5).toISOString() },
      { id: uid(), isDemo: true, name: 'Drink 8 glasses water', icon: '💧', color: '#3b82f6', streak: 21, completedDates: generatePastDates(21), target: 'daily', createdAt: new Date(Date.now() - 21*864e5).toISOString() },
      { id: uid(), isDemo: true, name: 'Weekly deep work',   icon: '⚡', color: '#ffb800', streak: 3,  completedDates: generatePastWeeks(3), target: 'weekly',  createdAt: new Date(Date.now() - 21*864e5).toISOString() },
    ];
  }

  function getSampleGoals() {
    return [
      { id: uid(), isDemo: true, title: 'Launch personal project', icon: '🚀', deadline: new Date(Date.now() + 30*864e5).toISOString(), milestones: [{ t: 'Design MVP', done: true }, { t: 'Build core features', done: true }, { t: 'User testing', done: false }, { t: 'Launch', done: false }], color: '#00d4ff' },
      { id: uid(), isDemo: true, title: 'Get fit for summer',       icon: '💪', deadline: new Date(Date.now() + 60*864e5).toISOString(), milestones: [{ t: 'Set workout schedule', done: true }, { t: 'Lose 5kg', done: false }, { t: 'Run 5K', done: false }], color: '#00ff88' },
      { id: uid(), isDemo: true, title: 'Learn new skill (ML)',     icon: '🧠', deadline: new Date(Date.now() + 90*864e5).toISOString(), milestones: [{ t: 'Finish online course', done: true }, { t: 'Build practice project', done: false }, { t: 'Apply at work', done: false }], color: '#a855f7' },
    ];
  }

  function generatePastDates(n) {
    const dates = [];
    for (let i = 0; i < n; i++) {
      const d = new Date(); d.setDate(d.getDate() - i);
      dates.push(d.toDateString());
    }
    return dates;
  }

  function generatePastWeeks(n) {
    const dates = [];
    for (let i = 0; i < n; i++) {
      const d = new Date(); d.setDate(d.getDate() - i * 7);
      dates.push(d.toDateString());
    }
    return dates;
  }

  // ── Habit CRUD ──
  function getHabits() { return [...habits]; }
  function getGoals()  { return [...goals]; }

  function createHabit(data) {
    const h = { id: uid(), name: data.name, icon: data.icon || '⭐', color: data.color || '#00d4ff', streak: 0, completedDates: [], target: data.target || 'daily', createdAt: new Date().toISOString() };
    habits.push(h);
    save();
    return h;
  }

  function toggleHabitToday(id) {
    const h = habits.find(x => x.id === id);
    if (!h) return;
    const today = new Date().toDateString();
    const idx = h.completedDates.indexOf(today);
    if (idx === -1) {
      h.completedDates.push(today);
      h.streak = calcStreak(h.completedDates);
    } else {
      h.completedDates.splice(idx, 1);
      h.streak = calcStreak(h.completedDates);
    }
    save();
    return h;
  }

  function isDoneToday(habit) {
    return habit.completedDates.includes(new Date().toDateString());
  }

  function calcStreak(dates) {
    let streak = 0;
    const today = new Date();
    for (let i = 0; i < 365; i++) {
      const d = new Date(today); d.setDate(d.getDate() - i);
      if (dates.includes(d.toDateString())) streak++;
      else if (i > 0) break;
    }
    return streak;
  }

  function deleteHabit(id) { habits = habits.filter(h => h.id !== id); save(); }

  function createGoal(data) {
    const g = { id: uid(), title: data.title, icon: data.icon || '🎯', deadline: data.deadline || null, milestones: data.milestones || [], color: data.color || '#00d4ff' };
    goals.push(g);
    save();
    return g;
  }

  function toggleMilestone(goalId, idx) {
    const g = goals.find(x => x.id === goalId);
    if (!g || !g.milestones[idx]) return;
    g.milestones[idx].done = !g.milestones[idx].done;
    save();
    return g;
  }

  function addMilestone(goalId, title) {
    const g = goals.find(x => x.id === goalId);
    if (!g) return;
    g.milestones.push({ t: title, done: false });
    save();
    return g;
  }

  function deleteGoal(id) {
    goals = goals.filter(g => g.id !== id);
    save();
  }

  function getGoalProgress(goal) {
    if (!goal.milestones.length) return 0;
    return Math.round((goal.milestones.filter(m => m.done).length / goal.milestones.length) * 100);
  }

  // Build heatmap data (last 52 weeks × 7 days = 364 days)
  function getHeatmapData(habit) {
    const cells = [];
    const today = new Date();
    for (let i = 363; i >= 0; i--) {
      const d = new Date(today); d.setDate(d.getDate() - i);
      cells.push({ date: d.toDateString(), done: habit.completedDates.includes(d.toDateString()) });
    }
    return cells;
  }

  return { load, save, getHabits, getGoals, createHabit, toggleHabitToday, isDoneToday, calcStreak, deleteHabit, createGoal, toggleMilestone, addMilestone, deleteGoal, getGoalProgress, getHeatmapData, setDemoData, setDemoGoals, get habits() { return habits; }, set habits(v) { habits = v; } };
})();
