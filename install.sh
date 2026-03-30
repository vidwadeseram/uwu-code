#!/usr/bin/env bash
# VPS Dev Dashboard - Single-command installer
# Usage: curl -sSL https://raw.githubusercontent.com/vidwadeseram/vps-dev-dashboard/main/install.sh | bash
set -euo pipefail

###############################################################################
# Config
###############################################################################
REPO_URL="https://github.com/vidwadeseram/vps-dev-dashboard.git"
INSTALL_DIR="${INSTALL_DIR:-/opt/vps-dashboard}"
DASHBOARD_PORT="${DASHBOARD_PORT:-3000}"
TERMINAL_PORT="${TERMINAL_PORT:-7681}"
NODE_VERSION="20"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
info()    { echo -e "${CYAN}[INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

require_root() { [ "$EUID" -eq 0 ] || error "Please run as root: sudo bash install.sh"; }
require_root

###############################################################################
# Detect OS
###############################################################################
info "Detecting OS..."
if [ -f /etc/os-release ]; then
  . /etc/os-release
  OS_ID="$ID"
  OS_VERSION="$VERSION_ID"
else
  error "Cannot detect OS. Only Ubuntu/Debian are supported."
fi

case "$OS_ID" in
  ubuntu|debian|linuxmint) PKG_MGR="apt-get" ;;
  *) error "Unsupported OS: $OS_ID. Only Ubuntu/Debian are supported." ;;
esac

info "OS: $OS_ID $OS_VERSION"

###############################################################################
# System packages
###############################################################################
info "Updating package lists..."
apt-get update -qq

info "Installing system dependencies..."
apt-get install -y -qq \
  curl wget git tmux build-essential \
  ufw net-tools iproute2 \
  cmake libjson-c-dev libwebsockets-dev \
  nginx 2>/dev/null || true

success "System packages installed."

###############################################################################
# Node.js
###############################################################################
if ! command -v node &>/dev/null || [[ "$(node -v | cut -d. -f1 | tr -d 'v')" -lt "$NODE_VERSION" ]]; then
  info "Installing Node.js $NODE_VERSION..."
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_VERSION}.x" | bash -
  apt-get install -y nodejs
  success "Node.js $(node -v) installed."
else
  success "Node.js $(node -v) already installed."
fi

###############################################################################
# ttyd (browser-based terminal)
###############################################################################
if ! command -v ttyd &>/dev/null; then
  info "Installing ttyd..."
  TTYD_VERSION=$(curl -s https://api.github.com/repos/tsl0922/ttyd/releases/latest | grep '"tag_name"' | cut -d'"' -f4)
  ARCH=$(uname -m)
  case "$ARCH" in
    x86_64)  TTYD_ARCH="x86_64" ;;
    aarch64) TTYD_ARCH="aarch64" ;;
    *)       TTYD_ARCH="x86_64" ;;
  esac
  curl -fsSL "https://github.com/tsl0922/ttyd/releases/download/${TTYD_VERSION}/ttyd.${TTYD_ARCH}" -o /usr/local/bin/ttyd
  chmod +x /usr/local/bin/ttyd
  success "ttyd ${TTYD_VERSION} installed."
else
  success "ttyd already installed: $(ttyd --version 2>&1 | head -1)"
fi

###############################################################################
# Clone / update repo
###############################################################################
info "Setting up $INSTALL_DIR..."
if [ -d "$INSTALL_DIR/.git" ]; then
  info "Repo already exists, pulling latest..."
  git -C "$INSTALL_DIR" pull --recurse-submodules
else
  git clone --recurse-submodules "$REPO_URL" "$INSTALL_DIR"
fi
success "Repo ready at $INSTALL_DIR."

###############################################################################
# Install dashboard dependencies & build
###############################################################################
info "Installing dashboard npm dependencies..."
cd "$INSTALL_DIR/dashboard"
npm ci --prefer-offline --loglevel=error 2>/dev/null || npm install --loglevel=error
info "Building dashboard..."
npm run build
success "Dashboard built."

###############################################################################
# Firewall
###############################################################################
info "Configuring UFW firewall..."
ufw --force enable 2>/dev/null || true
ufw allow ssh
ufw allow "$DASHBOARD_PORT/tcp" comment "vps-dashboard"
ufw allow "$TERMINAL_PORT/tcp"  comment "vps-dashboard-ttyd"
success "Firewall configured."

###############################################################################
# Systemd — dashboard
###############################################################################
info "Creating systemd service: vps-dashboard..."
cat > /etc/systemd/system/vps-dashboard.service <<EOF
[Unit]
Description=VPS Dev Dashboard
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=$INSTALL_DIR/dashboard
Environment=NODE_ENV=production
Environment=PORT=$DASHBOARD_PORT
ExecStart=/usr/bin/npm run start
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

###############################################################################
# Systemd — ttyd
###############################################################################
info "Creating systemd service: vps-ttyd..."
SHELL_BIN=$(command -v bash)
cat > /etc/systemd/system/vps-ttyd.service <<EOF
[Unit]
Description=VPS Browser Terminal (ttyd)
After=network.target

[Service]
Type=simple
User=root
ExecStart=/usr/local/bin/ttyd --port $TERMINAL_PORT --writable $SHELL_BIN
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

###############################################################################
# Enable & start services
###############################################################################
systemctl daemon-reload
systemctl enable vps-dashboard vps-ttyd
systemctl restart vps-dashboard vps-ttyd
success "Services started."

###############################################################################
# Nginx reverse proxy (optional — routes / to dashboard, /terminal to ttyd)
###############################################################################
info "Configuring nginx reverse proxy on port 80..."
PUBLIC_IP=$(curl -s --max-time 5 ifconfig.me 2>/dev/null || curl -s --max-time 5 icanhazip.com 2>/dev/null || hostname -I | awk '{print $1}')

cat > /etc/nginx/sites-available/vps-dashboard <<EOF
server {
    listen 80;
    server_name _;

    # Dashboard
    location / {
        proxy_pass http://127.0.0.1:$DASHBOARD_PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }

    # Browser terminal (WebSocket)
    location /terminal/ {
        proxy_pass http://127.0.0.1:$TERMINAL_PORT/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host \$host;
        proxy_read_timeout 86400;
    }
}
EOF

ln -sf /etc/nginx/sites-available/vps-dashboard /etc/nginx/sites-enabled/vps-dashboard
rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true
nginx -t && systemctl enable nginx && systemctl restart nginx
ufw allow 80/tcp comment "nginx"
success "Nginx configured."

###############################################################################
# Done
###############################################################################
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║         VPS Dev Dashboard - Installation Complete    ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  Dashboard:  ${CYAN}http://${PUBLIC_IP}${NC}  (port 80 via nginx)"
echo -e "  Terminal:   ${CYAN}http://${PUBLIC_IP}/terminal/${NC}"
echo -e "  Skyvern:    ${CYAN}http://${PUBLIC_IP}:8000${NC}  (start Skyvern separately)"
echo ""
echo -e "  Direct:     ${CYAN}http://${PUBLIC_IP}:${DASHBOARD_PORT}${NC}  (dashboard)"
echo -e "  Direct:     ${CYAN}http://${PUBLIC_IP}:${TERMINAL_PORT}${NC}  (ttyd terminal)"
echo ""
echo -e "  Manage services:"
echo -e "    ${YELLOW}systemctl status vps-dashboard${NC}"
echo -e "    ${YELLOW}systemctl status vps-ttyd${NC}"
echo ""
echo -e "  Update: ${YELLOW}cd $INSTALL_DIR && git pull --recurse-submodules && cd dashboard && npm ci && npm run build && systemctl restart vps-dashboard${NC}"
echo ""
