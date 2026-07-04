/* ==========================================================================
   api.js – API-Client (Registry-Loader, Version, Dummy-Endpunkte)
   Lädt config/module_registry.json lokal oder von GitHub
   ========================================================================== */

const API = (() => {
  'use strict';

  const LOCAL_REGISTRY  = 'config/module_registry.json';
  const REMOTE_REGISTRY = 'https://raw.githubusercontent.com/gianga82/avm-installer/main/config/module_registry.json';
  const VERSION_URL     = 'https://raw.githubusercontent.com/gianga82/avm-installer/main/VERSION';

  /* ─── Registry abrufen (lokal bevorzugt, GitHub als Fallback) ──────── */

  async function fetchRegistry() {
    try {
      const res = await fetch(LOCAL_REGISTRY, { cache: 'no-cache' });
      if (res.ok) return await res.json();
    } catch (_) { /* fall through */ }

    try {
      const res = await fetch(REMOTE_REGISTRY, { cache: 'no-cache' });
      if (res.ok) return await res.json();
      console.warn('Registry-Fetch von GitHub fehlgeschlagen: HTTP', res.status);
    } catch (err) {
      console.warn('Registry-Fetch von GitHub fehlgeschlagen:', err.message);
    }

    return null;
  }

  /* ─── Version abrufen ───────────────────────────────────────────────── */

  async function fetchVersion() {
    try {
      const res = await fetch(VERSION_URL, { cache: 'no-cache' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.text()).trim();
    } catch (err) {
      console.warn('Version-Fetch fehlgeschlagen:', err.message);
      return '1.0.0';
    }
  }

  /* ─── Konfiguration übermitteln (Dummy) ─────────────────────────────── */

  async function submitConfig(config) {
    console.log('Konfiguration übermittelt (Dummy):', config);
    return { success: true, message: 'Konfiguration empfangen (Dummy)' };
  }

  return { fetchRegistry, fetchVersion, submitConfig };
})();
