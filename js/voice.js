/* ═══════════════════════════════════════════
   VOICE.JS — Web Speech API
═══════════════════════════════════════════ */
'use strict';

const Voice = (() => {
  let recognition = null;
  let synth = window.speechSynthesis;
  let isListening = false;
  let onResultCb = null;
  let cumulativeTranscript = '';

  function init(onResult) {
    onResultCb = onResult;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('Web Speech API not supported in this browser.');
      return false;
    }
    recognition = new SpeechRecognition();
    recognition.continuous    = false;
    recognition.interimResults = true;
    recognition.lang          = 'en-US';
    recognition.maxAlternatives = 1;

    recognition.onresult = (e) => {
      let interimTranscript = '';
      for (let i = e.resultIndex; i < e.results.length; ++i) {
        if (e.results[i].isFinal) {
          cumulativeTranscript += e.results[i][0].transcript;
        } else {
          interimTranscript += e.results[i][0].transcript;
        }
      }
      
      const input = document.getElementById('ai-chat-input');
      if (input) {
        input.value = cumulativeTranscript + interimTranscript;
        // Trigger input event to hide quick actions dynamically
        input.dispatchEvent(new Event('input'));
      }
    };

    recognition.onerror = (e) => {
      console.error('Speech error:', e.error);
      isListening = false;
      updateVoiceBtn(false);
    };

    recognition.onend = () => {
      isListening = false;
      updateVoiceBtn(false);
    };

    return true;
  }

  function startListening() {
    if (!recognition) { showToast('Voice not supported in this browser', 'warning'); return; }
    if (isListening) { recognition.stop(); return; }
    const input = document.getElementById('ai-chat-input');
    cumulativeTranscript = input ? input.value : '';
    recognition.start();
    isListening = true;
    updateVoiceBtn(true);
  }

  function updateVoiceBtn(active) {
    const btn = document.getElementById('voice-btn');
    const indicator = document.getElementById('ai-listening-indicator');
    if (!btn) return;
    if (active) {
      btn.style.color = '#ff3366';
      btn.style.textShadow = '0 0 10px rgba(255,51,102,0.8)';
      if (indicator) indicator.style.display = 'block';
    } else {
      btn.style.color = '';
      btn.style.textShadow = '';
      if (indicator) indicator.style.display = 'none';
    }
  }

  function stopListening() {
    if (recognition && isListening) recognition.stop();
  }

  function speak(text, rate = 1, pitch = 1) {
    if (!synth) return;
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate  = rate;
    utterance.pitch = pitch;
    // Try to find a pleasant voice
    const voices = synth.getVoices();
    const preferred = voices.find(v => v.name.includes('Google') && v.lang === 'en-US') || voices[0];
    if (preferred) utterance.voice = preferred;
    synth.speak(utterance);
  }

  function isSupported() { return !!(window.SpeechRecognition || window.webkitSpeechRecognition); }

  return { init, startListening, stopListening, speak, isSupported };
})();
