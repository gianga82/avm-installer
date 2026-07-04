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

## Deployment (GitHub Pages)

Das Frontend wird über `publish_installer.sh` automatisch in ein separates
Repository (~/avm-installer/) veröffentlicht.

```bash
# Nur kopieren (zeigt Git-Status)
./scripts/publish_installer.sh

# Kopieren + automatisch commiten + pushen
./scripts/publish_installer.sh --push
```

Was passiert:
1. Ziel `~/avm-installer/` wird bereinigt (`.git` bleibt erhalten)
2. Nur erlaubte Dateien werden aus `static/installer/` kopiert
3. `bootstrap/`, `tests/`, `docs/`, `*.log`, `__pycache__` werden **nicht** übernommen
4. Git-Status wird angezeigt
5. Mit `--push`: automatischer Commit + Push zum Remote

Manuelle Schritte (einmalig):
1. `~/avm-installer/` als Git-Repo mit Remote `github.com/gianga82/avm-installer` einrichten
2. GitHub Pages im Repo aktivieren (Source: `main`, Ordner: `/ (root)`)
3. Ab dann nur noch `./scripts/publish_installer.sh --push` ausführen

## Lizenz

MIT – siehe `LICENSE`.
