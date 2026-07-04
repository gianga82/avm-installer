#!/usr/bin/env node
/**
 * test_ui.js – Headless Test Suite for Dynamic Module Registry
 *
 * Tests the pure-logic functions (no DOM required):
 *   normalizeRegistry, resolveDeps, getEnabledModules,
 *   groupByCategory, getStatusCounts
 *
 * Usage: node js/tests/test_ui.js
 */

'use strict';

/* ─── Colour / Reporter ───────────────────────────────────────────────── */

const GREEN = '\x1b[32m';
const RED   = '\x1b[31m';
const CYAN  = '\x1b[36m';
const RESET = '\x1b[0m';
let pass = 0, fail = 0;

function testCase(name) {
  console.log(`\n${CYAN}${'─'.repeat(56)}${RESET}`);
  console.log(`${CYAN}  ${name}${RESET}`);
  console.log(`${CYAN}${'─'.repeat(56)}${RESET}`);
}

function assert(condition, msg) {
  if (condition) {
    console.log(`  ${GREEN}✔ PASS${RESET}  ${msg}`);
    pass++;
  } else {
    console.log(`  ${RED}✘ FAIL${RESET}  ${msg}`);
    fail++;
  }
}

/* ─── Pure Logic (same as in app.js/ui.js) ────────────────────────────── */

const CATEGORY_ORDER = ['Server', 'AI', 'Networking', 'Monitoring', 'Security', 'Sonstige'];

function normalizeRegistry(data) {
  if (!data || typeof data !== 'object') return [];
  const modules = [];
  for (const [id, mod] of Object.entries(data)) {
    if (mod.visible === false) continue;
    modules.push({
      id,
      title: mod.title || id,
      category: mod.category || 'Sonstige',
      description: mod.description || '',
      icon: mod.icon || '?',
      installer: mod.installer || '',
      status: mod.status || 'planned',
      depends: Array.isArray(mod.depends) ? mod.depends : [],
      visible: mod.visible !== false,
      enabled: false,
    });
  }
  return modules;
}

function resolveDeps(modules) {
  const enabledIds = new Set(modules.filter(m => m.enabled).map(m => m.id));
  const autoDepIds = new Set();
  for (const mod of modules) {
    if (!mod.enabled) continue;
    for (const depId of mod.depends) {
      if (!enabledIds.has(depId)) autoDepIds.add(depId);
    }
  }
  return autoDepIds;
}

function getEnabledModules(modules) {
  const explicitly = modules.filter(m => m.enabled);
  const auto = [];
  for (const mod of explicitly) {
    for (const depId of mod.depends) {
      if (!explicitly.find(m => m.id === depId) && !auto.find(m => m.id === depId)) {
        const depMod = modules.find(m => m.id === depId);
        if (depMod) auto.push({ ...depMod, enabled: true, autoActivated: true });
      }
    }
  }
  return [...explicitly, ...auto];
}

function groupByCategory(modules) {
  const categories = {};
  for (const mod of modules) {
    if (!categories[mod.category]) categories[mod.category] = [];
    categories[mod.category].push(mod);
  }
  const ordered = [];
  for (const cat of CATEGORY_ORDER) {
    if (categories[cat]) ordered.push({ category: cat, modules: categories[cat] });
  }
  return ordered;
}

function getStatusCounts(modules) {
  const counts = { available: 0, experimental: 0, planned: 0, deprecated: 0 };
  for (const m of modules) {
    if (counts[m.status] !== undefined) counts[m.status]++;
  }
  return counts;
}

/* ─── Test Data ───────────────────────────────────────────────────────── */

const FULL_REGISTRY = {
  docker: {
    title: 'Docker', category: 'Server', description: 'Docker Engine',
    icon: '🐳', installer: 'server/docker', status: 'available',
    depends: [], visible: true,
  },
  openwebui: {
    title: 'Open WebUI', category: 'AI', description: 'Web UI for Ollama',
    icon: '🌐', installer: 'ai/openwebui', status: 'available',
    depends: ['docker'], visible: true,
  },
  mcp: {
    title: 'MCP Server', category: 'AI', description: 'Model Context Protocol',
    icon: '🔌', installer: '', status: 'experimental',
    depends: [], visible: true,
  },
  nginx_proxy_manager: {
    title: 'Nginx Proxy Manager', category: 'Server', description: 'Reverse Proxy',
    icon: '🔄', installer: '', status: 'planned',
    depends: ['docker'], visible: true,
  },
  test_deprecated_mod: {
    title: 'Old Module', category: 'Sonstige', description: 'Deprecated test',
    icon: '⚠️', installer: '', status: 'deprecated',
    depends: [], visible: true,
  },
  test_hidden_mod: {
    title: 'Hidden Module', category: 'Sonstige', description: 'Should not appear',
    icon: '👀', installer: '', status: 'available',
    depends: [], visible: false,
  },
  fail2ban: {
    title: 'Fail2Ban', category: 'Security', description: 'Brute-force protection',
    icon: '🚨', installer: '', status: 'available',
    depends: [], visible: true,
  },
};

/* ─── Test 1: Registry leer ───────────────────────────────────────────── */

testCase('1) Registry leer');
assert(Array.isArray(normalizeRegistry(null)),       'null => Array');
assert(normalizeRegistry(null).length === 0,         'null => leeres Array');
assert(Array.isArray(normalizeRegistry({})),          '{} => Array');
assert(normalizeRegistry({}).length === 0,            '{} => leeres Array');

/* ─── Test 2: Unbekannter Status ──────────────────────────────────────── */

testCase('2) Unbekannter Status');
const unknownModules = normalizeRegistry({
  test_mod: {
    title: 'Test', category: 'Server', description: 'Test',
    icon: '?', installer: '', status: 'unknown_status_xyz',
    depends: [], visible: true,
  },
});
assert(unknownModules.length === 1,                          'Modul mit unbekanntem Status wird geladen');
assert(unknownModules[0].status === 'unknown_status_xyz',    'Status bleibt erhalten');
assert(unknownModules[0].enabled === false,                  'Standard enabled = false');

/* ─── Test 3: Fehlende Kategorie ──────────────────────────────────────── */

testCase('3) Fehlende Kategorie');
const noCatModules = normalizeRegistry({
  no_cat_mod: {
    title: 'No Category', description: 'Test',
    icon: '?', installer: '', status: 'available',
    depends: [], visible: true,
  },
});
assert(noCatModules.length === 1,                     'Modul ohne category wird geladen');
assert(noCatModules[0].category === 'Sonstige',       'Fallback-Kategorie = Sonstige');
const grouped = groupByCategory(noCatModules);
assert(grouped.length === 1,                          'Wird unter Sonstige gruppiert');
assert(grouped[0].category === 'Sonstige',             'Gruppe = Sonstige');

/* ─── Test 4: Fehlender Installer ─────────────────────────────────────── */

testCase('4) Fehlender Installer');
const noInstModules = normalizeRegistry({
  no_inst_mod: {
    title: 'No Installer', category: 'AI', description: 'Test',
    icon: '?', status: 'available',
    depends: [], visible: true,
  },
});
assert(noInstModules.length === 1,                  'Modul ohne installer wird geladen');
assert(noInstModules[0].installer === '',            'Fehlender installer = Leerstring');

/* ─── Test 5: Hidden Module ───────────────────────────────────────────── */

testCase('5) Hidden Module (visible=false)');
const visibleModules = normalizeRegistry(FULL_REGISTRY);
const hidden = visibleModules.find(m => m.id === 'test_hidden_mod');
assert(!hidden,                               'test_hidden_mod erscheint nicht in normalisierten Modulen');
assert(visibleModules.length === 6,           '6 sichtbare Module (von 7, 1 hidden)');

/* ─── Test 6: Dependencies ────────────────────────────────────────────── */

testCase('6) Dependencies');
const depModules = normalizeRegistry(FULL_REGISTRY);
depModules.find(m => m.id === 'openwebui').enabled = true;

const autoDepIds = resolveDeps(depModules);
assert(autoDepIds.has('docker'),              'docker wird als Auto-Dep erkannt');
assert(!autoDepIds.has('openwebui'),          'openwebui ist nicht auto-dep');

const enabled = getEnabledModules(depModules);
const autoDocker = enabled.find(m => m.id === 'docker');
assert(autoDocker,                            'docker ist in enabled-Modulen');
assert(autoDocker.autoActivated === true,     'docker ist als autoActivated markiert');

const explicitOwui = enabled.find(m => m.id === 'openwebui');
assert(explicitOwui,                          'openwebui ist in enabled-Modulen');
assert(!explicitOwui.autoActivated,           'openwebui ist nicht autoActivated');

/* ─── Test 7: Experimentelle Module ───────────────────────────────────── */

testCase('7) Experimentelle Module');
const expModules = normalizeRegistry(FULL_REGISTRY);
const mcp = expModules.find(m => m.id === 'mcp');
assert(mcp,                                   'MCP Server ist geladen');
assert(mcp.status === 'experimental',         'MCP Server Status = experimental');

mcp.enabled = true;
const expAutoDeps = resolveDeps(expModules);
assert(expAutoDeps.size === 0,                'MCP hat keine Auto-Dependencies');

const expCounts = getStatusCounts(expModules);
assert(expCounts.experimental >= 1,           'experimental-Zähler >= 1');

/* ─── Test 8: Deprecated Module ───────────────────────────────────────── */

testCase('8) Deprecated Module');
const depMods = normalizeRegistry(FULL_REGISTRY);
const depMod = depMods.find(m => m.id === 'test_deprecated_mod');
assert(depMod,                                'Deprecated Modul ist geladen');
assert(depMod.status === 'deprecated',        'Status = deprecated');
assert(depMod.visible === true,               'visible = true (angezeigt aber deaktiviert)');

const depCounts = getStatusCounts(depMods);
assert(depCounts.deprecated >= 1,             'deprecated-Zähler >= 1');

/* ─── Extra: Category Grouping Order ──────────────────────────────────── */

testCase('Extra) Kategorie-Gruppierungs-Reihenfolge');
const catModules = normalizeRegistry(FULL_REGISTRY);
const catGroups = groupByCategory(catModules);
const catNames = catGroups.map(g => g.category);
assert(catNames.includes('Server'),           'Enthält Server');
assert(catNames.includes('AI'),               'Enthält AI');
assert(catNames.includes('Security'),         'Enthält Security');
assert(catNames.includes('Sonstige'),         'Enthält Sonstige');

const idx = {};
catGroups.forEach((g, i) => { idx[g.category] = i; });
assert(idx['Server'] < idx['AI'],             'Server vor AI');
assert(idx['AI'] < idx['Security'],           'AI vor Security');
assert(idx['Security'] < idx['Sonstige'],     'Security vor Sonstige');

/* ─── New: getInstallConfig equivalent ─────────────────────────────────── */

function buildInstallConfig(modules, hostname, sshPort, user, autoUpdate) {
  const enabledIds = modules.filter(m => m.enabled).map(m => m.id);
  const mods = {};
  for (const id of enabledIds) {
    mods[id] = { install: true };
  }
  return {
    hostname: hostname || null,
    ssh_port: sshPort !== 22 ? sshPort : null,
    user: user !== 'root' ? user : null,
    auto_update: autoUpdate || null,
    modules: Object.keys(mods).length > 0 ? mods : null,
  };
}

function buildCommandText(modules, hostname, sshPort, user, autoUpdate) {
  const BASE_URL = 'https://raw.githubusercontent.com/gianga82/avm-installer/main';
  const modFlags = modules.filter(m => m.enabled).map(m => '--' + m.id).join(' ');
  const cfgFlags = [];
  if (hostname) cfgFlags.push('--hostname ' + hostname);
  if (sshPort && sshPort !== 22) cfgFlags.push('--ssh-port ' + sshPort);
  if (user && user !== 'root') cfgFlags.push('--user ' + user);
  if (autoUpdate) cfgFlags.push('--auto-update');
  const allFlags = [modFlags, cfgFlags.filter(Boolean).join(' ')].filter(Boolean).join(' ');
  return 'curl -fsSL ' + BASE_URL + '/bootstrap/bootstrap.sh' + (allFlags ? ' | sudo bash -s -- ' + allFlags : ' | sudo bash -s --');
}

function getModuleSummary(modules) {
  const explicitly = modules.filter(m => m.enabled);
  const auto = [];
  for (const mod of explicitly) {
    for (const depId of mod.depends) {
      if (!explicitly.find(m => m.id === depId) && !auto.find(m => m.id === depId)) {
        const depMod = modules.find(m => m.id === depId);
        if (depMod) auto.push({ ...depMod, enabled: true, autoActivated: true });
      }
    }
  }
  const allEnabled = [...explicitly, ...auto];
  const explicit = allEnabled.filter(m => !m.autoActivated);
  const autoActivated = allEnabled.filter(m => m.autoActivated);
  const planned = modules.filter(m => m.status === 'planned');
  const experimental = modules.filter(m => m.status === 'experimental' && m.enabled);
  return { explicit, autoActivated, planned, experimental, allEnabled };
}

/* ─── Test 9: JSON Konfiguration ──────────────────────────────────────── */

testCase('9) JSON Konfiguration');
(function() {
  const modules = normalizeRegistry(FULL_REGISTRY);
  modules.find(m => m.id === 'docker').enabled = true;
  modules.find(m => m.id === 'openwebui').enabled = true;

  const config = buildInstallConfig(modules, 'myserver.local', 2222, 'admin', true);
  assert(typeof config === 'object',                    'JSON ist ein Objekt');
  assert(config.hostname === 'myserver.local',           'hostname korrekt');
  assert(config.ssh_port === 2222,                       'ssh_port korrekt');
  assert(config.user === 'admin',                        'user korrekt');
  assert(config.auto_update === true,                    'auto_update korrekt');
  assert(config.modules !== null,                        'modules ist gesetzt');
  assert(config.modules.docker !== undefined,            'docker in modules');
  assert(config.modules.docker.install === true,         'docker.install = true');
  assert(config.modules.openwebui !== undefined,         'openwebui in modules');
  assert(config.modules.openwebui.install === true,      'openwebui.install = true');
  assert(Object.keys(config.modules).length === 2,       'genau 2 module');
})();

/* ─── Test 10: JSON leere Konfiguration ──────────────────────────────── */

testCase('10) JSON leere Konfiguration');
(function() {
  const modules = normalizeRegistry(FULL_REGISTRY);
  const config = buildInstallConfig(modules, '', 22, 'root', false);
  assert(config.hostname === null,    'hostname null bei leer');
  assert(config.ssh_port === null,    'ssh_port null bei 22');
  assert(config.user === null,        'user null bei root');
  assert(config.auto_update === null, 'auto_update null bei false');
  assert(config.modules === null,     'modules null bei keiner Auswahl');
})();

/* ─── Test 11: Command Generation ────────────────────────────────────── */

testCase('11) Command Generation');
(function() {
  const modules = normalizeRegistry(FULL_REGISTRY);
  modules.find(m => m.id === 'docker').enabled = true;
  modules.find(m => m.id === 'openwebui').enabled = true;

  const cmd = buildCommandText(modules, 'srv.example.com', 22, 'root', false);
  assert(cmd.includes('curl -fsSL'),                    'beginnt mit curl');
  assert(cmd.includes('bootstrap.sh'),                   'enthält bootstrap.sh');
  assert(cmd.includes('sudo bash -s --'),                'enthält sudo bash');
  assert(cmd.includes('--docker'),                       'enthält --docker');
  assert(cmd.includes('--openwebui'),                    'enthält --openwebui');
  assert(cmd.includes('--hostname srv.example.com'),     'enthält --hostname');

  const cmd2 = buildCommandText(modules, '', 22, 'root', false);
  assert(!cmd2.includes('--hostname'),                   'kein hostname flag bei leer');
  assert(!cmd2.includes('--ssh-port'),                   'kein ssh-port flag bei 22');
  assert(!cmd2.includes('--user'),                       'kein user flag bei root');
  assert(!cmd2.includes('--auto-update'),                'kein auto-update bei false');
})();

/* ─── Test 12: Module Summary (Extended) ─────────────────────────────── */

testCase('12) Module Summary (Extended)');
(function() {
  const modules = normalizeRegistry(FULL_REGISTRY);
  modules.find(m => m.id === 'openwebui').enabled = true;
  modules.find(m => m.id === 'mcp').enabled = true;

  const summary = getModuleSummary(modules);
  assert(summary.allEnabled.length === 3,               '3 enabled (openwebui, mcp, docker auto)');
  assert(summary.explicit.length === 2,                 '2 explizit (openwebui, mcp)');
  assert(summary.autoActivated.length === 1,            '1 auto (docker)');
  assert(summary.autoActivated[0].id === 'docker',      'auto = docker');
  assert(summary.planned.length >= 1,                   'mind. 1 planned');
  assert(summary.experimental.length === 1,             '1 experimental (mcp)');
  assert(summary.experimental[0].id === 'mcp',          'experimental = mcp');
})();

/* ─── Test 13: Dependency Warnings ───────────────────────────────────── */

testCase('13) Dependency Warnings');
(function() {
  const modules = normalizeRegistry(FULL_REGISTRY);
  modules.find(m => m.id === 'openwebui').enabled = true;

  const summary = getModuleSummary(modules);
  const autoDep = summary.autoActivated.find(m => m.id === 'docker');
  assert(autoDep,                                      'docker als auto-dep erkannt');

  /* Simulate hint generation */
  const hints = [];
  for (const mod of summary.autoActivated) {
    const parents = [];
    for (const m of summary.allEnabled) {
      if (!m.autoActivated && m.depends && m.depends.includes(mod.id)) {
        parents.push(m.title);
      }
    }
    if (parents.length > 0) {
      hints.push({ text: parents.join(', ') + ' benötigt ' + mod.title + '.', type: 'info' });
    }
  }
  assert(hints.length === 1,                           'genau 1 dependency hinweis');
  assert(hints[0].text.includes('Open WebUI'),          'openwebui wird erwähnt');
  assert(hints[0].text.includes('Docker'),              'docker wird erwähnt');
  assert(hints[0].type === 'info',                     'typ = info');
})();

/* ─── Test 14: Keine Module ausgewählt ───────────────────────────────── */

testCase('14) Keine Module ausgewählt');
(function() {
  const modules = normalizeRegistry(FULL_REGISTRY);
  const summary = getModuleSummary(modules);
  assert(summary.explicit.length === 0,                 'keine expliziten');
  assert(summary.autoActivated.length === 0,            'keine auto');
  assert(summary.experimental.length === 0,             'keine experimental');
  assert(summary.allEnabled.length === 0,               'nichts enabled');

  const config = buildInstallConfig(modules, '', 22, 'root', false);
  assert(config.modules === null,                       'modules null');
})();

/* ─── Summary ─────────────────────────────────────────────────────────── */

const total = pass + fail;
console.log(`\n${'─'.repeat(56)}`);
if (fail === 0) {
  console.log(`${GREEN}  ✅ ALLE ${total} TESTS BESTANDEN (${pass} passed, ${fail} failed)${RESET}`);
} else {
  console.log(`${RED}  ❌ ${fail} TEST(S) FEHLGESCHLAGEN (${pass} passed, ${fail} failed von ${total})${RESET}`);
}
console.log(`${'─'.repeat(56)}\n`);
process.exit(fail > 0 ? 1 : 0);
