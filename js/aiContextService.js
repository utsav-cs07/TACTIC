/**
 * AIContextService.js
 * Generates the complete productivity context for the AI Assistant.
 */

const AIContextService = {
  buildContext() {
    const tasks = typeof Tasks !== 'undefined' ? Tasks.getAll() : [];
    const habits = typeof Habits !== 'undefined' && Habits.getHabits ? Habits.getHabits() : [];
    const goals = typeof Habits !== 'undefined' && Habits.getGoals ? Habits.getGoals() : [];
    const routine = typeof ScheduleService !== 'undefined' && ScheduleService.getRoutine ? ScheduleService.getRoutine() : null;
    const stats = typeof Tasks !== 'undefined' ? Tasks.getStats() : {};
    
    const now = new Date();
    const todayStr = now.toDateString();

    const pendingTasks = tasks.filter(t => !t.completed);
    const completedTasksToday = tasks.filter(t => t.completed && t.completedAt && new Date(t.completedAt).toDateString() === todayStr);
    const overdueTasks = tasks.filter(t => !t.completed && t.dueDate && new Date(t.dueDate) < new Date(todayStr));
    const todayTasks = tasks.filter(t => !t.completed && t.dueDate && new Date(t.dueDate).toDateString() === todayStr);
    const activeGoals = goals.filter(g => !g.completed && g.progress < 100);
    
    let userName = "User";
    if (typeof Auth !== 'undefined') {
      const user = Auth.getUser();
      if (user && user.displayName) {
        userName = user.displayName;
      } else if (user && !user.isGuest && typeof DB !== 'undefined' && DB.getCachedProfile) {
        const profile = DB.getCachedProfile();
        if (profile && profile.fullName) userName = profile.fullName;
      }
    }

    // Attempt to calculate available time loosely based on routine
    let remainingStudyTimeMins = 0;
    if (routine) {
        const parseTime = (t) => {
            if (!t) return null;
            const [h, m] = t.split(':').map(Number);
            const d = new Date();
            d.setHours(h, m, 0, 0);
            return d;
        };
        const workEnd = routine.collegeEnd || routine.workEndTime ? parseTime(routine.collegeEnd || routine.workEndTime) : null;
        const sleep = parseTime(routine.sleepTime || '23:00');
        const wake = parseTime(routine.wakeUpTime || '07:00');
        
        if (sleep) {
            if (workEnd) {
                // Normal College Day
                if (now >= workEnd && now < sleep) {
                    remainingStudyTimeMins = Math.floor((sleep - now) / 60000);
                } else if (now < workEnd) {
                    remainingStudyTimeMins = Math.floor((sleep - workEnd) / 60000);
                }
            } else {
                // Holiday Mode (No College)
                if (now < sleep) {
                    const startCount = Math.max(now.getTime(), wake ? wake.getTime() : now.getTime());
                    remainingStudyTimeMins = Math.floor((sleep.getTime() - startCount) / 60000);
                }
            }
        }
    }

    return {
      userName,
      currentTime: now.toLocaleTimeString(),
      currentDate: todayStr,
      remainingStudyTimeMins,
      stats,
      routine,
      pendingTasks: pendingTasks.map(t => ({ id: t.id, title: t.title, priority: t.priority, estimatedMins: t.estimatedMins, category: t.category })),
      completedTasksToday: completedTasksToday.map(t => t.title),
      overdueTasks: overdueTasks.map(t => t.title),
      todayTasks: todayTasks.map(t => ({ title: t.title, priority: t.priority })),
      habits: habits.map(h => h.name),
      activeGoals: activeGoals.map(g => ({ title: g.title, progress: g.progress }))
    };
  }
};

window.AIContextService = AIContextService;
