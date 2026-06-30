/* ═══════════════════════════════════════════
   ONBOARDING.JS — Intelligent First-Time Onboarding
   ═══════════════════════════════════════════ */
'use strict';

const Onboarding = (() => {
  let currentUser = null;
  let currentStep = 1;
  const totalSteps = 3;

  function start(user) {
    currentUser = user;
    currentStep = 1;
    
    const obScreen = document.getElementById('onboarding-screen');
    if (!obScreen) return;

    // Show onboarding screen overlay
    obScreen.style.display = 'flex';

    // Populate user profile info
    const emailEl = document.getElementById('ob-user-email');
    const readOnlyEmailEl = document.getElementById('ob-email-readonly');
    const nameInput = document.getElementById('ob-fullname');
    
    if (emailEl) emailEl.textContent = user.email || 'guest@domain.com';
    if (readOnlyEmailEl) readOnlyEmailEl.value = user.email || '';
    if (nameInput && user.displayName) nameInput.value = user.displayName;

    const photoImg = document.getElementById('ob-user-photo');
    const photoPlaceholder = document.getElementById('ob-user-photo-placeholder');

    if (user.photoURL) {
      if (photoImg) {
        photoImg.src = user.photoURL;
        photoImg.style.display = 'block';
      }
      if (photoPlaceholder) photoPlaceholder.style.display = 'none';
    } else {
      if (photoImg) photoImg.style.display = 'none';
      if (photoPlaceholder) {
        photoPlaceholder.textContent = (user.displayName || user.email || 'U')[0].toUpperCase();
        photoPlaceholder.style.display = 'flex';
      }
    }

    // Reset step UI
    showStep(1);

    // Attach listeners to Step 2 input elements for live timeline updates
    const liveInputs = ['ob-wakeup', 'ob-sleep', 'ob-workstart', 'ob-workend', 'ob-travel', 'ob-gym', 'ob-lunch', 'ob-dinner'];
    liveInputs.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', renderTimeline);
      }
    });

    // Render timeline initially
    renderTimeline();
  }

  function showStep(step) {
    currentStep = step;

    // Hide/show step contents
    for (let i = 1; i <= totalSteps; i++) {
      const el = document.getElementById(`ob-step-${i}`);
      const dot = document.getElementById(`ob-step-dot-${i}`);
      if (el) {
        el.classList.toggle('active', i === step);
      }
      if (dot) {
        dot.classList.toggle('active', i === step);
        dot.classList.toggle('completed', i < step);
      }
    }

    // Hide success screen
    const successScreen = document.getElementById('ob-step-success');
    if (successScreen) successScreen.classList.remove('active');

    // Update Progress bar details
    const lineActive = document.getElementById('ob-progress-line-active');
    if (lineActive) {
      const percentage = ((step - 1) / (totalSteps - 1)) * 100;
      lineActive.style.width = `${percentage}%`;
    }

    const label = document.getElementById('ob-step-label');
    if (label) {
      const labels = [
        'Step 1 of 3: About You',
        'Step 2 of 3: Daily Routine',
        'Step 3 of 3: Study Preferences'
      ];
      label.textContent = labels[step - 1];
    }

    // Update navigation buttons
    const prevBtn = document.getElementById('ob-prev-btn');
    const nextBtn = document.getElementById('ob-next-btn');

    if (prevBtn) {
      prevBtn.style.visibility = step === 1 ? 'hidden' : 'visible';
    }

    if (nextBtn) {
      nextBtn.textContent = step === totalSteps ? '🚀 Start Using TACTIC' : 'Continue →';
      if (step === totalSteps) {
        nextBtn.style.background = 'var(--neon-green)';
        nextBtn.style.borderColor = 'var(--neon-green)';
        nextBtn.style.color = '#000';
        nextBtn.style.boxShadow = 'var(--glow-green)';
      } else {
        nextBtn.style.background = 'var(--neon-purple)';
        nextBtn.style.borderColor = 'var(--neon-purple)';
        nextBtn.style.color = '#fff';
        nextBtn.style.boxShadow = '0 0 15px rgba(138, 43, 226, 0.3)';
      }
    }
  }

  function validateStep(step) {
    if (step === 1) {
      const name = document.getElementById('ob-fullname').value.trim();
      const age = document.getElementById('ob-age').value;
      const role = document.getElementById('ob-role').value;

      if (!name) { showToast('Please enter your full name', 'warning'); return false; }
      if (!age || Number(age) <= 0) { showToast('Please enter a valid age', 'warning'); return false; }
      if (!role) { showToast('Please select your role', 'warning'); return false; }
      return true;
    }

    if (step === 2) {
      const wake = document.getElementById('ob-wakeup').value;
      const sleep = document.getElementById('ob-sleep').value;
      const wStart = document.getElementById('ob-workstart').value;
      const wEnd = document.getElementById('ob-workend').value;

      if (!wake) { showToast('Wake-up time is required', 'warning'); return false; }
      if (!sleep) { showToast('Sleep time is required', 'warning'); return false; }
      if (!wStart) { showToast('Work/College start time is required', 'warning'); return false; }
      if (!wEnd) { showToast('Work/College end time is required', 'warning'); return false; }
      
      const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
      if (!timeRegex.test(wake) || !timeRegex.test(sleep) || !timeRegex.test(wStart) || !timeRegex.test(wEnd)) {
        showToast('Please enter valid times in HH:MM format', 'warning');
        return false;
      }
      return true;
    }

    return true;
  }

  function next() {
    if (!validateStep(currentStep)) return;

    if (currentStep < totalSteps) {
      showStep(currentStep + 1);
      if (currentStep === 2) {
        renderTimeline();
      }
    } else {
      submitOnboarding();
    }
  }

  function prev() {
    if (currentStep > 1) {
      showStep(currentStep - 1);
    }
  }

  async function submitOnboarding() {
    const nextBtn = document.getElementById('ob-next-btn');
    const prevBtn = document.getElementById('ob-prev-btn');
    
    // Validate final required preferences
    const studyDur = document.getElementById('ob-studydur').value;
    const pomodoro = document.getElementById('ob-pomodoro').value;
    const peakStart = document.getElementById('ob-peakstart').value;
    const peakEnd = document.getElementById('ob-peakend').value;

    if (!studyDur) { showToast('Please select study session duration', 'warning'); return; }
    if (!pomodoro) { showToast('Please select pomodoro interval', 'warning'); return; }
    if (!peakStart || !peakEnd) { showToast('Please select peak focus hours', 'warning'); return; }

    if (nextBtn) nextBtn.disabled = true;
    if (prevBtn) prevBtn.disabled = true;

    // Show loading indicators
    showToast('Saving your productivity profile... 🧠', 'info');

    try {
      const profile = {
        fullName: document.getElementById('ob-fullname').value.trim(),
        age: Number(document.getElementById('ob-age').value),
        role: document.getElementById('ob-role').value,
        email: currentUser.email || '',
        photoURL: currentUser.photoURL || null,
        onboardingCompleted: true,
        createdAt: new Date().toISOString()
      };

      const settings = {
        dailyRoutine: {
          wakeUpTime: document.getElementById('ob-wakeup').value,
          sleepTime: document.getElementById('ob-sleep').value,
          workStartTime: document.getElementById('ob-workstart').value,
          workEndTime: document.getElementById('ob-workend').value,
          travelDuration: document.getElementById('ob-travel').value ? Number(document.getElementById('ob-travel').value) : 0,
          lunchTime: document.getElementById('ob-lunch').value || '',
          dinnerTime: document.getElementById('ob-dinner').value || '',
          gymTime: document.getElementById('ob-gym').value || ''
        },
        productivity: {
          preferredStudyDuration: Number(studyDur),
          preferredPomodoro: Number(pomodoro),
          peakFocusStart: peakStart,
          peakFocusEnd: peakEnd,
          smartSchedulingEnabled: document.getElementById('ob-smartschedule').checked
        }
      };

      // Save user profile and settings to firestore
      await DB.saveUserProfileAndSettings(profile, settings);

      // Map routine to ScheduleService legacy schema to keep scheduling working
      if (typeof ScheduleService !== 'undefined') {
        const legacyData = {
          wakeUp:                 settings.dailyRoutine.wakeUpTime,
          sleep:                  settings.dailyRoutine.sleepTime,
          collegeStart:           settings.dailyRoutine.workStartTime,
          collegeEnd:             settings.dailyRoutine.workEndTime,
          travelTimeMins:         settings.dailyRoutine.travelDuration,
          lunchTime:              settings.dailyRoutine.lunchTime,
          dinnerTime:             settings.dailyRoutine.dinnerTime,
          gymTime:                settings.dailyRoutine.gymTime,
          studyDurMins:           settings.productivity.preferredStudyDuration,
          pomodoroMins:           settings.productivity.preferredPomodoro,
          peakFocusStart:         settings.productivity.peakFocusStart,
          peakFocusEnd:           settings.productivity.peakFocusEnd
        };
        await ScheduleService.updateRoutine(legacyData);
      }

      // Refresh Settings View inputs if SettingsView exists
      if (typeof SettingsView !== 'undefined' && typeof SettingsView.render === 'function') {
        SettingsView.render();
      }

      // Hide all standard steps and show success ring
      for (let i = 1; i <= totalSteps; i++) {
        const el = document.getElementById(`ob-step-${i}`);
        if (el) el.classList.remove('active');
      }
      const footerNav = document.getElementById('ob-footer-nav');
      if (footerNav) footerNav.style.display = 'none';

      const successScreen = document.getElementById('ob-step-success');
      if (successScreen) {
        successScreen.classList.add('active');
        successScreen.style.display = 'block';
      }

      // Success animation visual pause
      setTimeout(() => {
        const obScreen = document.getElementById('onboarding-screen');
        if (obScreen) obScreen.style.display = 'none';
        showToast('Welcome to TACTIC! Onboarding complete. 🚀', 'success');
        
        // Re-enable buttons for future safety
        if (nextBtn) nextBtn.disabled = false;
        if (prevBtn) prevBtn.disabled = false;
        if (footerNav) footerNav.style.display = 'flex';
      }, 2500);

    } catch (err) {
      console.error('[Onboarding] Error submitting onboarding profile:', err);
      showToast('Error saving profile. Please check credentials.', 'error');
      if (nextBtn) nextBtn.disabled = false;
      if (prevBtn) prevBtn.disabled = false;
    }
  }

  function timeToMins(tStr) {
    if (!tStr) return null;
    const [h, m] = tStr.split(':').map(Number);
    return h * 60 + m;
  }

  function formatMinsToTime(mins) {
    const h = Math.floor(mins / 60) % 24;
    const m = mins % 60;
    const ampm = h >= 12 ? 'PM' : 'AM';
    const displayH = h % 12 === 0 ? 12 : h % 12;
    return `${displayH}:${String(m).padStart(2, '0')} ${ampm}`;
  }

  function renderTimeline() {
    const container = document.getElementById('ob-timeline');
    if (!container) return;
    
    // Clear previous timeline blocks
    const blocks = container.querySelectorAll('.visual-timeline-block');
    blocks.forEach(b => b.remove());

    const segments = [];
    const pushSegment = (start, end, label, className) => {
      if (start === null || end === null) return;
      let duration = end - start;
      if (duration <= 0) return;
      segments.push({ start, end, label, className });
    };

    // 1. Sleep Blocks (usually overlaps midnight)
    const wake = timeToMins(document.getElementById('ob-wakeup').value);
    const sleep = timeToMins(document.getElementById('ob-sleep').value);
    
    if (wake !== null && sleep !== null) {
      if (sleep > wake) {
        // Sleep spans across midnight (e.g. 23:00 to 07:00)
        pushSegment(sleep, 1440, '💤 Sleep', 'sleep');
        pushSegment(0, wake, '💤 Sleep', 'sleep');
      } else {
        pushSegment(sleep, wake, '💤 Sleep', 'sleep');
      }
    }

    // 2. Work/College Block
    const wStart = timeToMins(document.getElementById('ob-workstart').value);
    const wEnd = timeToMins(document.getElementById('ob-workend').value);
    if (wStart !== null && wEnd !== null) {
      if (wEnd > wStart) {
        pushSegment(wStart, wEnd, '🏫 College / Work', 'work');
      }
    }

    // 3. Travel Time (Commutes surrounding Work/College start and end)
    const travelVal = parseInt(document.getElementById('ob-travel').value) || 0;
    if (travelVal > 0 && wStart !== null && wEnd !== null) {
      const travToStart = Math.max(0, wStart - travelVal);
      pushSegment(travToStart, wStart, '🚗 Commute', 'work');
      
      const travEnd = Math.min(1440, wEnd + travelVal);
      pushSegment(wEnd, travEnd, '🚗 Commute', 'work');
    }

    // 4. Gym Time
    const gymStr = document.getElementById('ob-gym').value;
    if (gymStr) {
      const gym = timeToMins(gymStr);
      if (gym !== null) {
        pushSegment(gym, Math.min(1440, gym + 60), '💪 Gym / Workout', 'gym');
      }
    }

    // 5. Lunch Time
    const lunchStr = document.getElementById('ob-lunch').value;
    if (lunchStr) {
      const lunch = timeToMins(lunchStr);
      if (lunch !== null) {
        pushSegment(lunch, Math.min(1440, lunch + 45), '🍔 Lunch Break', 'meal');
      }
    }

    // 6. Dinner Time
    const dinnerStr = document.getElementById('ob-dinner').value;
    if (dinnerStr) {
      const dinner = timeToMins(dinnerStr);
      if (dinner !== null) {
        pushSegment(dinner, Math.min(1440, dinner + 45), '🍽️ Dinner Time', 'meal');
      }
    }

    // Sort segments by start time to process in chronological order
    segments.sort((a, b) => a.start - b.start);

    // Compute overlapping segments and assign columns
    const cols = []; // tracks end times of each column
    segments.forEach(seg => {
      let colIdx = 0;
      while (colIdx < cols.length && cols[colIdx] > seg.start) {
        colIdx++;
      }
      seg.col = colIdx;
      cols[colIdx] = seg.end;
    });

    const totalCols = cols.length || 1;

    // Second pass: find active overlaps for each segment to decide final block width layout
    segments.forEach(seg => {
      const overlaps = segments.filter(other => 
        other !== seg && 
        !(other.end <= seg.start || other.start >= seg.end)
      );
      seg.overlaps = overlaps;
    });

    // Render segments dynamically onto timeline UI
    segments.forEach(seg => {
      const topPct = (seg.start / 1440) * 100;
      const heightPct = ((seg.end - seg.start) / 1440) * 100;

      let leftPct = 0;
      let colWidth = 100;

      if (seg.overlaps.length > 0) {
        const colWidthUnit = 100 / totalCols;
        leftPct = seg.col * colWidthUnit;
        colWidth = colWidthUnit;
      }

      const block = document.createElement('div');
      block.className = `visual-timeline-block ${seg.className}`;
      block.style.top = `${topPct}%`;
      block.style.height = `${heightPct}%`;
      block.style.left = `calc(${leftPct}% + 4px)`;
      block.style.width = `calc(${colWidth}% - 8px)`;

      const timeStr = `${formatMinsToTime(seg.start)} - ${formatMinsToTime(seg.end)}`;
      block.title = `${seg.label} (${timeStr})`;

      // Optimize space usage: if event height is too small (under 60m), hide the secondary text elements
      const minMinsToShowTime = 60;
      if (seg.end - seg.start < minMinsToShowTime) {
        block.innerHTML = `<div style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; width:100%; font-size:0.6rem; font-weight:700;">${seg.label}</div>`;
      } else {
        block.innerHTML = `
          <div style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; width:100%; font-weight:700;">${seg.label}</div>
          <span style="font-size: 0.55rem; display: block; opacity: 0.85; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; margin-top:2px;">${timeStr}</span>
        `;
      }

      container.appendChild(block);
    });
  }

  return { start, prev, next };
})();
