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
- Split the ShipNow runtime boundary so the UI stays on `boringmax.com/shipnow` while the API moves to `shipnow.boringmax.com/api`, and the VPS Caddy route map forwards `/preview*` and `/site*` into ShipNow as well.
- Added `preview.boringmax.com` as the public preview host and pointed ShipNow's preview base URL to it.
- Switched generated static sites to a relative Vite base so preview and public releases resolve assets correctly under `/preview/<project>` and `/site/<project>`, then rebuilt and republished `vps-accept-20260525` to verify both routes serve 200s.
