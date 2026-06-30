/* ═══════════════════════════════════════════
   PRODUCT TOUR & 60-SECOND CHALLENGE
═══════════════════════════════════════════ */
'use strict';

const ProductTour = (() => {
  let isTourActive = false;
  let currentStepIndex = 0;
  let isChallengeActive = false;
  
  let challengeProgress = {
    createdTask: false,
    plannedDay: false,
    talkedToAi: false,
    completedTask: false,
    viewedAnalytics: false
  };

  const steps = [
    { target: '#dashboard-view', title: 'Dashboard', desc: 'This is your AI command center. Here you can instantly view today\'s workload, overdue tasks, completion rate, AI recommendations, and productivity insights.' },
    { target: '.ai-insight', title: 'Smart AI Coach', desc: 'This AI continuously analyzes your tasks, habits, goals, deadlines, and routine to suggest the smartest next action.' },
    { target: '#ai-toggle-btn', title: 'Ask AI', desc: 'You can ask anything about your schedule, productivity, deadlines, study planning, or habits. The AI understands your personal data and gives context-aware answers. You can also speak instead of typing.' },
    { target: 'button[onclick="Dashboard.planDay()"]', title: 'Plan My Day', desc: 'One click generates an optimized schedule based on your routine, deadlines, habits, priorities, goals, available free time, and energy levels.' },
    { target: '.nav-item[data-view="tasks"]', title: 'Tasks', desc: 'Create tasks with priorities, deadlines and AI assistance. TACTIC automatically prioritizes and schedules them.' },
    { target: '.nav-item[data-view="calendar"]', title: 'Calendar', desc: 'See all your scheduled work in one place and optionally sync with Google Calendar.' },
    { target: '.nav-item[data-view="habits"]', title: 'Habits & Goals', desc: 'Track habits, build streaks, and achieve long-term goals with AI coaching.' },
    { target: '.nav-item[data-view="analytics"]', title: 'Analytics', desc: 'Monitor productivity trends, completion rates, focus time, and AI insights.' },
    { target: '.nav-item[data-view="settings"]', title: 'Daily Routine', desc: 'Customize your daily routine. TACTIC plans around your college, work, meals, sleep, holidays, and free time. Leave timings blank to activate Holiday Mode!' },
    { target: '#user-avatar-btn', title: 'You\'re Ready!', desc: '✓ Personalized AI recommendations\n✓ AI scheduling & prioritization\n✓ Context-aware chat\n✓ Smart notifications' }
  ];

  /* ── 1. Welcome Screen ── */
  function startWelcome() {
    const overlay = document.getElementById('tour-welcome-overlay');
    if (overlay) overlay.classList.add('active');
  }

  function skipWelcome() {
    const overlay = document.getElementById('tour-welcome-overlay');
    if (overlay) overlay.classList.remove('active');
    
    // Mark as completed
    if (typeof DB !== 'undefined') {
      DB.getTutorialState().then(state => {
        state.tourCompleted = true;
        DB.saveTutorialState(state);
      });
    }
  }

  /* ── 2. The Tour Engine ── */
  function startTour() {
    const welcome = document.getElementById('tour-welcome-overlay');
    if (welcome) welcome.classList.remove('active');

    isTourActive = true;
    currentStepIndex = 0;
    
    // Create Backdrop & Spotlight
    if (!document.getElementById('tour-backdrop')) {
      const backdrop = document.createElement('div');
      backdrop.id = 'tour-backdrop';
      backdrop.className = 'tour-backdrop';
      document.body.appendChild(backdrop);
    }
    
    if (!document.getElementById('tour-spotlight')) {
      const spotlight = document.createElement('div');
      spotlight.id = 'tour-spotlight';
      spotlight.className = 'tour-spotlight';
      document.body.appendChild(spotlight);
    }

    if (!document.getElementById('tour-card')) {
      const card = document.createElement('div');
      card.id = 'tour-card';
      card.className = 'tour-card';
      document.body.appendChild(card);
    }
    
    // Generate Demo Data if empty
    if (typeof Tasks !== 'undefined' && Tasks.getAll().length === 0) {
      injectDemoData();
    }
    
    // Open Sidebar if mobile so nav targets are visible
    if (window.innerWidth <= 768 && document.getElementById('sidebar')) {
      document.getElementById('sidebar').classList.add('open');
    }

    // Switch to Dashboard explicitly
    if (typeof UI !== 'undefined') UI.showView('dashboard');
    
    setTimeout(() => {
      document.getElementById('tour-backdrop').style.opacity = '1';
      renderStep();
    }, 100);
  }

  function renderStep() {
    if (!isTourActive) return;
    
    const step = steps[currentStepIndex];
    let target = document.querySelector(step.target);
    
    // Fallback if target not found (just center screen)
    let rect = { top: window.innerHeight / 2 - 50, left: window.innerWidth / 2 - 50, width: 100, height: 100, bottom: window.innerHeight / 2 + 50, right: window.innerWidth / 2 + 50 };
    if (target) {
      // Scroll into view instantly so rect calculation is accurate
      target.scrollIntoView({ block: 'center' });
      rect = target.getBoundingClientRect();
    }
    
    // Update Spotlight
    const spotlight = document.getElementById('tour-spotlight');
    if (spotlight) {
      spotlight.style.top = `${rect.top - 8}px`;
      spotlight.style.left = `${rect.left - 8}px`;
      spotlight.style.width = `${rect.width + 16}px`;
      spotlight.style.height = `${rect.height + 16}px`;
    }
    
    // Update Card
    const card = document.getElementById('tour-card');
    if (card) {
      card.classList.remove('active');
      
      setTimeout(() => {
        let dots = '';
        for (let i = 0; i < steps.length; i++) {
          dots += `<div class="tour-dot ${i === currentStepIndex ? 'active' : ''}"></div>`;
        }
        
        let descHtml = step.desc.replace(/\n/g, '<br>');
        
        card.innerHTML = `
          <div class="tour-card-header">${step.title}</div>
          <div class="tour-card-body">${descHtml}</div>
          <div class="tour-card-footer">
            <div class="tour-progress">${dots}</div>
            <div style="display:flex; gap:8px;">
              <button class="tour-btn" onclick="ProductTour.skipTour()">Skip</button>
              ${currentStepIndex > 0 ? `<button class="tour-btn" onclick="ProductTour.prevStep()">Prev</button>` : ''}
              ${currentStepIndex < steps.length - 1 ? 
                `<button class="tour-btn primary" onclick="ProductTour.nextStep()">Next</button>` : 
                `<button class="tour-btn primary" onclick="ProductTour.endTour()">Finish</button>`
              }
            </div>
          </div>
        `;
        
        // Position Card
        let cardTop = (rect.bottom !== undefined ? rect.bottom : rect.top + rect.height) + 16;
        let cardLeft = rect.left + (rect.width / 2) - 160;
        
        // Bounds checking
        if (cardLeft < 20) cardLeft = 20;
        if (cardLeft + 320 > window.innerWidth - 20) cardLeft = window.innerWidth - 340;
        if (cardTop + 200 > window.innerHeight - 20) {
          cardTop = rect.top - 216; // place above
        }
        
        card.style.top = `${cardTop}px`;
        card.style.left = `${cardLeft}px`;
        card.classList.add('active');
      }, 300);
    }
  }

  function nextStep() {
    if (currentStepIndex < steps.length - 1) {
      currentStepIndex++;
      renderStep();
    }
  }
  
  function prevStep() {
    if (currentStepIndex > 0) {
      currentStepIndex--;
      renderStep();
    }
  }

  function skipTour() {
    endTour(true);
  }

  function endTour(skipped = false) {
    isTourActive = false;
    
    // Hide UI
    document.getElementById('tour-backdrop')?.remove();
    document.getElementById('tour-spotlight')?.remove();
    document.getElementById('tour-card')?.remove();
    
    if (window.innerWidth <= 768 && document.getElementById('sidebar')) {
      document.getElementById('sidebar').classList.remove('open');
    }

    // Wipe Demo Data
    removeDemoData();
    if (typeof UI !== 'undefined') UI.showView('dashboard');
    
    // Save State
    if (typeof DB !== 'undefined') {
      DB.getTutorialState().then(state => {
        state.tourCompleted = true;
        DB.saveTutorialState(state);
      });
    }
    
    // Show Celebration if finished normally
    if (!skipped) {
      const celeb = document.getElementById('tour-celebration-overlay');
      if (celeb) celeb.classList.add('active');
    }
  }

  /* ── 3. The 60-Second Challenge ── */
  function startChallenge() {
    const celeb = document.getElementById('tour-celebration-overlay');
    if (celeb) celeb.classList.remove('active');
    
    isChallengeActive = true;
    
    challengeProgress = {
      createdTask: false,
      plannedDay: false,
      talkedToAi: false,
      completedTask: false,
      viewedAnalytics: false
    };
    
    updateChallengeUI();
  }
  
  function updateChallengeUI() {
    if (!isChallengeActive) return;
    
    const widget = document.getElementById('challenge-widget');
    if (!widget) return;
    
    widget.classList.add('active');
    
    let completedCount = 0;
    if (challengeProgress.createdTask) completedCount++;
    if (challengeProgress.plannedDay) completedCount++;
    if (challengeProgress.talkedToAi) completedCount++;
    if (challengeProgress.completedTask) completedCount++;
    if (challengeProgress.viewedAnalytics) completedCount++;
    
    document.getElementById('chal-count').innerText = `${completedCount} / 5 Completed`;
    document.getElementById('chal-fill').style.width = `${(completedCount / 5) * 100}%`;
    
    document.getElementById('chal-task').className = `challenge-task ${challengeProgress.createdTask ? 'completed' : ''}`;
    document.getElementById('chal-plan').className = `challenge-task ${challengeProgress.plannedDay ? 'completed' : ''}`;
    document.getElementById('chal-ai').className = `challenge-task ${challengeProgress.talkedToAi ? 'completed' : ''}`;
    document.getElementById('chal-complete').className = `challenge-task ${challengeProgress.completedTask ? 'completed' : ''}`;
    document.getElementById('chal-analytics').className = `challenge-task ${challengeProgress.viewedAnalytics ? 'completed' : ''}`;
    
    if (completedCount === 5) {
      setTimeout(finishChallenge, 800);
    }
  }

  function finishChallenge() {
    isChallengeActive = false;
    const widget = document.getElementById('challenge-widget');
    if (widget) widget.classList.remove('active');
    
    // Save State
    if (typeof DB !== 'undefined' && !window.isGuestMode) {
      DB.getTutorialState().then(state => {
        state.quickChallengeCompleted = true;
        DB.saveTutorialState(state);
      });
      // Award Badge (if profile exists)
      DB.getUserProfile().then(profile => {
        if (profile) {
           profile.badges = profile.badges || [];
           if (!profile.badges.includes('TACTIC Explorer')) {
             profile.badges.push('TACTIC Explorer');
             DB.saveUserProfileAndSettings(profile, {});
           }
        }
      });
    }
    
    // Show Success Screen
    const success = document.getElementById('challenge-success-overlay');
    if (success) {
      if (window.isGuestMode) {
        success.querySelector('.welcome-title').innerHTML = '🏆 Demo Completed';
        success.querySelector('.welcome-subtitle').innerHTML = "You've experienced the power of TACTIC.";
        const divs = success.querySelectorAll('div');
        divs.forEach(div => {
          if (div.innerText.includes('TACTIC Explorer Badge Unlocked')) div.innerHTML = 'All Core Features Explored';
          if (div.innerText.includes("You're ready to master your productivity")) div.innerHTML = 'Sign in to save your own tasks, habits, goals, and AI progress.';
        });
        const btns = success.querySelectorAll('button');
        if (btns.length >= 2) {
          btns[0].innerHTML = 'Continue Exploring Demo';
          btns[0].onclick = () => { ProductTour.endChallengeSuccess(); };
          btns[1].innerHTML = 'Sign In & Save';
          btns[1].onclick = () => { Auth.splashSignInWithGoogle(); ProductTour.endChallengeSuccess(); };
        }
      }
      success.classList.add('active');
    }
    
    // Add confetti
    if (typeof confetti === 'function') confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
  }

  function endChallengeSuccess() {
    const success = document.getElementById('challenge-success-overlay');
    if (success) success.classList.remove('active');
  }

  /* ── 4. Event Hooks ── */
  function onTaskCreated() {
    if (isChallengeActive && !challengeProgress.createdTask) {
      challengeProgress.createdTask = true;
      if (typeof confetti === 'function') confetti({ particleCount: 50, spread: 60 });
      updateChallengeUI();
    }
  }
  function onPlanGenerated() {
    if (isChallengeActive && !challengeProgress.plannedDay) {
      challengeProgress.plannedDay = true;
      updateChallengeUI();
    }
  }
  function onAiChat() {
    if (isChallengeActive && !challengeProgress.talkedToAi) {
      challengeProgress.talkedToAi = true;
      updateChallengeUI();
    }
  }
  function onTaskCompleted() {
    if (isChallengeActive && !challengeProgress.completedTask) {
      challengeProgress.completedTask = true;
      updateChallengeUI();
    }
  }
  function onAnalyticsViewed() {
    if (isChallengeActive && !challengeProgress.viewedAnalytics) {
      challengeProgress.viewedAnalytics = true;
      updateChallengeUI();
    }
  }
  
  function restartTourFromSettings() {
    // Reset state variables
    isTourActive = false;
    currentStepIndex = 0;
    isChallengeActive = false;
    challengeProgress = {
      createdTask: false,
      plannedDay: false,
      talkedToAi: false,
      completedTask: false,
      viewedAnalytics: false
    };

    // Close settings and navigate back to dashboard
    if (typeof UI !== 'undefined' && UI.showView) {
      UI.showView('dashboard');
    }
    
    // Close mobile sidebar if open
    if (window.innerWidth <= 768 && document.getElementById('sidebar')) {
      document.getElementById('sidebar').classList.remove('mobile-open');
      document.getElementById('sidebar').classList.remove('open');
    }

    // Hide any previous overlays to start fresh
    const success = document.getElementById('challenge-success-overlay');
    if (success) success.classList.remove('active');
    
    const celeb = document.getElementById('tour-celebration-overlay');
    if (celeb) celeb.classList.remove('active');
    
    const widget = document.getElementById('challenge-widget');
    if (widget) widget.classList.remove('active');
    
    // Clean up old tour DOM elements if they exist
    document.getElementById('tour-backdrop')?.remove();
    document.getElementById('tour-spotlight')?.remove();
    document.getElementById('tour-card')?.remove();

    // Start from the Welcome screen
    startWelcome();
  }

  /* ── 5. Demo Data Injector ── */
  function injectDemoData() {
    if (typeof Tasks === 'undefined') return;
    
    const d1 = new Date(); d1.setHours(d1.getHours() + 2);
    const d2 = new Date(); d2.setHours(d2.getHours() + 5);
    
    // Inject directly into Tasks array to avoid triggering DB.addTask
    Tasks.tasks.push(
      { id: 'demo1', title: 'Finish AI Implementation Plan', category: 'Work', priority: 'critical', estimatedMins: 60, status: 'pending', dueDate: d1.toISOString(), createdAt: new Date().toISOString(), isDemo: true },
      { id: 'demo2', title: 'Review Database Schema', category: 'Study', priority: 'high', estimatedMins: 45, status: 'pending', dueDate: d2.toISOString(), createdAt: new Date().toISOString(), isDemo: true },
      { id: 'demo3', title: 'Call Client regarding UI feedback', category: 'Work', priority: 'medium', estimatedMins: 30, status: 'pending', dueDate: d2.toISOString(), createdAt: new Date().toISOString(), isDemo: true }
    );
    
    if (typeof Habits !== 'undefined' && Habits.habits) {
      Habits.habits.push(
        { id: 'demo-h1', name: 'Drink 2L Water', frequency: 'daily', streak: 12, completed: false, isDemo: true },
        { id: 'demo-h2', name: 'Read 20 mins', frequency: 'daily', streak: 5, completed: true, isDemo: true }
      );
    }
    
    if (typeof App !== 'undefined' && App.renderDashboard) {
      App.renderDashboard();
    } else if (typeof Dashboard !== 'undefined' && Dashboard.render) {
      Dashboard.render();
    }
  }

  function removeDemoData() {
    if (typeof Tasks !== 'undefined') {
      Tasks.tasks = Tasks.tasks.filter(t => !t.isDemo);
    }
    if (typeof Habits !== 'undefined' && Habits.habits) {
      Habits.habits = Habits.habits.filter(h => !h.isDemo);
    }
    if (typeof App !== 'undefined' && App.renderDashboard) {
      App.renderDashboard();
    } else if (typeof Dashboard !== 'undefined' && Dashboard.render) {
      Dashboard.render();
    }
  }

  return {
    startWelcome,
    skipWelcome,
    startTour,
    skipTour,
    nextStep,
    prevStep,
    endTour,
    startChallenge,
    endChallengeSuccess,
    onTaskCreated,
    onPlanGenerated,
    onAiChat,
    onTaskCompleted,
    onAnalyticsViewed,
    restartTourFromSettings
  };
})();

window.ProductTour = ProductTour;
