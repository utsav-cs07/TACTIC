class TacticModal {
  constructor() {
    this.createModalStructure();
    this.bindEvents();
    this.currentResolve = null;
    this.currentReject = null;
    this.trapFocus = this.trapFocus.bind(this);
    this.handleKeydown = this.handleKeydown.bind(this);
  }

  createModalStructure() {
    if (document.getElementById('tactic-modal-overlay')) return;

    this.overlay = document.createElement('div');
    this.overlay.className = 'modal-overlay tactic-modal-overlay';
    this.overlay.id = 'tactic-modal-overlay';
    this.overlay.style.zIndex = '9999';

    this.overlay.innerHTML = `
      <div class="modal tactic-modal" id="tactic-modal" role="dialog" aria-modal="true">
        <div class="modal-header">
          <h3 id="tactic-modal-title"></h3>
          <button class="modal-close" id="tactic-modal-close" aria-label="Close modal">×</button>
        </div>
        <div class="modal-body" id="tactic-modal-body"></div>
        <div class="modal-footer" id="tactic-modal-footer">
          <button class="btn btn-ghost" id="tactic-modal-cancel">Cancel</button>
          <button class="btn btn-primary" id="tactic-modal-save">Save</button>
        </div>
      </div>
    `;
    document.body.appendChild(this.overlay);

    this.modal = document.getElementById('tactic-modal');
    this.title = document.getElementById('tactic-modal-title');
    this.body = document.getElementById('tactic-modal-body');
    this.btnSave = document.getElementById('tactic-modal-save');
    this.btnCancel = document.getElementById('tactic-modal-cancel');
    this.btnClose = document.getElementById('tactic-modal-close');
    this.footer = document.getElementById('tactic-modal-footer');
  }

  bindEvents() {
    this.btnClose.addEventListener('click', () => this.close(null));
    this.btnCancel.addEventListener('click', () => this.close(null));
    this.btnSave.addEventListener('click', () => this.save());
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.close(null);
    });
  }

  open(options) {
    return new Promise((resolve, reject) => {
      this.currentResolve = resolve;
      this.currentReject = reject;
      
      this.modalType = options.type || 'custom'; // 'habit', 'goal', 'confirm', 'milestone'
      this.currentMilestones = options.data?.milestones ? [...options.data.milestones] : [];
      this.currentIcon = options.data?.icon || (options.type === 'goal' ? '🎯' : '⭐');
      this.currentColor = options.data?.color || '#00ff66';
      this.title.textContent = options.title || 'Modal';
      this.buildBody(options);
      
      // Configure buttons
      if (options.type === 'confirm') {
        this.btnSave.textContent = options.confirmText || 'Delete';
        this.btnSave.classList.replace('btn-primary', 'btn-danger');
      } else {
        this.btnSave.textContent = options.saveText || 'Save';
        this.btnSave.classList.replace('btn-danger', 'btn-primary');
      }

      this.overlay.classList.add('open');
      
      document.addEventListener('keydown', this.handleKeydown);
      
      // Auto-focus first input
      setTimeout(() => {
        const firstInput = this.body.querySelector('input, select, textarea');
        if (firstInput) firstInput.focus();
        else this.btnSave.focus();
      }, 100);
    });
  }

  close(result) {
    this.overlay.classList.remove('open');
    document.removeEventListener('keydown', this.handleKeydown);
    if (this.currentResolve) {
      this.currentResolve(result);
      this.currentResolve = null;
      this.currentReject = null;
    }
  }

  save() {
    if (this.modalType === 'confirm') {
      this.close(true);
      return;
    }

    const data = this.extractData();
    if (this.validate(data)) {
      this.close(data);
    }
  }

  handleKeydown(e) {
    if (e.key === 'Escape') {
      this.close(null);
    } else if (e.key === 'Enter') {
      // Don't trigger save if inside a textarea
      if (document.activeElement.tagName !== 'TEXTAREA') {
        e.preventDefault();
        this.save();
      }
    } else if (e.key === 'Tab') {
      this.trapFocus(e);
    }
  }

  trapFocus(e) {
    const focusableElements = this.modal.querySelectorAll('a[href], button, textarea, input, select, [tabindex]:not([tabindex="-1"])');
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (e.shiftKey) {
      if (document.activeElement === firstElement) {
        lastElement.focus();
        e.preventDefault();
      }
    } else {
      if (document.activeElement === lastElement) {
        firstElement.focus();
        e.preventDefault();
      }
    }
  }

  buildBody(options) {
    this.body.innerHTML = '';
    let content = '';

    const emojis = ['⭐', '📚', '💪', '🏃', '🎯', '🔥', '🌱', '💼', '❤️', '🧠'];
    const colors = ['#00ff66', '#00d4ff', '#a855f7', '#ff3366', '#facc15'];

    const iconPickerHtml = `<div class="icon-picker-grid">` + 
      emojis.map(e => `<div class="icon-swatch ${e === this.currentIcon ? 'active' : ''}" data-icon="${e}">${e}</div>`).join('') +
      `</div>`;

    const colorPickerHtml = `<div class="color-picker-grid">` +
      colors.map(c => `<div class="color-swatch ${c === this.currentColor ? 'active' : ''}" style="background-color: ${c};" data-color="${c}"></div>`).join('') +
      `</div>`;

    if (options.type === 'habit') {
      content = `
        <div class="form-row">
          <div class="form-group">
            <label>Habit Name <span class="required">*</span></label>
            <input type="text" id="habit-name" class="form-control tactic-input" placeholder="e.g., Morning Run" value="${options.data?.name || ''}">
            <div class="validation-msg" id="msg-habit-name">Habit Name is required.</div>
          </div>
          <div class="form-group">
            <label>Description (Optional)</label>
            <input type="text" id="habit-desc" class="form-control tactic-input" placeholder="Why are you doing this?" value="${options.data?.description || ''}">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Frequency</label>
            <select id="habit-freq" class="form-control tactic-input">
              <option value="daily" ${options.data?.target === 'daily' ? 'selected' : ''}>Daily</option>
              <option value="weekly" ${options.data?.target === 'weekly' ? 'selected' : ''}>Weekly</option>
              <option value="custom" ${options.data?.target === 'custom' ? 'selected' : ''}>Custom</option>
            </select>
          </div>
          <div class="form-group">
            <label>Preferred Time</label>
            <select id="habit-time" class="form-control tactic-input">
              <option value="morning">Morning</option>
              <option value="afternoon">Afternoon</option>
              <option value="evening">Evening</option>
              <option value="night">Night</option>
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Icon</label>
            ${iconPickerHtml}
          </div>
          <div class="form-group">
            <label>Accent Color</label>
            ${colorPickerHtml}
          </div>
        </div>
        
        <div class="ai-coach-card glass-card">
          <div class="ai-coach-header">
            <span class="ai-icon">🤖</span> AI Habit Coach
          </div>
          <div class="ai-coach-grid">
            <div class="ai-stat">
              <span class="ai-label">Success Prediction</span>
              <span class="ai-value text-green">91%</span>
            </div>
            <div class="ai-stat">
              <span class="ai-label">Best Time</span>
              <span class="ai-value">8:15 AM</span>
            </div>
            <div class="ai-stat">
              <span class="ai-label">Duration</span>
              <span class="ai-value">15m</span>
            </div>
          </div>
          <div class="ai-coach-reasoning">
            <p><strong>Reason:</strong> Your morning schedule has a free slot after breakfast.</p>
            <p><strong>Recommendation:</strong> This habit fits naturally into your existing routine.</p>
          </div>
        </div>
      `;
    } else if (options.type === 'goal') {
      content = `
        <div class="form-row">
          <div class="form-group">
            <label>Goal Title <span class="required">*</span></label>
            <input type="text" id="goal-title" class="form-control tactic-input" placeholder="e.g., Learn to Play Guitar" value="${options.data?.title || ''}">
            <div class="validation-msg" id="msg-goal-title">Goal Title is required.</div>
          </div>
          <div class="form-group">
            <label>Category</label>
            <select id="goal-category" class="form-control tactic-input">
              <option value="health">Health & Fitness</option>
              <option value="career">Career & Business</option>
              <option value="learning">Learning & Growth</option>
              <option value="personal">Personal</option>
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Description (Optional)</label>
            <input type="text" id="goal-desc" class="form-control tactic-input" placeholder="What does success look like?" value="${options.data?.description || ''}">
          </div>
          <div class="form-group">
            <label>Target Date (Optional)</label>
            <input type="date" id="goal-date" class="form-control tactic-input">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Icon</label>
            ${iconPickerHtml}
          </div>
          <div class="form-group">
            <label>Accent Color</label>
            ${colorPickerHtml}
          </div>
        </div>
        
        <div class="form-group milestones-section">
          <label class="milestones-header">
            Milestones
            <button type="button" id="tactic-add-milestone" class="btn btn-ghost add-milestone-btn">+ Add Milestone</button>
          </label>
          <div id="tactic-milestones-list" class="milestones-list"></div>
        </div>

        <div class="ai-coach-card glass-card">
          <div class="ai-coach-header">
            <span class="ai-icon">🤖</span> AI Goal Coach
          </div>
          <div class="ai-coach-grid">
            <div class="ai-stat">
              <span class="ai-label">Difficulty</span>
              <span class="ai-value">Medium</span>
            </div>
            <div class="ai-stat">
              <span class="ai-label">Est. Completion</span>
              <span class="ai-value">14 Days</span>
            </div>
          </div>
          <div class="ai-coach-reasoning">
            <p><strong>Recommendation:</strong> Break this goal into smaller milestones to improve completion probability.</p>
            <p><strong>First Milestone:</strong> Complete the fundamentals.</p>
          </div>
        </div>
      `;
    } else if (options.type === 'confirm') {
      content = `
        <div class="confirm-content">
          <p class="confirm-message">${options.message || 'Are you sure you want to proceed?'}</p>
          <p class="confirm-warning">⚠ This action cannot be undone.</p>
        </div>
      `;
    } else if (options.type === 'milestone') {
      content = `
        <div class="form-group">
          <label>Milestone Name <span class="required">*</span></label>
          <input type="text" id="milestone-name" class="form-control tactic-input" placeholder="e.g., Complete Chapter 1">
          <div class="validation-msg" id="msg-milestone-name">Milestone Name is required.</div>
        </div>
      `;
    }

    this.body.innerHTML = content;

    if (options.type === 'habit' || options.type === 'goal') {
      this.body.querySelectorAll('.icon-swatch').forEach(el => {
        el.addEventListener('click', (e) => {
          this.body.querySelectorAll('.icon-swatch').forEach(s => s.classList.remove('active'));
          e.target.classList.add('active');
          this.currentIcon = e.target.dataset.icon;
        });
      });
      
      this.body.querySelectorAll('.color-swatch').forEach(el => {
        el.addEventListener('click', (e) => {
          this.body.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
          e.target.classList.add('active');
          this.currentColor = e.target.dataset.color;
        });
      });
    }

    if (options.type === 'goal') {
      this.renderMilestones();
      document.getElementById('tactic-add-milestone').addEventListener('click', () => {
        this.currentMilestones.push({ t: 'New Milestone', done: false });
        this.renderMilestones();
      });
    }
  }

  renderMilestones() {
    const list = document.getElementById('tactic-milestones-list');
    if (!list) return;
    
    list.innerHTML = '';
    this.currentMilestones.forEach((m, idx) => {
      const item = document.createElement('div');
      item.style.display = 'flex';
      item.style.gap = '8px';
      item.style.alignItems = 'center';
      
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = m.done;
      checkbox.style.cursor = 'pointer';
      checkbox.addEventListener('change', (e) => {
        this.currentMilestones[idx].done = e.target.checked;
      });

      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'form-control tactic-input';
      input.value = m.t;
      input.style.flex = '1';
      input.addEventListener('input', (e) => {
        this.currentMilestones[idx].t = e.target.value;
      });

      const delBtn = document.createElement('button');
      delBtn.className = 'btn btn-ghost';
      delBtn.innerHTML = '×';
      delBtn.style.padding = '4px 8px';
      delBtn.style.color = 'var(--neon-red)';
      delBtn.addEventListener('click', () => {
        this.currentMilestones.splice(idx, 1);
        this.renderMilestones();
      });

      item.appendChild(checkbox);
      item.appendChild(input);
      item.appendChild(delBtn);
      list.appendChild(item);
    });
  }

  extractData() {
    if (this.modalType === 'habit') {
      return {
        name: document.getElementById('habit-name').value.trim(),
        description: document.getElementById('habit-desc').value.trim(),
        target: document.getElementById('habit-freq').value,
        time: document.getElementById('habit-time').value,
        icon: this.currentIcon,
        color: this.currentColor
      };
    } else if (this.modalType === 'goal') {
      return {
        title: document.getElementById('goal-title').value.trim(),
        description: document.getElementById('goal-desc').value.trim(),
        category: document.getElementById('goal-category').value,
        priority: 'medium', // Defaulted or omitted since we removed the priority dropdown to fit layout
        deadline: document.getElementById('goal-date').value,
        icon: this.currentIcon,
        color: this.currentColor,
        milestones: this.currentMilestones.filter(m => m.t.trim() !== '')
      };
    } else if (this.modalType === 'milestone') {
      return document.getElementById('milestone-name').value.trim();
    }
    return null;
  }

  validate(data) {
    let isValid = true;
    
    // Clear previous validation styling
    this.body.querySelectorAll('.tactic-input').forEach(el => el.classList.remove('invalid'));
    this.body.querySelectorAll('.validation-msg').forEach(el => el.style.display = 'none');

    if (this.modalType === 'habit') {
      if (!data.name) {
        document.getElementById('habit-name').classList.add('invalid');
        document.getElementById('msg-habit-name').style.display = 'block';
        isValid = false;
      }
    } else if (this.modalType === 'goal') {
      if (!data.title) {
        document.getElementById('goal-title').classList.add('invalid');
        document.getElementById('msg-goal-title').style.display = 'block';
        isValid = false;
      }
    } else if (this.modalType === 'milestone') {
      if (!data) {
        document.getElementById('milestone-name').classList.add('invalid');
        document.getElementById('msg-milestone-name').style.display = 'block';
        isValid = false;
      }
    }

    return isValid;
  }
}

// Expose a global instance
window.tacticModal = new TacticModal();
