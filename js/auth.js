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
      if (user) {
        const splash = document.getElementById('splash-screen');
        if (splash) splash.style.display = 'none';
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
      // Removed Calendar scopes from initial login to bypass Google's "Unverified App" warning
      const result = await firebase.auth().signInWithPopup(provider);

      // Store the OAuth access token for Google Calendar API calls (if available)
      const credential = result.credential;
      if (credential && credential.accessToken) {
        sessionStorage.setItem('nexus_goog_token', credential.accessToken);
      }

      showToast(`Welcome, ${result.user.displayName}! 🎉`, 'success');
    } catch (err) {

      console.error('Sign-in error:', err);
      if (err.code !== 'auth/popup-closed-by-user') {
        showToast('Sign-in failed: ' + err.message, 'error');
      }
    }
  }

  async function signOut() {
    if (!FIREBASE_ENABLED) return;
    try {
      await firebase.auth().signOut();
      sessionStorage.removeItem('nexus_goog_token');
      showToast('Signed out. Data saved locally.', 'info');
    } catch (err) {
      console.error('Sign-out error:', err);
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

    if (currentUser && !currentUser.isGuest) {
      if (avatar) {
        if (currentUser.photoURL) avatar.innerHTML = `<img src="${currentUser.photoURL}" style="width:100%;height:100%;border-radius:50%;object-fit:cover" alt="Profile">`;
        else avatar.textContent = (currentUser.displayName || 'U')[0].toUpperCase();
      }
      if (userNameEl) userNameEl.textContent = currentUser.displayName || currentUser.email;
      if (loginBtn) loginBtn.style.display = 'none';
      if (logoutBtn) logoutBtn.style.display = 'flex';
      
      if (btnLoginSett) btnLoginSett.style.display = 'none';
      if (btnLogoutSett) btnLogoutSett.style.display = 'block';

      const syncBadge = document.getElementById('sync-badge');
      if (syncBadge) { syncBadge.style.display = 'flex'; syncBadge.textContent = '☁ Synced'; }
    } else {
      if (avatar) avatar.textContent = 'G';
      if (userNameEl) userNameEl.textContent = 'Guest (offline)';
      if (loginBtn) loginBtn.style.display = 'flex';
      if (logoutBtn) logoutBtn.style.display = 'none';
      
      if (btnLoginSett) btnLoginSett.style.display = 'block';
      if (btnLogoutSett) btnLogoutSett.style.display = 'none';

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
    const splash = document.getElementById('splash-screen');
    if (splash) splash.style.display = 'none';
    
    // Seed 2 default tasks if empty for Hackathon Judges
    setTimeout(() => {
      if (window.Tasks && window.DB && Tasks.getAll().length === 0) {
        const t1 = Tasks.create({
          title: 'Review NEXUS AI Architecture',
          desc: 'Explore the source code, check the AI parsing logic in parser.js, and evaluate the prompt engineering.',
          category: 'work',
          priority: 'critical',
          dueDate: new Date().toISOString(),
          estimatedMins: 30
        });
        const t2 = Tasks.create({
          title: 'Test AI Task Extraction',
          desc: 'Upload a sample datesheet image or CSV to watch the AI automatically parse and prioritize exams.',
          category: 'personal',
          priority: 'high',
          dueDate: new Date(Date.now() + 86400000).toISOString(),
          estimatedMins: 15
        });
        DB.addTask(t1);
        DB.addTask(t2);
        if (window.App) {
          App.renderCurrentView();
          App.updateBadges();
        }
        showToast('Loaded default tasks for Guest Mode.', 'info');
      }
    }, 500);
  }

  return { init, signInWithGoogle, signOut, getUser, isLoggedIn, getAccessToken, updateUI, splashSignInWithGoogle, continueAsGuest };
})();
