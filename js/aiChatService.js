/**
 * AIChatService.js
 * Processes user queries using the context from AIContextService.
 * Returns structured responses (Answer, Reasoning, Recommended Action).
 * Designed to be replaced by Gemini in the future.
 */

const AIChatService = {
  processQuery(query, context) {
    const q = query.toLowerCase().trim();
    
    const response = {
      answer: "",
      reasoning: "",
      action: "",
      confidence: 0
    };

    const hasTasks = context.pendingTasks && context.pendingTasks.length > 0;
    const totalTimeMins = context.remainingStudyTimeMins || 120; // fallback to 2h

    // Intent 1: "Can I finish everything today?" or "Can I finish today?"
    if (q.includes("can i finish") || q.includes("time to finish")) {
      const estimatedTotal = context.pendingTasks.reduce((acc, t) => acc + (t.estimatedMins || 30), 0);
      
      if (!hasTasks) {
        response.answer = "Yes, you have already finished everything!";
        response.reasoning = "There are no pending tasks left for today.";
        response.action = "Relax or work on a long-term goal.";
        response.confidence = 100;
      } else if (estimatedTotal <= totalTimeMins) {
        response.answer = "Yes, you can comfortably complete everything today.";
        response.reasoning = `You have approximately ${Math.floor(totalTimeMins / 60)}h ${totalTimeMins % 60}m of free time, and your remaining tasks only take about ${Math.floor(estimatedTotal / 60)}h ${estimatedTotal % 60}m.`;
        response.action = `Start with your highest priority task: ${context.pendingTasks[0].title}.`;
        response.confidence = 92;
      } else {
        response.answer = "It will be very tight, and you might not finish everything.";
        response.reasoning = `Your tasks require about ${Math.floor(estimatedTotal / 60)}h ${estimatedTotal % 60}m, but you only have ~${Math.floor(totalTimeMins / 60)}h ${totalTimeMins % 60}m available.`;
        response.action = "Focus only on 'Critical' and 'High' priority tasks today. Postpone the rest to tomorrow.";
        response.confidence = 88;
      }
      return response;
    }

    // Intent 2: "What should I do next?" or "What's my biggest priority?"
    if (q.includes("what should i do next") || q.includes("biggest priority") || q.includes("prioritize my tasks")) {
      if (!hasTasks) {
        response.answer = "You are completely caught up.";
        response.reasoning = "Your task list is currently empty.";
        response.action = context.activeGoals.length > 0 ? `Spend some time on your goal: ${context.activeGoals[0].title}.` : "Take a well-deserved break.";
        response.confidence = 98;
      } else {
        const topTask = [...context.pendingTasks].sort((a, b) => {
          const p = { critical: 4, high: 3, medium: 2, low: 1 };
          return (p[b.priority] || 0) - (p[a.priority] || 0);
        })[0];
        
        response.answer = `You should start working on: ${topTask.title}.`;
        response.reasoning = `This is currently your highest priority (${topTask.priority}) pending task.`;
        response.action = `Break it down into a ${topTask.estimatedMins || 25}-minute Pomodoro session right now.`;
        response.confidence = 95;
      }
      return response;
    }

    // Intent 3: "What should I study tonight?" or "When should I study?"
    if (q.includes("what should i study") || q.includes("when should i study")) {
      const studyTasks = context.pendingTasks.filter(t => t.category === 'work' || t.category === 'study');
      const timeStr = (context.routine && context.routine.peakFocusStart) 
        ? `${context.routine.peakFocusStart} to ${context.routine.peakFocusEnd}` 
        : `your evening block`;

      if (studyTasks.length > 0) {
        response.answer = `You should study ${studyTasks[0].title}.`;
        response.reasoning = `This matches your academic/work category and is pending.`;
        response.action = `Study this during your peak focus window: ${timeStr}.`;
        response.confidence = 90;
      } else if (context.activeGoals.length > 0) {
        response.answer = `Focus on your long-term goal: ${context.activeGoals[0].title}.`;
        response.reasoning = `You have no immediate study assignments due, making this the perfect time for long-term progress.`;
        response.action = `Dedicate 45 minutes to this during ${timeStr}.`;
        response.confidence = 85;
      } else {
        response.answer = "You have no urgent study tasks.";
        response.reasoning = "All immediate academic and work tasks are cleared.";
        response.action = "Read a book or catch up on a personal hobby tonight.";
        response.confidence = 88;
      }
      return response;
    }

    // Intent 4: "Can I postpone..." or "Should I postpone anything?"
    if (q.includes("postpone")) {
      if (!hasTasks) {
        response.answer = "There is nothing to postpone.";
        response.reasoning = "You have no tasks.";
        response.action = "Enjoy your free time.";
        response.confidence = 100;
        return response;
      }
      const lowTasks = context.pendingTasks.filter(t => t.priority === 'low' || t.priority === 'medium');
      if (lowTasks.length > 0) {
        response.answer = `Yes, you can safely postpone ${lowTasks[0].title}.`;
        response.reasoning = `This task is marked as ${lowTasks[0].priority} priority and is not critical for today.`;
        response.action = `Reschedule it for tomorrow and focus your remaining time on higher-priority items.`;
        response.confidence = 86;
      } else {
        response.answer = "It is not recommended to postpone anything right now.";
        response.reasoning = "All your pending tasks are High or Critical priority.";
        response.action = "Try to finish as much as possible today, or break them down if you feel overwhelmed.";
        response.confidence = 94;
      }
      return response;
    }

    // Intent 5: "When should I work on my goals?"
    if (q.includes("goals") || q.includes("work on my goals")) {
      if (context.activeGoals.length === 0) {
        response.answer = "You don't have any active goals right now.";
        response.reasoning = "Your goals list is empty.";
        response.action = "Go to the Habits & Goals page to set a new long-term milestone.";
        response.confidence = 100;
      } else {
        const goal = context.activeGoals[0];
        const timeStr = (context.routine && context.routine.dinnerTime) 
          ? `shortly after dinner (${context.routine.dinnerTime})` 
          : `in your evening free block`;
        response.answer = `You should work on ${goal.title} tonight.`;
        response.reasoning = `You have available free time ${timeStr}.`;
        response.action = `Set aside 30-45 minutes tonight to make progress without interrupting daily tasks.`;
        response.confidence = 91;
      }
      return response;
    }

    // Intent 6: "Do I have time to relax?" or "How much free time do I have?"
    if (q.includes("relax") || q.includes("free time")) {
      const estimatedTotal = context.pendingTasks.reduce((acc, t) => acc + (t.estimatedMins || 30), 0);
      const freeTime = totalTimeMins - estimatedTotal;
      
      if (freeTime >= 60) {
        response.answer = "Yes, you have plenty of time to relax!";
        response.reasoning = `Even after finishing your tasks, you will have roughly ${Math.floor(freeTime / 60)}h ${freeTime % 60}m of free time.`;
        response.action = "Complete your tasks first, then enjoy guilt-free relaxation for the rest of the day.";
        response.confidence = 97;
      } else if (freeTime > 0) {
        response.answer = "Yes, but it's limited.";
        response.reasoning = `You have about ${freeTime} minutes of free time after completing mandatory tasks.`;
        response.action = "Pace yourself. Take a 15-minute break now, then tackle your tasks.";
        response.confidence = 90;
      } else {
        response.answer = "Not right now.";
        response.reasoning = "Your current workload requires more time than you have available today.";
        response.action = "Postpone any low-priority tasks so you can create a 30-minute relaxation window tonight.";
        response.confidence = 88;
      }
      return response;
    }

    // Intent 7: "How am I doing today?" or "How productive am I today?"
    if (q.includes("how am i doing") || q.includes("how productive")) {
      const completionRate = context.stats.rate || 0;
      if (completionRate >= 80) {
        response.answer = "You are incredibly productive today!";
        response.reasoning = `You have a ${completionRate}% completion rate and finished ${context.completedTasksToday.length} tasks.`;
        response.action = "Keep up the momentum or take an early rest.";
        response.confidence = 98;
      } else if (completionRate >= 40) {
        response.answer = "You're making steady progress.";
        response.reasoning = `You've completed some tasks, but still have ${context.pendingTasks.length} pending.`;
        response.action = "Knock out one quick task right now to build momentum.";
        response.confidence = 92;
      } else {
        response.answer = "You're off to a slow start today.";
        response.reasoning = `Your completion rate is currently ${completionRate}%.`;
        response.action = "Start with the easiest task or use the Pomodoro timer for 15 minutes to overcome friction.";
        response.confidence = 89;
      }
      return response;
    }

    // Fallback logic
    response.answer = "I'm analyzing your context to give you the best answer.";
    response.reasoning = `You have ${context.pendingTasks.length} tasks pending and ${context.activeGoals.length} active goals.`;
    response.action = context.pendingTasks.length > 0 
      ? `Start by focusing on ${context.pendingTasks[0].title}.` 
      : "You're completely caught up! Try adding a new task.";
    response.confidence = 75;

    return response;
  }
};

window.AIChatService = AIChatService;
