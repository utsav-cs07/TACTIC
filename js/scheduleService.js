/* ═══════════════════════════════════════════
   SCHEDULE SERVICE — Daily Routine Manager
═══════════════════════════════════════════ */
'use strict';

const ScheduleService = (() => {


  const defaultRoutine = {
    wakeUp: '07:00',
    sleep: '23:00',
    collegeStart: '09:00',
    collegeEnd: '14:00',
    travelTimeMins: 45,
    lunchTime: '13:00',
    dinnerTime: '20:00',
    gymTime: '18:00',
    studyDurMins: 120,
    pomodoroMins: 25,
    peakFocusStart: '10:00',
    peakFocusEnd: '12:00'
  };

  let routineCache = null;

  function mapDbToInternal(dbData) {
    if (!dbData) return null;
    return {
      wakeUp:                 dbData.wakeUpTime || '',
      sleep:                  dbData.sleepTime || '',
      collegeStart:           dbData.collegeStart || '',
      collegeEnd:             dbData.collegeEnd || '',
      travelTimeMins:         dbData.travelTime !== undefined ? dbData.travelTime : '',
      lunchTime:              dbData.lunchTime || '',
      dinnerTime:             dbData.dinnerTime || '',
      gymTime:                dbData.gymTime || '',
      studyDurMins:           dbData.preferredStudyDuration !== undefined ? dbData.preferredStudyDuration : '',
      pomodoroMins:           dbData.preferredPomodoro !== undefined ? dbData.preferredPomodoro : '',
      peakFocusStart:         dbData.peakFocusStart || '',
      peakFocusEnd:           dbData.peakFocusEnd || ''
    };
  }

  function mapInternalToDb(internalData) {
    if (!internalData) return null;
    return {
      wakeUpTime:             internalData.wakeUp || '',
      sleepTime:              internalData.sleep || '',
      collegeStart:           internalData.collegeStart || '',
      collegeEnd:             internalData.collegeEnd || '',
      travelTime:             internalData.travelTimeMins !== '' && internalData.travelTimeMins !== undefined ? Number(internalData.travelTimeMins) : '',
      lunchTime:              internalData.lunchTime || '',
      dinnerTime:             internalData.dinnerTime || '',
      gymTime:                internalData.gymTime || '',
      preferredStudyDuration: internalData.studyDurMins !== '' && internalData.studyDurMins !== undefined ? Number(internalData.studyDurMins) : '',
      preferredPomodoro:      internalData.pomodoroMins !== '' && internalData.pomodoroMins !== undefined ? Number(internalData.pomodoroMins) : '',
      peakFocusStart:         internalData.peakFocusStart || '',
      peakFocusEnd:           internalData.peakFocusEnd || ''
    };
  }

  async function getRoutine(forceRefresh = false) {
    // Try to fetch from Firebase if logged in
    if (typeof DB !== 'undefined' && DB.getMode() === 'firestore') {
      const fbData = await DB.getRoutine();
      if (fbData) {
        const mapped = mapDbToInternal(fbData);
        routineCache = { ...defaultRoutine, ...mapped };
        return routineCache;
      }
    }
    
    // Fallback to memory cache
    if (!forceRefresh && routineCache) {
      return routineCache;
    }
    
    // Fallback to default
    routineCache = { ...defaultRoutine };
    return routineCache;
  }

  async function updateRoutine(data) {
    // Ensure all numeric inputs are numbers, but keep empty strings as empty so they can be cleared
    if (data.travelTimeMins !== undefined && data.travelTimeMins !== '') data.travelTimeMins = Number(data.travelTimeMins);
    if (data.studyDurMins !== undefined && data.studyDurMins !== '') data.studyDurMins = Number(data.studyDurMins);
    if (data.pomodoroMins !== undefined && data.pomodoroMins !== '') data.pomodoroMins = Number(data.pomodoroMins);

    if (!validateRoutine(data)) {
      throw new Error("Invalid routine data");
    }
    
    // Update memory cache
    routineCache = { ...(routineCache || defaultRoutine), ...data };
    
    // Save to Firebase if logged in
    if (typeof DB !== 'undefined' && DB.getMode() === 'firestore') {
      const dbPayload = mapInternalToDb(routineCache);
      await DB.saveRoutine(dbPayload);
    }
    
    return routineCache;
  }

  function validateRoutine(data) {
    console.log('[ScheduleService] validating:', data);
    if (data.travelTimeMins !== undefined && data.travelTimeMins !== '' && Number(data.travelTimeMins) < 0) {
      console.log('[ScheduleService] validation fail: travelTimeMins < 0');
      return false;
    }
    if (data.studyDurMins !== undefined && data.studyDurMins !== '' && Number(data.studyDurMins) < 0) {
      console.log('[ScheduleService] validation fail: studyDurMins < 0');
      return false;
    }
    if (data.pomodoroMins !== undefined && data.pomodoroMins !== '' && Number(data.pomodoroMins) <= 0) {
      console.log('[ScheduleService] validation fail: pomodoroMins <= 0');
      return false;
    }
    
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    const timeFields = ['wakeUp', 'sleep', 'collegeStart', 'collegeEnd', 'lunchTime', 'dinnerTime', 'gymTime', 'peakFocusStart', 'peakFocusEnd'];
    
    for (const key of timeFields) {
      if (data[key] && data[key] !== '' && !timeRegex.test(data[key])) {
        console.log(`[ScheduleService] validation fail: time field ${key} is invalid: "${data[key]}"`);
        return false;
      }
    }
    console.log('[ScheduleService] validation success!');
    return true;
  }

  return { getRoutine, updateRoutine, validateRoutine };
})();
