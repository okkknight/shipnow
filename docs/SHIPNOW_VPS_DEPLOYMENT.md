# ShipNow VPS Deployment

This note records the live VPS shape for ShipNow and the site layout standard it enforces.

## Goal

- ShipNow manages sites, but each site must live in its own directory under `/opt/boringmax/site`
- No shared top-level `/opt/boringmax/site/releases`, `/opt/boringmax/site/projects`, `/opt/boringmax/site/logs`, or `.shipnow`
- Already published sites must keep working even if the ShipNow process disappears later

## VPS directory model

### BoringAPI gateway

- App code: `/opt/boringmax/boringapi`
- systemd service: `boringapi.service`
- HTTP listener: `127.0.0.1:8091`

### ShipNow app

- App code: `/opt/boringmax/shipnow`
- systemd service: `shipnow.service`
- HTTP listener: `127.0.0.1:8090`
- App-private data dir: `/opt/boringmax/shipnow/workspace`
- Public ShipNow UI site: `/opt/boringmax/site/shipnow`

### ShipNow deployment split

ShipNow is deployed in two parts:

1. The application code and server bundle live in `/opt/boringmax/shipnow`.
2. The latest client-side build output is published to `/opt/boringmax/site/shipnow`.

Recommended release flow:

```bash
# 1) build locally
pnpm build

# 2) sync the application repo and server bundle
rsync -az --delete \
  --exclude '.git' \
  --exclude 'node_modules' \
  --exclude 'output' \
  --exclude '.playwright-cli' \
  -e 'ssh -o StrictHostKeyChecking=no' \
  ./ root@89.208.242.44:/opt/boringmax/shipnow/

# 3) sync the generated public client assets
rsync -az --delete \
  -e 'ssh -o StrictHostKeyChecking=no' \
  dist/client/ root@89.208.242.44:/opt/boringmax/site/shipnow/

# 4) make sure the workspace stays writable by the shipnow user
ssh root@89.208.242.44 'chown -R shipnow:shipnow /opt/boringmax/shipnow/workspace'

# 5) reload the service if the backend changed or if the workspace ownership changed
ssh root@89.208.242.44 'systemctl restart shipnow'
```

Notes:

- `/opt/boringmax/shipnow` is the source of truth for the backend and server bundle.
- `/opt/boringmax/site/shipnow` is the source of truth for the public UI assets served by Caddy.
- `/opt/boringmax/shipnow/workspace` must stay writable by the `shipnow` service user; after syncing the repo or touching the workspace on the VPS, re-`chown` it and restart the service before testing create/publish flows.
- When only the frontend changes, syncing `dist/client/` to `/opt/boringmax/site/shipnow/` is enough for public UI freshness, but backend changes still require a ShipNow service restart.
- VPS deployments are production deployments: the systemd service runs with `NODE_ENV=production`, the backend defaults to the production preview/public base URLs, and the preview release HTML is published with a base path derived from that environment's `SHIPNOW_PREVIEW_BASE_URL`.
- Local development keeps the local preview base (`http://localhost:3000/preview`) so the same code can still render preview assets against the local server without changing the production route contract.

### Site root

- Public site root: `/opt/boringmax/site`
- Every direct child of this directory is a site, for example:
  - `/opt/boringmax/site/shipnow`
  - `/opt/boringmax/site/test`
  - `/opt/boringmax/site/loveadventure`

### Per-site layout

For each ShipNow-managed site, the VPS now uses two layers:

1. The internal project workspace under the project id:

```text
/opt/boringmax/site/proj_<projectId>/
  source/
  preview/
    index.html
    assets/
  releases/
    preview/
    public/
  logs/
  current-preview
```

2. The actual live public site under the public handle:

```text
/opt/boringmax/site/<publicHandle>/
  index.html
  assets/
```

Meaning:

- `/opt/boringmax/site/<publicHandle>/` is the current public entrypoint and the path Caddy serves directly
- `index.html` and `assets/` under the public handle directory are the current public entrypoint
- `preview/index.html` and `preview/assets/` under the project id tree are the current preview entrypoint
- `source/` is the editable project source tree
- `releases/preview/` and `releases/public/` store immutable build snapshots inside the project workspace
- `logs/` stores task logs
- `current-preview` points to the active preview snapshot
- the public handle directory itself is the live public site directory, so there is no separate `current-public` alias layer

### Test reset / cleanup rules

When you want a clean ShipNow test environment on the VPS:

1. Delete ShipNow-managed projects through the API first:
   - `DELETE /api/projects/:projectId`
   - wait for the delete task to finish successfully
2. Remove any leftover ShipNow project directories under `/opt/boringmax/site`:
   - the disposable project trees are the `proj_*` directories
   - remove those directories directly if the API delete left stale files behind
3. Keep the ordinary static sites untouched:
   - `shipnow/` is the public UI publication and must stay
   - plain static sites such as `test/`, `loveadventure/`, and `shootman/` are not part of the ShipNow reset flow
4. Do not move the ShipNow app-private files into `/opt/boringmax/site`:
   - the app code stays in `/opt/boringmax/shipnow`
   - the sqlite database stays under `/opt/boringmax/shipnow/workspace`
   - only the public client build is synced to `/opt/boringmax/site/shipnow`

This keeps the reset path predictable: managed ShipNow projects are disposable, while the shared static site roots remain stable.

## systemd environment

The current ShipNow service should provide these core paths:

```ini
WorkingDirectory=/opt/boringmax/shipnow
Environment=NODE_ENV=production
Environment=SHIPNOW_PORT=8090
Environment=SHIPNOW_PUBLIC_BASE_URL=https://boringmax.com
Environment=SHIPNOW_PREVIEW_BASE_URL=https://api.boringmax.com/shipnow/preview
Environment=SHIPNOW_API_BASE_URL=https://api.boringmax.com/shipnow/api
Environment=SHIPNOW_APP_PREFIX=/shipnow
Environment=SHIPNOW_WORKSPACE_ROOT=/opt/boringmax/site/shipnow
Environment=SHIPNOW_PUBLIC_STATIC_ROOT=/opt/boringmax/site
Environment=SHIPNOW_TEMPLATE_ROOT=/opt/boringmax/shipnow/templates
Environment=SHIPNOW_DB_PATH=/opt/boringmax/shipnow/workspace/shipnow.sqlite
Environment=SHIPNOW_CODEX_BIN=/usr/bin/codex
ExecStart=/usr/bin/node /opt/boringmax/shipnow/dist/server/index.js
```

Notes:

- `SHIPNOW_PUBLIC_STATIC_ROOT` is the site root and must stay at `/opt/boringmax/site`
- The ShipNow app database is app-private and lives under `/opt/boringmax/shipnow/workspace`
- The ShipNow workspace remains under the ShipNow app directory at `/opt/boringmax/shipnow/workspace`
- The managed site assets themselves must live inside each public handle directory, not in a shared bucket
- The public ShipNow UI is the only thing that belongs in `/opt/boringmax/site/shipnow`; do not place sqlite, logs, or app-private workspace data there

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
- `api.boringmax.com`
  - reverse proxy to `127.0.0.1:8091`

Note: `api.boringmax.com` must exist in public DNS before Caddy can obtain and serve a trusted TLS certificate for it. If the hostname does not resolve yet, the gateway process can still be healthy on `127.0.0.1:8091`, but the public HTTPS entrypoint will not come up until DNS is added.

## Shared BoringAPI contract

- `api.boringmax.com/<app>/api/*` routes that app's dynamic API requests
- `api.boringmax.com/<app>/preview/*` routes that app's dynamic preview requests
- New apps only extend the registry; Caddy stays generic

Notes:

- The public VPS no longer uses `boringmax.com/preview*`, `boringmax.com/site*`, `preview.boringmax.com`, or `shipnow.boringmax.com` as ShipNow entrypoints.
- `boringmax.com/shipnow` is the static ShipNow UI publication stored in `/opt/boringmax/site/shipnow`.
- `api.boringmax.com/shipnow/preview/<siteName>` is the real public preview URL, while the `/preview` directory under each site is only the filesystem layout that backs it.
- `boringmax.com/preview*` and `boringmax.com/site*` are left to the normal static `file_server` fallback; they do not need bespoke 404 handling if the requested file does not exist.
- ShipNow still understands preview concepts internally, but that internal route model is not the same thing as the live Caddy entrypoint.
- The preview release HTML base is derived from the active `previewBaseUrl` path, so local preview builds still use `/preview/<project>` while the VPS uses `/shipnow/preview/<project>` through the production env values.
- The public release path is the public handle directory under `/opt/boringmax/site/<publicHandle>/`, while the internal `projectId` tree keeps the release snapshots and logs.

## Why this works

- Published sites are fully static and live under their own site directory
- Preview sites are also static and live under the same site directory
- ShipNow can disappear after publishing and the site still has everything it needs
- Preview release HTML is written with a `/siteName/preview/` base so `api.boringmax.com/shipnow/preview/<siteName>` can load its own assets directly from the site tree

## Validation

```bash
systemctl status shipnow
systemctl status boringapi
curl -I https://boringmax.com/shipnow
curl -I https://api.boringmax.com/shipnow/api/settings
curl -I https://api.boringmax.com/shipnow/preview/test
curl -I https://boringmax.com/test
ls -la /opt/boringmax/site/test
ls -la /opt/boringmax/site/test/preview
```
