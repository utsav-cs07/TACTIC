/* ═══════════════════════════════════════════
   GCAL.JS — Google Calendar API Integration
   
   HOW TO SET THIS UP:
   1. Go to https://console.cloud.google.com/
   2. Select your Firebase project
   3. APIs & Services → Library → Enable "Google Calendar API"
   4. APIs & Services → Credentials → Create OAuth 2.0 Client ID (Web)
   5. Add your domain to "Authorized JavaScript origins"
   6. Paste your Client ID and API Key below
   ═══════════════════════════════════════════ */
'use strict';

// ── PASTE YOUR VALUES HERE ──
const GOOGLE_CLIENT_ID = window.ENV.GOOGLE_CLIENT_ID;
const GOOGLE_API_KEY   = window.ENV.GOOGLE_API_KEY;

const GCAL_SCOPES      = 'https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.events';
const GCAL_DISCOVERY   = 'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest';
const NEXUS_CAL_NAME   = 'NEXUS AI Tasks'; // Name of the calendar we create

const GCal = (() => {
  let gapiReady   = false;
  let calendarId  = null; // ID of the NEXUS calendar in Google Calendar
  let isEnabled   = false;
  let initError   = null;

  /* ── Init ── */
  function init() {
    // Check if gapi is available and credentials are set
    if (!window.gapi) { console.log('[GCal] gapi not loaded — Calendar sync disabled'); return; }
    if (GOOGLE_CLIENT_ID === 'YOUR_CLIENT_ID.apps.googleusercontent.com') {
      console.log('[GCal] No Client ID configured — Calendar sync disabled');
      return;
    }

    gapi.load('client:auth2', () => {
      gapi.client.init({
        apiKey:        GOOGLE_API_KEY,
        clientId:      GOOGLE_CLIENT_ID,
        discoveryDocs: [GCAL_DISCOVERY],
        scope:         GCAL_SCOPES,
      }).then(() => {
        gapiReady = true;
        // If already signed in via Firebase Auth, use their token
        const token = Auth.getAccessToken();
        if (token) {
          gapi.client.setToken({ access_token: token });
          isEnabled = true;
          ensureNexusCalendar();
          updateCalSyncUI(true);
        }
        console.log('[GCal] Initialized');
      }).catch(err => {
        console.warn('[GCal] Init error:', err);
        let msg = typeof err === 'object' ? JSON.stringify(err) : err;
        if (err && err.details) msg = err.details;
        else if (err && err.error && err.error.message) msg = err.error.message;
        initError = msg; // Store the error instead of spamming the user on every page load
      });
    });
  }

  /* ── Sign in specifically for calendar (if not already via Firebase) ── */
  async function signIn() {
    if (!gapiReady) { 
      if (initError) showToast('GCal Error: ' + initError, 'error', 10000);
      else showToast('Google Calendar API not configured. See README.', 'warning'); 
      return; 
    }
    try {
      await gapi.auth2.getAuthInstance().signIn({ scope: GCAL_SCOPES });
      isEnabled = true;
      await ensureNexusCalendar();
      updateCalSyncUI(true);
      showToast('Google Calendar connected! ✅', 'success');
    } catch (err) {
      console.error('[GCal] Sign in error:', err);
      showToast('Calendar sign-in failed. Check browser pop-up blocker.', 'error');
    }
  }

  async function signOut() {
    if (gapiReady) await gapi.auth2.getAuthInstance().signOut();
    isEnabled = false;
    calendarId = null;
    updateCalSyncUI(false);
    showToast('Google Calendar disconnected.', 'info');
  }

  /* ── Ensure "NEXUS AI Tasks" calendar exists ── */
  async function ensureNexusCalendar() {
    if (!isEnabled) return;
    const savedId = localStorage.getItem('nexus_gcal_id');
    if (savedId) { calendarId = savedId; return; }

    try {
      // List existing calendars
      const res = await gapi.client.calendar.calendarList.list();
      const existing = res.result.items.find(c => c.summary === NEXUS_CAL_NAME);
      if (existing) {
        calendarId = existing.id;
      } else {
        // Create NEXUS calendar
        const created = await gapi.client.calendar.calendars.insert({
          resource: { summary: NEXUS_CAL_NAME, description: 'Tasks synced from NEXUS AI Productivity Companion', timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }
        });
        calendarId = created.result.id;
        showToast('Created "NEXUS AI Tasks" calendar in Google Calendar 📅', 'success');
      }
      localStorage.setItem('nexus_gcal_id', calendarId);
      console.log('[GCal] Calendar ID:', calendarId);
    } catch (err) {
      console.error('[GCal] Calendar setup error:', err);
    }
  }

  /* ── Add task → Google Calendar event ── */
  async function addEvent(task) {
    if (!isEnabled || !calendarId || !task.dueDate) return null;
    try {
      const start = new Date(task.dueDate);
      const end   = new Date(start.getTime() + (task.estimatedMins || 30) * 60000);

      const event = {
        summary:     task.title,
        description: task.desc || `Category: ${task.category}\nPriority: ${task.priority}\nFrom NEXUS AI`,
        start: { dateTime: start.toISOString(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
        end:   { dateTime: end.toISOString(),   timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
        colorId:    priorityToColorId(task.priority),
        reminders:  { useDefault: false, overrides: [{ method: 'popup', minutes: 60 }, { method: 'popup', minutes: 15 }] },
        extendedProperties: { private: { nexusTaskId: task.id } },
      };

      const res = await gapi.client.calendar.events.insert({ calendarId, resource: event });
      console.log('[GCal] Event created:', res.result.id);
      return res.result.id;
    } catch (err) {
      console.warn('[GCal] Add event error:', err);
      return null;
    }
  }

  /* ── Update existing Google Calendar event ── */
  async function updateEvent(gcalEventId, task) {
    if (!isEnabled || !calendarId || !gcalEventId) return;
    try {
      const start = new Date(task.dueDate);
      const end   = new Date(start.getTime() + (task.estimatedMins || 30) * 60000);

      await gapi.client.calendar.events.patch({
        calendarId,
        eventId: gcalEventId,
        resource: {
          summary:     task.title,
          description: task.desc || '',
          start: { dateTime: start.toISOString() },
          end:   { dateTime: end.toISOString() },
          status: task.completed ? 'cancelled' : 'confirmed',
        }
      });
      console.log('[GCal] Event updated:', gcalEventId);
    } catch (err) {
      console.warn('[GCal] Update event error:', err);
    }
  }

  /* ── Delete Google Calendar event ── */
  async function deleteEvent(gcalEventId) {
    if (!isEnabled || !calendarId || !gcalEventId) return;
    try {
      await gapi.client.calendar.events.delete({ calendarId, eventId: gcalEventId });
      console.log('[GCal] Event deleted:', gcalEventId);
    } catch (err) {
      console.warn('[GCal] Delete event error:', err);
    }
  }

  /* ── Fetch events from Google Calendar for a date range ── */
  async function getEvents(startDate, endDate) {
    if (!isEnabled || !calendarId) return [];
    try {
      const res = await gapi.client.calendar.events.list({
        calendarId,
        timeMin:      startDate.toISOString(),
        timeMax:      endDate.toISOString(),
        singleEvents: true,
        orderBy:      'startTime',
        maxResults:   100,
      });
      return res.result.items || [];
    } catch (err) {
      console.warn('[GCal] Get events error:', err);
      return [];
    }
  }

  /* ── Sync all pending tasks to Google Calendar ── */
  async function syncAllTasks(tasks) {
    if (!isEnabled) return;
    const pending = tasks.filter(t => !t.completed && t.dueDate && !t.gcalEventId);
    let synced = 0;
    for (const task of pending) {
      const eventId = await addEvent(task);
      if (eventId) {
        Tasks.update(task.id, { gcalEventId: eventId });
        synced++;
      }
    }
    if (synced > 0) showToast(`✅ ${synced} tasks synced to Google Calendar`, 'success');
  }

  /* ── Helper: Map priority → Google Calendar color ── */
  function priorityToColorId(priority) {
    // Google Calendar color IDs: 1=Lavender, 2=Sage, 3=Grape, 4=Flamingo,
    // 5=Banana, 6=Tangerine, 7=Peacock, 8=Graphite, 9=Blueberry, 10=Basil, 11=Tomato
    return { critical: '11', high: '6', medium: '7', low: '8' }[priority] || '7';
  }

  /* ── Update UI sync status ── */
  function updateCalSyncUI(connected) {
    const btn  = document.getElementById('gcal-connect-btn');
    const badge = document.getElementById('gcal-status-badge');
    if (btn) {
      btn.textContent = connected ? '📅 Calendar Connected ✓' : '📅 Connect Google Calendar';
      btn.style.borderColor = connected ? 'rgba(0,255,136,0.4)' : '';
      btn.style.color = connected ? 'var(--neon-green)' : '';
    }
    if (badge) {
      badge.textContent = connected ? '📅 Cal Synced' : '';
      badge.style.display = connected ? 'inline' : 'none';
    }
  }

  function isConnected() { return isEnabled; }

  return { init, signIn, signOut, addEvent, updateEvent, deleteEvent, getEvents, syncAllTasks, isConnected };
})();
