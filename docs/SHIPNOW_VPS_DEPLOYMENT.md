# ShipNow VPS Deployment

This note records the live VPS shape for ShipNow and the site layout standard it enforces.

## Goal

- ShipNow manages sites, but each site must live in its own directory under `/opt/boringmax/site`
- No shared top-level `/opt/boringmax/site/releases`, `/opt/boringmax/site/projects`, `/opt/boringmax/site/logs`, or `.shipnow`
- Already published sites must keep working even if the ShipNow process disappears later

## VPS directory model

### ShipNow app

- App code: `/opt/boringmax/shipnow`
- systemd service: `shipnow.service`
- HTTP listener: `127.0.0.1:8090`
- App-private data site: `/opt/boringmax/site/shipnow`

### Site root

- Public site root: `/opt/boringmax/site`
- Every direct child of this directory is a site, for example:
  - `/opt/boringmax/site/shipnow`
  - `/opt/boringmax/site/test`
  - `/opt/boringmax/site/loveadventure`

### Per-site layout

For each site, ShipNow uses this structure:

```text
/opt/boringmax/site/<siteName>/
  index.html
  assets/
  preview/
    index.html
    assets/
  source/
  releases/
    preview/
    public/
  logs/
  current-preview
  current-public
```

Meaning:

- `index.html` and `assets/` are the current public entrypoint
- `preview/index.html` and `preview/assets/` are the current preview entrypoint
- `source/` is the editable project source tree
- `releases/preview/` and `releases/public/` store immutable build snapshots
- `logs/` stores task logs
- `current-preview` and `current-public` point to the active release snapshot

## systemd environment

The current ShipNow service should provide these core paths:

```ini
WorkingDirectory=/opt/boringmax/shipnow
Environment=NODE_ENV=production
Environment=SHIPNOW_PORT=8090
Environment=SHIPNOW_PUBLIC_BASE_URL=https://boringmax.com
Environment=SHIPNOW_PREVIEW_BASE_URL=https://shipnow.boringmax.com/preview
Environment=SHIPNOW_API_BASE_URL=https://shipnow.boringmax.com/api
Environment=SHIPNOW_APP_PREFIX=/shipnow
Environment=SHIPNOW_WORKSPACE_ROOT=/opt/boringmax/site/shipnow
Environment=SHIPNOW_PUBLIC_STATIC_ROOT=/opt/boringmax/site
Environment=SHIPNOW_TEMPLATE_ROOT=/opt/boringmax/shipnow/templates
Environment=SHIPNOW_DB_PATH=/opt/boringmax/site/shipnow/shipnow.sqlite
Environment=SHIPNOW_CODEX_BIN=/usr/bin/codex
ExecStart=/usr/bin/node /opt/boringmax/shipnow/dist/server/index.js
```

Notes:

- `SHIPNOW_PUBLIC_STATIC_ROOT` is the site root and must stay at `/opt/boringmax/site`
- The ShipNow app database and workspace are app-private, but they live in the ShipNow site directory at `/opt/boringmax/site/shipnow`
- The managed site assets themselves must live inside each site directory, not in a shared bucket

## Claude Code runner

The VPS now also has the Claude Code CLI installed for the `claude-code` runner:

- Binary: `/usr/bin/claude`
- Version: `2.1.156`
- The `shipnow` systemd service runs as the dedicated `shipnow` user, so Claude Code can use its full permission-bypass mode without inheriting root restrictions
- Runtime env is loaded from `/etc/shipnow/shipnow.env` through a systemd drop-in at `/etc/systemd/system/shipnow.service.d/10-claude-code.conf`
- The env file carries both ShipNow-specific keys and Claude-compatible keys:
  - `SHIPNOW_CLAUDE_CODE_BIN=/usr/bin/claude`
  - `SHIPNOW_CLAUDE_ANTHROPIC_BASE_URL`
  - `SHIPNOW_CLAUDE_ANTHROPIC_API_KEY`
  - `SHIPNOW_CLAUDE_MODEL`
  - `ANTHROPIC_BASE_URL`
  - `ANTHROPIC_API_KEY`
  - `ANTHROPIC_MODEL`

Notes:

- Keep the env file root-only readable, because it stores the DeepSeek API key used by Claude Code
- Keep `/opt/boringmax/site` owned by `shipnow:shipnow` so the `claude-code` runner can edit project workspaces under full access
- ShipNow reads the `SHIPNOW_*` values directly, and Claude Code also accepts the `ANTHROPIC_*` aliases
- After updating the env file, run `systemctl daemon-reload && systemctl restart shipnow`

## Caddy routing

Recommended public routing:

- `boringmax.com`
  - `root * /opt/boringmax/site`
  - `try_files {path}/index.html {path}.html {path} /index.html`
  - `file_server`
- `boringmax.com/shipnow`
  - reverse proxy to `127.0.0.1:8090`
- `shipnow.boringmax.com/preview`
  - `root * /opt/boringmax/site`
  - `try_files {path}/preview/index.html {path}.html {path} /index.html`
  - `file_server`
- `shipnow.boringmax.com/api`
  - reverse proxy to `127.0.0.1:8090`

Notes:

- The public VPS no longer uses `boringmax.com/preview*` or `boringmax.com/site*` as ShipNow entrypoints.
- `shipnow.boringmax.com/preview/<siteName>` is the real public preview URL, while the `/preview` directory under each site is only the filesystem layout that backs it.
- ShipNow still understands preview concepts internally, but that internal route model is not the same thing as the live Caddy entrypoint.

## Why this works

- Published sites are fully static and live under their own site directory
- Preview sites are also static and live under the same site directory
- ShipNow can disappear after publishing and the site still has everything it needs
- Preview release HTML is written with a `/siteName/preview/` base so `shipnow.boringmax.com/preview/<siteName>` can load its own assets directly from the site tree

## Validation

```bash
systemctl status shipnow
curl -I https://boringmax.com/test
curl -I https://shipnow.boringmax.com/preview/test
ls -la /opt/boringmax/site/test
ls -la /opt/boringmax/site/test/preview
```
