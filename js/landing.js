/**
 * landing.js
 * Handles scroll animations, typing simulations, and count-up stats for the landing page.
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. Intersection Observer for Scroll Animations
  const observerOptions = {
    root: null,
    rootMargin: '0px',
    threshold: 0.1
  };

  const observer = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible-scroll');
        
        // If it's the stats section, trigger count-up
        if (entry.target.classList.contains('stat-num') && !entry.target.dataset.counted) {
          startCountUp(entry.target);
          entry.target.dataset.counted = "true";
        }
      }
    });
  }, observerOptions);

  document.querySelectorAll('.hidden-scroll').forEach(el => {
    observer.observe(el);
  });

  // 2. Statistics Count Up Animation
  function startCountUp(el) {
    const target = parseInt(el.dataset.target, 10);
    const duration = 2000; // ms
    const stepTime = Math.abs(Math.floor(duration / target));
    let current = 0;
    
    // Smooth easing
    const increment = target / (duration / 16); 
    
    const timer = setInterval(() => {
      current += increment;
      if (current >= target) {
        current = target;
        clearInterval(timer);
      }
      
      // Formatting
      let display = Math.floor(current).toString();
      if (el.dataset.suffix) display += el.dataset.suffix;
      if (el.dataset.prefix) display = el.dataset.prefix + display;
      
      // Add commas if needed
      if (target >= 1000) {
        display = Math.floor(current).toLocaleString() + (el.dataset.suffix || '');
      }
      
      el.textContent = display;
    }, 16);
  }

  // 3. AI Chat Simulation (Hero Section)
  const chatScenarios = [
    {
      q: "Can I finish everything today?",
      a: "Yes! You have 2.5h of free time and only 1.5h of estimated tasks. Start with Physics.",
      reason: "Prioritizing high impact."
    },
    {
      q: "What should I do after gym?",
      a: "Review your Azure Goal. It aligns with your evening focus window.",
      reason: "Based on your 7PM peak focus."
    },
    {
      q: "When should I work on my Azure goal?",
      a: "Tonight at 7:30 PM. You have a solid 90-minute block with zero scheduled interruptions.",
      reason: "Optimizing for deep work."
    }
  ];

  const typeWriter = (element, text, speed, callback) => {
    let i = 0;
    element.innerHTML = '';
    const timer = setInterval(() => {
      if (i < text.length) {
        element.innerHTML += text.charAt(i);
        i++;
      } else {
        clearInterval(timer);
        if (callback) setTimeout(callback, 800);
      }
    }, speed);
  };

  const heroUserText = document.getElementById('hero-user-text');
  const heroAiText = document.getElementById('hero-ai-text');
  let currentScenario = 0;

  function playScenario() {
    if (!heroUserText || !heroAiText) return;
    const scenario = chatScenarios[currentScenario];
    
    heroUserText.innerHTML = '';
    heroAiText.innerHTML = '<span style="color:#a855f7">Thinking...</span>';
    
    // Type user question
    typeWriter(heroUserText, scenario.q, 40, () => {
      // Type AI response
      typeWriter(heroAiText, scenario.a, 20, () => {
        // Wait 4 seconds, then next scenario
        setTimeout(() => {
          currentScenario = (currentScenario + 1) % chatScenarios.length;
          playScenario();
        }, 4000);
      });
    });
  }
  
  if (heroUserText) {
    setTimeout(playScenario, 1000);
  }

  // 4. Dashboard Mouse Parallax
  const dashWrap = document.querySelector('.dashboard-preview');
  const dashImg = document.querySelector('.dash-img-wrap');
  
  if (dashWrap && dashImg) {
    dashWrap.addEventListener('mousemove', (e) => {
      const rect = dashWrap.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      const xPercent = (x / rect.width - 0.5) * 10; // max rotation degrees
      const yPercent = (y / rect.height - 0.5) * -10;
      
      dashImg.style.transform = `rotateX(${yPercent}deg) rotateY(${xPercent}deg) scale3d(1.02, 1.02, 1.02)`;
    });
    
    dashWrap.addEventListener('mouseleave', () => {
      dashImg.style.transform = `rotateX(5deg) rotateY(0) scale3d(1, 1, 1)`;
    });
  }
});
