#!/usr/bin/env bash
# ==============================================================================
# install.sh – AVM Installer (Entry Point)
# ==============================================================================
# Steuert sämtliche Modulinstallationen über die Modul-Registry
# (config/module_registry.json) und die install_config.json.
# Enthält keine harten MODULE_MAP-Definitionen mehr.
#
# Usage:
#   Über Bootstrap:
#     bash install.sh --config config/install_config.json
#
#   Direkt mit CLI-Flags:
#     bash install.sh [OPTIONS]
# ==============================================================================

set -euo pipefail

# ─── Version ─────────────────────────────────────────────────────────────────
INSTALLER_VERSION="2.0.0"
BOOTSTRAP_VERSION="1.0.0"
BASE_URL="https://raw.githubusercontent.com/gianga82/avm-installer/main"

# ─── Module flags (Legacy-Kompatibilität) ────────────────────────────────────
OPT_DOCKER=false
OPT_COMPOSE=false
OPT_MCP=false
OPT_OPENCODE=false
OPT_OLLAMA=false
OPT_OPENWEBUI=false
OPT_NPM=false
OPT_TAILSCALE=false
OPT_WATCHTOWER=false
OPT_MONITORING=false
OPT_HOSTNAME=""
OPT_SSH_PORT=""
OPT_USER="root"
OPT_AUTO_UPDATE=false
OPT_CONFIG=""

# ─── Zielverzeichnis / Registry ──────────────────────────────────────────────
AVM_TARGET_DIR="${AVM_TARGET_DIR:-/opt/avm}"
AVM_REPO_URL="https://github.com/gianga82/ai-vps-manager.git"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REGISTRY_PATH="${SCRIPT_DIR}/config/module_registry.json"

# ─── Farben ─────────────────────────────────────────────────────────────────
RED='\033[31m'; GREEN='\033[32m'; YELLOW='\033[33m'; CYAN='\033[36m'
BLUE='\033[34m'; BOLD='\033[1m'; NC='\033[0m'
CHECK="${GREEN}✔${NC}"
CROSS="${RED}✖${NC}"
WARN_SYM="${YELLOW}⚠${NC}"
INFO_SYM="${CYAN}ℹ${NC}"

_log() { echo "[$(date +%s)] $*" >&2; }

# ─── Registry laden ─────────────────────────────────────────────────────────

declare -A REG_TITLE REG_CATEGORY REG_INSTALLER REG_STATUS REG_DEPENDS REG_VISIBLE

load_registry() {
    local reg_file="${1:-${REGISTRY_PATH}}"

    if [ ! -f "${reg_file}" ]; then
        echo -e " ${CROSS} ${RED}Modul-Registry nicht gefunden: ${reg_file}${NC}" >&2
        return 1
    fi

    if ! command -v python3 &>/dev/null; then
        echo -e " ${CROSS} ${RED}python3 wird zum Lesen der Registry benötigt${NC}" >&2
        return 1
    fi

    python3 -c "
import json, sys
reg = json.load(open('${reg_file}'))
keys = sorted(reg.keys())
sys.stdout.write('KEYS=' + ','.join(keys) + '\n')
for k, v in reg.items():
    sys.stdout.write(f'TITLE_{k}={v.get(\"title\",k)}\n')
    sys.stdout.write(f'CATEGORY_{k}={v.get(\"category\",\"\")}\n')
    sys.stdout.write(f'INSTALLER_{k}={v.get(\"installer\",\"\")}\n')
    sys.stdout.write(f'STATUS_{k}={v.get(\"status\",\"\")}\n')
    sys.stdout.write(f'DEPENDS_{k}={\"|\".join(v.get(\"depends\",[]))}\n')
    sys.stdout.write(f'VISIBLE_{k}={str(v.get(\"visible\",True)).lower()}\n')
" 2>/dev/null || {
        echo -e " ${CROSS} ${RED}Fehler beim Lesen der Registry${NC}" >&2
        return 1
    }

    # Parsen der Python-Ausgabe
    local registry_data
    registry_data="$(python3 -c "
import json, sys
reg = json.load(open('${reg_file}'))
keys = sorted(reg.keys())
sys.stdout.write('KEYS=' + ','.join(keys) + '\n')
for k, v in reg.items():
    sys.stdout.write(f'TITLE_{k}={v.get(\"title\",k)}\n')
    sys.stdout.write(f'CATEGORY_{k}={v.get(\"category\",\"\")}\n')
    sys.stdout.write(f'INSTALLER_{k}={v.get(\"installer\",\"\")}\n')
    sys.stdout.write(f'STATUS_{k}={v.get(\"status\",\"\")}\n')
    sys.stdout.write(f'DEPENDS_{k}={\"|\".join(v.get(\"depends\",[]))}\n')
    sys.stdout.write(f'VISIBLE_{k}={str(v.get(\"visible\",True)).lower()}\n')
" 2>/dev/null)" || return 1

    REGISTRY_KEYS=()
    while IFS='=' read -r k v; do
        [ -z "${k}" ] && continue
        case "${k}" in
            KEYS) IFS=',' read -ra REGISTRY_KEYS <<< "${v}" ;;
            TITLE_*)    REG_TITLE["${k#TITLE_}"]="${v}" ;;
            CATEGORY_*) REG_CATEGORY["${k#CATEGORY_}"]="${v}" ;;
            INSTALLER_*) REG_INSTALLER["${k#INSTALLER_}"]="${v}" ;;
            STATUS_*)   REG_STATUS["${k#STATUS_}"]="${v}" ;;
            DEPENDS_*)  REG_DEPENDS["${k#DEPENDS_}"]="${v}" ;;
            VISIBLE_*)  REG_VISIBLE["${k#VISIBLE_}"]="${v}" ;;
        esac
    done <<< "${registry_data}"

    echo -e " ${CHECK} ${GREEN}Modul-Registry geladen: ${reg_file}${NC}"
    return 0
}

# ─── Registry-Abfragen ──────────────────────────────────────────────────────

reg_title()     { echo "${REG_TITLE[${1}]:-${1}}"; }
reg_installer() { echo "${REG_INSTALLER[${1}]:-}"; }
reg_status()    { echo "${REG_STATUS[${1}]:-unknown}"; }
reg_depends()   { echo "${REG_DEPENDS[${1}]:-}"; }
reg_visible()   { echo "${REG_VISIBLE[${1}]:-true}"; }

# ─── Hilfe ──────────────────────────────────────────────────────────────────

usage() {
  cat <<EOF
AI VPS Manager Installer v${INSTALLER_VERSION}

Usage:
  bash install.sh --config <datei>
  bash install.sh [OPTIONS]

Options:
  --config FILE           Lade Konfiguration aus JSON-Datei
  --docker                Install Docker & Compose
  --docker-compose        Install Docker Compose plugin
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
  --help, -h              Show this help
EOF
  exit 0
}

# ─── install_config.json einlesen ────────────────────────────────────────────

load_config() {
  local config_file="$1"

  if [ ! -f "${config_file}" ]; then
    echo -e " ${CROSS} ${RED}Konfigurationsdatei nicht gefunden: ${config_file}${NC}" >&2
    exit 2
  fi

  if ! command -v python3 &>/dev/null; then
    echo -e " ${CROSS} ${RED}python3 wird zum Lesen der Konfiguration benötigt${NC}" >&2
    exit 2
  fi

  OPT_HOSTNAME="$(python3 -c "import json; print(json.load(open('${config_file}')).get('hostname',''))" 2>/dev/null || echo "")"
  OPT_SSH_PORT="$(python3 -c "import json; print(json.load(open('${config_file}')).get('ssh_port',22))" 2>/dev/null || echo "22")"
  OPT_USER="$(python3 -c "import json; print(json.load(open('${config_file}')).get('user','root'))" 2>/dev/null || echo "root")"
  OPT_AUTO_UPDATE="$(python3 -c "import json; print(json.load(open('${config_file}')).get('auto_update',False))" 2>/dev/null || echo "False")"

  local modules_json
  modules_json="$(python3 -c "
import json, sys
c = json.load(open('${config_file}'))
m = c.get('modules', {})
for k, v in m.items():
    sys.stdout.write(f'{k}={v}\n')
" 2>/dev/null || true)"

  while IFS='=' read -r key val; do
    [ -z "${key}" ] && continue
    val="${val,,}"
    case "${key}" in
      docker)              [ "${val}" = "true" ] && OPT_DOCKER=true ;;
      docker_compose)      [ "${val}" = "true" ] && OPT_COMPOSE=true ;;
      mcp)                 [ "${val}" = "true" ] && OPT_MCP=true ;;
      opencode)            [ "${val}" = "true" ] && OPT_OPENCODE=true ;;
      ollama)              [ "${val}" = "true" ] && OPT_OLLAMA=true ;;
      openwebui)           [ "${val}" = "true" ] && OPT_OPENWEBUI=true ;;
      nginx_proxy_manager) [ "${val}" = "true" ] && OPT_NPM=true ;;
      tailscale)           [ "${val}" = "true" ] && OPT_TAILSCALE=true ;;
      watchtower)          [ "${val}" = "true" ] && OPT_WATCHTOWER=true ;;
      monitoring)          [ "${val}" = "true" ] && OPT_MONITORING=true ;;
    esac
  done <<< "${modules_json}"

  echo -e " ${CHECK} ${GREEN}Installationskonfiguration geladen: ${config_file}${NC}"
}

# ─── CLI-Parameter parsen (Legacy) ──────────────────────────────────────────

parse_args() {
  while [ $# -gt 0 ]; do
    case "$1" in
      --help|-h) usage ;;
      --config)      OPT_CONFIG="$2"; shift ;;
      --docker)      OPT_DOCKER=true ;;
      --docker-compose) OPT_COMPOSE=true ;;
      --mcp)         OPT_MCP=true ;;
      --opencode)    OPT_OPENCODE=true ;;
      --ollama)      OPT_OLLAMA=true ;;
      --openwebui)   OPT_OPENWEBUI=true ;;
      --nginx-proxy-manager) OPT_NPM=true ;;
      --tailscale)   OPT_TAILSCALE=true ;;
      --watchtower)  OPT_WATCHTOWER=true ;;
      --monitoring)  OPT_MONITORING=true ;;
      --hostname)    OPT_HOSTNAME="$2"; shift ;;
      --ssh-port)    OPT_SSH_PORT="$2"; shift ;;
      --user)        OPT_USER="$2"; shift ;;
      --auto-update) OPT_AUTO_UPDATE=true ;;
      *) echo -e " ${YELLOW}⚠ Unbekanntes Flag: $1${NC}" >&2 ;;
    esac
    shift
  done
}

# ─── Haupt-Repo klonen / aktualisieren ──────────────────────────────────────

ensure_main_repo() {
  if [ -d "${AVM_TARGET_DIR}/.git" ]; then
    echo -e " ${INFO_SYM} ${CYAN}Haupt-Repo bereits vorhanden: ${AVM_TARGET_DIR}${NC}"
    _log "Repo existiert bereits in ${AVM_TARGET_DIR}"
    return 0
  fi

  echo -e " ${INFO_SYM} ${CYAN}Klone Haupt-Repo nach ${AVM_TARGET_DIR} …${NC}"
  _log "Klone ${AVM_REPO_URL} nach ${AVM_TARGET_DIR}"

  mkdir -p "${AVM_TARGET_DIR}"
  git clone --depth=1 "${AVM_REPO_URL}" "${AVM_TARGET_DIR}" 2>&1 | tail -1 || {
    echo -e " ${CROSS} ${RED}Fehler beim Klonen des Repositories${NC}" >&2
    return 1
  }

  echo -e " ${CHECK} ${GREEN}Haupt-Repo geklont nach ${AVM_TARGET_DIR}${NC}"
  return 0
}

# ─── Prüfen ob ein Modul aktiviert ist ──────────────────────────────────────

is_module_enabled() {
  local key="$1"
  local var_name="OPT_${key^^}"
  echo "${!var_name:-false}"
}

# ─── Abhängigkeiten auflösen ────────────────────────────────────────────────

resolve_dependencies() {
  local auto_enabled=()

  # docker_compose → docker
  if [ "${OPT_COMPOSE}" = true ] && [ "${OPT_DOCKER}" = false ]; then
    OPT_DOCKER=true
    auto_enabled+=("docker")
    echo -e " ${INFO_SYM} ${CYAN}Docker Compose → Docker automatisch aktiviert${NC}"
    _log "DEPENDENCY: docker_compose → docker auto-enabled"
  fi

  # openwebui → docker
  if [ "${OPT_OPENWEBUI}" = true ] && [ "${OPT_DOCKER}" = false ]; then
    OPT_DOCKER=true
    auto_enabled+=("docker")
    echo -e " ${INFO_SYM} ${CYAN}Open WebUI → Docker automatisch aktiviert${NC}"
    _log "DEPENDENCY: openwebui → docker auto-enabled"
  fi

  echo "${auto_enabled[@]}"
}

# ─── Status-Label mit Farbe ─────────────────────────────────────────────────

status_label() {
  local status="$1"
  case "${status}" in
    available)   echo "${GREEN}available${NC}" ;;
    experimental) echo "${YELLOW}experimental${NC}" ;;
    planned)     echo "${BLUE}planned${NC}" ;;
    deprecated)  echo "${RED}deprecated${NC}" ;;
    *)           echo "${status}" ;;
  esac
}

# ─── Status-Handling ────────────────────────────────────────────────────────

check_module_status() {
  local key="$1"
  local status
  status="$(reg_status "${key}")"

  case "${status}" in
    available)
      return 0
      ;;
    experimental)
      echo -e "  ${WARN_SYM} ${YELLOW}${key}: experimentell – Installation wird fortgesetzt${NC}"
      _log "STATUS ${key}: experimental – installation proceeds"
      return 0
      ;;
    planned)
      echo -e "  ${INFO_SYM} ${CYAN}${key}: geplant – nicht installiert${NC}"
      _log "STATUS ${key}: planned – skipped"
      return 1
      ;;
    deprecated)
      echo -e "  ${CROSS} ${RED}${key}: veraltet – Installation verweigert${NC}"
      _log "STATUS ${key}: deprecated – installation denied"
      return 2
      ;;
    *)
      echo -e "  ${WARN_SYM} ${YELLOW}${key}: unbekannter Status '${status}' – übersprungen${NC}"
      _log "STATUS ${key}: unknown status '${status}'"
      return 1
      ;;
  esac
}

# ─── Zentrale Modulinstallationsfunktion ────────────────────────────────────

install_selected_modules() {
  echo ""
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BLUE}  Modulinstallation${NC}"
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""

  _log "Starte Modulinstallation"

  # Registry laden
  load_registry || {
    echo -e " ${CROSS} ${RED}Modul-Registry nicht verfügbar – Abbruch${NC}" >&2
    return 1
  }

  # Haupt-Repo sicherstellen
  ensure_main_repo || {
    echo -e " ${CROSS} ${RED}Haupt-Repo nicht verfügbar – Modulinstallation abgebrochen${NC}" >&2
    return 1
  }

  # Modulmanager laden
  local mm_script="${AVM_TARGET_DIR}/lib/module_manager.sh"
  if [ ! -f "${mm_script}" ]; then
    echo -e " ${CROSS} ${RED}Modulmanager nicht gefunden: ${mm_script}${NC}" >&2
    return 1
  fi

  # shellcheck source=/dev/null
  source "${mm_script}"
  echo -e " ${CHECK} ${GREEN}Modulmanager geladen${NC}"
  _log "Modulmanager geladen aus ${mm_script}"

  # Systemvorbereitung
  echo -e " ${INFO_SYM} ${CYAN}Systemvorbereitung …${NC}"
  apt-get update -qq 2>/dev/null || true
  apt-get install -y -qq curl git python3 python3-venv python3-pip ufw ca-certificates gnupg lsb-release 2>/dev/null || true
  echo -e " ${CHECK} ${GREEN}Basispakete installiert${NC}"

  # Hostname
  if [ -n "${OPT_HOSTNAME}" ]; then
    hostnamectl set-hostname "${OPT_HOSTNAME}" 2>/dev/null || true
    echo -e " ${CHECK} ${GREEN}Hostname: ${OPT_HOSTNAME}${NC}"
    _log "Hostname: ${OPT_HOSTNAME}"
  fi

  # SSH-Port
  if [ -n "${OPT_SSH_PORT}" ] && [ "${OPT_SSH_PORT}" != "22" ]; then
    sed -i "s/^#Port 22/Port ${OPT_SSH_PORT}/" /etc/ssh/sshd_config 2>/dev/null || true
    systemctl restart sshd 2>/dev/null || true
    echo -e " ${CHECK} ${GREEN}SSH-Port: ${OPT_SSH_PORT}${NC}"
    _log "SSH-Port: ${OPT_SSH_PORT}"
  fi

  # Auto-Update
  if [ "${OPT_AUTO_UPDATE}" = "true" ]; then
    apt-get install -y -qq unattended-upgrades 2>/dev/null || true
    dpkg-reconfigure -f noninteractive unattended-upgrades 2>/dev/null || true
    echo -e " ${CHECK} ${GREEN}Auto-Update aktiviert${NC}"
    _log "Auto-Update aktiviert"
  fi

  # ─── Abhängigkeiten auflösen ──────────────────────────────────────────
  echo ""
  echo -e " ${INFO_SYM} ${CYAN}Prüfe Abhängigkeiten …${NC}"
  local auto_enabled
  auto_enabled=($(resolve_dependencies))
  local auto_count="${#auto_enabled[@]}"

  # ─── Module installieren ──────────────────────────────────────────────
  echo ""
  echo -e "${CYAN}──────────────────────────────────────────${NC}"
  printf " %-22s %s\n" "Modul" "Status"
  echo -e "${CYAN}──────────────────────────────────────────${NC}"

  local installed_count=0
  local skipped_count=0
  local failed_count=0

  for key in "${REGISTRY_KEYS[@]}"; do
    local title
    title="$(reg_title "${key}")"
    local enabled
    enabled="$(is_module_enabled "${key}")"

    # Automatisch aktivierte Module
    local is_auto=false
    for a in "${auto_enabled[@]}"; do
      [ "${a}" = "${key}" ] && is_auto=true
    done

    if [ "${enabled}" != "true" ]; then
      printf "  %-22s\n" "${title}"
      skipped_count=$((skipped_count + 1))
      _log "MODUL ${key}: übersprungen (nicht aktiviert)"
      continue
    fi

    # Status prüfen
    check_module_status "${key}"
    local status_exit=$?

    if [ "${status_exit}" -eq 2 ]; then
      printf "  %-22s ${RED}%s${NC}\n" "${title}" "veraltet"
      skipped_count=$((skipped_count + 1))
      continue
    fi

    if [ "${status_exit}" -eq 1 ]; then
      printf "  %-22s ${BLUE}%s${NC}\n" "${title}" "geplant"
      skipped_count=$((skipped_count + 1))
      continue
    fi

    # installer-Pfad aus der Registry
    local mm_path
    mm_path="$(reg_installer "${key}")"

    if [ -z "${mm_path}" ]; then
      printf "  %-22s ${YELLOW}%s${NC}\n" "${title}" "kein Installer"
      skipped_count=$((skipped_count + 1))
      _log "MODUL ${key}: kein Installer-Pfad in Registry"
      continue
    fi

    # Prüfen ob das Modul im Modulmanager existiert
    if ! module_exists "${mm_path}"; then
      printf "  %-22s ${YELLOW}%s${NC}\n" "${title}" "Modul nicht gefunden"
      skipped_count=$((skipped_count + 1))
      _log "MODUL ${key}: module_exists(${mm_path}) = false"
      continue
    fi

    # Installation
    local status_text="installiert"
    [ "${is_auto}" = true ] && status_text="automatisch aktiviert"

    echo -e "  ${INFO_SYM} ${CYAN}${title} …${NC}"
    _log "MODUL ${key}: installiere (${mm_path})"

    if run_module_action "${mm_path}" "install" 2>&1; then
      printf "  %-22s ${GREEN}%s${NC}\n" "${title}" "${status_text}"
      installed_count=$((installed_count + 1))
      _log "MODUL ${key}: ${status_text}"
    else
      printf "  %-22s ${RED}%s${NC}\n" "${title}" "fehlgeschlagen"
      failed_count=$((failed_count + 1))
      _log "MODUL ${key}: FEHLGESCHLAGEN"
    fi
  done

  # ─── Zusammenfassung ──────────────────────────────────────────────────
  echo -e "${CYAN}──────────────────────────────────────────${NC}"
  echo ""
  echo -e " ${CHECK} ${GREEN}Installierte Module:${NC}   ${installed_count}"
  echo -e " ${WARN_SYM} ${YELLOW}Übersprungene Module:${NC} ${skipped_count}"
  if [ "${failed_count}" -gt 0 ]; then
    echo -e " ${CROSS} ${RED}Fehlgeschlagene Module:${NC} ${failed_count}"
  fi
  if [ "${auto_count}" -gt 0 ]; then
    echo -e " ${INFO_SYM} ${CYAN}Automatisch aktiviert:${NC} ${auto_count}"
  fi
  echo ""

  _log "Modulinstallation abgeschlossen: ${installed_count} installiert, ${skipped_count} übersprungen, ${failed_count} fehlgeschlagen"

  # Firewall
  if command -v ufw &>/dev/null; then
    ufw --force enable 2>/dev/null || true
    ufw allow "${OPT_SSH_PORT:-22}/tcp" 2>/dev/null || true
    ufw allow 80/tcp 2>/dev/null || true
    ufw allow 443/tcp 2>/dev/null || true
    ufw allow 8080/tcp 2>/dev/null || true
    echo -e " ${CHECK} ${GREEN}Firewall konfiguriert${NC}"
    _log "Firewall konfiguriert"
  fi

  return "${failed_count}"
}

# ─── Legacy: Direkte CLI-Flags ohne --config ────────────────────────────────

run_legacy_cli() {
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BLUE}  Direkte Installation (Legacy CLI)${NC}"
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""

  _log "Legacy CLI: direkte Installation mit Flags"

  local tmp_config
  tmp_config="$(mktemp)"

  cat > "${tmp_config}" << CFGEOF
{
  "version": 1,
  "hostname": "${OPT_HOSTNAME}",
  "ssh_port": ${OPT_SSH_PORT},
  "user": "${OPT_USER}",
  "auto_update": ${OPT_AUTO_UPDATE},
  "modules": {
    "docker": ${OPT_DOCKER},
    "docker_compose": ${OPT_COMPOSE},
    "mcp": ${OPT_MCP},
    "opencode": ${OPT_OPENCODE},
    "ollama": ${OPT_OLLAMA},
    "openwebui": ${OPT_OPENWEBUI},
    "nginx_proxy_manager": ${OPT_NPM},
    "tailscale": ${OPT_TAILSCALE},
    "watchtower": ${OPT_WATCHTOWER},
    "monitoring": ${OPT_MONITORING}
  }
}
CFGEOF

  OPT_CONFIG="${tmp_config}"
  _log "Temporäre Config erzeugt: ${tmp_config}"

  install_selected_modules
  local exit_code=$?

  rm -f "${tmp_config}"
  return "${exit_code}"
}

# ─── Einstiegspunkt ─────────────────────────────────────────────────────────

main() {
  echo ""
  echo -e "${CYAN}╔══════════════════════════════════════════════════════════╗${NC}"
  echo -e "${CYAN}║${NC}          ${BOLD}AI VPS Manager – Installation${NC}               ${CYAN}║${NC}"
  echo -e "${CYAN}╚══════════════════════════════════════════════════════════╝${NC}"
  echo ""

  parse_args "$@"

  if [ -n "${OPT_CONFIG}" ]; then
    load_config "${OPT_CONFIG}"
    install_selected_modules
    local exit_code=$?
  else
    local has_flags=false
    if [ "${OPT_DOCKER}" = true ] || [ "${OPT_COMPOSE}" = true ] || \
       [ "${OPT_MCP}" = true ] || [ "${OPT_OPENCODE}" = true ] || \
       [ "${OPT_OLLAMA}" = true ] || [ "${OPT_OPENWEBUI}" = true ] || \
       [ "${OPT_NPM}" = true ] || [ "${OPT_TAILSCALE}" = true ] || \
       [ "${OPT_WATCHTOWER}" = true ] || [ "${OPT_MONITORING}" = true ] || \
       [ -n "${OPT_HOSTNAME}" ]; then
      has_flags=true
    fi

    if [ "${has_flags}" = true ]; then
      run_legacy_cli
      local exit_code=$?
    else
      echo -e " ${INFO_SYM} ${CYAN}Keine Installationsparameter – leite an Bootstrap weiter …${NC}"
      echo ""

      local bootstrap_url="${BASE_URL}/bootstrap/bootstrap.sh"

      if command -v curl &>/dev/null; then
        bash <(curl -fsSL --connect-timeout 10 --max-time 30 "${bootstrap_url}") "$@"
      elif command -v wget &>/dev/null; then
        bash <(wget -qO- --timeout=30 "${bootstrap_url}") "$@"
      else
        echo -e " ${CROSS} ${RED}Kein curl oder wget gefunden${NC}" >&2
        exit 2
      fi

      local bootstrap_exit=$?
      case "${bootstrap_exit}" in
        0)  echo -e "\n${GREEN}Bootstrap erfolgreich.${NC}" ;;
        1)  echo -e "\n${YELLOW}Bootstrap abgebrochen.${NC}" ;;
        2)  echo -e "\n${RED}Bootstrap fehlgeschlagen.${NC}" ;;
        *)  echo -e "\n${RED}Unbekannter Fehler (${bootstrap_exit}).${NC}" ;;
      esac
      exit "${bootstrap_exit}"
    fi
  fi

  echo ""
  echo -e "${GREEN}╔══════════════════════════════════════════════════════════╗${NC}"
  echo -e "${GREEN}║        Installation abgeschlossen!                       ║${NC}"
  echo -e "${GREEN}╚══════════════════════════════════════════════════════════╝${NC}"
  echo ""

  exit "${exit_code:-0}"
}

main "$@"
