/* ==========================================================================
   installer.js – Befehlsgenerierung, JSON-Export, Zwischenablage, Download
   ========================================================================== */

const Installer = (() => {
  'use strict';

  const BASE_URL = 'https://raw.githubusercontent.com/gianga82/avm-installer/main';

  /* ─── Modul-Flags ───────────────────────────────────────────────────── */

  function getModuleFlags(state) {
    const enabled = state.modules.filter(m => m.enabled);
    return enabled.map(m => '--' + m.id).join(' ');
  }

  /* ─── Config-Flags ──────────────────────────────────────────────────── */

  function getConfigFlags(state) {
    const flags = [];
    if (state.hostname)  flags.push('--hostname ' + state.hostname);
    if (state.sshPort && state.sshPort !== 22) flags.push('--ssh-port ' + state.sshPort);
    if (state.user && state.user !== 'root') flags.push('--user ' + state.user);
    if (state.autoUpdate) flags.push('--auto-update');
    return flags.join(' ');
  }

  /* ─── Kompletten Befehl bauen ───────────────────────────────────────── */

  function buildCommand(state) {
    const curlLine = 'curl -fsSL ' + BASE_URL + '/bootstrap/bootstrap.sh';
    const modFlags = getModuleFlags(state);
    const cfgFlags = getConfigFlags(state);
    const allFlags = [modFlags, cfgFlags].filter(Boolean).join(' ');
    const mainLine = allFlags ? ' | sudo bash -s -- ' + allFlags : ' | sudo bash -s --';
    return { curlLine, mainLine, modFlags, cfgFlags, fullCommand: curlLine + mainLine };
  }

  /* ─── Terminal-UI aktualisieren ─────────────────────────────────────── */

  function updateCommand(state) {
    const terminal = document.getElementById('terminal');
    if (!terminal) return;
    const cmd = buildCommand(state);
    terminal.innerHTML = '<span class="prompt">$</span> ' + escapeHtml(cmd.fullCommand) + '<span class="terminal-cursor"></span>';
  }

  function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /* ─── In Zwischenablage kopieren ────────────────────────────────────── */

  function copyToClipboard(text, successMsg, failMsg) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        UI.showToast(successMsg || 'In Zwischenablage kopiert!', 'success');
      }).catch(function () {
        fallbackCopy(text, failMsg);
      });
    } else {
      fallbackCopy(text, failMsg);
    }
  }

  function fallbackCopy(text, failMsg) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand('copy');
      UI.showToast('In Zwischenablage kopiert!', 'success');
    } catch {
      UI.showToast(failMsg || 'Kopieren fehlgeschlagen', 'error');
    }
    document.body.removeChild(textarea);
  }

  function copyCommand(state) {
    const cmd = buildCommand(state);
    copyToClipboard(cmd.fullCommand, 'Befehl in Zwischenablage kopiert!');
  }

  function copyJSON(state) {
    const json = JSON.stringify(App.getInstallConfig(), null, 2);
    copyToClipboard(json, 'JSON in Zwischenablage kopiert!');
  }

  /* ─── JSON Builder ──────────────────────────────────────────────────── */

  function buildJSON(state) {
    return JSON.stringify(App.getInstallConfig(), null, 2);
  }

  /* ─── Script-Download ───────────────────────────────────────────────── */

  function downloadScript(state) {
    const cmd = buildCommand(state);
    const timestamp = new Date().toISOString().slice(0, 10);
    const modules = state.modules.filter(m => m.enabled).map(m => m.title).join(', ') || 'keine';
    const config = App.getConfig();

    const script = '#!/usr/bin/env bash\n' +
      '# AI VPS Manager \u2013 Installation Script\n' +
      '# Generiert: ' + timestamp + '\n' +
      '# Module: ' + modules + '\n' +
      '# Hostname: ' + (config.hostname || '(nicht gesetzt)') + '\n' +
      '# SSH-Port: ' + config.ssh_port + '\n' +
      '# User: ' + config.user + '\n' +
      '\n' +
      'set -euo pipefail\n' +
      '\n' +
      'echo "=== AI VPS Manager Installation ==="\n' +
      'echo "Starte Installation der ausgew\u00e4hlten Module..."\n' +
      '\n' +
      cmd.curlLine + '\n';

    downloadFile(script, 'avm-install-' + timestamp + '.sh', 'application/x-sh');
    UI.showToast('Script heruntergeladen!', 'success');
  }

  /* ─── JSON-Download ─────────────────────────────────────────────────── */

  function downloadJSON(state) {
    const json = buildJSON(state);
    downloadFile(json, 'install_config.json', 'application/json');
    UI.showToast('install_config.json heruntergeladen!', 'success');
  }

  function downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return { updateCommand, copyCommand, copyJSON, downloadScript, downloadJSON, buildJSON, buildCommand };
})();
