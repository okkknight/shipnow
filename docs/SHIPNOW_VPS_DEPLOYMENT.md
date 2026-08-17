# ShipNow VPS Deployment

This note records the live VPS shape for ShipNow and the site layout standard it enforces.

## Goal

- The VPS now splits responsibilities cleanly:
  - internal workspaces live under `/opt/boringmax/workspace/project/<projectId>`
  - public sites live under `/opt/boringmax/site/<publicHandle>`
  - the ShipNow UI stays at `/opt/boringmax/site/shipnow`
- No shared top-level `/opt/boringmax/site/releases`, `/opt/boringmax/site/projects`, `/opt/boringmax/site/logs`, or `.shipnow`
- Already published sites must keep working even if the ShipNow process disappears later
- Local development uses the same split idea, but with `workspace/project/<projectId>` for the internal project tree and `workspace/public/<publicHandle>` for public sites

## Current VPS snapshot

As of 2026-05-30, the live VPS layout matches the split above:

- `/opt/boringmax/site/` contains only the ShipNow UI publication and the live public handle directories.
- `/opt/boringmax/workspace/` contains the internal project workspace tree plus the ShipNow sqlite database.
- `proj_*` directories no longer live under `/opt/boringmax/site/`; they now live only under `/opt/boringmax/workspace/project/`.
- The active services are `shipnow`, `boringapi`, and `caddy`.

## Directory model

### Local development

- Internal project workspaces: `workspace/project/proj_<projectId>/...`
- Public sites: `workspace/public/<publicHandle>/...`

### VPS deployment

- App code: `/opt/boringmax/shipnow`
- systemd service: `shipnow.service`
- HTTP listener: `127.0.0.1:8090`
- App-private data dir: `/opt/boringmax/workspace`
- Public ShipNow UI site: `/opt/boringmax/site/shipnow`
- Internal project workspaces: `/opt/boringmax/workspace/project/proj_<projectId>/...`
- Public sites: `/opt/boringmax/site/<publicHandle>/...`
- sqlite database: `/opt/boringmax/workspace/shipnow.sqlite`

## ShipNow deployment split

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
  --exclude 'workspace' \
  -e 'ssh -o StrictHostKeyChecking=no' \
  ./ ubuntu@43.172.79.177:/opt/boringmax/shipnow/

# 3) sync the generated public client assets
rsync -az --delete \
  -e 'ssh -o StrictHostKeyChecking=no' \
  dist/client/ ubuntu@43.172.79.177:/opt/boringmax/site/shipnow/

# 4) make sure the VPS workspace stays writable by the shipnow user
ssh ubuntu@43.172.79.177 'chown -R shipnow:shipnow /opt/boringmax/workspace'

# 5) reload the service if the backend changed or if the workspace ownership changed
ssh ubuntu@43.172.79.177 'systemctl daemon-reload && systemctl restart shipnow'
```

Notes:

- `/opt/boringmax/shipnow` is the source of truth for the backend and server bundle.
- `/opt/boringmax/site/shipnow` is the source of truth for the public UI assets served by Caddy.
- `/opt/boringmax/workspace` must stay writable by the `shipnow` service user; after moving the VPS workspace or touching the runtime data, re-`chown` it and restart the service before testing create/publish flows.
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
/opt/boringmax/workspace/project/proj_<projectId>/
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
- there is no separate `current-public` alias layer anymore; the public handle directory itself is the live public site directory

### Test reset / cleanup rules

When you want a clean ShipNow test environment on the VPS:

1. Delete ShipNow-managed projects through the API first:
   - `DELETE /api/projects/:projectId`
   - wait for the delete task to finish successfully
2. Remove any leftover ShipNow project directories under `/opt/boringmax/workspace/project`:
   - the disposable project trees are the `proj_*` directories
   - remove those directories directly if the API delete left stale files behind
3. Keep the ordinary static sites untouched:
   - `shipnow/` is the public UI publication and must stay
   - plain static sites such as `test/`, `loveadventure/`, and `shootman/` are not part of the ShipNow reset flow
4. Do not move the ShipNow app-private files into `/opt/boringmax/site`:
   - the app code stays in `/opt/boringmax/shipnow`
   - the sqlite database stays under `/opt/boringmax/workspace`
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
Environment=SHIPNOW_WORKSPACE_ROOT=/opt/boringmax/workspace/project
Environment=SHIPNOW_PUBLIC_STATIC_ROOT=/opt/boringmax/site
Environment=SHIPNOW_TEMPLATE_ROOT=/opt/boringmax/shipnow/templates
Environment=SHIPNOW_DB_PATH=/opt/boringmax/workspace/shipnow.sqlite
Environment=SHIPNOW_CODEX_BIN=/usr/bin/codex
ExecStart=/usr/bin/node /opt/boringmax/shipnow/dist/server/index.js
```

Notes:

- `SHIPNOW_WORKSPACE_ROOT` is the project workspace root. On the VPS it now stays at `/opt/boringmax/workspace/project`, while local development defaults to `workspace/project`.
- `SHIPNOW_PUBLIC_STATIC_ROOT` is the public site root and must stay at `/opt/boringmax/site` on the VPS; local development defaults to `workspace/public`.
- The ShipNow app database is app-private and lives under `/opt/boringmax/workspace`.
- The ShipNow workspace no longer lives under the ShipNow app directory on the VPS.
- The managed site assets themselves must live inside each public handle directory, not in a shared bucket.
- The public ShipNow UI is the only thing that belongs in `/opt/boringmax/site/shipnow`; do not place sqlite, logs, or app-private workspace data there.

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

- Keep the env file root-only readable, because it stores the DeepSeek API key used by Claude Code.
- Keep `/opt/boringmax/workspace` owned by `shipnow:shipnow` so the `claude-code` runner can edit project workspaces under full access.
- ShipNow reads the `SHIPNOW_*` values directly, and Claude Code also accepts the `ANTHROPIC_*` aliases.
- After updating the env file, run `systemctl daemon-reload && systemctl restart shipnow`.

## Caddy routing

Recommended public routing:

- `boringmax.com`
  - `root * /opt/boringmax/site`
  - public HTML responses use `Cache-Control: no-cache, max-age=0, must-revalidate`
  - hashed `/assets/*` and static hero images use `Cache-Control: public, max-age=31536000, immutable`
  - `/shipnow/*` is handled as a SPA shell that falls back to `/shipnow/index.html` for deep links like `/shipnow/project/<projectId>/preview` and `/shipnow/project/<projectId>/live`
  - `try_files {path}/index.html {path}.html {path} /index.html`
  - `file_server`
- `api.boringmax.com`
  - reverse proxy to `127.0.0.1:8091`

Note: `api.boringmax.com` must exist in public DNS before Caddy can obtain and serve a trusted TLS certificate for it. If the hostname does not resolve yet, the gateway process can still be healthy on `127.0.0.1:8091`, but the public HTTPS entrypoint will not come up until DNS is added.

## Recent live Caddy tweaks

The live VPS Caddyfile now has two deployment-specific adjustments that are worth keeping in mind during verification:

1. Public HTML revalidation for published sites
   - The public site HTML entry pages under `boringmax.com` now send `Cache-Control: no-cache, max-age=0, must-revalidate`.
   - Hashed `/assets/*` files and other static images still use long-lived immutable caching.
   - This keeps publish refreshes responsive: the browser revalidates the HTML shell on each navigation, but still reuses hashed assets efficiently.

2. ShipNow SPA fallback for deep links
   - Requests under `/shipnow/*` are treated as the ShipNow single-page app shell.
   - Caddy falls back to `/shipnow/index.html` for deep links such as `/shipnow/project/<projectId>/preview` and `/shipnow/project/<projectId>/live`.
   - This prevents refreshes on nested ShipNow UI routes from surfacing `404` or `ERR_HTTP_RESPONSE_CODE_FAILURE`.

These are Caddy-only behaviors. They do not change the ShipNow API contract, the public handle directory layout, or the preview/public release generation logic in the app itself.

## Shared BoringAPI contract

- `api.boringmax.com/<app>/api/*` routes that app's dynamic API requests
- `api.boringmax.com/<app>/preview/*` routes that app's dynamic preview requests
- New apps only extend the registry; Caddy stays generic

Notes:

- The public VPS no longer uses `boringmax.com/preview*`, `boringmax.com/site*`, `preview.boringmax.com`, or `shipnow.boringmax.com` as ShipNow entrypoints.
- `boringmax.com/shipnow` is the static ShipNow UI publication stored in `/opt/boringmax/site/shipnow`.
- `api.boringmax.com/shipnow/preview/<siteName>` is the real public preview URL, while the `/preview` directory under each project workspace is only the filesystem layout that backs it.
- `boringmax.com/preview*` and `boringmax.com/site*` are left to the normal static `file_server` fallback; they do not need bespoke 404 handling if the requested file does not exist.
- ShipNow still understands preview concepts internally, but that internal route model is not the same thing as the live Caddy entrypoint.
- The preview release HTML base is derived from the active `previewBaseUrl` path, so local preview builds still use `/preview/<project>` while the VPS uses `/shipnow/preview/<project>` through the production env values.
- The public release path is the public handle directory under `/opt/boringmax/site/<publicHandle>/`, while the internal `projectId` tree keeps the release snapshots and logs under `/opt/boringmax/workspace/project/<projectId>`.

## Why this works

- Published sites are fully static and live under their own site directory
- Preview sites are also static and live under the same site directory
- ShipNow can disappear after publishing and the site still has everything it needs
- Preview release HTML is written with a `/shipnow/preview/<siteName>/` base so `api.boringmax.com/shipnow/preview/<siteName>` can load its own assets directly from the site tree

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
ls -la /opt/boringmax/workspace/project/proj_<projectId>
```
