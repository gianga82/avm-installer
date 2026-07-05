/* ==========================================================================
   ui.js – UI-Rendering, Toast-Benachrichtigungen, DOM-Helfer
   ========================================================================== */

const UI = (() => {
  'use strict';

  const CATEGORY_ORDER = ['Server', 'AI', 'Networking', 'Monitoring', 'Security', 'Sonstige'];
  const STATUS_LABELS = {
    available: 'Verf\u00fcgbar',
    experimental: 'Experimentell',
    planned: 'Geplant',
    deprecated: 'Veraltet',
  };

  /* ─── Module rendern ────────────────────────────────────────────────── */

  function renderModules(modules, container) {
    const enabledIds = new Set(modules.filter(m => m.enabled).map(m => m.id));
    const autoDepIds = new Set();
    for (const mod of modules) {
      if (!mod.enabled) continue;
      for (const depId of mod.depends) {
        if (!enabledIds.has(depId)) autoDepIds.add(depId);
      }
    }

    const categories = {};
    for (const mod of modules) {
      if (!categories[mod.category]) categories[mod.category] = [];
      categories[mod.category].push(mod);
    }

    let html = '';

    for (const cat of CATEGORY_ORDER) {
      if (!categories[cat]) continue;
      html += '<div class="category-label">' + cat + '</div>';
      html += '<div class="modules-grid">';
      for (const mod of categories[cat]) {
        const isAuto = autoDepIds.has(mod.id);
        const isDisabled = mod.status === 'planned' || mod.status === 'deprecated';
        const isChecked = mod.enabled || isAuto;
        const cssClass = [];
        if (isDisabled) cssClass.push('disabled');
        if (mod.status === 'deprecated') cssClass.push('deprecated');
        if (isChecked) cssClass.push('selected');
        if (isAuto) cssClass.push('auto-dep');

        const badgeLabel = STATUS_LABELS[mod.status] || mod.status;
        const titleAttr = mod.status === 'planned'
          ? 'title="Dieses Modul ist geplant und noch nicht verf\u00fcgbar."'
          : mod.status === 'deprecated'
            ? 'title="Dieses Modul ist veraltet und wird nicht installiert."'
            : '';

        let autoLabel = '';
        if (isAuto) {
          autoLabel = '<span class="auto-label">automatisch aktiviert</span>';
        }

        html += '<div class="module-card ' + cssClass.join(' ') + '" data-id="' + mod.id + '" ' + titleAttr + ' role="button" tabindex="0">';
        html += '  <div class="module-icon">' + mod.icon + '</div>';
        html += '  <div class="module-info">';
        html += '    <h4>' + mod.title + ' ' + autoLabel + '</h4>';
        html += '    <p>' + mod.description + '</p>';
        html += '    <span class="module-badge ' + mod.status + '">' + badgeLabel + '</span>';
        html += '  </div>';
        html += '  <div class="module-check' + (isChecked ? ' checked' : '') + '">';
        if (isChecked) html += '<span class="check-mark">\u2713</span>';
        html += '  </div>';
        html += '</div>';
      }
      html += '</div>';
    }

    container.innerHTML = html;
  }

  /* ─── Zusammenfassung rendern (erweitert) ───────────────────────────── */

  function renderSummary() {
    const summary = App.getModuleSummary();
    const counts = App.getCounts();

    /* Explizit installierte Module */
    const explicitList = document.getElementById('summaryExplicit');
    if (explicitList) {
      if (summary.explicit.length === 0) {
        explicitList.innerHTML = '<li style="color:var(--text-muted);font-style:italic;">Keine Module ausgew\u00e4hlt</li>';
      } else {
        explicitList.innerHTML = summary.explicit.map(m =>
          '<li><span class="dot active"></span>' + m.title + '</li>'
        ).join('');
      }
    }

    /* Automatisch aktivierte Module */
    const autoList = document.getElementById('summaryAuto');
    if (autoList) {
      if (summary.autoActivated.length === 0) {
        autoList.innerHTML = '<li style="color:var(--text-muted);font-style:italic;">Keine automatischen Abh\u00e4ngigkeiten</li>';
      } else {
        autoList.innerHTML = summary.autoActivated.map(m =>
          '<li><span class="dot warning"></span>' + m.title + ' <span style="color:var(--text-muted);font-size:0.75rem;">(ben\u00f6tigt)</span></li>'
        ).join('');
      }
    }

    /* Geplante Module */
    const plannedList = document.getElementById('summaryPlanned');
    if (plannedList) {
      if (summary.planned.length === 0) {
        plannedList.innerHTML = '<li style="color:var(--text-muted);font-style:italic;">Keine geplanten Module</li>';
      } else {
        plannedList.innerHTML = summary.planned.map(m =>
          '<li><span class="dot" style="background:var(--accent);"></span>' + m.title + ' <span style="color:var(--accent);font-size:0.75rem;">(geplant)</span></li>'
        ).join('');
      }
    }

    /* Experimentelle Module */
    const expList = document.getElementById('summaryExperimental');
    if (expList) {
      if (summary.experimental.length === 0) {
        expList.innerHTML = '<li style="color:var(--text-muted);font-style:italic;">Keine experimentellen Module ausgew\u00e4hlt</li>';
      } else {
        expList.innerHTML = summary.experimental.map(m =>
          '<li><span class="dot warning"></span>' + m.title + ' <span style="color:var(--yellow);font-size:0.75rem;">(experimentell)</span></li>'
        ).join('');
      }
    }

    /* Counts */
    document.getElementById('countSelected').textContent = counts.selected;
    document.getElementById('countAvailable').textContent = counts.available;
    document.getElementById('countExperimental').textContent = counts.experimental;
  }

  /* ─── JSON-Konfiguration rendern ────────────────────────────────────── */

  function renderJSON() {
    const container = document.getElementById('jsonViewer');
    if (!container) return;

    const config = App.getInstallConfig();
    const json = JSON.stringify(config, null, 2);
    container.innerHTML = highlightJSON(json);
  }

  function highlightJSON(json) {
    return json.replace(
      /("(?:\\.|[^"\\])*")\s*:/g,
      '<span class="json-key">$1</span>:'
    ).replace(
      /:\s*("(?:\\.|[^"\\])*")/g,
      ':<span class="json-string">$1</span>'
    ).replace(
      /:\s*(true|false|null)/g,
      ':<span class="json-bool">$1</span>'
    ).replace(
      /:\s*(\d+\.?\d*)/g,
      ':<span class="json-num">$1</span>'
    ).replace(
      /({|}|\[|\])/g,
      '<span class="json-bracket">$1</span>'
    );
  }

  /* ─── Dependency-Hinweise rendern ───────────────────────────────────── */

  function renderDepHints() {
    const container = document.getElementById('depHints');
    if (!container) return;

    const summary = App.getModuleSummary();
    const hints = [];

    /* Auto-Dependency-Hinweise */
    for (const mod of summary.autoActivated) {
      const parents = [];
      for (const m of summary.allEnabled) {
        if (!m.autoActivated && m.depends && m.depends.includes(mod.id)) {
          parents.push(m.title);
        }
      }
      if (parents.length > 0) {
        hints.push({
          text: parents.join(', ') + ' ben\u00f6tigt ' + mod.title + '.',
          type: 'info',
        });
      }
    }

    /* Experimentelle Warnungen */
    for (const mod of summary.experimental) {
      hints.push({
        text: mod.title + ' ist experimentell. Nicht f\u00fcr Produktion empfohlen.',
        type: 'warning',
      });
    }

    /* Geplante Module */
    const enabledAllIds = new Set(summary.allEnabled.map(m => m.id));
    const visiblePlanned = summary.planned.filter(m => m.visible !== false);
    for (const mod of visiblePlanned) {
      hints.push({
        text: mod.title + ' ist geplant und kann noch nicht installiert werden.',
        type: 'planned',
      });
    }

    if (hints.length === 0) {
      container.innerHTML = '<div class="dep-hint dep-hint-info">Alle ausgew\u00e4hlten Module sind verf\u00fcgbar.</div>';
      return;
    }

    container.innerHTML = hints.map(h => {
      const cls = h.type === 'warning' ? 'dep-hint-warning' : h.type === 'planned' ? 'dep-hint-planned' : 'dep-hint-info';
      const icon = h.type === 'warning' ? '\u26a0\ufe0f' : h.type === 'planned' ? '\u2139\ufe0f' : '\u2139\ufe0f';
      return '<div class="dep-hint ' + cls + '">' + icon + ' ' + h.text + '</div>';
    }).join('');
  }

  /* ─── Toast-Benachrichtigung ────────────────────────────────────────── */

  function showToast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'toast ' + type;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(function () {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s ease';
      setTimeout(function () { toast.remove(); }, 300);
    }, duration);
  }

  return { renderModules, renderSummary, renderJSON, renderDepHints, showToast };
})();
