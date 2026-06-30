'use strict';

const AIPlannerService = (() => {

  const timeToMins = (t) => {
    if (!t) return null;
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };

  const minsToTime = (m) => {
    if (m === null || m === undefined) return '';
    let wrapped = m % (24 * 60);
    if (wrapped < 0) wrapped += 24 * 60;
    const h = Math.floor(wrapped / 60).toString().padStart(2, '0');
    const mm = (wrapped % 60).toString().padStart(2, '0');
    return `${h}:${mm}`;
  };

  const scorePriority = (task, goals) => {
    let score = 0;
    if (task.priority === 'critical') score += 100;
    else if (task.priority === 'high') score += 75;
    else if (task.priority === 'medium') score += 50;
    else if (task.priority === 'low') score += 25;

    if (task.dueDate) {
      const today = new Date().toISOString().split('T')[0];
      if (task.dueDate === today) score += 50;
      else if (task.dueDate < today) score += 100; // Overdue
    }

    if (task.goalId) {
      score += 20; // Bonus for goal alignment
    }
    return score;
  };

  async function generateDailyPlan(uid) {
    console.log('[AIPlannerService] Generating plan for UID:', uid);
    
    // 1. Fetch Data
    const todayTasks = typeof Tasks !== 'undefined' ? Tasks.getByFilter('today') : [];
    const todayHabits = typeof Habits !== 'undefined' ? Habits.getHabits().filter(h => !h.completed) : [];
    const activeGoals = typeof Habits !== 'undefined' ? Habits.getGoals() : [];
    const routine = typeof ScheduleService !== 'undefined' ? (await ScheduleService.getRoutine() || {}) : {};
    
    const todayStr = new Date().toISOString().split('T')[0];
    
    // Default config fallbacks
    const studyDur = Number(routine.studyDurMins) || 60;
    const pomodoro = Number(routine.pomodoroMins) || 0;
    
    // Build initial fixed blocks
    const timeline = [];

    const addBlock = (name, startMins, endMins, type = 'fixed', meta = {}) => {
      if (startMins === null || endMins === null || startMins >= endMins) return;
      timeline.push({
        title: name,
        startMins,
        endMins,
        type,
        duration: endMins - startMins,
        ...meta
      });
    };

    // Calculate sleepMins to handle after-midnight sleep
    const getSleepMins = () => {
      if (!routine.sleep) return null;
      let s = timeToMins(routine.sleep);
      let w = timeToMins(routine.wakeUp) || 6 * 60;
      if (s < w) s += 24 * 60;
      return s;
    };
    const sleepMins = getSleepMins();

    // Step 1: Fixed blocks
    if (routine.wakeUp) addBlock('Wake Up & Morning Routine 🌅', timeToMins(routine.wakeUp), timeToMins(routine.wakeUp) + 30);
    if (routine.collegeStart && routine.collegeEnd) addBlock('College / Work 🏢', timeToMins(routine.collegeStart), timeToMins(routine.collegeEnd));
    
    const travel = Number(routine.travelTimeMins) || 0;
    if (travel > 0 && routine.collegeStart) {
      addBlock('Morning Commute 🚗', timeToMins(routine.collegeStart) - travel, timeToMins(routine.collegeStart));
    }
    if (travel > 0 && routine.collegeEnd) {
      addBlock('Evening Commute 🚗', timeToMins(routine.collegeEnd), timeToMins(routine.collegeEnd) + travel);
    }

    if (routine.lunchTime) addBlock('Lunch Break 🍱', timeToMins(routine.lunchTime), timeToMins(routine.lunchTime) + 45);
    if (routine.dinnerTime) addBlock('Dinner 🍽️', timeToMins(routine.dinnerTime), timeToMins(routine.dinnerTime) + 45);
    if (routine.gymTime) addBlock('Gym / Workout 💪', timeToMins(routine.gymTime), timeToMins(routine.gymTime) + 60);
    if (sleepMins !== null) addBlock('Wind down & Sleep 🌙', sleepMins - 30, sleepMins);

    // Calculate free time slots
    const getFreeSlots = () => {
      timeline.sort((a, b) => a.startMins - b.startMins);
      const slots = [];
      let currentMin = timeToMins(routine.wakeUp) ? timeToMins(routine.wakeUp) + 30 : 8 * 60;
      let endOfDay = sleepMins !== null ? sleepMins - 30 : 23 * 60;

      if (endOfDay < currentMin) endOfDay += 24 * 60;

      for (const block of timeline) {
        if (block.startMins > currentMin) {
          slots.push({ startMins: currentMin, endMins: block.startMins, duration: block.startMins - currentMin });
        }
        currentMin = Math.max(currentMin, block.endMins);
      }
      if (currentMin < endOfDay) {
        slots.push({ startMins: currentMin, endMins: endOfDay, duration: endOfDay - currentMin });
      }
      return slots.filter(s => s.duration >= 15);
    };

    let freeSlots = getFreeSlots();

    // Prioritize tasks
    const sortedTasks = [...todayTasks]
      .filter(t => t.status !== 'completed' && t.status !== 'cancelled')
      .sort((a, b) => scorePriority(b, activeGoals) - scorePriority(a, activeGoals));

    const totalTaskMins = sortedTasks.reduce((acc, t) => acc + (Number(t.estimatedMins) || 30), 0);
    const totalFreeMins = freeSlots.reduce((acc, s) => acc + s.duration, 0);

    const pushedToTomorrow = [];
    const scheduledTaskIds = [];
    let workloadStatus = 'Light';
    if (totalTaskMins > totalFreeMins) workloadStatus = 'Overloaded';
    else if (totalTaskMins > totalFreeMins * 0.7) workloadStatus = 'Heavy';
    else if (totalTaskMins > totalFreeMins * 0.4) workloadStatus = 'Moderate';

    // Schedule Tasks
    for (const task of sortedTasks) {
      let remainingTaskTime = Number(task.estimatedMins) || 30;
      
      if (workloadStatus === 'Overloaded' && (task.priority === 'low' || task.priority === 'medium') && !task.dueDate) {
        pushedToTomorrow.push(task);
        continue;
      }

      while (remainingTaskTime > 0) {
        freeSlots = getFreeSlots();
        if (freeSlots.length === 0) {
          pushedToTomorrow.push(task);
          break;
        }

        let bestSlot = freeSlots[0];
        const peakStart = timeToMins(routine.peakFocusStart);
        const peakEnd = timeToMins(routine.peakFocusEnd);

        if ((task.priority === 'high' || task.priority === 'critical') && peakStart && peakEnd) {
          const peakSlot = freeSlots.find(s => s.startMins >= peakStart && s.startMins < peakEnd);
          if (peakSlot) bestSlot = peakSlot;
        }

        const chunkDur = Math.min(remainingTaskTime, bestSlot.duration, studyDur);
        
        let confidence = 100;
        if (bestSlot.duration < chunkDur) confidence -= 20;
        if (task.priority === 'high' && (!peakStart || bestSlot.startMins > peakEnd)) confidence -= 15;

        addBlock(task.title, bestSlot.startMins, bestSlot.startMins + chunkDur, 'task', {
          taskId: task.id,
          priority: task.priority,
          category: task.category,
          confidence: Math.max(0, confidence)
        });

        remainingTaskTime -= chunkDur;

        if (remainingTaskTime > 0 && pomodoro > 0) {
          if (bestSlot.duration >= chunkDur + pomodoro) {
            addBlock('Break ☕', bestSlot.startMins + chunkDur, bestSlot.startMins + chunkDur + pomodoro, 'break');
          }
        }
        
        if (!scheduledTaskIds.includes(task.id)) {
          scheduledTaskIds.push(task.id);
        }
      }
    }

    // Schedule Habits
    for (const habit of todayHabits) {
      freeSlots = getFreeSlots();
      if (freeSlots.length === 0) break;
      
      let bestSlot = freeSlots[0];
      addBlock(habit.name, bestSlot.startMins, bestSlot.startMins + 15, 'habit', {
        habitId: habit.id,
        confidence: 80
      });
    }

    timeline.sort((a, b) => a.startMins - b.startMins);

    // Calculate Remaining Free Study Time
    const finalFreeSlots = getFreeSlots();
    const remainingStudyMins = finalFreeSlots.reduce((acc, s) => acc + s.duration, 0);
    
    // Generate Goal Suggestions
    const goalSuggestions = [];
    if (remainingStudyMins > 0 && activeGoals.length > 0) {
      finalFreeSlots.forEach((slot, index) => {
        // Pick a goal (could cycle through them)
        const goal = activeGoals[index % activeGoals.length];
        goalSuggestions.push({
          goalTitle: goal.title,
          startTime: minsToTime(slot.startMins),
          endTime: minsToTime(slot.endMins),
          duration: slot.duration,
          reason: totalTaskMins === 0 
            ? 'You currently have no scheduled study tasks and this goal is active.'
            : 'You still have flexible study time after completing today\'s planned work.'
        });
      });
    }

    // Build Strategy
    const totalScheduledTasks = scheduledTaskIds.length;
    const strategyText = [];
    strategyText.push(`• Total Tasks Scheduled: ${totalScheduledTasks}`);
    strategyText.push(`• Total Habits Scheduled: ${todayHabits.length}`);
    strategyText.push(`• Estimated Productive Hours: ${(totalTaskMins / 60).toFixed(1)}h`);
    strategyText.push(`• Free Time Remaining: ${Math.floor(remainingStudyMins / 60)}h ${remainingStudyMins % 60}m`);
    
    if (pushedToTomorrow.length > 0) {
      strategyText.push(`\n**Note**: Due to time constraints, ${pushedToTomorrow.length} lower-priority task(s) were pushed to tomorrow.`);
    }

    let recommendation = '';
    if (routine.peakFocusStart && routine.peakFocusEnd) {
      recommendation = `Your highest concentration period is between ${routine.peakFocusStart} and ${routine.peakFocusEnd}. We've optimized your schedule to tackle the hardest tasks during this window. `;
    }
    if (studyDur > 0) {
      recommendation += `Tasks longer than ${studyDur} minutes have been automatically split to reduce fatigue.`;
    }

    let studyAnalysis = '';
    if (remainingStudyMins > 0) {
      const h = Math.floor(remainingStudyMins / 60);
      const m = remainingStudyMins % 60;
      const timeStr = `${h > 0 ? h + ' hours' : ''} ${m > 0 ? m + ' minutes' : ''}`.trim();
      
      if (totalTaskMins === 0) {
        studyAnalysis = `You have approximately ${timeStr} of productive study time remaining today. Since no additional academic tasks are scheduled, this time can be invested toward your active long-term goals.`;
      } else {
        studyAnalysis = `You still have ${timeStr} of flexible study time after completing today's planned work. Consider revising a weak subject or making progress toward your active goals.`;
      }
    } else {
      studyAnalysis = `Your schedule is completely full today. Focus on executing your planned tasks.`;
    }

    const planData = {
      generatedAt: new Date().toISOString(),
      strategy: {
        summary: strategyText.join('\n'),
        workload: workloadStatus,
        recommendation: recommendation,
        studyAnalysis: studyAnalysis,
        motivation: 'Every small step forward is a victory. Stick to the plan and you will crush it today! 🚀'
      },
      timeline: timeline.map(b => ({
        ...b,
        startTime: minsToTime(b.startMins),
        endTime: minsToTime(b.endMins)
      })),
      routineSnapshot: routine,
      taskIds: scheduledTaskIds,
      habitIds: todayHabits.map(h => h.id),
      remainingStudyMins: remainingStudyMins,
      goalSuggestions: goalSuggestions
    };

    if (typeof DB !== 'undefined') {
      await DB.saveDailyPlan(todayStr, planData);
    }

    return planData;
  }

  return { generateDailyPlan };
})();
