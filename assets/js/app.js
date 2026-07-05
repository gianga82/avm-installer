const WIZARD_TXT = {};

const LANG = {
  de: {
    nav: { demo: 'Demo', features: 'Features', screenshots: 'Screenshots', os: 'OS', requirements: 'Voraussetzungen', wizard: 'Installation' },
    hero: { badge: 'v2.0.0', title: 'AI VPS Manager', subtitle: 'Der intelligente Server-Manager für Docker, KI und Automatisierung.', cta: 'Installation starten', docs: 'Dokumentation', github: 'GitHub' },
    demo: { title: 'Live-Demo', desc: 'Interaktive Vorschau (kommt bald)' },
    features: { title: 'Features', subtitle: 'Was der AI VPS Manager bietet' },
    screenshots: { title: 'Screenshots', subtitle: 'Blick hinter die Kulissen' },
    os: { title: 'Unterstützte Betriebssysteme' },
    requirements: { title: 'Voraussetzungen' },
    wizard: { title: 'Installations-Assistent', subtitle: '5 Schritte zu deinem Server', step1: 'Server auswählen', step2: 'Module auswählen', step3: 'Optionen', step4: 'Zusammenfassung', step5: 'Installationsbefehl' },
    post: { title: 'Installation abgeschlossen', server: 'Server erreichbar', mcp: 'MCP aktiv', docker: 'Docker aktiv', opencode: 'OpenCode aktiv', webui: 'WebUI öffnen', test: 'MCP testen', logs: 'Logs ansehen', docs: 'Dokumentation' },
    footer: { text: 'AI VPS Manager – Open Source unter MIT-Lizenz.', github: 'GitHub', docs: 'Dokumentation', license: 'MIT License' },
    cmd: { copy: '📋 Kopieren', save: '📄 Als Datei speichern', start: '🚀 Installation starten', copied: '✅ Befehl kopiert! Jetzt im Terminal ausführen.' },
    validation: { openwebui: 'Open WebUI benötigt Docker – bitte Docker ebenfalls auswählen.', npm: 'Nginx Proxy Manager benötigt Docker – bitte Docker ebenfalls auswählen.', monitoring: 'Monitoring benötigt Docker – bitte Docker ebenfalls auswählen.', compose: 'Docker Compose benötigt Docker – bitte Docker ebenfalls auswählen.' },
  },
  en: {
    nav: { demo: 'Demo', features: 'Features', screenshots: 'Screenshots', os: 'OS', requirements: 'Requirements', wizard: 'Installation' },
    hero: { badge: 'v2.0.0', title: 'AI VPS Manager', subtitle: 'The intelligent server manager for Docker, AI and automation.', cta: 'Start Installation', docs: 'Documentation', github: 'GitHub' },
    demo: { title: 'Live Demo', desc: 'Interactive preview (coming soon)' },
    features: { title: 'Features', subtitle: 'What the AI VPS Manager offers' },
    screenshots: { title: 'Screenshots', subtitle: 'Behind the scenes' },
    os: { title: 'Supported Operating Systems' },
    requirements: { title: 'Requirements' },
    wizard: { title: 'Installation Wizard', subtitle: '5 steps to your server', step1: 'Select Server', step2: 'Choose Modules', step3: 'Options', step4: 'Summary', step5: 'Install Command' },
    post: { title: 'Installation Complete', server: 'Server Reachable', mcp: 'MCP Active', docker: 'Docker Active', opencode: 'OpenCode Active', webui: 'Open WebUI', test: 'Test MCP', logs: 'View Logs', docs: 'Documentation' },
    footer: { text: 'AI VPS Manager – Open Source under MIT License.', github: 'GitHub', docs: 'Documentation', license: 'MIT License' },
    cmd: { copy: '📋 Copy', save: '📄 Save as Script', start: '🚀 Start Installation', copied: '✅ Command copied! Run it in your terminal now.' },
    validation: { openwebui: 'Open WebUI requires Docker – please select Docker as well.', npm: 'Nginx Proxy Manager requires Docker – please select Docker as well.', monitoring: 'Monitoring requires Docker – please select Docker as well.', compose: 'Docker Compose requires Docker – please select Docker as well.' },
  },
};

const App = (() => {
  let lang = 'de';
  let tx = {};

  function init() {
    lang = localStorage.getItem('avm-lang') || 'de';
    tx = LANG[lang] || LANG.de;

    applyLang();
    bindLangToggle();
    bindMobileMenu();
    bindScrollLinks();
    bindCopyButton();

    Animation.init();

    Wizard.init((s) => {
      // state change handler
    });

    document.documentElement.lang = lang === 'en' ? 'en' : 'de';
  }

  function setLang(code) {
    lang = code;
    localStorage.setItem('avm-lang', code);
    tx = LANG[code] || LANG.de;
    document.documentElement.lang = code === 'en' ? 'en' : 'de';
    document.querySelectorAll('.lang-toggle .lang-code').forEach((el) => {
      el.classList.toggle('active', el.dataset.lang === code);
    });
    document.body.classList.add('lang-switching');
    applyLang();
    Wizard.updateSummary();
    setTimeout(() => document.body.classList.remove('lang-switching'), 200);
  }

  function applyLang() {
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const path = el.dataset.i18n.split('.');
      let val = tx;
      for (const key of path) { if (val) val = val[key]; }
      if (val) el.textContent = val;
    });
    // Update placeholders
    const hostnameInput = document.getElementById('wizard-hostname');
    if (hostnameInput) hostnameInput.placeholder = lang === 'en' ? 'my-server' : 'server.meinedomain.de';
    const usernameInput = document.getElementById('wizard-username');
    if (usernameInput) usernameInput.placeholder = 'root';
  }

  function bindLangToggle() {
    document.getElementById('lang-toggle')?.addEventListener('click', () => {
      setLang(lang === 'de' ? 'en' : 'de');
    });
  }

  function bindMobileMenu() {
    document.getElementById('mobile-menu-btn')?.addEventListener('click', () => {
      document.getElementById('navbar-links')?.classList.toggle('open');
    });
  }

  function bindScrollLinks() {
    document.querySelectorAll('a[href^="#"]').forEach((link) => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const target = document.querySelector(link.getAttribute('href'));
        if (target) target.scrollIntoView({ behavior: 'smooth' });
        document.getElementById('navbar-links')?.classList.remove('open');
      });
    });
  }

  function bindCopyButton() {
    document.getElementById('cmd-copy')?.addEventListener('click', () => {
      const cmd = document.getElementById('command-text')?.textContent;
      if (!cmd) return;
      Installer.copyToClipboard(cmd);

      const toast = document.getElementById('toast');
      if (toast) {
        toast.textContent = tx.cmd.copied;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 3000);
      }
    });

    document.getElementById('cmd-save')?.addEventListener('click', () => {
      const cmd = document.getElementById('command-text')?.textContent;
      if (!cmd) return;
      Installer.downloadScript(cmd);
    });

    document.getElementById('cmd-start')?.addEventListener('click', () => {
      const cmd = document.getElementById('command-text')?.textContent;
      if (!cmd) return;
      Installer.copyToClipboard(cmd);
      const toast = document.getElementById('toast');
      if (toast) {
        toast.textContent = tx.cmd.copied;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 3000);
      }
    });
  }

  return { init, setLang };
})();

document.addEventListener('DOMContentLoaded', () => App.init());
