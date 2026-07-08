#!/usr/bin/env bash
# ==============================================================================
# bootstrap.sh – AVM Installer Bootstrap (Pre-Flight Check + Installer Loader)
# ==============================================================================
# Lädt install.sh aus demselben Repository und führt es aus.
# Führt vorab Systemprüfungen durch und zeigt Server-Informationen an.
#
# Usage (via Web UI):
#   curl -fsSL https://raw.githubusercontent.com/gianga82/avm-installer/main/bootstrap/bootstrap.sh | sudo bash -s -- [OPTIONS]
#
# Usage (interaktiv):
#   curl -fsSL https://raw.githubusercontent.com/gianga82/avm-installer/main/bootstrap/bootstrap.sh | sudo bash
# ==============================================================================

set -euo pipefail

# ─── Version & URL ───────────────────────────────────────────────────────────
BOOTSTRAP_VERSION="1.0.0"
BASE_URL="https://raw.githubusercontent.com/gianga82/avm-installer/main"

# ─── Farben ──────────────────────────────────────────────────────────────────
RED='\033[31m'; GREEN='\033[32m'; YELLOW='\033[33m'; CYAN='\033[36m'
BLUE='\033[34m'; BOLD='\033[1m'; NC='\033[0m'
CHECK="${GREEN}✔${NC}"
CROSS="${RED}✖${NC}"
WARN_SYM="${YELLOW}⚠${NC}"
INFO_SYM="${CYAN}ℹ${NC}"

# ─── Logging ─────────────────────────────────────────────────────────────────
_log() { echo "[$(date +%s)] $*" >&2; }

# ─── Root-Prüfung ────────────────────────────────────────────────────────────
check_root() {
  if [ "$(id -u)" -ne 0 ]; then
    echo -e " ${CROSS} ${RED}Dieses Skript benötigt Root-Rechte.${NC}" >&2
    echo -e " ${INFO_SYM} ${CYAN}Führe aus: curl -fsSL ${BASE_URL}/bootstrap/bootstrap.sh | sudo bash${NC}"
    exit 1
  fi
}

# ─── Betriebssystem-Prüfung ──────────────────────────────────────────────────
check_os() {
  local os=""
  if [ -f /etc/os-release ]; then
    os="$(grep -oP '(?<=^ID=).*' /etc/os-release | tr -d '"')"
  elif command -v lsb_release &>/dev/null; then
    os="$(lsb_release -si | tr '[:upper:]' '[:lower:]')"
  fi

  case "${os}" in
    ubuntu|debian)
      return 0
      ;;
    "")
      echo -e " ${WARN_SYM} ${YELLOW}Betriebssystem nicht erkannt – Installation wird fortgesetzt${NC}"
      return 0
      ;;
    *)
      echo -e " ${WARN_SYM} ${YELLOW}Betriebssystem '${os}' möglicherweise nicht vollständig unterstützt${NC}"
      echo -e " ${INFO_SYM} ${CYAN}Installation wird fortgesetzt (Ubuntu/Debian empfohlen)${NC}"
      return 0
      ;;
  esac
}

# ─── Architektur-Prüfung ─────────────────────────────────────────────────────
check_arch() {
  local arch
  arch="$(uname -m)"
  case "${arch}" in
    x86_64|amd64|aarch64|arm64)
      return 0
      ;;
    *)
      echo -e " ${WARN_SYM} ${YELLOW}Architektur '${arch}' möglicherweise nicht vollständig unterstützt${NC}"
      echo -e " ${INFO_SYM} ${CYAN}Installation wird fortgesetzt (amd64/arm64 empfohlen)${NC}"
      return 0
      ;;
  esac
}

# ─── Abhängigkeiten prüfen ───────────────────────────────────────────────────
check_deps() {
  local missing=()
  for dep in curl wget; do
    if ! command -v "${dep}" &>/dev/null; then
      missing+=("${dep}")
    fi
  done

  if [ ${#missing[@]} -gt 0 ]; then
    echo -e " ${CROSS} ${RED}Fehlende Abhängigkeiten: ${missing[*]}${NC}" >&2
    echo -e " ${INFO_SYM} ${CYAN}Installiere mit: apt-get install -y ${missing[*]}${NC}"
    exit 2
  fi
}

# ─── Systemübersicht anzeigen ────────────────────────────────────────────────
show_system_info() {
  local os=""
  local os_ver=""
  if [ -f /etc/os-release ]; then
    os="$(grep -oP '(?<=^PRETTY_NAME=).*' /etc/os-release | tr -d '"')"
    os_ver="$(grep -oP '(?<=^VERSION_ID=).*' /etc/os-release | tr -d '"')"
  fi
  local arch
  arch="$(uname -m)"
  local kernel
  kernel="$(uname -r)"
  local cpu
  cpu="$(nproc 2>/dev/null || echo "?")"
  local mem
  mem="$(free -h 2>/dev/null | awk '/^Mem:/{print $2}' || echo "?")"
  local disk
  disk="$(df -h / 2>/dev/null | awk 'NR==2{print $4}' || echo "?")"

  echo ""
  echo -e "${CYAN}────────────────────────────────────────────${NC}"
  echo -e "${CYAN}  System-Informationen${NC}"
  echo -e "${CYAN}────────────────────────────────────────────${NC}"
  echo -e " ${INFO_SYM} ${BOLD}Betriebssystem:${NC}  ${os:-unbekannt}"
  echo -e " ${INFO_SYM} ${BOLD}Kernel:${NC}          ${kernel}"
  echo -e " ${INFO_SYM} ${BOLD}Architektur:${NC}     ${arch}"
  echo -e " ${INFO_SYM} ${BOLD}CPU-Kerne:${NC}       ${cpu}"
  echo -e " ${INFO_SYM} ${BOLD}Arbeitsspeicher:${NC} ${mem}"
  echo -e " ${INFO_SYM} ${BOLD}Freier Speicher:${NC} ${disk}"
  echo -e "${CYAN}────────────────────────────────────────────${NC}"
  echo ""
}

# ─── install.sh herunterladen und ausführen ─────────────────────────────────
run_installer() {
  local installer_url="${BASE_URL}/install.sh"
  local installer_exit=0

  echo -e " ${INFO_SYM} ${CYAN}Lade Installer von ${installer_url} …${NC}"
  _log "Lade install.sh von ${installer_url}"

  if command -v curl &>/dev/null; then
    bash <(curl -fsSL --connect-timeout 10 --max-time 60 "${installer_url}") "$@" || installer_exit=$?
  elif command -v wget &>/dev/null; then
    bash <(wget -qO- --timeout=60 "${installer_url}") "$@" || installer_exit=$?
  else
    echo -e " ${CROSS} ${RED}Kein curl oder wget gefunden${NC}" >&2
    exit 2
  fi

  return "${installer_exit}"
}

# ─── Interaktive Bestätigung ─────────────────────────────────────────────────
confirm_interactive() {
  echo -e " ${INFO_SYM} ${CYAN}Dies wird die folgenden Komponenten auf Ihrem Server installieren:${NC}"
  echo ""
  echo -e "   • ${BOLD}AI VPS Manager${NC} – Server-Management & Module"
  echo -e "   • ${BOLD}Docker${NC} – Container-Plattform"
  echo -e "   • ${BOLD}Weitere Module${NC} nach Auswahl"
  echo ""
  echo -e " ${WARN_SYM} ${YELLOW}Bitte stellen Sie sicher, dass:${NC}"
  echo -e "   • Ein aktuelles Backup Ihrer Daten existiert"
  echo -e "   • Der Server auf dem neuesten Stand ist (apt update/upgrade)"
  echo -e "   • Port 22 (SSH) erreichbar ist"
  echo ""
  read -r -p "Fortfahren? [J/n]: " response
  case "${response}" in
    [jJYy]|"")
      return 0
      ;;
    *)
      echo -e " ${WARN_SYM} ${YELLOW}Bootstrap abgebrochen.${NC}"
      return 1
      ;;
  esac
}

# ─── Hilfe ────────────────────────────────────────────────────────────────────
usage() {
  cat <<EOF
AI VPS Manager Bootstrap v${BOOTSTRAP_VERSION}

Usage:
  curl -fsSL ${BASE_URL}/bootstrap/bootstrap.sh | sudo bash -s -- [OPTIONS]

Options:
  --help, -h              Diese Hilfe anzeigen
  --version               Version anzeigen

Installationsoptionen (werden an install.sh durchgereicht):
  --docker                Install Docker & Compose
  --mcp                   Install MCP Server
  --opencode              Install OpenCode
  --ollama                Install Ollama
  --openwebui             Install Open WebUI (requires Docker)
  --nginx-proxy-manager   Install Nginx Proxy Manager
  --tailscale             Install Tailscale
  --watchtower            Install Watchtower
  --monitoring            Install Monitoring
  --hostname NAME         Set server hostname
  --ssh-port PORT         Set SSH port (default: 22)
  --user NAME             Set admin user (default: root)
  --auto-update           Enable automatic security updates

Ohne Optionen startet der interaktive Modus.
EOF
  exit 0
}

# ─── Einstiegspunkt ─────────────────────────────────────────────────────────
main() {
  export AVM_BOOTSTRAP=1

  echo ""
  echo -e "${CYAN}╔══════════════════════════════════════════════════════════╗${NC}"
  echo -e "${CYAN}║${NC}       ${BOLD}AI VPS Manager – Bootstrap v${BOOTSTRAP_VERSION}${NC}           ${CYAN}║${NC}"
  echo -e "${CYAN}╚══════════════════════════════════════════════════════════╝${NC}"
  echo ""

  for arg in "$@"; do
    case "${arg}" in
      --help|-h) usage ;;
      --version)
        echo "bootstrap.sh version ${BOOTSTRAP_VERSION}"
        exit 0
        ;;
    esac
  done

  check_root
  check_os
  check_arch
  check_deps

  if [ $# -eq 0 ]; then
    show_system_info
    confirm_interactive || exit 1
    echo -e " ${CHECK} ${GREEN}Bootstrap abgeschlossen.${NC}"
    echo -e " ${INFO_SYM} ${CYAN}Keine Module ausgewählt.${NC}"
    echo ""
    echo -e " ${INFO_SYM} ${CYAN}Installation mit Standard-Modulen:${NC}"
    echo -e "    curl -fsSL ${BASE_URL}/bootstrap/bootstrap.sh | sudo bash -s -- --docker --opencode --ollama --fail2ban --netdata --auto-update"
    echo ""
    echo -e " ${INFO_SYM} ${CYAN}Alle Optionen anzeigen:${NC}"
    echo -e "    bash install.sh --help"
    exit 0
  fi

  run_installer "$@"
  local exit_code=$?

  case "${exit_code}" in
    0)  echo -e "\n${GREEN}Bootstrap erfolgreich.${NC}" ;;
    1)  echo -e "\n${YELLOW}Installation abgebrochen.${NC}" ;;
    2)  echo -e "\n${RED}Installation fehlgeschlagen.${NC}" ;;
    *)  echo -e "\n${RED}Unbekannter Fehler (${exit_code}).${NC}" ;;
  esac
  exit "${exit_code}"
}

main "$@"
