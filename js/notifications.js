/* ═══════════════════════════════════════════
   NOTIFICATIONS.JS — Browser Notifications
═══════════════════════════════════════════ */
'use strict';

const Notifications = (() => {
  let permission = 'default';
  let timers = [];

  async function init() {
    if (!('Notification' in window)) return;
    permission = Notification.permission;
    
    // Auto-request if not already granted/denied
    if (permission === 'default') {
      try {
        permission = await Notification.requestPermission();
      } catch (e) {}
    }
    
    // Hide the red dot if we have permission
    if (permission === 'granted') {
      const dot = document.querySelector('#notif-btn .notif-dot');
      if (dot) dot.style.display = 'none';
    }
  }

  async function requestPermission() {
    if (!('Notification' in window)) return false;
    permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  function send(title, body, icon = '⚡') {
    if (permission !== 'granted') return;
    try {
      const n = new Notification(title, {
        body,
        icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">' + icon + '</text></svg>',
        badge: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" fill="%2300d4ff"/></svg>',
        tag: 'nexus-' + Date.now(),
        requireInteraction: false,
      });
      setTimeout(() => n.close(), 5000);
    } catch (e) {}
  }

  function scheduleTaskReminder(task) {
    if (!task.dueDate) return;
    const due = new Date(task.dueDate);
    const now = new Date();

    // 1 hour before
    const oneHour = new Date(due.getTime() - 36e5);
    if (oneHour > now) {
      const delay = oneHour - now;
      const t = setTimeout(() => send(`⏰ Due in 1 hour`, task.title, '⏰'), delay);
      timers.push(t);
    }

    // 15 min before
    const fifteenMin = new Date(due.getTime() - 9e5);
    if (fifteenMin > now) {
      const delay = fifteenMin - now;
      const t = setTimeout(() => send(`🚨 Due in 15 minutes!`, task.title, '🚨'), delay);
      timers.push(t);
    }
  }

  function scheduleMorningBriefing(tasks) {
    const now = new Date();
    const brief = new Date(now);
    brief.setHours(9, 0, 0, 0);
    if (brief <= now) brief.setDate(brief.getDate() + 1);
    const delay = brief - now;
    const today = tasks.filter(t => {
      if (!t.dueDate) return false;
      const d = new Date(t.dueDate);
      return d.toDateString() === brief.toDateString() && !t.completed;
    });
    const t = setTimeout(() => {
      send('🌅 Good morning! Here\'s your day', `${today.length} tasks due today. Let's crush it!`, '🌅');
    }, delay);
    timers.push(t);
  }

  function clearAll() {
    timers.forEach(t => clearTimeout(t));
    timers = [];
  }

  function scheduleAll(tasks) {
    clearAll();
    tasks.filter(t => !t.completed && t.dueDate).forEach(scheduleTaskReminder);
    scheduleMorningBriefing(tasks);
  }

  return { init, requestPermission, send, scheduleAll, clearAll };
})();
