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
const NEXUS_CAL_NAME   = 'TACTIC Tasks'; // Name of the calendar we create

const GCal = (() => {
  let gapiReady   = false;
  let calendarId  = null; // ID of the TACTIC calendar in Google Calendar
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

    gapi.load('client', () => {
      gapi.client.init({
        apiKey:        GOOGLE_API_KEY,
        discoveryDocs: [GCAL_DISCOVERY],
      }).then(() => {
        gapiReady = true;
        // If already signed in via Firebase Auth and we have a token, set it
        const token = Auth.getAccessToken();
        if (token) {
          gapi.client.setToken({ access_token: token });
          isEnabled = true;
          cachedCalsToFetch = null;
          for (const key in eventsCache) delete eventsCache[key];
          ensureNexusCalendar();
          updateCalSyncUI(true);
        }
        console.log('[GCal] Initialized');
      }).catch(err => {
        console.warn('[GCal] Init error:', err);
        let msg = typeof err === 'object' ? JSON.stringify(err) : err;
        if (err && err.details) msg = err.details;
        else if (err && err.error && err.error.message) msg = err.error.message;
        initError = msg; 
      });
    });
  }

  /* ── Sign in specifically for calendar (delegated to Firebase) ── */
  async function signIn() {
    if (!gapiReady) { 
      if (initError) showToast('GCal Error: ' + initError, 'error', 10000);
      else showToast('Google Calendar API not configured. See README.', 'warning'); 
      return; 
    }
    try {
      const token = await Auth.signInForCalendar();
      if (!token) return; // User closed popup or failed

      gapi.client.setToken({ access_token: token });
      isEnabled = true;
      cachedCalsToFetch = null;
      for (const key in eventsCache) delete eventsCache[key];
      await ensureNexusCalendar();
      updateCalSyncUI(true);
      showToast('Google Calendar connected! ✅', 'success');
    } catch (err) {
      console.error('[GCal] Sign in error:', err);
      showToast('Calendar sign-in failed.', 'error');
    }
  }

  async function signOut() {
    if (gapiReady) {
      gapi.client.setToken(null);
    }
    isEnabled = false;
    calendarId = null;
    cachedCalsToFetch = null;
    for (const key in eventsCache) delete eventsCache[key];
    updateCalSyncUI(false);
    showToast('Google Calendar disconnected.', 'info');
  }

  /* ── Setup Google Calendar Target ── */
  async function ensureNexusCalendar() {
    if (!isEnabled) return;
    calendarId = 'primary';
    console.log('[GCal] Calendar ID set to primary');
  }

  /* ── Add task → Google Calendar event ── */
  async function addEvent(task) {
    if (!isEnabled || !calendarId || !task.dueDate) return null;
    try {
      const start = new Date(task.dueDate);
      const end   = new Date(start.getTime() + (task.estimatedMins || 30) * 60000);

      const event = {
        summary:     task.title,
        description: task.desc || `Category: ${task.category}\nPriority: ${task.priority}\nFrom TACTIC`,
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

  let cachedCalsToFetch = null;
  const eventsCache = {};

  /* ── Fetch events from ALL relevant Google Calendars (Two-Way Sync) ── */
  async function getExternalEvents(startDate, endDate) {
    if (!isEnabled) return [];
    
    // Check cache for instant load
    const monthKey = startDate.toISOString().slice(0, 7); // e.g. "2026-06"
    if (eventsCache[monthKey]) return eventsCache[monthKey];

    try {
      // 1. Get list of calendars (Primary + Holidays) (Cached)
      if (!cachedCalsToFetch) {
        const calListRes = await gapi.client.calendar.calendarList.list();
        console.log('[GCal] Raw calendar list from Google API:', calListRes.result.items);
        cachedCalsToFetch = calListRes.result.items.filter(c => 
          c.primary || 
          (c.id && c.id.toLowerCase().includes('holiday')) || 
          (c.summary && c.summary.toLowerCase().includes('holiday'))
        );
        console.log('[GCal] Filtered calendars to sync:', cachedCalsToFetch);
      }

      let allEvents = [];

      // 2. Fetch events for each calendar
      await Promise.all(cachedCalsToFetch.map(async (cal) => {
        try {
          const res = await gapi.client.calendar.events.list({
            calendarId:   cal.id,
            timeMin:      startDate.toISOString(),
            timeMax:      endDate.toISOString(),
            singleEvents: true,
            orderBy:      'startTime',
            maxResults:   50,
          });
          const items = res.result.items || [];
          const mapped = items
            .filter(e => !(e.extendedProperties && e.extendedProperties.private && e.extendedProperties.private.nexusTaskId))
            .map(e => ({
              id: e.id,
              title: e.summary,
              start: e.start.dateTime || e.start.date, // date is for all-day events like holidays
              isExternal: true,
              isHoliday: (cal.id && cal.id.toLowerCase().includes('holiday')) || (cal.summary && cal.summary.toLowerCase().includes('holiday'))
            }));
          allEvents = allEvents.concat(mapped);
        } catch(e) { console.warn('Failed to fetch cal:', cal.id); }
      }));

      // Deduplicate by title and start date (Google sometimes returns duplicates from different calendars)
      const seen = new Set();
      allEvents = allEvents.filter(e => {
        const key = e.title + e.start;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      eventsCache[monthKey] = allEvents; // Save to cache
      return allEvents;
    } catch (err) {
      const details = err?.result?.error?.message || err?.message || JSON.stringify(err);
      console.warn('[GCal] getExternalEvents error:', details, err);
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
        if (typeof DB !== 'undefined') DB.updateTask(task.id, { gcalEventId: eventId });
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

  return { init, signIn, signOut, addEvent, updateEvent, deleteEvent, getEvents, getExternalEvents, syncAllTasks, isConnected };
})();
