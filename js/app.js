/* ==========================================================================
   app.js – Anwendungsdaten, State-Management, Initialisierung
   Lädt Module dynamisch aus config/module_registry.json
   ========================================================================== */

const App = (() => {
  'use strict';

  /* ─── State ─────────────────────────────────────────────────────────── */

  const state = {
    modules: [],
    hostname: '',
    sshPort: 22,
    user: 'root',
    autoUpdate: false,
    ready: false,
  };

  /* ─── Registry laden ────────────────────────────────────────────────── */

  async function loadRegistry() {
    const data = await API.fetchRegistry();
    if (!data || typeof data !== 'object') {
      console.error('App: Registry konnte nicht geladen werden');
      return [];
    }
    const modules = [];
    for (const [id, mod] of Object.entries(data)) {
      if (mod.visible === false) continue;
      modules.push({
        id,
        title: mod.title || id,
        category: mod.category || 'Sonstige',
        description: mod.description || '',
        icon: mod.icon || '\u2753',
        installer: mod.installer || '',
        status: mod.status || 'planned',
        depends: Array.isArray(mod.depends) ? mod.depends : [],
        visible: mod.visible !== false,
        enabled: false,
      });
    }
    return modules;
  }

  /* ─── Selektierte Module (mit Auto-Dependencies) ────────────────────── */

  function getEnabledModules() {
    const explicitly = state.modules.filter(m => m.enabled);
    const auto = [];
    for (const mod of explicitly) {
      for (const depId of mod.depends) {
        if (!explicitly.find(m => m.id === depId) && !auto.find(m => m.id === depId)) {
          const depMod = state.modules.find(m => m.id === depId);
          if (depMod) auto.push({ ...depMod, enabled: true, autoActivated: true });
        }
      }
    }
    return [...explicitly, ...auto];
  }

  function enableModule(id, enabled) {
    const mod = state.modules.find(m => m.id === id);
    if (!mod) return false;
    if (mod.status === 'planned' || mod.status === 'deprecated') return false;
    mod.enabled = enabled;
    return true;
  }

  function isEnabled(id) {
    const mod = state.modules.find(m => m.id === id);
    return mod ? mod.enabled : false;
  }

  function getModule(id) {
    return state.modules.find(m => m.id === id);
  }

  function getModules() {
    return state.modules;
  }

  function getCounts() {
    const enabled = state.modules.filter(m => m.enabled);
    return {
      selected: enabled.length,
      available: enabled.filter(m => m.status === 'available').length,
      experimental: enabled.filter(m => m.status === 'experimental').length,
    };
  }

  function getStatusCounts() {
    const counts = { available: 0, experimental: 0, planned: 0, deprecated: 0 };
    for (const m of state.modules) {
      if (counts[m.status] !== undefined) counts[m.status]++;
    }
    return counts;
  }

  /* ─── Erweiterte Modul-Zusammenfassung ──────────────────────────────── */

  function getModuleSummary() {
    const enabled = state.modules.filter(m => m.enabled);
    const allEnabled = getEnabledModules();
    const explicit = allEnabled.filter(m => !m.autoActivated);
    const autoActivated = allEnabled.filter(m => m.autoActivated);
    const planned = state.modules.filter(m => m.status === 'planned');
    const experimental = state.modules.filter(m => m.status === 'experimental' && m.enabled);
    return { explicit, autoActivated, planned, experimental, allEnabled };
  }

  /* ─── Installations-Konfiguration (JSON) ────────────────────────────── */

  function getInstallConfig() {
    const enabledIds = state.modules.filter(m => m.enabled).map(m => m.id);
    const modules = {};
    for (const id of enabledIds) {
      modules[id] = { install: true };
    }
    return {
      hostname: state.hostname || null,
      ssh_port: state.sshPort !== 22 ? state.sshPort : null,
      user: state.user !== 'root' ? state.user : null,
      auto_update: state.autoUpdate || null,
      modules: Object.keys(modules).length > 0 ? modules : null,
    };
  }

  /* ─── Server Config ─────────────────────────────────────────────────── */

  function setHostname(val) { state.hostname = val; }
  function setSshPort(val) { state.sshPort = parseInt(val, 10) || 22; }
  function setUser(val) { state.user = val || 'root'; }
  function setAutoUpdate(val) { state.autoUpdate = val === true || val === 'true'; }

  function getConfig() {
    return {
      hostname: state.hostname,
      ssh_port: state.sshPort,
      user: state.user,
      auto_update: state.autoUpdate,
    };
  }

  /* ─── Alle UI-Elemente aktualisieren ────────────────────────────────── */

  function renderAll() {
    const modulesContainer = document.getElementById('modulesContainer');
    if (modulesContainer && state.modules.length > 0) {
      UI.renderModules(state.modules, modulesContainer);
    }
    UI.renderSummary();
    UI.renderJSON();
    UI.renderDepHints();
    Installer.updateCommand(state);
  }

  /* ─── Initialisierung ───────────────────────────────────────────────── */

  async function init() {
    const modulesContainer = document.getElementById('modulesContainer');
    if (!modulesContainer) return;

    const modules = await loadRegistry();
    state.modules = modules;

    renderAll();
    state.ready = true;

    document.getElementById('modulesContainer').addEventListener('click', function (e) {
      const card = e.target.closest('.module-card');
      if (!card) return;
      const id = card.dataset.id;
      if (card.classList.contains('disabled')) return;
      if (card.classList.contains('deprecated')) return;
      const mod = state.modules.find(m => m.id === id);
      if (!mod) return;
      const newState = !mod.enabled;
      enableModule(id, newState);
      renderAll();
    });

    document.getElementById('hostname')?.addEventListener('input', renderAll);
    document.getElementById('sshPort')?.addEventListener('input', renderAll);
    document.getElementById('user')?.addEventListener('input', renderAll);
    document.getElementById('autoUpdate')?.addEventListener('change', renderAll);

    document.getElementById('copyBtn')?.addEventListener('click', function () {
      Installer.copyCommand(state);
    });

    document.getElementById('downloadBtn')?.addEventListener('click', function () {
      Installer.downloadScript(state);
    });

    document.getElementById('copyJsonBtn')?.addEventListener('click', function () {
      Installer.copyJSON(state);
    });

    document.getElementById('downloadJsonBtn')?.addEventListener('click', function () {
      Installer.downloadJSON(state);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return {
    getEnabledModules,
    enableModule,
    isEnabled,
    getModule,
    getModules,
    getCounts,
    getStatusCounts,
    getModuleSummary,
    getInstallConfig,
    getConfig,
    renderAll,
    state,
  };
})();
