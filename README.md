# uwu-tester

A web-based VPS development dashboard with integrated browser-use regression testing.

## Features

- **Browser Terminal** — full terminal in your browser via [ttyd](https://github.com/tsl0922/ttyd)
- **Tmux Session Viewer** — see all sessions, windows, and working directories in real time
- **Port Tracker** — all listening ports with process names, PIDs, and session correlation
- **Expose Ports** — one-click to open a firewall rule and get the public URL for any port
- **Projects Panel** — scan, clone, and manage git repos from `/opt/projects`
- **uwu-tester** — per-project browser-use regression tests with a built-in editor and results viewer
- **System Stats** — CPU, memory, disk, load average, uptime at a glance

## Install (single command)

Run on your VPS as root:

```bash
curl -sSL https://raw.githubusercontent.com/vidwadeseram/uwu-tester/main/install.sh | sudo bash
```

The script will:
1. Install Node.js 20, ttyd, nginx, tmux, ufw, uv
2. Clone this repo to `/opt/vps-dashboard`
3. Install browser-use + Playwright for regression tests
4. Build the Next.js dashboard
5. Create and start `systemd` services for the dashboard and terminal
6. Configure nginx as a reverse proxy on port 80

After install, visit `http://YOUR_VPS_IP` in your browser.

## Regression Tests (uwu-tester)

Test cases are stored as JSON files, one per project:

```
regression_tests/
  test_cases/
    marxpos.json       ← test cases for marxpos project
    myproject.json     ← test cases for myproject
  results/
    marxpos/
      20240101T120000Z.json   ← run results
  test_runner.py             ← browser-use runner
  pyproject.toml
```

### Running tests manually

```bash
cd /opt/vps-dashboard/regression_tests
ANTHROPIC_API_KEY=sk-ant-... uv run test_runner.py marxpos
```

Pass credentials as env vars or `KEY=VALUE` args:

```bash
uv run test_runner.py marxpos WEB_PHONE=+1234567890 WEB_PASSWORD=secret
```

### Test case JSON format

```json
{
  "project": "myproject",
  "description": "My project E2E tests",
  "test_cases": [
    {
      "id": "login",
      "label": "Login",
      "task": "Go to {{BASE_URL}} and log in with {{EMAIL}} / {{PASSWORD}}. Return SUCCESS when authenticated.",
      "enabled": true,
      "depends_on": null,
      "skip_dependents_on_fail": true
    }
  ]
}
```

Use `{{VAR}}` placeholders — they're substituted from environment variables at run time.

### Dashboard UI

The `/tests` page in the dashboard lets you:
- Create / select projects
- Add, edit, delete, enable/disable, and reorder test cases
- Trigger a test run with one click
- View results for all recent runs
