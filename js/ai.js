/* ═══════════════════════════════════════════
   AI.JS — AI Engine: NLP, Scoring, Suggestions
═══════════════════════════════════════════ */
'use strict';

const AI = (() => {

  // ── Priority Scoring Engine ──
  function scorePriority(task) {
    let score = 0;
    const now = new Date();
    const due = task.dueDate ? new Date(task.dueDate) : null;

    // Deadline urgency (40 points)
    if (due) {
      const hoursLeft = (due - now) / 36e5;
      if (hoursLeft < 0)      score += 45;
      else if (hoursLeft < 2) score += 40;
      else if (hoursLeft < 8) score += 30;
      else if (hoursLeft < 24) score += 20;
      else if (hoursLeft < 72) score += 10;
      else                     score += 5;
    }

    // Keyword importance (30 points)
    const text = (task.title + ' ' + task.desc).toLowerCase();
    const critical = ['urgent', 'asap', 'critical', 'emergency', 'deadline', 'important'];
    const high     = ['meeting', 'submit', 'review', 'present', 'deliver', 'report'];
    const medium   = ['call', 'email', 'update', 'check', 'prepare'];
    if (critical.some(k => text.includes(k))) score += 25;
    else if (high.some(k => text.includes(k))) score += 15;
    else if (medium.some(k => text.includes(k))) score += 5;

    // Manual priority override (20 points)
    const priorityBonus = { critical: 20, high: 15, medium: 10, low: 5 };
    score += priorityBonus[task.priority] || 10;

    // Category weight (10 points)
    const catWeight = { work: 10, health: 8, personal: 5, shopping: 2 };
    score += catWeight[task.category] || 5;

    return Math.min(Math.round(score), 100);
  }

  function autoAssignPriority(task) {
    const score = scorePriority(task);
    if (score >= 75) return 'critical';
    if (score >= 50) return 'high';
    if (score >= 25)  return 'medium';
    return 'low';
  }

  // ── NLP Parser ──
  const NLP = {
    dayMap: { today: 0, tomorrow: 1, 'day after tomorrow': 2, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6, sunday: 0 },

    parseDate(text) {
      const t = text.toLowerCase();
      const now = new Date();
      // Check relative days
      for (const [word, offset] of Object.entries(this.dayMap)) {
        if (t.includes(word)) {
          const d = new Date(now);
          if (offset === 0 || offset === 1 || offset === 2) {
            d.setDate(d.getDate() + offset);
          } else {
            // Day of week
            const current = d.getDay();
            let diff = offset - current;
            if (diff <= 0) diff += 7;
            d.setDate(d.getDate() + diff);
          }
          d.setHours(12, 0, 0, 0);
          return d;
        }
      }
      // "in X days"
      const inDays = t.match(/in (\d+) days?/);
      if (inDays) { const d = new Date(now); d.setDate(d.getDate() + parseInt(inDays[1])); d.setHours(12,0,0,0); return d; }
      // "next week"
      if (t.includes('next week')) { const d = new Date(now); d.setDate(d.getDate() + 7); d.setHours(12,0,0,0); return d; }
      return null;
    },

    parseTime(text) {
      const t = text.toLowerCase();
      // Match "at 3pm", "by 5", "till 11", "before 14:30", or just "5pm"
      const timeMatch = t.match(/(?:(at|by|before|till|until)\s+(\d{1,2})(?::(\d{2}))?(?:\s*(am|pm))?\b)|(?:(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b)/);
      if (timeMatch) {
        let h = parseInt(timeMatch[2] || timeMatch[5]);
        const m = parseInt(timeMatch[3] || timeMatch[6] || '0');
        const mer = timeMatch[4] || timeMatch[7];
        
        if (!mer) {
          // If no am/pm specified, assume PM for 1-11
          if (h >= 1 && h <= 11) h += 12;
        } else {
          if (mer === 'pm' && h < 12) h += 12;
          if (mer === 'am' && h === 12) h = 0;
        }
        return { h, m };
      }
      // "noon" / "midnight"
      if (t.includes('noon'))     return { h: 12, m: 0 };
      if (t.includes('midnight')) return { h: 0,  m: 0 };
      if (t.includes('morning'))  return { h: 9,  m: 0 };
      if (t.includes('evening'))  return { h: 18, m: 0 };
      if (t.includes('night'))    return { h: 21, m: 0 };
      return null;
    },

    parseCategory(text) {
      const t = text.toLowerCase();
      if (/\b(work|office|meeting|project|client|code|dev)\b/.test(t)) return 'work';
      if (/\b(gym|doctor|health|medicine|workout|run)\b/.test(t)) return 'health';
      if (/\b(buy|shop|grocery|groceries|store|purchase)\b/.test(t)) return 'shopping';
      return 'personal';
    },

    parsePriority(text) {
      const t = text.toLowerCase();
      if (/\b(urgent|asap|critical|emergency|immediately)\b/.test(t)) return 'critical';
      if (/\b(important|high priority|soon|deadline)\b/.test(t)) return 'high';
      if (/\b(low|whenever|someday|eventually)\b/.test(t)) return 'low';
      return null;
    },

    extractTitle(text) {
      // Remove command words and time/date expressions
      return text
        .replace(/^(add|create|remind me to|schedule|set|new task|i need to)\s*/i, '')
        .replace(/(today|tomorrow|next week|in \d+ days?|on (monday|tuesday|wednesday|thursday|friday|saturday|sunday))/gi, '')
        .replace(/(?:(?:at|by|before|till|until)\s+\d{1,2}(?::\d{2})?(?:\s*(?:am|pm))?\b)|(?:\d{1,2}(?::\d{2})?\s*(?:am|pm)\b)/gi, '')
        .replace(/\b(noon|midnight|morning|evening|night)\b/gi, '')
        .replace(/(urgent|asap|critical|high priority|low priority)/gi, '')
        .replace(/\s+/g, ' ')
        .trim();
    }
  };

  function parseCommand(input) {
    const text = input.trim();
    let date = NLP.parseDate(text);
    const time = NLP.parseTime(text);
    const category = NLP.parseCategory(text);
    const priority  = NLP.parsePriority(text) || 'medium';
    let title = NLP.extractTitle(text);
    if (!title) title = text;

    // Merge date + time
    let dueDate = null;
    if (time && !date) {
      date = new Date();
      date.setHours(time.h, time.m, 0, 0);
      if (date < new Date()) {
        date.setDate(date.getDate() + 1); // If time passed today, assume tomorrow
      }
    }
    
    if (date) {
      if (time) { date.setHours(time.h, time.m, 0, 0); }
      dueDate = date.toISOString();
    }

    return { title, category, priority, dueDate };
  }

  // ── Suggestions Engine ──
  const suggestionTemplates = {
    overloaded: (count) => ({
      icon: '⚠️',
      title: 'Workload Warning',
      body: `You have ${count} tasks pending today. That is a lot to handle for just beginning! Try deleting lower priority tasks or rescheduling them to avoid burnout.`,
    }),
    overdue: (tasks) => ({
      icon: '🚨',
      title: 'Overdue Work Strategy',
      body: `You have ${tasks.length} overdue task(s). "${tasks[0].title}" needs attention. Recommendation: Try breaking it into 15-minute micro-steps, or defer it to tomorrow if your plate is full. A focused Pomodoro session could knock it out!`,
    }),
    morning: (tasks) => ({
      icon: '🌅',
      title: "Good morning! Here's your day",
      body: `${tasks.length} task${tasks.length > 1 ? 's' : ''} due today. Your highest priority: "${tasks.sort((a,b) => scorePriority(b)-scorePriority(a))[0]?.title || 'none'}". Let's crush it!`,
    }),
    focus: (task) => ({
      icon: '🎯',
      title: 'Focus suggestion',
      body: `Based on your workload, I recommend tackling "${task.title}" next — it's high priority and due soon.`,
    }),
    wellDone: () => ({
      icon: '🎉',
      title: 'Streak milestone!',
      body: `You're on fire! You've completed tasks consistently. Keep this momentum going — you're building a great habit.`,
    }),
    idle: () => ({
      icon: '⚡',
      title: 'Productivity tip',
      body: `Break large tasks into 25-min Pomodoro sessions. Your brain stays fresh and tasks feel less daunting. Want me to schedule one?`,
    }),
    evening: (stats) => ({
      icon: '🌙',
      title: "Today's wrap-up",
      body: `You completed ${stats.completed} tasks today! Completion rate: ${stats.rate}%. Tomorrow has ${stats.today} tasks lined up.`,
    }),
    criticalAlert: (task, hoursLeft) => {
      let motivation = "You've got this! Focus up.";
      if (hoursLeft < 1) motivation = "It's crunch time! Put away distractions and focus strictly on this.";
      else if (hoursLeft < 3) motivation = "Time is ticking! Let's knock this out right now.";
      else motivation = "Tackle this now to save yourself the stress later.";

      return {
        icon: '⚠️',
        title: 'CRITICAL URGENCY',
        body: `"${task.title}" is critical and due in ${hoursLeft < 1 ? 'less than 1 hour' : Math.round(hoursLeft) + ' hours'}! ${motivation}`,
      };
    }
  };

  function getContextualSuggestion(allTasks) {
    const hour = new Date().getHours();
    const stats = Tasks.getStats();
    const overdue = Tasks.getByFilter('overdue');
    const today   = Tasks.getByFilter('today');
    const pending  = allTasks.filter(t => !t.completed);

    // Check for critical upcoming tasks
    const criticalTasks = pending.filter(t => t.priority === 'critical' && t.dueDate && new Date(t.dueDate) > new Date());
    if (criticalTasks.length > 0) {
      // Sort by closest deadline
      criticalTasks.sort((a,b) => new Date(a.dueDate) - new Date(b.dueDate));
      const mostUrgent = criticalTasks[0];
      const hoursLeft = (new Date(mostUrgent.dueDate) - new Date()) / (1000 * 60 * 60);
      if (hoursLeft <= 24) {
        return suggestionTemplates.criticalAlert(mostUrgent, hoursLeft);
      }
    }

    if (overdue.length > 0)        return suggestionTemplates.overdue(overdue);
    if (today.length > 5)          return suggestionTemplates.overloaded(today.length);
    if (hour >= 5  && hour < 10)   return suggestionTemplates.morning(today);
    if (hour >= 20)                 return suggestionTemplates.evening(stats);
    if (pending.length > 0) {
      const next = pending.sort((a,b) => scorePriority(b)-scorePriority(a))[0];
      return suggestionTemplates.focus(next);
    }
    return suggestionTemplates.idle();
  }

  // ── Smart Scheduling ──
  function suggestSchedule(task) {
    const now = new Date();
    const slots = [];
    // Find next 3 available time slots (simple: 9am, 2pm, 6pm pattern)
    const preferred = [9, 14, 18, 20];
    for (let dayOffset = 0; dayOffset <= 3; dayOffset++) {
      for (const h of preferred) {
        const d = new Date(now);
        d.setDate(d.getDate() + dayOffset);
        d.setHours(h, 0, 0, 0);
        if (d > now) {
          slots.push(d);
          if (slots.length >= 3) break;
        }
      }
      if (slots.length >= 3) break;
    }

    const fmt = (d) => d.toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    return slots.map((s, i) => ({
      label: ['Best fit', 'Alternative', 'Later option'][i],
      time: fmt(s),
      iso: s.toISOString(),
    }));
  }

  // ── Chat Responses ──
  const responses = {
    greet: ["Hello! I'm TACTIC OS, your AI productivity companion. How can I help you today?", "Hey there! Ready to boost your productivity? What's on your mind?", "Welcome back! Your productivity score is looking sharp. What shall we tackle?"],
    addTask: (title, hasTime) => `Got it! I've added "${title}" to your tasks and auto-assigned priority.${hasTime ? ' I also set the deadline you mentioned.' : ' Want me to suggest a time slot?'}`,
    noTasks: ["You're all caught up! 🎉 No pending tasks. Perfect time to plan ahead.", "Clean slate! Want me to suggest some goals or habits to build?"],
    help: `Here's what I can do:\n• **Add tasks**: "Add meeting with team tomorrow at 3pm"\n• **Prioritize**: "What should I focus on?"\n• **Schedule**: "Schedule my tasks for today"\n• **Stats**: "How am I doing?"\n• **Habits**: "Track my morning run"\n• Just ask naturally!`,
    prioritize: (tasks) => `Based on AI scoring, here's your priority order:\n${tasks.slice(0,5).map((t,i) => `${i+1}. ${t.title} (${t.priority})`).join('\n')}`,
    stats: (s) => `Your productivity stats:\n• ✅ Completed: ${s.completed}/${s.total} tasks\n• 📊 Rate: ${s.rate}%\n• 🔥 Overdue: ${s.overdue}\n• 📅 Due today: ${s.today}`,
    schedule: (slots) => `Here are your suggested time slots:\n${slots.map(s => `• **${s.label}**: ${s.time}`).join('\n')}\nWhich works best for you?`,
    unknown: ["I'm not sure I understood that. Try: 'add [task]', 'prioritize', 'stats', or 'help'.", "Hmm, let me think... You can say things like 'what's due today?', 'add task', or 'how am I doing?'"],
  };

  function rand(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  async function askGemini(prompt, tasks) {
    if (!window.ENV || !window.ENV.GEMINI_API_KEY) {
      throw new Error('No API Key');
    }
    const now = new Date();
    const twoDaysFromNow = new Date(now.getTime() + 48 * 60 * 60 * 1000);
    const relevantTasks = tasks.filter(t => !t.completed && (!t.dueDate || new Date(t.dueDate) < twoDaysFromNow));
    const taskContext = relevantTasks.map(t => `- ${t.title} (Priority: ${t.priority}, Due: ${t.dueDate ? new Date(t.dueDate).toLocaleDateString() : 'none'})`).join('\n');
    const systemPrompt = `You are TACTIC, a brilliant and highly productive personal assistant. 
Here are the user's immediate pending tasks (due today, tomorrow, or overdue):
${taskContext || 'No immediate pending tasks.'}
    
The user is asking you a question or making a statement. 
CRITICAL INSTRUCTION: Give highly actionable, highly personalized advice on how to start their tasks TODAY or within 1-2 days. DO NOT mention or worry about tasks due in the distant future. Do not output raw markdown code blocks, just speak naturally like a motivating coach. Keep responses extremely concise (under 2 short paragraphs).

User says: "${prompt}"`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${window.ENV.GEMINI_API_KEY}`;
    const payload = { contents: [{ parts: [{ text: systemPrompt }] }] };

    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (!res.ok) {
      let errMsg = 'API Error';
      try { 
        const errorData = await res.json();
        errMsg = errorData?.error?.message || `HTTP Error ${res.status}`;
      } catch (e) {}
      throw new Error(errMsg);
    }
    const data = await res.json();
    return data.candidates[0].content.parts[0].text;
  }

  async function processInput(input, allTasks, bypassRegex = false) {
    const t = input.toLowerCase().trim();

    if (!bypassRegex) {
      // Greetings
      if (/^(hi|hello|hey|greetings|sup|yo)\b/.test(t)) return { type: 'text', text: rand(responses.greet) };

      // Help
      if (/\bhelp\b/.test(t)) return { type: 'text', text: responses.help };

      // Stats / How am I doing
      if (/\b(stats|statistics|how am i|progress|score|report)\b/.test(t)) {
        return { type: 'text', text: responses.stats(Tasks.getStats()) };
      }

      // Prioritize
      if (/\b(prioritize|priority|focus|what should i|what's next|most important)\b/.test(t)) {
        const sorted = allTasks.filter(x => !x.completed).sort((a,b) => scorePriority(b) - scorePriority(a));
        if (!sorted.length) return { type: 'text', text: rand(responses.noTasks) };
        return { type: 'text', text: responses.prioritize(sorted) };
      }

      // Add task
      if (/^(add|create|remind|schedule|set|new task|i need to|remind me to)\b/.test(t)) {
        const parsed = parseCommand(input);
        if (parsed.title && parsed.title.length > 2) {
          const hasTime = input.match(/(?:at|by|before|till|until)\s+\d{1,2}|am\b|pm\b/i);
          return { type: 'add_task', data: parsed, text: responses.addTask(parsed.title, hasTime) };
        }
      }

      // What's due today
      if (/\b(today|due today|today'?s tasks?)\b/.test(t)) {
        const today = Tasks.getByFilter('today');
        if (!today.length) return { type: 'text', text: "Nothing due today! 🎉 Enjoy the free time or get ahead on tomorrow's tasks." };
        return { type: 'text', text: `You have ${today.length} tasks due today:\n${today.map((x,i) => `${i+1}. ${x.title} [${x.priority}]`).join('\n')}` };
      }

      // Overdue check
      if (/\b(overdue|late|missed|behind)\b/.test(t)) {
        const over = Tasks.getByFilter('overdue');
        if (!over.length) return { type: 'text', text: "No overdue tasks! You're on track 🎯" };
        return { type: 'text', text: `⚠️ ${over.length} overdue task${over.length>1?'s':''}:\n${over.map(x=>`• ${x.title}`).join('\n')}\nWant me to reschedule them?` };
      }

      // Schedule suggestion
      if (/\b(schedule|when should i|plan|time slot|when to)\b/.test(t)) {
        const pending = allTasks.filter(x => !x.completed);
        if (!pending.length) return { type: 'text', text: rand(responses.noTasks) };
        const top = pending.sort((a,b) => scorePriority(b)-scorePriority(a))[0];
        const slots = suggestSchedule(top);
        return { type: 'text', text: `For "${top.title}":\n${responses.schedule(slots)}` };
      }

      // Motivational
      if (/\b(motivate?|inspire|quote|boost|energy)\b/.test(t)) {
        const quotes = [
          '"The secret of getting ahead is getting started." — Mark Twain',
          '"Action is the foundational key to all success." — Pablo Picasso',
          '"You don\'t have to be great to start, but you have to start to be great."',
          '"Focus on being productive instead of busy." — Tim Ferriss',
        ];
        return { type: 'text', text: rand(quotes) };
      }
    }

    // Proceed to Gemini
    try {
      const geminiResponse = await askGemini(input, allTasks);
      return { type: 'text', text: geminiResponse };
    } catch (e) {
      console.error('Gemini API Error:', e);
      if (e.message === 'No API Key') {
         return { type: 'text', text: "⚠️ **Missing Key!** Please add your Gemini API Key to `env.js`." };
      }
      return { type: 'text', text: `⚠️ **Gemini API Error:** ${e.message}` };
    }
  }

  // ── AI Weekly Plan ──
  function generateWeekPlan(tasks) {
    const pending = tasks.filter(t => !t.completed).sort((a,b) => scorePriority(b) - scorePriority(a));
    const days = ['Monday','Tuesday','Wednesday','Thursday','Friday'];
    const plan = {};
    let i = 0;
    days.forEach(day => {
      plan[day] = [];
      // Assign ~2-3 tasks per day
      const perDay = Math.ceil(pending.length / 5);
      for (let j = 0; j < perDay && i < pending.length; j++, i++) {
        plan[day].push(pending[i]);
      }
    });
    return plan;
  }

  return { scorePriority, autoAssignPriority, parseCommand, processInput, getContextualSuggestion, suggestSchedule, generateWeekPlan };
})();
