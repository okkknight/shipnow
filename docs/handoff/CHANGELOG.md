# Changelog

## 2026-05-25

- Bootstrapped the ShipNow implementation workspace.
- Added the project context and handoff entrypoints.
- Implemented the ShipNow MVP app shell, backend API, task runner, and default static template.
- Verified project create, apply-change, preview build, and preview release flows with the `hello-shipnow` project.
- Tightened Codex task prompts so generated tasks stay file-only and do not launch long-running dev servers.
- Enforced reserved project-name validation, explicit typed delete confirmation, and log-preserving deletion cleanup.
- Normalized API error handling so validation and duplicate-name failures return explicit client-facing status codes.
- Verified the build-failure path with a temporary broken `hello-shipnow` source change, then restored the project back to `preview_ready`.
- Verified the publish path by promoting `hello-shipnow` from preview to public release.
- Upgraded the default `game` template into a playable power-charge basketball mini game and verified it builds in an isolated temp copy.
- Deployed ShipNow to the host-native VPS layout, fixed template builds with Vite's runner config loader, and initialized project workspaces as git repos before Codex tasks run.
- Verified the full VPS acceptance loop with `vps-accept-20260525`: create, build, preview, publish, and public site access all completed successfully.
- Split the ShipNow runtime boundary so the UI stays on `boringmax.com/shipnow` while the API moves to `shipnow.boringmax.com/api`, and preview/public releases are served from `preview.boringmax.com/{project}` and `boringmax.com/{project}`.
- Added `preview.boringmax.com` as the public preview host and pointed ShipNow's preview base URL to it.
- Switched generated static sites to a relative Vite base so preview and public releases resolve assets correctly under `/preview/<project>` and `/project`, then rebuilt and republished `vps-accept-20260525` to verify both routes serve 200s.
- Simplified project creation to a single default template flow: removed the visible project-type picker, and now infer game projects from the prompt so Codex can switch them to Phaser when needed.
- Added a live overview banner that shows the current task status plus the latest task log excerpt while a project is generating or publishing.

## 2026-05-26

- Ran an independent browser acceptance pass against the live VPS ShipNow entry.
- Verified the core UI flow: project list renders, the new-project modal opens, project creation starts, task logs stream, preview release generation completes, and the temporary smoke project reaches `preview_ready`.
- Found a design-blocking issue: `https://boringmax.com/shipnow` and the API are still reachable without an authentication gate, so the deployment does not yet satisfy the design doc's access-protection requirement.
- Ran a follow-up browser acceptance pass for the modify flow on `ui-smoke-20260526`.
- Verified that apply-change completes successfully, a new preview release is produced, the preview page reflects the updated template title and description, and the public release remains unchanged until Publish is clicked.
- Moved the VPS project artifacts into per-site directories under `/opt/boringmax/site/<siteName>`, updated the ShipNow service and Caddy preview root, reinstated dependencies in migrated project source directories, and verified that `test` rebuilds, previews, and republishes successfully after the move.
- Reworked the layout standard so each site owns its own `source/`, `preview/`, `releases/`, and `logs/` tree under `/opt/boringmax/site/<siteName>`, migrated the live VPS projects into that per-site structure, and removed the shared `.shipnow` asset bucket after verification.
- Fixed the migrated preview/public pointer chain so each site's `preview/index.html` and `preview/assets` symlinks follow `current-preview`, then rebuilt and republished `test` to verify the final per-site layout end to end.
- Stabilized the publish/rebuild/delete action path by skipping `Content-Type: application/json` for bodyless requests and preserving Fastify's real 4xx responses instead of converting them into generic 500s.
