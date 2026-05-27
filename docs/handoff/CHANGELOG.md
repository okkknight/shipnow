# Changelog

## 2026-05-28

- Removed the hardcoded assistant sample action card from the project workspace conversation stream so the page now shows only real project messages and events.
- Fixed the project status drawer white-screen crash by restoring the collapsible task/history open-state hooks that the drawer body still depends on.
- Added a primary "新建项目" button above the drawer user card and wired it to return to the home route.

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

## 2026-05-27

- Fully closed the UI redesign strong-track scope: the reference pages keep their explanatory styling, the real mobile pages now shrink/stack naturally at 390px, and the remaining design-system edge cases were brought back inside the viewport.
- Re-ran the 390px browser checks after the final shrink pass and confirmed the visual-reference page and the real business pages no longer produce visible horizontal overflow.
- Synchronized the redesign progress table with the actual implementation state so the doc now reflects a complete收口 instead of a stage-3 checkpoint.
- Finished the 390px mobile UI closure pass for the real ShipNow pages: home, projects, project workspace, preview, and publish-result now shrink or stack their pills/cards naturally instead of clipping at the right edge, while the reference visual pages keep their explanatory shell styling.
- Aligned the mobile preview page so the top header stays compact and the feature grid collapses to a mobile-friendly layout; verified the updated screens with fresh 390px browser screenshots.
- Updated the UI redesign progress table to reflect the actual implementation state instead of the earlier stage-3 checkpoint.
- Started the reference-component migration for the UI redesign refactor.
- Exported the ShipNow reference primitives so business pages can reuse the same visual language as the design-system and visual-reference pages.
- Switched the mobile home, template center, project list, and project workspace routes to the reference phone shell and card system.
- Reworked the desktop project conversation stream to use the reference `ChatBubble` and `AssistantActionCard` pattern instead of the older dashboard-style avatar panels.
- Hid the old workspace top bar on mobile routes so the phone pages are rendered as standalone surfaces instead of compressed desktop shells.
- Verified the refactor with `pnpm build` and fresh mobile/desktop screenshots.
- Remaining work: continue migrating the desktop home/templates/projects/preview/publish surfaces and then finish the VPS deployment and verification loop.
- Continued the cleanup toward a no-compat rewrite: converted the desktop templates page and desktop project workspace to the reference-component layout, removed the old `project-workspace-shell` CSS branch, and kept the build green after the rewrite.
- Remaining cleanup: the obsolete `ProjectWorkspaceMobile` stub is still present in `src/App.tsx` and should be removed or collapsed into the active mobile reference path before the next stage is considered fully clean.
- Finished the follow-up cleanup pass: removed the obsolete `ProjectWorkspaceMobile` stub, rewrote the mobile project drawer/status surfaces onto the reference drawer language, and gated the old global drawer chrome so it no longer double-renders on mobile project routes.
- Added a dedicated home mobile reference drawer so the home page no longer depends on the old global drawer chrome on mobile; the remaining old global drawer classes are now desktop-only and can be migrated next.
- Continued the no-compat cleanup by making the project reference drawers return `null` unless they are actually open, and renamed the project drawer/status helpers to `ReferenceWorkspaceDrawer` and `ReferenceWorkspaceStatusDrawer` so the code no longer carries stale mobile-only names.
- Removed the last `workspace-empty` fallback from the project route and replaced it with the reference `EmptyState` component so the project flow no longer carries the old empty-shell wording.
- Finished the naming cleanup for the reference surfaces by renaming `PublishConfirmDialog`, `ProjectWorkspaceMobileReference`, and `HomeMobileWorkspaceDrawer` to reference-prefixed component names, so the code now reads consistently with the rendered UI language.
- Renamed the top-level `workspace-backdrop` shell class to `sn-app-backdrop` so the app shell no longer carries the old workspace-era naming.
- Fixed the mobile home crash caused by a missing `sidebarOpen` prop on `HomeWorkspace`, then re-verified the home page in an isolated headless Chrome session to confirm the standalone mobile reference layout renders correctly.
- Fixed the publish-failure blank page by importing the missing `Info` icon into `src/App.tsx`, then re-verified both mobile and desktop publish-failure routes in the browser so the failure result page now renders in the reference layout.
- Aligned the mobile publish result pages more closely with the reference flow by removing the extra result header strip and cleaning the unused mobile result props, then re-verified the mobile success/failure routes in the browser.
- Reworked the shared `ChatBubble` primitive so assistant and user messages both carry side avatars again, with the user avatar now mirrored to the right on mobile chat flows to match the reference composition more closely.
- Separated the real mobile pages from the reference phone shell: `home / templates / projects / project / preview / publish-result` now render on `MobilePageSurface` with standalone top bars, while the simulated phone frame stays reserved for the static visual-reference pages.
- Continued the separation pass so real mobile pages now use mobile-specific action buttons, preview/result page classes, and mobile-only content names instead of borrowing the reference phone shell language; the black phone frame remains only on the reference/design pages.
- Renamed the shared action button primitive to `SnActionButton` so the real home/templates/projects pages and the reference pages now share a neutral action primitive instead of the old `ReferencePhoneActionButton` name.
- Continued the no-compat UI refactor by giving the real home page its own `sn-home-*` page shell, the template page its own `sn-template-*` shell, and the projects / project workspace pages their own `sn-project-*` shell names so the real routes no longer read as reference pages in the markup.
- Continued the page-shell cleanup by giving the project workbench its own `sn-project-workspace-*` internal layout names and the preview/result surfaces their own `sn-project-preview-*` / `sn-project-workspace-*` outer grids, so the real interactive pages no longer borrow the reference workspace wording in their top-level structure.
- Continued the real-page naming cleanup by renaming the publish confirmation flow and the mobile project workspace/drawer components to neutral project/workspace names, so the real routes no longer expose `Reference*` component names in their implementation path.
- Clarified the last confusing reference-shell component names in `shipnow-enhanced.tsx` so the design-reference phone frame now reads as `ReferenceVisualPhoneShell` / `ReferenceVisualPhoneTopBar`, making it explicit that the black phone shell belongs only to the design/reference pages and not to the real mobile routes.
- Replaced the desktop home composer attachment button's lingering mobile icon-button skin with the neutral `.icon-button` primitive so the real desktop page no longer borrows a mobile-only control style.
- Removed the remaining mobile icon-button skin from the desktop project workspace refresh and attachment controls, so the desktop real pages now keep neutral icon controls and the mobile skin stays confined to mobile routes.
- Paused the stage-3 UI redesign run at a clean checkpoint and updated the standalone progress table to reflect the real status: reference-page separation is in place, but the 390px mobile visual details still need final收口 before the third stage can be treated as fully complete.
- Replaced the desktop project workspace action row and status toolbar buttons with the neutral `SnActionButton` primitive so the real desktop workspace no longer carries `MobileActionButton` semantics; mobile routes still keep the mobile-specific button variant where appropriate.
