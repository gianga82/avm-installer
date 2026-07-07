# AVM Installer – Web Frontend

Web-Installer für den [AI VPS Manager](https://github.com/gianga82/ai-vps-manager).

👉 **Live**: [gianga82.github.io/avm-installer](https://gianga82.github.io/avm-installer)

## Features

- Dark Theme mit Glas-Effekten (Inter Font, responsive)
- Module werden dynamisch aus `config/module_registry.json` geladen
- Keine hartcodierten Modulnamen im HTML/JS
- 6 Kategorien: Server, AI, Networking, Monitoring, Security, Sonstige
- Status-System: available, experimental, planned, deprecated
- Auto-Dependencies: Abhängige Module werden automatisch aktiviert
- **Live-Konfiguration**: Jede Eingabe aktualisiert sofort Zusammenfassung, JSON und Befehl
- **JSON-Viewer** mit Syntax-Highlighting (Copy + Download)
- **Terminal-Viewer** mit vollständigem curl-Befehl (Copy + Download)
- **Abhängigkeits-Hinweise**: Info bei Auto-Deps, gelbe Warnung bei experimentell, blaue Info bei geplant

## Architektur

```
index.html              – Einstieg (keine Modul-Daten)
css/style.css           – Stylesheet
js/
  app.js                – State, Registry-Load, Init, renderAll()
  ui.js                 – Rendering (Cards, Summary, JSON, DepHints, Toasts)
  installer.js          – Befehlsgenerierung, JSON-Export, Copy, Download
  api.js                – Registry-Fetch (lokal + GitHub)
config/
  module_registry.json  – Single Source of Truth für alle Module
assets/
  logo.svg / favicon.ico
```

## Module Registry

`config/module_registry.json` definiert alle Module:

```json
{
  "modul_id": {
    "title": "Modulname",
    "category": "Server|AI|Networking|Monitoring|Security|Sonstige",
    "description": "Kurzbeschreibung",
    "icon": "🐳",
    "installer": "pfad/im/installer",
    "status": "available|experimental|planned|deprecated",
    "depends": ["dependency_id"],
    "visible": true
  }
}
```

- `visible: false` – Modul wird auf der Seite nicht angezeigt
- `deprecated` – Modul wird angezeigt, Checkbox deaktiviert (rot)
- `planned` – Modul angezeigt, Checkbox deaktiviert (blau)
- `experimental` – Modul wählbar, gelber Badge
- `depends` – Abhängigkeiten werden automatisch aktiviert

## Live-Konfiguration

Die Seite reagiert auf jede Eingabe ohne Reload:

1. **Server-Konfiguration** ändern → JSON + Befehl aktualisieren sich
2. **Modul auswählen** → Zusammenfassung + JSON + Befehl + Hinweise aktualisieren
3. **JSON** anzeigen, kopieren oder als `install_config.json` herunterladen
4. **Befehl** kopieren oder als `.sh`-Script herunterladen

## Web → Bootstrap → Installation

### Ablaufdiagramm

```
┌─────────────────────────────────────────────────────────────┐
│  Browser (Web-Installer)                                    │
│                                                             │
│  index.html                                                 │
│    ├── js/api.js ──── lädt ───► config/module_registry.json │
│    ├── js/app.js ──── baut ───► getInstallConfig()          │
│    ├── js/ui.js  ──── zeigt   (Server + Module)             │
│    └── js/installer.js                                      │
│          ├── buildCommand()  → curl-Befehl                  │
│          └── buildJSON()     → install_config.json           │
└──────────────────────────┬──────────────────────────────────┘
                           │
              ┌────────────┴────────────┐
              ▼                        ▼
  curl ... | bash            download
  (sofort ausführen)         install_config.json
              │                        │
              └────────────┬───────────┘
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  Server (install.sh)                                        │
│                                                             │
│  1. parse_args() oder load_config()                         │
│     └── Liest --flags oder install_config.json              │
│         (beide Formate: "modul": true oder                  │
│          "modul": { "install": true })                      │
│                                                             │
│  2. load_registry()                                         │
│     └── Liest config/module_registry.json                   │
│         (selbe Datei wie der Web-Installer!)                │
│                                                             │
│  3. ensure_main_repo()                                      │
│     └── Klont ai-vps-manager nach /opt/avm                  │
│                                                             │
│  4. source lib/module_manager.sh                            │
│     └── Lädt Modul-Manager aus dem geklonten Repo           │
│                                                             │
│  5. resolve_dependencies()                                  │
│     └── Aktiviert Abhängigkeiten (docker→openwebui, …)      │
│                                                             │
│  6. Für jedes aktivierte Modul:                             │
│     ├── check_module_status() – available/experimental/…    │
│     ├── module_exists()      – Prüft module.conf            │
│     └── run_module_action()  – Führt install.sh aus         │
│                                                             │
│  7. Firewall konfigurieren (UFW)                            │
└─────────────────────────────────────────────────────────────┘
```

### Konfigurationslogik

**Es gibt nur noch eine Konfigurationslogik.**

Sowohl der Web-Installer (JavaScript) als auch der Bash-Installer (`install.sh`)
verwenden dieselbe Quelle für Modulnamen und -metadaten:

| Komponente             | Quelle                        |
|------------------------|-------------------------------|
| Modulnamen             | `config/module_registry.json` |
| Kategorie              | `category`-Feld               |
| Status                 | `status`-Feld                 |
| Abhängigkeiten         | `depends`-Feld                |
| Installer-Pfad         | `installer`-Feld              |
| Server-Konfiguration   | CLI-Flags / `install_config.json` |

### Format-Kompatibilität

`install_config.json` wird von beiden Welten gleich verstanden:

```json
{
  "hostname": "myserver",
  "ssh_port": 2222,
  "user": "admin",
  "auto_update": true,
  "modules": {
    "docker": true,
    "openwebui": true
  }
}
```

Das Bash-Script unterstützt **beide Formate** aus Gründen der Rückwärtskompatibilität:
- `"modul": true` – einfacher Boolean
- `"modul": { "install": true }` – Objekt-Format (generiert von älteren Web-Versionen)

## Entwicklung

```bash
python3 -m http.server 8080
# http://localhost:8080
```

## Tests

```bash
node js/tests/test_ui.js
# oder browser: open js/tests/test_ui.html
```

## Build & Release

Das Frontend durchläuft vor der Veröffentlichung einen Build-Prozess:

```
static/installer/  →  build/installer/  →  static/installer/  →  GitHub Pages
     (Quelle)        (build_installer.sh)   (publish_installer.sh)
                     └── Einzige Filterung    └── Kein Filter – 1:1-Kopie
```

### Build

```bash
# Build erzeugen (nur freigegebene Dateien)
./scripts/build_installer.sh
```

Ergebnis: `build/installer/` mit validiertem Inhalt und Statistik.

### Veröffentlichen

```bash
# Build + Sync ins Submodul
./scripts/publish_installer.sh

# Build + Sync + Commit + Push (im Submodul)
./scripts/publish_installer.sh --push
```

### Kurzform (Build + Publish in einem Schritt)

```bash
./scripts/publish_installer.sh --push
```

## Deployment (GitHub Pages)

Das Frontend wird über `publish_installer.sh` in das Git-Submodul
`static/installer/` veröffentlicht.

### Voraussetzungen

- Submodul ist initialisiert:
  ```bash
  git submodule update --init static/installer
  ```

### Verwendung

```bash
# Build + Sync in Submodul
./scripts/publish_installer.sh

# Build + Sync + Commit + Push
./scripts/publish_installer.sh --push
```

### Was passiert

1. **Build**: Falls `build/installer/` fehlt, wird automatisch `build_installer.sh` ausgeführt
2. **Validierung**: Prüft Build und Submodul auf Vollständigkeit
3. **Sync**: Der **gesamte** Build-Inhalt wird nach `static/installer/` synchronisiert (`.git` bleibt erhalten). Es gibt keine zweite Filterung im Publish – `build_installer.sh` definiert als einzige Stelle, welche Dateien ausgeschlossen werden.
4. **Zusammenfassung**: Dateien, Branch, Repository, Git-Status
5. **Mit `--push`**: Automatischer Commit + Push **im Submodul** (überspringt bei identischem Stand)

### Ausschlüsse

Die einzige Filterung findet in `build_installer.sh` statt:
`.git`, `.github`, `node_modules`, `__pycache__`, `*.log`, `*.tmp`

Neue Ordner wie `bootstrap/`, `docs/` oder zukünftige Erweiterungen werden **automatisch** ohne Codeänderung übernommen.

## Lizenz

MIT – siehe `LICENSE`.
