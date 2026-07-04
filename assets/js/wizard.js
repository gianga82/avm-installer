const Wizard = (() => {
  let currentStep = 1;
  const totalSteps = 5;
  let state = {
    server: 'ubuntu-24',
    modules: {
      docker: true,
      compose: false,
      avm: true,
      mcp: true,
      opencode: true,
      ollama: false,
      openwebui: false,
      npm: false,
      tailscale: false,
      watchtower: false,
      monitoring: false,
    },
    hostname: '',
    sshPort: '22',
    username: 'root',
    autoUpdate: false,
  };
  let onStateChange = null;

  const moduleLabels = {
    docker: 'Docker',
    compose: 'Docker Compose',
    avm: 'AI VPS Manager',
    mcp: 'MCP Server',
    opencode: 'OpenCode',
    ollama: 'Ollama',
    openwebui: 'Open WebUI',
    npm: 'Nginx Proxy Manager',
    tailscale: 'Tailscale',
    watchtower: 'Watchtower',
    monitoring: 'Monitoring',
  };

  function init(callback) {
    onStateChange = callback;
    bindEvents();
    updateStep(1);
    updateSummary();
  }

  function bindEvents() {
    document.querySelectorAll('.wizard-option input').forEach((input) => {
      input.addEventListener('change', (e) => {
        const card = e.target.closest('.wizard-option');
        if (!card) return;
        if (e.target.type === 'radio') {
          document.querySelectorAll(`input[name="${e.target.name}"]`).forEach((r) => {
            r.closest('.wizard-option')?.classList.remove('selected');
          });
          card.classList.add('selected');
          state.server = e.target.value;
          updateSummary();
        } else if (e.target.type === 'checkbox') {
          if (e.target.dataset.locked) return;
          card.classList.toggle('selected', e.target.checked);
          const mod = e.target.dataset.module;
          if (mod && state.modules.hasOwnProperty(mod)) {
            state.modules[mod] = e.target.checked;
          }
          updateSummary();
        }
        if (onStateChange) onStateChange(state);
      });
    });

    const hostnameInput = document.getElementById('wizard-hostname');
    if (hostnameInput) {
      hostnameInput.addEventListener('input', (e) => {
        state.hostname = e.target.value.trim();
        updateSummary();
        if (onStateChange) onStateChange(state);
      });
    }

    const sshPortInput = document.getElementById('wizard-ssh-port');
    if (sshPortInput) {
      sshPortInput.addEventListener('input', (e) => {
        state.sshPort = e.target.value.trim() || '22';
        updateSummary();
        if (onStateChange) onStateChange(state);
      });
    }

    const usernameInput = document.getElementById('wizard-username');
    if (usernameInput) {
      usernameInput.addEventListener('input', (e) => {
        state.username = e.target.value.trim() || 'root';
        updateSummary();
        if (onStateChange) onStateChange(state);
      });
    }

    const autoUpdateInput = document.getElementById('wizard-autoupdate');
    if (autoUpdateInput) {
      autoUpdateInput.addEventListener('change', (e) => {
        state.autoUpdate = e.target.checked;
        updateSummary();
        if (onStateChange) onStateChange(state);
      });
    }
  }

  function updateStep(step) {
    currentStep = Math.max(1, Math.min(step, totalSteps));

    document.querySelectorAll('.wizard-step').forEach((el) => el.classList.remove('active'));
    const activeStep = document.getElementById(`wizard-step-${currentStep}`);
    if (activeStep) activeStep.classList.add('active');

    const progress = document.querySelector('.wizard-progress');
    if (progress) {
      progress.className = 'wizard-progress';
      progress.classList.add(`step-${currentStep}`);
    }

    document.querySelectorAll('.progress-step').forEach((el, i) => {
      const idx = i + 1;
      el.classList.remove('active', 'completed');
      if (idx === currentStep) el.classList.add('active');
      else if (idx < currentStep) el.classList.add('completed');
    });

    const backBtn = document.getElementById('wizard-back');
    const nextBtn = document.getElementById('wizard-next');
    if (backBtn) backBtn.style.display = currentStep === 1 ? 'none' : 'inline-flex';
    if (nextBtn) {
      const isEn = document.documentElement.lang === 'en';
      if (currentStep === totalSteps) {
        nextBtn.textContent = isEn ? 'Generate Command' : 'Befehl generieren';
      } else {
        nextBtn.textContent = isEn ? 'Next' : 'Weiter';
      }
    }

    if (onStateChange) onStateChange(state);
    document.getElementById('wizard')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function validateStep2() {
    const el = document.getElementById('wizard-validation');
    if (!el) return true;
    const m = state.modules;
    let msg = '';
    if (m.openwebui && !m.docker) msg = WIZARD_TXT?.validation?.openwebui || 'Open WebUI benötigt Docker – bitte Docker ebenfalls auswählen.';
    else if (m.npm && !m.docker) msg = WIZARD_TXT?.validation?.npm || 'Nginx Proxy Manager benötigt Docker – bitte Docker ebenfalls auswählen.';
    else if (m.monitoring && !m.docker) msg = WIZARD_TXT?.validation?.monitoring || 'Monitoring benötigt Docker – bitte Docker ebenfalls auswählen.';
    else if (m.compose && !m.docker) msg = WIZARD_TXT?.validation?.compose || 'Docker Compose benötigt Docker – bitte Docker ebenfalls auswählen.';
    if (msg) {
      el.textContent = '⚠ ' + msg;
      el.classList.add('show');
      return false;
    }
    el.classList.remove('show');
    return true;
  }

  function next() {
    if (currentStep < totalSteps) {
      if (currentStep === 2 && !validateStep2()) return;
      updateStep(currentStep + 1);
    } else {
      generateFinalCommand();
    }
  }

  function back() {
    if (currentStep > 1) updateStep(currentStep - 1);
  }

  function goToStep(step) { updateStep(step); }

  function generateFinalCommand() {
    const cmd = Installer.generateCommand(state);
    const el = document.getElementById('command-text');
    if (el) el.textContent = cmd;
  }

  function updateSummary() {
    const serverEl = document.getElementById('summary-server');
    if (serverEl) {
      const labels = { 'ubuntu-24': 'Ubuntu 24.04 LTS', 'ubuntu-22': 'Ubuntu 22.04 LTS', 'debian-12': 'Debian 12' };
      serverEl.textContent = labels[state.server] || 'Ubuntu 24.04 LTS';
    }

    const modulesEl = document.getElementById('summary-modules');
    if (modulesEl) {
      const selected = Object.entries(state.modules).filter(([, v]) => v).map(([k]) => moduleLabels[k] || k);
      if (selected.length > 0) {
        modulesEl.innerHTML = selected.map((m) => `<span class="summary-tag">${m}</span>`).join('');
      } else {
        modulesEl.innerHTML = '<span class="summary-tag" style="color:var(--text-muted)">–</span>';
      }
    }

    const optionsEl = document.getElementById('summary-options');
    if (optionsEl) {
      const parts = [];
      if (state.hostname) parts.push(`Hostname: ${state.hostname}`);
      if (state.sshPort && state.sshPort !== '22') parts.push(`SSH-Port: ${state.sshPort}`);
      if (state.username && state.username !== 'root') parts.push(`Benutzer: ${state.username}`);
      if (state.autoUpdate) parts.push('Auto-Update');
      optionsEl.textContent = parts.length > 0 ? parts.join(' · ') : '–';
    }
  }

  function getState() { return { ...state }; }

  return { init, next, back, goToStep, getState };
})();
