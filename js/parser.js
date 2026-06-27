/* ═══════════════════════════════════════════
   PARSER.JS — Intelligent Datesheet Extraction via Gemini AI
   ═══════════════════════════════════════════ */
'use strict';

const Parser = (() => {
  let isParsing = false;

  function init() {
    // Bind Drag & Drop on window
    window.addEventListener('dragenter', handleDragEnter);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('dragover', (e) => e.preventDefault());
    window.addEventListener('drop', handleDrop);

    // Bind File Input
    const fileInput = document.getElementById('datesheet-upload');
    if (fileInput) {
      fileInput.addEventListener('change', (e) => {
        if (e.target.files.length) processFile(e.target.files[0]);
        e.target.value = ''; // reset
      });
    }
  }

  let dragCounter = 0;
  function handleDragEnter(e) {
    e.preventDefault();
    dragCounter++;
    const overlay = document.getElementById('drag-drop-overlay');
    if (overlay) overlay.style.display = 'flex';
  }

  function handleDragLeave(e) {
    e.preventDefault();
    dragCounter--;
    if (dragCounter === 0) {
      const overlay = document.getElementById('drag-drop-overlay');
      if (overlay) overlay.style.display = 'none';
    }
  }

  function handleDrop(e) {
    e.preventDefault();
    dragCounter = 0;
    const overlay = document.getElementById('drag-drop-overlay');
    if (overlay) overlay.style.display = 'none';

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  }

  async function processFile(file) {
    if (isParsing) return;
    if (!window.ENV || !window.ENV.GEMINI_API_KEY) {
      showToast('⚠️ Please add your Gemini API Key in env.js to use intelligent parsing!', 'error', 5000);
      return;
    }

    const advice = await askForAdvice();
    const adviceText = advice ? `\n\nUSER SPECIAL INSTRUCTIONS: "${advice}"\nMake absolutely sure you follow these instructions when extracting.` : '';

    isParsing = true;
    showToast('NEXUS AI is analyzing your datesheet... 🧠', 'info', 10000);

    try {
      let parts = [];

      // If text or CSV, read as text
      if (file.type.startsWith('text/') || file.name.endsWith('.csv')) {
        const text = await file.text();
        parts.push({ text: text });
      } 
      // If image, read as base64
      else if (file.type.startsWith('image/')) {
        const base64 = await toBase64(file);
        // Remove data URL prefix
        const base64Data = base64.split(',')[1];
        parts.push({
          inlineData: { data: base64Data, mimeType: file.type }
        });
      } else if (file.type === 'application/pdf') {
         // Gemini 1.5 flash accepts PDF natively
         const base64 = await toBase64(file);
         const base64Data = base64.split(',')[1];
         parts.push({
           inlineData: { data: base64Data, mimeType: 'application/pdf' }
         });
      } else {
        throw new Error('Unsupported file type. Please upload an Image, Text, CSV, or PDF.');
      }


      // Add the prompt instruction
      parts.unshift({
        text: `You are an AI task extractor. Today's date is ${new Date().toISOString()}.
Look at the attached datesheet or text. Extract all exams, assignments, or important deadlines.${adviceText}
CRITICAL TABLE HANDLING: If the document is a table with multiple columns (like a datesheet), and the user's special instructions specify a specific column or branch (e.g., "IT column", "CSE"), you MUST ONLY extract items from THAT exact column. Ignore ALL items in other columns, even if they look like exams! If the target column is full of stars or blanks for a specific date, skip that date entirely.
Return ONLY a valid JSON array of objects. Do not include markdown formatting like \`\`\`json.
Each object must have:
- "title": string (e.g. "Mathematics Exam")
- "dueDate": string (ISO 8601 format datetime). CRITICAL: If the dates in the document are from the past, shift the month/year forward so they are scheduled for upcoming dates! If exact time is missing, YOU MUST set it to 09:00:00.
- "category": string (e.g. "work" or "personal" or "health")
If no subjects/exams are found for the requested column, return an empty array [].`
      });

      // Call Gemini API
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${window.ENV.GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: parts }],
          generationConfig: { temperature: 0.2 }
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Gemini API Error');
      }

      const data = await response.json();
      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (!rawText) throw new Error('No output from Gemini');

      // Parse JSON from output
      const jsonStr = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
      const extractedTasks = JSON.parse(jsonStr);

      if (!Array.isArray(extractedTasks) || extractedTasks.length === 0) {
        showToast('NEXUS AI couldn\'t find any exams in that file.', 'warning');
        isParsing = false;
        return;
      }

      // Deduplicate and normalize dates
      const uniqueTasks = [];
      const seen = new Set();
      for (const t of extractedTasks) {
        let cleanDate = null;
        if (t.dueDate) {
          const parsed = new Date(t.dueDate);
          if (!isNaN(parsed.valueOf())) {
            cleanDate = parsed.toISOString();
          }
        }
        
        const key = (t.title || '') + '|' + (cleanDate || '');
        if (!seen.has(key)) {
          seen.add(key);
          t.dueDate = cleanDate;
          uniqueTasks.push(t);
        }
      }

      // Create tasks
      let created = 0;
      for (const t of uniqueTasks) {
        const taskData = {
          title: t.title || 'Untitled Exam',
          desc: 'Auto-extracted from datesheet',
          category: 'work',
          priority: 'critical', // Force critical for exams
          dueDate: t.dueDate,
          estimatedMins: 120,
          repeat: null
        };
        const task = Tasks.create(taskData);
        DB.addTask(task);
        if (task.dueDate && window.GCal && window.GCal.isConnected()) {
          const eventId = await window.GCal.addEvent(task);
          if (eventId) Tasks.update(task.id, { gcalEventId: eventId });
        }
        created++;
      }

      App.renderCurrentView();
      App.updateBadges();
      if (window.Notifications) Notifications.scheduleAll(Tasks.getAll());

      showToast(`Success! NEXUS AI scheduled ${created} critical exam(s). 🎯`, 'success');

    } catch (err) {
      console.error('Parser Error:', err);
      showToast('Parsing failed: ' + err.message, 'error');
    } finally {
      isParsing = false;
    }
  }

  function toBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = error => reject(error);
    });
  }

  function askForAdvice() {
    return new Promise((resolve) => {
      const overlay = document.getElementById('advice-modal-overlay');
      const input = document.getElementById('advice-input');
      const skipBtn = document.getElementById('advice-skip-btn');
      const submitBtn = document.getElementById('advice-submit-btn');

      if (!overlay || !input || !skipBtn || !submitBtn) {
        resolve(''); 
        return;
      }

      input.value = '';
      overlay.classList.add('open');
      input.focus();

      function close(val) {
        overlay.classList.remove('open');
        skipBtn.onclick = null;
        submitBtn.onclick = null;
        resolve(val);
      }

      skipBtn.onclick = () => close('');
      submitBtn.onclick = () => close(input.value.trim());
      
      // Allow Enter key to submit
      input.onkeydown = (e) => {
        if (e.key === 'Enter') {
          input.onkeydown = null;
          close(input.value.trim());
        }
      };
    });
  }

  return { init };
})();
