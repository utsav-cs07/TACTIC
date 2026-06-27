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

  /* ── Init ── */
  function init(user, onChange) {
    onChangeCb = onChange;

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
      const [taskSnap, habitSnap, goalSnap] = await Promise.all([
        getUserPath('tasks').orderBy('createdAt', 'desc').get(),
        getUserPath('habits').get(),
        getUserPath('goals').get(),
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

      // Inject into localStorage so Tasks/Habits modules can use them
      localStorage.setItem('nexus_tasks',  JSON.stringify(tasks));
      localStorage.setItem('nexus_habits', JSON.stringify(habits));
      localStorage.setItem('nexus_goals',  JSON.stringify(goals));

      console.log(`[DB] Loaded from Firestore: ${tasks.length} tasks, ${habits.length} habits, ${goals.length} goals`);
      return true;
    } catch (err) {
      console.error('[DB] Firestore load error:', err);
      return false;
    }
  }

  /* ── Status ── */
  function getMode() { return isFirestore ? 'firestore' : 'localStorage'; }
  function getIcon() { return isFirestore ? '☁' : '💾'; }

  return { init, getTasks, addTask, updateTask, deleteTask, saveHabits, saveGoals, subscribeToTasks, unsubscribeAll, loadFromFirestore, migrateLocalToFirestore, getMode, getIcon };
})();
