# ShipNow Project Context

## What this is

ShipNow is a self-hosted AI small-site publishing workbench for `boringmax.com/shipnow`; its public UI is now a static site at `boringmax.com/shipnow`, and its shared dynamic gateway contract is defined at `https://api.boringmax.com/shipnow/api` and `https://api.boringmax.com/shipnow/preview`.

## What this is not

- Not an online IDE
- Not a multi-user platform
- Not a backend app builder
- Not a Docker orchestration tool

## Current state

- The product specification is complete enough to implement the MVP.
- The workspace now contains a working ShipNow app skeleton, backend API, task runner, and default static template.
- The app can create a project, apply a Codex-driven change, rebuild it, publish a preview release, and promote that preview to the public release.
- Project handle edits now stage a pending rename until the next successful publish; the UI shows the new handle immediately with a "发布后生效" hint, while the live public handle stays unchanged until publish succeeds.
- The shared BoringAPI registry now freezes ShipNow's dynamic path contract as `api.boringmax.com/shipnow/api/*` for API traffic and `api.boringmax.com/shipnow/preview/*` for preview traffic, while the static UI is published to `boringmax.com/shipnow`.
- The create flow now uses one default template instead of a visible project-type picker; game projects are inferred from the prompt and can still switch to Phaser through Codex.
- The current implementation now enforces reserved project-name checks, explicit delete confirmation, and log-preserving deletion behavior.
- VPS acceptance is live on the host-native deployment: the ShipNow UI is published as a static site at `/shipnow`, public releases are served from `boringmax.com/<publicHandle>` with the actual files living under `/opt/boringmax/site/<publicHandle>`, and ShipNow's dynamic traffic now follows the shared `api.boringmax.com/shipnow/api` and `api.boringmax.com/shipnow/preview` contract, with the acceptance project `vps-accept-20260525` fully published.
- Project workspaces are initialized as git repositories before Codex runs, and the default static template builds with Vite's `--configLoader runner` mode to avoid the read-only temp-file issue on the VPS layout.
- Generated static sites now use a relative Vite base, so preview and public releases resolve assets correctly when served from `/preview/<project>` and `/project`.
- The active VPS layout now keeps each ShipNow-managed project self-contained under `/opt/boringmax/site/proj_<projectId>` for source, preview snapshots, public release history, and logs, while the actual live public site is served directly from `/opt/boringmax/site/<publicHandle>`; the shared `.shipnow` bucket and the old project-level public alias layer have been removed.
- ShipNow's own app-private workspace remains under `/opt/boringmax/site/shipnow`, while its sqlite database now lives under `/opt/boringmax/shipnow/workspace/shipnow.sqlite`; managed site assets stay inside each site directory.
- For VPS reset runs, ShipNow-managed projects are disposable: delete them through the API, wait for the task to succeed, then remove any leftover `/opt/boringmax/site/proj_*` directories. Leave the ordinary static sites and `/opt/boringmax/site/shipnow` alone unless the reset explicitly targets them.
- Preview release HTML now derives its `<base>` path from the active `previewBaseUrl` pathname, so local runs still resolve through `/preview/<handle>/` while the VPS resolves through `/shipnow/preview/<handle>/` under production env values. Public release publication now copies the built site into `/opt/boringmax/site/<publicHandle>` so `boringmax.com/<publicHandle>` serves the latest release directly.
- The VPS now also has Claude Code CLI installed at `/usr/bin/claude`, and `shipnow.service` loads `/etc/shipnow/shipnow.env` through a drop-in so the `claude-code` runner can use the configured DeepSeek-compatible Anthropic endpoint and API key.
- The `shipnow.service` now runs as the dedicated `shipnow` user, and `/opt/boringmax/site` is owned by that user so Claude Code can use its full permission-bypass mode on writable workspaces without hitting root restrictions.
- The `test` project has been migrated to the per-site layout and verified end-to-end again after the move.
- The build-failure recovery path has been verified and the reference project is back in `preview_ready`.
- The default `game` template now builds as a playable Phaser power-charge basketball mini game.
- The overview panel now shows the current task state and latest log excerpt while a project is generating or publishing, so in-flight Codex work is visible without switching tabs.
- The latest browser acceptance of the modify flow passed for `ui-smoke-20260526`: apply-change completed successfully, the preview release updated, and the public release stayed unchanged because Publish was not clicked.
- The publish action now sends bodyless requests without a JSON content-type header, and the API preserves Fastify's real 4xx status codes instead of wrapping them into generic 500s.
- The latest independent browser acceptance is not yet passing because the ShipNow entry and API are still reachable without an authentication gate, which violates the design doc's access-protection requirement.
- The project workbench now auto-follows new conversation entries to the latest message on both desktop and mobile; the behavior was verified in Playwright CLI after scrolling the view back up and sending a test conversation.
- The implementation is local-first; VPS deployment paths are configured later through environment variables, and the per-site VPS layout is documented in `docs/SHIPNOW_VPS_DEPLOYMENT.md`.
- ShipNow's sqlite database now lives under `/opt/boringmax/shipnow/workspace/shipnow.sqlite` instead of the public `site/` tree; the public ShipNow UI remains at `/opt/boringmax/site/shipnow`.
- ShipNow deployment now explicitly splits backend and frontend publication: the app code and server bundle stay in `/opt/boringmax/shipnow`, while the latest `dist/client/` output is synced to `/opt/boringmax/site/shipnow` so the public `/shipnow` page always shows the newest UI.

## Latest task

- Status: `Conversation auto-follow added and verified`
- Reason: the project workbench now auto-scrolls to the latest conversation entry when new messages or task events appear, and the behavior was verified in Playwright CLI on the live local app.

## Key files

- `ShipNow_产品详细设计方案.md`
- `docs/handoff/README.md`
- `docs/handoff/CHANGELOG.md`
- `docs/SHIPNOW_VPS_DEPLOYMENT.md`

## Working rules

- Keep the implementation aligned to the design doc.
- Prefer explicit state transitions and file-system-backed releases.
- Use `pnpm` for package management.
- Keep the first version operational before widening scope.
- Keep Codex-driven tasks bounded to file edits and `pnpm build`; avoid launching long-running dev servers inside the task runner.
- Treat each `/opt/boringmax/site/<siteName>` directory as the authoritative home for that site's managed assets; do not route site artifacts through a shared bucket under `/opt/boringmax/site`.
