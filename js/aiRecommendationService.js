/**
 * AIRecommendationService.js
 * Smart AI Coach that proactively guides the user throughout the day.
 */

const AIRecommendationService = {
  getRecommendations() {
    const tasks = (typeof Tasks !== 'undefined') ? Tasks.getAll() : [];
    const habits = (typeof Habits !== 'undefined' && Habits.getHabits) ? Habits.getHabits() : [];
    const goals = (typeof Habits !== 'undefined' && Habits.getGoals) ? Habits.getGoals() : [];
    
    let routine = null;
    if (typeof ScheduleService !== 'undefined' && ScheduleService.getRoutine) {
      routine = ScheduleService.getRoutine();
    }

    const now = new Date();
    const todayStr = now.toDateString();
    
    const recs = {
      doNext: null,
      studyWindow: null,
      growth: null
    };

    // Filter Tasks
    const overdueTasks = tasks.filter(t => !t.completed && t.dueDate && new Date(t.dueDate) < new Date(todayStr));
    const todayTasks = tasks.filter(t => {
      if (t.completed || !t.dueDate) return false;
      return new Date(t.dueDate).toDateString() === todayStr;
    });
    const pendingTasks = tasks.filter(t => !t.completed);

    // ==========================================
    // Priority 1-3: DO NEXT
    // ==========================================
    if (overdueTasks.length > 0) {
      const topTask = overdueTasks.sort((a, b) => (b.priority === 'high' ? 1 : -1))[0];
      recs.doNext = {
        title: topTask.title,
        subtitle: '🔥 DO NEXT',
        desc: `Split it into two Pomodoro sessions and complete the first session during your next available focus block.`,
        confidence: 98,
        icon: '🚨'
      };
    } else if (todayTasks.length > 0) {
      const topTask = todayTasks.sort((a, b) => (b.priority === 'high' ? 1 : -1))[0];
      recs.doNext = {
        title: topTask.title,
        subtitle: '🔥 DO NEXT',
        desc: `Complete it before dinner to avoid becoming overdue.`,
        confidence: 95,
        icon: '📌'
      };
    } else if (pendingTasks.length > 0) {
      const bestTask = pendingTasks.sort((a, b) => (b.priority === 'high' ? 1 : -1))[0];
      recs.doNext = {
        title: bestTask.title,
        subtitle: '🔥 DO NEXT',
        desc: `It fits perfectly into your available study window.`,
        confidence: 85,
        icon: '🔥'
      };
    } else {
      recs.doNext = {
        title: 'All caught up!',
        subtitle: '🔥 DO NEXT',
        desc: `You have completed all your tasks. Enjoy your free time!`,
        confidence: 100,
        icon: '✨'
      };
    }

    // ==========================================
    // Priority 4: BEST STUDY WINDOW
    // ==========================================
    if (routine && routine.peakFocusStart && routine.peakFocusEnd) {
      recs.studyWindow = {
        title: `${routine.peakFocusStart} – ${routine.peakFocusEnd}`,
        subtitle: '📚 BEST STUDY WINDOW',
        desc: `Peak Focus Hours. No interruptions expected. Highest concentration period.`,
        confidence: 92,
        icon: '🧠'
      };
    } else {
      recs.studyWindow = {
        title: `7:30 PM – 9:00 PM`,
        subtitle: '📚 BEST STUDY WINDOW',
        desc: `You still have productive study time available today. Use this time for revision or assignments.`,
        confidence: 80,
        icon: '⏳'
      };
    }

    // ==========================================
    // Priority 5-8: GROWTH SUGGESTION
    // ==========================================
    const activeGoals = goals.filter(g => !g.completed && g.progress < 100);
    
    // Check incomplete habits for today
    const yyyyMmDd = now.toISOString().split('T')[0];
    const incompleteHabits = habits.filter(h => {
      // Habit schema typically stores history as array of date strings
      return h.history ? !h.history.includes(yyyyMmDd) : true;
    });

    if (activeGoals.length > 0) {
      const goal = activeGoals[0];
      recs.growth = {
        title: `Work on ${goal.title}`,
        subtitle: '🎯 GROWTH SUGGESTION',
        desc: `No urgent tasks are scheduled after dinner and this aligns with your long-term goal.`,
        confidence: 88,
        icon: '🎯'
      };
    } else if (incompleteHabits.length > 0) {
      const habit = incompleteHabits[0];
      recs.growth = {
        title: `Finish ${habit.name} Habit`,
        subtitle: '🎯 GROWTH SUGGESTION',
        desc: `Completing it before sleep helps maintain your streak.`,
        confidence: 85,
        icon: '🌱'
      };
    } else {
      const completedToday = tasks.filter(t => t.completed && t.completedAt && new Date(t.completedAt).toDateString() === todayStr).length;
      recs.growth = {
        title: `Great Progress!`,
        subtitle: '🎯 GROWTH SUGGESTION',
        desc: `You have completed ${completedToday} tasks today. Today is a great day to make progress on your long-term goals.`,
        confidence: 94,
        icon: '📈'
      };
    }

    return recs;
  },

  renderToDashboard() {
    const container = document.getElementById('ai-recommendation-grid');
    if (!container) return;

    const recs = this.getRecommendations();
    
    const createCard = (rec) => {
      if (!rec) return '';
      return `
        <div class="ai-rec-card">
          <div class="ai-rec-header">
            <div class="ai-rec-subtitle-wrapper">
              <span class="ai-rec-subtitle">${rec.subtitle}</span>
            </div>
            <div class="ai-rec-confidence">
              <span class="confidence-dot"></span>
              AI Confidence: ${rec.confidence}%
            </div>
          </div>
          <h4 class="ai-rec-title">${rec.icon} ${rec.title}</h4>
          <p class="ai-rec-desc">${rec.desc}</p>
        </div>
      `;
    };

    container.innerHTML = `
      ${createCard(recs.doNext)}
      ${createCard(recs.studyWindow)}
      ${createCard(recs.growth)}
    `;
  },
  
  initAutoRefresh() {
    // Auto-refresh recommendations every 5 minutes
    setInterval(() => {
      if (typeof Dashboard !== 'undefined' && Dashboard.render) {
        Dashboard.render();
      }
    }, 5 * 60 * 1000);
  }
};

window.AIRecommendationService = AIRecommendationService;
