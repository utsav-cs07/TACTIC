/* ═══════════════════════════════════════════
   AUTH.JS — Firebase Google Authentication
   
   Handles:
   - Google Sign-In / Sign-Out
   - Auth state changes (updates UI)
   - User profile display
   ═══════════════════════════════════════════ */
'use strict';

const Auth = (() => {
  let currentUser = null;
  let onAuthChangeCb = null;

  function init(onAuthChange) {
    onAuthChangeCb = onAuthChange;

    if (window.isDemoMode) {
      // In Demo Mode, immediately enter as guest, skip Firebase, skip splash screen
      currentUser = { uid: 'local-guest', displayName: 'Demo User', email: '', photoURL: null, isGuest: true };
      updateUI();
      const splash = document.getElementById('splash-screen');
      if (splash) splash.style.display = 'none';
      if (onAuthChangeCb) onAuthChangeCb(currentUser);
      return;
    }

    if (!FIREBASE_ENABLED) {
      // Run as guest (localStorage mode)
      currentUser = { uid: 'local-guest', displayName: 'Guest User', email: '', photoURL: null, isGuest: true };
      updateUI();
      if (onAuthChangeCb) onAuthChangeCb(currentUser);
      return;
    }

    // Listen for Firebase auth state changes
    firebase.auth().onAuthStateChanged((user) => {
      currentUser = user;
      updateUI();
      const splash = document.getElementById('splash-screen');
      if (user) {
        if (splash) splash.style.display = 'none';
      } else {
        // User is not signed in
        const isGuest = localStorage.getItem('nexus_guest_mode') === 'true';
        if (!isGuest && splash) {
          splash.style.display = 'flex';
        }
      }
      if (onAuthChangeCb) onAuthChangeCb(user);
    });
  }

  async function signInWithGoogle() {
    if (!FIREBASE_ENABLED) {
      showToast('⚙️ Open js/firebase-config.js, paste your keys & set FIREBASE_ENABLED = true', 'warning', 6000);
      return;
    }
    try {
      const provider = new firebase.auth.GoogleAuthProvider();
      provider.addScope('https://www.googleapis.com/auth/calendar');
      provider.addScope('https://www.googleapis.com/auth/calendar.events');
      provider.addScope('https://www.googleapis.com/auth/calendar.readonly');
      provider.setCustomParameters({ prompt: 'select_account consent' });
      
      const result = await firebase.auth().signInWithPopup(provider);
      
      // Save OAuth token for GCal Sync
      const credential = result.credential;
      if (credential && credential.accessToken) {
        sessionStorage.setItem('nexus_goog_token', credential.accessToken);
        // Trigger GCal init if loaded
        if (typeof GCal !== 'undefined') {
          setTimeout(() => {
            GCal.init();
            // Automatically sync all pending tasks to calendar after init
            setTimeout(() => {
              if (GCal.isConnected() && typeof Tasks !== 'undefined') GCal.syncAllTasks(Tasks.getAll());
            }, 2000);
          }, 500);
        }
      }

      showToast(`Welcome, ${result.user.displayName}! 🎉 Calendar Connected.`, 'success');
    } catch (err) {
      console.error('Sign-in error:', err);
      if (err.code !== 'auth/popup-closed-by-user') {
        showToast('Sign-in failed: ' + err.message, 'error');
      }
    }
  }

  async function signInForCalendar() {
    if (!FIREBASE_ENABLED) return null;
    try {
      const provider = new firebase.auth.GoogleAuthProvider();
      provider.addScope('https://www.googleapis.com/auth/calendar');
      provider.addScope('https://www.googleapis.com/auth/calendar.events');
      provider.addScope('https://www.googleapis.com/auth/calendar.readonly');
      provider.setCustomParameters({ prompt: 'select_account consent' });
      
      const result = await firebase.auth().signInWithPopup(provider);
      const credential = result.credential;
      if (credential && credential.accessToken) {
        sessionStorage.setItem('nexus_goog_token', credential.accessToken);
        return credential.accessToken;
      }
      return null;
    } catch (err) {
      console.error('Calendar sign-in error:', err);
      if (err.code !== 'auth/popup-closed-by-user') {
        showToast('Calendar sign-in failed: ' + err.message, 'error');
      }
      return null;
    }
  }

  async function signOut() {
    try {
      if (typeof firebase !== 'undefined' && firebase.auth) {
        await firebase.auth().signOut();
      }
    } catch (err) {
      console.error('Sign-out error:', err);
    } finally {
      sessionStorage.removeItem('nexus_goog_token');
      localStorage.clear(); // Wipe sensitive data from screen
      location.reload();    // Hard reset UI
    }
  }

  function getUser()        { return currentUser; }
  function isLoggedIn()     { return !!currentUser && !currentUser?.isGuest; }
  function getAccessToken() { return sessionStorage.getItem('nexus_goog_token'); }

  function updateUI() {
    const avatar = document.querySelector('.user-avatar');
    const loginBtn = document.getElementById('auth-login-btn');
    const logoutBtn = document.getElementById('auth-logout-btn');
    const userNameEl = document.getElementById('auth-user-name');
    
    // Also handle settings buttons
    const btnLoginSett = document.getElementById('auth-login-btn-settings');
    const btnLogoutSett = document.getElementById('auth-logout-btn');
    const demoBadge = document.getElementById('demo-badge');

    if (currentUser && !currentUser.isGuest) {
      if (avatar) {
        if (currentUser.photoURL) {
          const fallback = (currentUser.displayName || currentUser.email || 'U')[0].toUpperCase();
          avatar.innerHTML = `<img src="${currentUser.photoURL}" referrerpolicy="no-referrer" style="width:100%;height:100%;border-radius:50%;object-fit:cover" alt="Profile" onerror="this.onerror=null; this.outerHTML='${fallback}'">`;
        } else {
          avatar.textContent = (currentUser.displayName || currentUser.email || 'U')[0].toUpperCase();
        }
      }
      if (userNameEl) userNameEl.textContent = currentUser.displayName || currentUser.email;
      if (loginBtn) loginBtn.style.display = 'none';
      if (logoutBtn) logoutBtn.style.display = 'flex';
      
      if (btnLoginSett) btnLoginSett.style.display = 'none';
      if (btnLogoutSett) btnLogoutSett.style.display = 'block';
      if (demoBadge) demoBadge.style.display = 'none';

      const syncBadge = document.getElementById('sync-badge');
      if (syncBadge) { syncBadge.style.display = 'flex'; syncBadge.textContent = '☁ Synced'; }
    } else {
      if (avatar) avatar.textContent = 'G';
      if (userNameEl) userNameEl.textContent = 'Guest (offline)';
      if (loginBtn) loginBtn.style.display = 'flex';
      if (logoutBtn) logoutBtn.style.display = 'none';
      
      if (btnLoginSett) btnLoginSett.style.display = 'block';
      if (btnLogoutSett) btnLogoutSett.style.display = 'none';
      if (demoBadge && currentUser && currentUser.isGuest) demoBadge.style.display = 'flex';

      const syncBadge = document.getElementById('sync-badge');
      if (syncBadge) { syncBadge.style.display = 'flex'; syncBadge.textContent = '💾 Local'; syncBadge.style.color = 'var(--text-muted)'; }
    }
  }

  async function splashSignInWithGoogle() {
    await signInWithGoogle();
    if (currentUser && !currentUser.isGuest) {
      const splash = document.getElementById('splash-screen');
      if (splash) splash.style.display = 'none';
    }
  }

  function continueAsGuest() {
    window.isGuestMode = true;
    currentUser = { uid: 'local-guest', displayName: 'Guest User', email: '', photoURL: null, isGuest: true };
    updateUI();
    
    const splash = document.getElementById('splash-screen');
    if (splash) splash.style.display = 'none';
    
    showToast('Entering Guest Demo Mode...', 'info', 3000);
    
    // Clear localStorage to ensure fresh demo state
    localStorage.clear();
    
    const now = new Date();
    const d = (offsetDays, h = 10, m = 0) => {
      const dt = new Date(now); dt.setDate(dt.getDate() + offsetDays); dt.setHours(h, m, 0, 0); return dt.toISOString();
    };

    // Rich Demo Tasks
    const demoTasks = [
      { id: Tasks.uid(), isDemo: true, title: 'Complete Machine Learning Assignment', desc: 'Implement neural network from scratch', category: 'work', priority: 'critical', dueDate: d(0, 15, 0), completed: false, estimatedMins: 120, tags: ['ML', 'urgent'] },
      { id: Tasks.uid(), isDemo: true, title: 'Prepare for TOC Exam', desc: 'Revise automata and Turing machines', category: 'work', priority: 'high', dueDate: d(1, 10, 0), completed: false, estimatedMins: 90, tags: ['exam'] },
      { id: Tasks.uid(), isDemo: true, title: 'Submit Hackathon Project', desc: 'Finalize TACTIC codebase', category: 'work', priority: 'critical', dueDate: d(0, 23, 59), completed: false, estimatedMins: 180, tags: ['hackathon'] },
      { id: Tasks.uid(), isDemo: true, title: 'Revise DBMS', desc: 'SQL queries and normalization', category: 'work', priority: 'medium', dueDate: d(2, 14, 0), completed: false, estimatedMins: 60, tags: ['dbms'] },
      { id: Tasks.uid(), isDemo: true, title: 'Gym Workout', desc: 'Pull day', category: 'health', priority: 'high', dueDate: d(0, 18, 0), completed: true, estimatedMins: 60, tags: ['fitness'] }
    ];

    // Rich Demo Habits
    const demoHabits = [
      { id: Habits.uid ? Habits.uid() : Tasks.uid(), isDemo: true, name: 'Drink Water', icon: '💧', color: '#00d4ff', streak: 12, target: 'daily' },
      { id: Habits.uid ? Habits.uid() : Tasks.uid(), isDemo: true, name: 'Read 30 Minutes', icon: '📚', color: '#a855f7', streak: 5, target: 'daily' },
      { id: Habits.uid ? Habits.uid() : Tasks.uid(), isDemo: true, name: 'Exercise', icon: '🏋️', color: '#00ff88', streak: 3, target: 'daily' },
      { id: Habits.uid ? Habits.uid() : Tasks.uid(), isDemo: true, name: 'Meditation', icon: '🧘', color: '#ffb800', streak: 8, target: 'daily' }
    ];

    // Rich Demo Goals
    const demoGoals = [
      { id: Habits.uid ? Habits.uid() : Tasks.uid(), isDemo: true, name: 'Maintain 90% Attendance', icon: '🎓', color: '#00d4ff', milestones: [{id: 1, title: 'September', done: true}, {id: 2, title: 'October', done: false}] },
      { id: Habits.uid ? Habits.uid() : Tasks.uid(), isDemo: true, name: 'Learn Azure Data Engineering', icon: '☁️', color: '#0088ff', milestones: [{id: 1, title: 'Data Factory', done: true}, {id: 2, title: 'Databricks', done: false}] },
      { id: Habits.uid ? Habits.uid() : Tasks.uid(), isDemo: true, name: 'Complete Semester Project', icon: '🚀', color: '#a855f7', milestones: [{id: 1, title: 'Phase 1', done: true}, {id: 2, title: 'Phase 2', done: false}] }
    ];

    setTimeout(() => {
      if (typeof Tasks !== 'undefined' && typeof Tasks.setDemoData === 'function') Tasks.setDemoData(demoTasks);
      if (typeof Habits !== 'undefined' && typeof Habits.setDemoData === 'function') Habits.setDemoData(demoHabits);
      if (typeof Habits !== 'undefined' && typeof Habits.setDemoGoals === 'function') Habits.setDemoGoals(demoGoals);
      
      if (typeof App !== 'undefined') {
        App.renderCurrentView();
        App.updateBadges();
      }
      
      if (typeof ProductTour !== 'undefined') {
        ProductTour.start();
      }
    }, 300);
  }

  return { init, signInWithGoogle, signInForCalendar, signOut, getUser, isLoggedIn, getAccessToken, updateUI, splashSignInWithGoogle, continueAsGuest };
})();
