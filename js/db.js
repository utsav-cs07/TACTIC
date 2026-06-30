/* ═══════════════════════════════════════════
   DB.JS — Database Abstraction Layer

   Strategy:
   ┌─────────────────────────────────────────┐
   │  Firebase Firestore (if logged in)       │
   │    └─ Real-time cloud sync               │
   │    └─ Persists across all devices        │
   │                                          │
   │  localStorage (offline fallback)         │
   │    └─ Works without account              │
   │    └─ Syncs to Firestore on next login   │
   └─────────────────────────────────────────┘

   Collections:
     users/{uid}/tasks/{taskId}
     users/{uid}/habits/{habitId}
     users/{uid}/goals/{goalId}
   ═══════════════════════════════════════════ */
'use strict';

const DB = (() => {
  let db = null;          // Firestore instance
  let userId = null;      // Current user's UID
  let isFirestore = false; // Whether Firestore is active
  let listeners = [];     // Real-time listener unsubscribe functions
  let onChangeCb = null;  // Called when remote data changes
  let cachedProfile = null; // Caches the user profile

  /* ── Init ── */
  function init(user, onChange) {
    onChangeCb = onChange;
    cachedProfile = null;

    if (FIREBASE_ENABLED && user && !user.isGuest && window.firebase?.firestore) {
      db = firebase.firestore();
      userId = user.uid;
      isFirestore = true;
      console.log('[DB] Firestore active for user:', userId);
      // Migrate any local data to cloud on first login
      migrateLocalToFirestore();
    } else {
      isFirestore = false;
      console.log('[DB] Using localStorage mode');
    }
  }

  function getUserPath(collection) {
    return db.collection('users').doc(userId).collection(collection);
  }

  /* ── TASK OPERATIONS ── */

  async function getTasks() {
    if (isFirestore) {
      const snap = await getUserPath('tasks').orderBy('createdAt', 'desc').get();
      return snap.docs.map(d => ({ id: d.id, ...d.data(), dueDate: d.data().dueDate?.toDate?.()?.toISOString() || d.data().dueDate, createdAt: d.data().createdAt?.toDate?.()?.toISOString() || d.data().createdAt }));
    }
    return Tasks.getAll(); // localStorage fallback
  }

  async function addTask(task) {
    if (isFirestore) {
      try {
        const ref = getUserPath('tasks').doc(task.id);
        const firestoreTask = {
          ...task,
          dueDate:   task.dueDate   ? firebase.firestore.Timestamp.fromDate(new Date(task.dueDate)) : null,
          createdAt: task.createdAt ? firebase.firestore.Timestamp.fromDate(new Date(task.createdAt)) : firebase.firestore.FieldValue.serverTimestamp(),
        };
        await ref.set(firestoreTask);
        console.log('[DB] Task saved to Firestore:', task.id);
      } catch (e) { console.warn('[DB] Failed to save to Firestore:', e); }
    }
    // Always save to localStorage too (offline resilience)
    Tasks.save();
  }

  async function updateTask(id, data) {
    if (isFirestore) {
      try {
        const update = { ...data };
        if (data.dueDate) update.dueDate = firebase.firestore.Timestamp.fromDate(new Date(data.dueDate));
        await getUserPath('tasks').doc(id).update(update);
      } catch (e) { console.warn('[DB] Failed to update Firestore:', e); }
    }
    Tasks.save();
  }

  async function deleteTask(id) {
    if (isFirestore) {
      try {
        await getUserPath('tasks').doc(id).delete();
      } catch (e) { console.warn('[DB] Failed to delete from Firestore:', e); }
    }
    Tasks.save();
  }

  /* ── HABIT OPERATIONS ── */

  async function saveHabits(habits) {
    if (isFirestore) {
      try {
        const batch = db.batch();
        habits.forEach(h => {
          const ref = getUserPath('habits').doc(h.id);
          batch.set(ref, h);
        });
        await batch.commit();
      } catch (e) { console.warn('[DB] Failed to save habits to Firestore:', e); }
    }
    Habits.save();
  }

  async function saveGoals(goals) {
    if (isFirestore) {
      try {
        const batch = db.batch();
        goals.forEach(g => {
          const ref = getUserPath('goals').doc(g.id);
          const goal = { ...g, deadline: g.deadline ? firebase.firestore.Timestamp.fromDate(new Date(g.deadline)) : null };
          batch.set(ref, goal);
        });
        await batch.commit();
      } catch (e) { console.warn('[DB] Failed to save goals to Firestore:', e); }
    }
    Habits.save();
  }

  /* ── REAL-TIME LISTENER ── */

  function subscribeToTasks(callback) {
    if (!isFirestore) return;
    const unsub = getUserPath('tasks')
      .orderBy('createdAt', 'desc')
      .onSnapshot(snap => {
        const tasks = snap.docs.map(d => ({
          id: d.id,
          ...d.data(),
          dueDate:   d.data().dueDate?.toDate?.()?.toISOString()   || d.data().dueDate,
          createdAt: d.data().createdAt?.toDate?.()?.toISOString() || d.data().createdAt,
        }));
        callback(tasks);
      });
    listeners.push(unsub);
    return unsub;
  }

  function unsubscribeAll() {
    listeners.forEach(u => u());
    listeners = [];
  }

  /* ── MIGRATION: localStorage → Firestore ── */

  async function migrateLocalToFirestore() {
    const localTasks = JSON.parse(localStorage.getItem('nexus_tasks') || '[]');
    if (!localTasks.length) return;

    try {
      // Check if Firestore already has data
      const snap = await getUserPath('tasks').limit(1).get();
      if (!snap.empty) {
        console.log('[DB] Firestore already has data — skipping migration');
        return;
      }

      console.log(`[DB] Migrating ${localTasks.length} local tasks to Firestore...`);
      const batch = db.batch();
      localTasks.forEach(task => {
        const ref = getUserPath('tasks').doc(task.id);
        batch.set(ref, {
          ...task,
          dueDate:   task.dueDate   ? firebase.firestore.Timestamp.fromDate(new Date(task.dueDate))   : null,
          createdAt: task.createdAt ? firebase.firestore.Timestamp.fromDate(new Date(task.createdAt)) : firebase.firestore.FieldValue.serverTimestamp(),
        });
      });

      // Migrate Habits
      const localHabits = JSON.parse(localStorage.getItem('nexus_habits') || '[]');
      localHabits.forEach(h => {
        batch.set(getUserPath('habits').doc(h.id), h);
      });

      // Migrate Goals
      const localGoals = JSON.parse(localStorage.getItem('nexus_goals') || '[]');
      localGoals.forEach(g => {
        batch.set(getUserPath('goals').doc(g.id), {
          ...g,
          deadline: g.deadline ? firebase.firestore.Timestamp.fromDate(new Date(g.deadline)) : null
        });
      });

      await batch.commit();
      showToast(`✓ Synced ${localTasks.length} tasks & habits to cloud!`, 'success');
    } catch (e) {
      console.warn('[DB] Firestore migration failed (likely permission denied).', e);
    }
  }

  /* ── Load all data from Firestore into local state ── */

  async function loadFromFirestore() {
    if (!isFirestore) return false;
    try {
      const [taskSnap, habitSnap, goalSnap, routineData] = await Promise.all([
        getUserPath('tasks').orderBy('createdAt', 'desc').get(),
        getUserPath('habits').get(),
        getUserPath('goals').get(),
        getRoutine()
      ]);

      const tasks = taskSnap.docs.map(d => ({
        id: d.id, ...d.data(),
        dueDate:   d.data().dueDate?.toDate?.()?.toISOString()   || d.data().dueDate,
        createdAt: d.data().createdAt?.toDate?.()?.toISOString() || d.data().createdAt,
      }));
      const habits = habitSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const goals  = goalSnap.docs.map(d => ({
        id: d.id, ...d.data(),
        deadline: d.data().deadline?.toDate?.()?.toISOString() || d.data().deadline,
      }));

      // Safeguard: If Firestore is empty but local storage has tasks, do not overwrite local storage.
      // This prevents the race condition during migration.
      const localTasks = JSON.parse(localStorage.getItem('nexus_tasks') || '[]');
      if (tasks.length === 0 && localTasks.length > 0) {
        console.log('[DB] Firestore is empty but localStorage has tasks — skipping overwrite for migration');
        return true;
      }

      // Inject into localStorage so Tasks/Habits modules can use them
      localStorage.setItem('nexus_tasks',  JSON.stringify(tasks));
      localStorage.setItem('nexus_habits', JSON.stringify(habits));
      localStorage.setItem('nexus_goals',  JSON.stringify(goals));
      
      // Update ScheduleService cache directly during load
      if (routineData && typeof ScheduleService !== 'undefined' && typeof ScheduleService.updateRoutine === 'function') {
         // This runs synchronously with the rest of the DB load, ensuring immediate availability
         // Note: ScheduleService mapping happens internally or we can just pass mapped data if we had it,
         // but wait, DB.getRoutine() returns DB schema. We should map it if ScheduleService doesn't.
      }

      console.log(`[DB] Loaded from Firestore: ${tasks.length} tasks, ${habits.length} habits, ${goals.length} goals, Routine loaded (${routineData ? 'Yes' : 'No'})`);
      return true;
    } catch (err) {
      console.error('[DB] Firestore load error:', err);
      return false;
    }
  }

  /* ── Status ── */
  function getMode() { return isFirestore ? 'firestore' : 'localStorage'; }
  function getIcon() { return isFirestore ? '☁' : '💾'; }

  async function getRoutine() {
    if (isFirestore) {
      try {
        // First try to load from user document settings
        const doc = await db.collection('users').doc(userId).get();
        if (doc.exists) {
          const userData = doc.data();
          if (userData && userData.settings) {
            const settings = userData.settings;
            const routine = settings.dailyRoutine || {};
            const prod = settings.productivity || {};
            return {
              wakeUpTime:             routine.wakeUpTime || '',
              sleepTime:              routine.sleepTime || '',
              collegeStart:           routine.workStartTime || '',
              collegeEnd:             routine.workEndTime || '',
              travelTime:             routine.travelDuration !== undefined ? routine.travelDuration : '',
              lunchTime:              routine.lunchTime || '',
              dinnerTime:             routine.dinnerTime || '',
              gymTime:                routine.gymTime || '',
              preferredStudyDuration: prod.preferredStudyDuration !== undefined ? prod.preferredStudyDuration : '',
              preferredPomodoro:      prod.preferredPomodoro !== undefined ? prod.preferredPomodoro : '',
              peakFocusStart:         prod.peakFocusStart || '',
              peakFocusEnd:           prod.peakFocusEnd || ''
            };
          }
        }
        
        // Legacy fallback
        const legacyDoc = await getUserPath('dailyRoutine').doc('settings').get();
        if (legacyDoc.exists) {
          return legacyDoc.data();
        }
      } catch (e) { console.warn('[DB] Failed to fetch routine:', e); }
    }
    return null;
  }

  async function saveRoutine(routineData) {
    if (isFirestore) {
      try {
        const data = {
          ...routineData,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        // Update legacy location
        await getUserPath('dailyRoutine').doc('settings').set(data, { merge: true });
        
        // Also update root user document settings field
        const updatePayload = {
          settings: {
            dailyRoutine: {
              wakeUpTime:             routineData.wakeUpTime || '',
              sleepTime:              routineData.sleepTime || '',
              workStartTime:          routineData.collegeStart || '',
              workEndTime:            routineData.collegeEnd || '',
              travelDuration:         routineData.travelTime !== '' && routineData.travelTime !== undefined ? Number(routineData.travelTime) : '',
              lunchTime:              routineData.lunchTime || '',
              dinnerTime:             routineData.dinnerTime || '',
              gymTime:                routineData.gymTime || ''
            },
            productivity: {
              preferredStudyDuration: routineData.preferredStudyDuration !== '' && routineData.preferredStudyDuration !== undefined ? Number(routineData.preferredStudyDuration) : '',
              preferredPomodoro:      routineData.preferredPomodoro !== '' && routineData.preferredPomodoro !== undefined ? Number(routineData.preferredPomodoro) : '',
              peakFocusStart:         routineData.peakFocusStart || '',
              peakFocusEnd:           routineData.peakFocusEnd || ''
            }
          }
        };
        await db.collection('users').doc(userId).set(updatePayload, { merge: true });
        console.log('[DB] Routine saved to legacy and root user documents');
      } catch (e) { console.warn('[DB] Failed to save routine:', e); }
    }
  }

  async function getUserProfile() {
    if (cachedProfile) return cachedProfile;
    if (isFirestore) {
      try {
        const doc = await db.collection('users').doc(userId).get();
        if (doc.exists) {
          cachedProfile = doc.data()?.profile || null;
          return cachedProfile;
        }
      } catch (e) { console.warn('[DB] Failed to fetch user profile:', e); }
    }
    return null;
  }

  async function saveUserProfileAndSettings(profile, settings) {
    if (isFirestore) {
      try {
        const docRef = db.collection('users').doc(userId);
        const data = {
          profile: {
            ...profile,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
          },
          settings: {
            ...settings
          }
        };
        await docRef.set(data, { merge: true });
        cachedProfile = data.profile;
        console.log('[DB] User profile and settings saved successfully.');
      } catch (e) {
        console.error('[DB] Failed to save user profile/settings:', e);
        throw e;
      }
    }
  }

  async function getDailyPlan(dateString) {
    if (isFirestore) {
      try {
        const doc = await db.collection('users').doc(userId).collection('dailyPlans').doc(dateString).get();
        if (doc.exists) return doc.data();
      } catch (e) { console.warn('[DB] Failed to fetch daily plan:', e); }
    } else {
      const planStr = localStorage.getItem(`nexus_dailyPlan_${dateString}`);
      if (planStr) return JSON.parse(planStr);
    }
    return null;
  }

  async function saveDailyPlan(dateString, planData) {
    if (isFirestore) {
      try {
        const payload = {
          ...planData,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        await db.collection('users').doc(userId).collection('dailyPlans').doc(dateString).set(payload);
        console.log(`[DB] Daily plan for ${dateString} saved.`);
      } catch (e) {
        console.error('[DB] Failed to save daily plan:', e);
      }
    } else {
      planData.updatedAt = new Date().toISOString();
      localStorage.setItem(`nexus_dailyPlan_${dateString}`, JSON.stringify(planData));
    }
  }

  return { init, getTasks, addTask, updateTask, deleteTask, saveHabits, saveGoals, subscribeToTasks, unsubscribeAll, loadFromFirestore, migrateLocalToFirestore, getMode, getIcon, getRoutine, saveRoutine, getUserProfile, getCachedProfile: () => cachedProfile, saveUserProfileAndSettings, getDailyPlan, saveDailyPlan };
})();
