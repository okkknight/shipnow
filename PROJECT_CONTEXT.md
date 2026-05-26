# ShipNow Project Context

## What this is

ShipNow is a self-hosted AI small-site publishing workbench for `boringmax.com/shipnow`, with its API served from `https://shipnow.boringmax.com/api`.

## What this is not

- Not an online IDE
- Not a multi-user platform
- Not a backend app builder
- Not a Docker orchestration tool

## Current state

- The product specification is complete enough to implement the MVP.
- The workspace now contains a working ShipNow app skeleton, backend API, task runner, and default static template.
- The app can create a project, apply a Codex-driven change, rebuild it, publish a preview release, and promote that preview to the public release.
- The create flow now uses one default template instead of a visible project-type picker; game projects are inferred from the prompt and can still switch to Phaser through Codex.
- The current implementation now enforces reserved project-name checks, explicit delete confirmation, and log-preserving deletion behavior.
- VPS acceptance is live on the host-native deployment: the public ShipNow app runs at `/shipnow`, `preview.boringmax.com` serves preview releases, public releases are served from `boringmax.com/{projectName}`, the API is served from `shipnow.boringmax.com/api`, and the acceptance project `vps-accept-20260525` is fully published.
- Project workspaces are initialized as git repositories before Codex runs, and the default static template builds with Vite's `--configLoader runner` mode to avoid the read-only temp-file issue on the VPS layout.
- Generated static sites now use a relative Vite base, so preview and public releases resolve assets correctly when served from `/preview/<project>` and `/project`.
- The active VPS layout now keeps all project artifacts under `/opt/boringmax/site/.shipnow`: source, preview snapshots, public snapshots, logs, and the ShipNow database all live there, while the public site symlink lives at `/opt/boringmax/site/<projectName>`.
- The `test` project has been migrated to the new `.shipnow` layout and verified end-to-end again after the move.
- The build-failure recovery path has been verified and the reference project is back in `preview_ready`.
- The default `game` template now builds as a playable Phaser power-charge basketball mini game.
- The overview panel now shows the current task state and latest log excerpt while a project is generating or publishing, so in-flight Codex work is visible without switching tabs.
- The latest browser acceptance of the modify flow passed for `ui-smoke-20260526`: apply-change completed successfully, the preview release updated, and the public release stayed unchanged because Publish was not clicked.
- The latest independent browser acceptance is not yet passing because the ShipNow entry and API are still reachable without an authentication gate, which violates the design doc's access-protection requirement.
- The implementation is local-first; VPS deployment paths are configured later through environment variables, and the VPS-specific layout is documented in `docs/SHIPNOW_VPS_DEPLOYMENT.md`.

## Latest task

- Status: `VPS artifacts moved to site/.shipnow and verified`
- Reason: source, preview, public, log, and database paths were migrated to the site-root private layout, then `test` was rebuilt and republished successfully after the move.

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
- Treat `/opt/boringmax/site/.shipnow` as the authoritative private VPS data root; do not route project artifacts back through `/opt/boringmax/shipnow/workspace`.
