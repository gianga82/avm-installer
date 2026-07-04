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
static/installer/  →  build/installer/  →  avm-installer/ (GitHub Pages)
     (Quelle)       (build_installer.sh)    (publish_installer.sh)
```

### Build

```bash
# Build erzeugen (nur freigegebene Dateien)
./scripts/build_installer.sh
```

Ergebnis: `build/installer/` mit validiertem Inhalt und Statistik.

### Veröffentlichen

```bash
# Build + Publish (automatischer Build bei fehlendem build/installer/)
./scripts/publish_installer.sh

# Mit benutzerdefiniertem Ziel
./scripts/publish_installer.sh --target ~/avm-installer

# Mit automatischem Commit + Push
./scripts/publish_installer.sh --push
```

### Kurzform (Build + Publish in einem Schritt)

```bash
./scripts/publish_installer.sh --push
```

## Deployment (GitHub Pages)

Das Frontend wird über `publish_installer.sh` automatisch in ein separates
Repository (~/avm-installer/) veröffentlicht.

### Voraussetzungen

- Ziel-Repository existiert und ist initialisiert:
  ```bash
  mkdir -p ~/avm-installer
  git init ~/avm-installer
  git -C ~/avm-installer remote add origin git@github.com:gianga82/avm-installer.git
  ```

### Verwendung

```bash
# Standard (Ziel: ~/avm-installer)
./scripts/publish_installer.sh

# Benutzerdefiniertes Zielverzeichnis
./scripts/publish_installer.sh --target ~/avm-installer

# Kopieren + automatisch commiten + pushen
./scripts/publish_installer.sh --push
./scripts/publish_installer.sh --target ~/avm-installer --push
```

### Was passiert

1. **Build**: Falls `build/installer/` fehlt, wird automatisch `build_installer.sh` ausgeführt
2. **Validierung**: Prüft Build- und Zielverzeichnis auf Vollständigkeit
3. **Bereinigung**: Ziel wird geleert (`.git` bleibt erhalten)
4. **Kopieren**: Nur erlaubte Dateien werden aus `build/installer/` übernommen
5. **Zusammenfassung**: Anzahl Dateien, Zielpfad, Repository, Git-Status
6. **Mit `--push`**: Automatischer Commit + Push (überspringt bei identischem Stand)

### Ausgeschlossene Dateien

`bootstrap/`, `docs/`, `tests/`, `.github/`, `node_modules/`, `__pycache__/`,
`*.log`, `*.tmp`, `*.log`, `.git/`

### Manuelle Schritte (einmalig)

1. `~/avm-installer/` als Git-Repo mit Remote einrichten (s.o.)
2. GitHub Pages im Repo aktivieren (Source: `main`, Ordner: `/ (root)`)
3. Ab dann nur noch `./scripts/publish_installer.sh --push` ausführen

## Lizenz

MIT – siehe `LICENSE`.
