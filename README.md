# VPS Dev Dashboard

A web-based development environment dashboard for your VPS. Manage tmux sessions, track ports, expose services, and access a browser-based terminal — all from one place.

## Features

- **Browser Terminal** — full terminal in your browser via [ttyd](https://github.com/tsl0922/ttyd)
- **Tmux Session Viewer** — see all sessions, windows, and working directories in real time
- **Port Tracker** — all listening ports with process names, PIDs, and session correlation
- **Expose Ports** — one-click to open a firewall rule and get the public URL for any port
- **Skyvern Integration** — navbar shortcut to your Skyvern instance
- **System Stats** — CPU, memory, disk, load average, uptime at a glance

## Install (single command)

Run on your VPS as root:

```bash
curl -sSL https://raw.githubusercontent.com/vidwadeseram/vps-dev-dashboard/main/install.sh | sudo bash
```

That's it. The script will:
1. Install Node.js 20, ttyd, nginx, tmux, ufw
2. Clone this repo to `/opt/vps-dashboard`
3. Build the Next.js dashboard
4. Create and start `systemd` services for the dashboard and terminal
5. Configure nginx as a reverse proxy on port 80
6. Open the necessary firewall ports

After install, visit `http://YOUR_VPS_IP` in your browser.

### Custom ports

```bash
DASHBOARD_PORT=4000 TERMINAL_PORT=8080 curl -sSL ... | sudo bash
```

## Workflow

1. **SSH into your VPS**, clone a project, start a tmux session:
   ```bash
   git clone https://github.com/you/myproject
   tmux new -s myproject
   cd myproject && npm start
   ```

2. **Open the dashboard** at `http://YOUR_VPS_IP` — your tmux session appears with the working directory and any ports it's using.

3. **Click Expose** on a port to get the public URL and optionally open it in the firewall.

4. **Use the Terminal** link for a full browser-based terminal when you don't have SSH handy.

## Services

| Service | Default Port | Description |
|---------|-------------|-------------|
| Dashboard | 3000 (proxied via :80) | Next.js dashboard |
| ttyd | 7681 (proxied via :80/terminal/) | Browser terminal |
| Skyvern | 8000 | Start separately |

### Manage services

```bash
systemctl status vps-dashboard
systemctl status vps-ttyd
systemctl restart vps-dashboard
journalctl -u vps-dashboard -f
```

### Update

```bash
cd /opt/vps-dashboard
git pull --recurse-submodules
cd dashboard && npm ci && npm run build
systemctl restart vps-dashboard
```

## Local development

```bash
git clone --recurse-submodules https://github.com/vidwadeseram/vps-dev-dashboard
cd vps-dev-dashboard/dashboard
npm install
npm run dev   # http://localhost:3000
```

## Submodules

- **[skyvern](skyvern/)** — [Skyvern-AI/skyvern](https://github.com/Skyvern-AI/skyvern): AI-powered browser automation agent. Follow Skyvern's own setup instructions to run it.
