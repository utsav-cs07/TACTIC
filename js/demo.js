/**
 * demo.js
 * Handles the "Demo Mode" for hackathon judges and guests.
 * Detects ?demo=true in the URL and forces the app into a completely in-memory state.
 */

window.isDemoMode = new URLSearchParams(window.location.search).get('demo') === 'true';

const DemoData = {
  // Temporary in-memory storage for Demo Mode
  storage: {},

  init() {
    if (!window.isDemoMode) return;
    
    console.log("🚀 TACTIC initializing in DEMO MODE. All changes are temporary.");
    
    this.populateRealisticData();
    this.interceptLocalStorage();
    
    // Show badge
    const badge = document.getElementById('demo-badge');
    if (badge) badge.style.display = 'block';
  },
  
  interceptLocalStorage() {
    const originalGet = localStorage.getItem.bind(localStorage);
    const originalSet = localStorage.setItem.bind(localStorage);
    const originalRemove = localStorage.removeItem.bind(localStorage);

    localStorage.getItem = (key) => {
      if (this.storage.hasOwnProperty(key)) return this.storage[key];
      return originalGet(key);
    };

    localStorage.setItem = (key, value) => {
      // In demo mode, all app data writes go to memory only
      if (key.startsWith('nexus_')) {
        this.storage[key] = value;
      } else {
        originalSet(key, value);
      }
    };

    localStorage.removeItem = (key) => {
      if (key.startsWith('nexus_')) {
        delete this.storage[key];
      } else {
        originalRemove(key);
      }
    };
  },

  populateRealisticData() {
    const now = new Date();
    
    // 1. Routine
    this.storage['nexus_routine'] = JSON.stringify({
      wakeTime: "06:30",
      sleepTime: "23:00",
      workStartTime: "09:00",
      workEndTime: "17:00",
      commuteMins: 30,
      lunchTime: "12:30",
      dinnerTime: "19:30",
      peakFocusStart: "19:30",
      peakFocusEnd: "21:30"
    });

    // 2. Profile
    this.storage['nexus_profile'] = JSON.stringify({
      fullName: "Hackathon Judge",
      role: "Judge & Tech Enthusiast"
    });

    // 3. Tasks
    const todayStr = now.toDateString();
    const tomorrow = new Date(now.getTime() + 86400000);
    const tasks = [
      {
        id: "demo-t1",
        title: "Review TACTIC Source Code",
        desc: "Examine aiPlanner.js and AI Context engine.",
        priority: "critical",
        category: "work",
        estimatedMins: 45,
        dueDate: now.toISOString(),
        completed: false,
        createdAt: now.toISOString()
      },
      {
        id: "demo-t2",
        title: "Test AI Voice Assistant",
        desc: "Try using the microphone button on the dashboard to add a task hands-free.",
        priority: "high",
        category: "personal",
        estimatedMins: 15,
        dueDate: now.toISOString(),
        completed: false,
        createdAt: now.toISOString()
      },
      {
        id: "demo-t3",
        title: "Evaluate AI Chat Responses",
        desc: "Ask the AI 'Can I finish everything today?'",
        priority: "high",
        category: "work",
        estimatedMins: 20,
        dueDate: now.toISOString(),
        completed: false,
        createdAt: now.toISOString()
      },
      {
        id: "demo-t4",
        title: "Prepare Final Scoring",
        desc: "Compile thoughts on UI/UX, AI integration, and codebase quality.",
        priority: "medium",
        category: "work",
        estimatedMins: 60,
        dueDate: tomorrow.toISOString(),
        completed: false,
        createdAt: now.toISOString()
      },
      {
        id: "demo-t5",
        title: "Check Dashboard Responsiveness",
        desc: "Resize window to ensure everything flows perfectly on mobile.",
        priority: "low",
        category: "personal",
        estimatedMins: 10,
        dueDate: now.toISOString(),
        completed: true, // Show one completed
        completedAt: new Date(now.getTime() - 3600000).toISOString(),
        createdAt: now.toISOString()
      }
    ];
    this.storage['nexus_tasks'] = JSON.stringify(tasks);

    // 4. Habits
    const habits = [
      {
        id: "demo-h1",
        name: "Read 20 Pages",
        frequency: "daily",
        streak: 14,
        longestStreak: 21,
        history: { [todayStr]: false, [new Date(now.getTime()-86400000).toDateString()]: true },
        createdAt: now.toISOString()
      },
      {
        id: "demo-h2",
        name: "Morning Workout",
        frequency: "daily",
        streak: 5,
        longestStreak: 5,
        history: { [todayStr]: true }, // Already done today
        createdAt: now.toISOString()
      }
    ];
    this.storage['nexus_habits'] = JSON.stringify(habits);

    // 5. Goals
    const goals = [
      {
        id: "demo-g1",
        title: "Launch SaaS Product",
        deadline: new Date(now.getTime() + 86400000 * 30).toISOString(),
        progress: 65,
        completed: false,
        createdAt: now.toISOString()
      },
      {
        id: "demo-g2",
        title: "Learn Advanced AI Integrations",
        deadline: new Date(now.getTime() + 86400000 * 60).toISOString(),
        progress: 30,
        completed: false,
        createdAt: now.toISOString()
      }
    ];
    this.storage['nexus_goals'] = JSON.stringify(goals);
  }
};

DemoData.init();
