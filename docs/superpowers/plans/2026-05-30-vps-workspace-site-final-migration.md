# VPS Workspace/Site Final Migration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 VPS 最终收敛成 `/opt/boringmax/workspace + /opt/boringmax/site` 的清晰分层，同时保持本地仍然使用 `workspace/project + workspace/public`，避免本地和 VPS 互相污染。

**Architecture:** 本地开发继续沿用已完成的双层结构：内部项目树在 `workspace/project/<projectId>`，公网站点在 `workspace/public/<publicHandle>`。VPS 则把内部工作区迁到 `/opt/boringmax/workspace/project/<projectId>`，公网站点继续放在 `/opt/boringmax/site/<publicHandle>`，ShipNow 应用本体仍留在 `/opt/boringmax/shipnow`，sqlite 也迁到 `/opt/boringmax/workspace/shipnow.sqlite`。这次迁移的核心不是改路由，而是把“内部工作区”和“公开静态站点”彻底拆开，并在 systemd、文档和验收流程里固定这条约定。

**Tech Stack:** Node.js, TypeScript, SQLite, Fastify, rsync, systemd, Caddy, Bash

---

## Scope Lock

- 本计划只处理 VPS 的目录分层和部署契约，不把本地再次改回 VPS 的混合布局
- 本地开发保持 `workspace/project + workspace/public` 不变
- VPS 最终目标是：
  - 内部工作区：`/opt/boringmax/workspace/project/<projectId>`
  - 公网站点：`/opt/boringmax/site/<publicHandle>`
  - ShipNow UI：`/opt/boringmax/site/shipnow`
  - ShipNow 应用本体：`/opt/boringmax/shipnow`
  - sqlite：`/opt/boringmax/workspace/shipnow.sqlite`
- 不改 Caddy 的静态站点语义，`boringmax.com/<publicHandle>` 仍然直接命中 `/opt/boringmax/site/<publicHandle>`
- 不做旧入口兼容，不再为历史 `proj_*` 混合目录保留额外访问路径
- 迁移过程中先验证再删除旧目录，先保活项目，再清历史残留

## Current State That This Plan Builds On

- 代码层已经支持本地与 VPS 分离的根目录：
  - `SHIPNOW_WORKSPACE_ROOT` 默认指向 `workspace/project`
  - `SHIPNOW_PUBLIC_STATIC_ROOT` 默认指向 `workspace/public`
- 当前 VPS 仍然是历史混合布局，`/opt/boringmax/site` 下面同时存在公开站点和部分 `proj_*` 内部工作区残留
- `shipnow.service` 仍然保留在 `/opt/boringmax/shipnow` 目录体系里，app-private 数据还需要继续从公网站点树里剥离
- 现有部署文档还混有旧说明，必须同步改成“VPS workspace/site 分离、本地 workspace/project + workspace/public”的最终口径

## Decisions Already Locked

- 本地不回退到混合布局
- VPS 不继续把 `proj_*` 工作区留在 `/opt/boringmax/site`
- 公开 handle 目录继续作为公网站点入口
- `shipnow` 公网 UI 仍在 `/opt/boringmax/site/shipnow`
- 应用本体和 sqlite 迁出公网站点树，进入 `/opt/boringmax/workspace`
- 迁移验收必须同时看本地和 VPS，不能只验一边

---

### Task 1: 冻结 VPS 现状并做一次可回滚的快照

**Files:**
- Modify: `/Users/linpeiwen/knightspace/shipnow/docs/SHIPNOW_VPS_DEPLOYMENT.md`
- Modify: `/Users/linpeiwen/knightspace/shipnow/PROJECT_CONTEXT.md`
- Modify: `/Users/linpeiwen/knightspace/shipnow/docs/handoff/CHANGELOG.md`

- [ ] **Step 1: Capture the current VPS shape**

```bash
ssh root@89.208.242.44 '
  set -e
  systemctl is-active shipnow boringapi caddy
  printf "\nsite root:\n"
  find /opt/boringmax/site -maxdepth 1 -mindepth 1 -printf "%y %p -> %l\n" | sort
  printf "\nshipnow workspace:\n"
  find /opt/boringmax/shipnow/workspace -maxdepth 2 -printf "%y %p -> %l\n" | sort | head -n 200
'
```

Expected:
- `shipnow`, `boringapi`, and `caddy` are active
- `/opt/boringmax/site` still contains a mixed set of `proj_*` and public handle directories
- `/opt/boringmax/shipnow/workspace` still contains the app-private sqlite and runtime files

- [ ] **Step 2: Create a rollback archive**

```bash
ssh root@89.208.242.44 '
  set -e
  stamp=shipnow-vps-split-2026-05-30
  mkdir -p /opt/boringmax/backups/$stamp
  tar -C /opt/boringmax -czf /opt/boringmax/backups/$stamp/site.tgz site
  tar -C /opt/boringmax/shipnow -czf /opt/boringmax/backups/$stamp/shipnow-workspace.tgz workspace
'
```

Expected:
- backup archives exist under `/opt/boringmax/backups/shipnow-vps-split-2026-05-30/`
- no live paths have moved yet

- [ ] **Step 3: Refresh the deployment docs to state the final target**

Update these files so they stop implying that the VPS keeps app-private data inside `/opt/boringmax/site`:

```text
/Users/linpeiwen/knightspace/shipnow/docs/SHIPNOW_VPS_DEPLOYMENT.md
/Users/linpeiwen/knightspace/shipnow/PROJECT_CONTEXT.md
/Users/linpeiwen/knightspace/shipnow/docs/handoff/CHANGELOG.md
```

Expected:
- the docs explicitly say: local = `workspace/project + workspace/public`, VPS = `/opt/boringmax/workspace + /opt/boringmax/site`
- there is no ambiguous language left about app-private data living in `/opt/boringmax/site`

---

### Task 2: Move VPS internal workspaces out of `/opt/boringmax/site`

**Files:**
- Modify (VPS): `/opt/boringmax/shipnow/workspace/shipnow.sqlite`
- Modify (VPS): `/etc/shipnow/shipnow.env`
- Modify (VPS): `/etc/systemd/system/shipnow.service.d/10-claude-code.conf`

- [ ] **Step 1: Create the new workspace root**

```bash
ssh root@89.208.242.44 '
  set -e
  install -d -o shipnow -g shipnow /opt/boringmax/workspace/project
  install -d -o shipnow -g shipnow /opt/boringmax/workspace
'
```

Expected:
- `/opt/boringmax/workspace/project` exists
- ownership is `shipnow:shipnow`

- [ ] **Step 2: Move every ShipNow-managed internal tree out of `/opt/boringmax/site`**

```bash
ssh root@89.208.242.44 '
  set -e
  shopt -s nullglob
  for dir in /opt/boringmax/site/proj_*; do
    mv "$dir" /opt/boringmax/workspace/project/
  done
'
```

Expected:
- `/opt/boringmax/site/proj_*` no longer exists
- the moved directories now live under `/opt/boringmax/workspace/project/proj_*`

- [ ] **Step 3: Move sqlite into the new private workspace root**

```bash
ssh root@89.208.242.44 '
  set -e
  mv /opt/boringmax/shipnow/workspace/shipnow.sqlite* /opt/boringmax/workspace/
  chown -R shipnow:shipnow /opt/boringmax/workspace
'
```

Expected:
- `/opt/boringmax/workspace/shipnow.sqlite` exists
- `shipnow.sqlite-wal` and `shipnow.sqlite-shm` move with it when present
- `/opt/boringmax/shipnow/workspace` is no longer the live sqlite location

- [ ] **Step 4: Repoint the ShipNow service environment to the new VPS roots**

The final VPS values must be:

```ini
Environment=SHIPNOW_WORKSPACE_ROOT=/opt/boringmax/workspace/project
Environment=SHIPNOW_PUBLIC_STATIC_ROOT=/opt/boringmax/site
Environment=SHIPNOW_DB_PATH=/opt/boringmax/workspace/shipnow.sqlite
```

Keep the existing production API and preview base URLs unchanged:

```ini
Environment=SHIPNOW_PUBLIC_BASE_URL=https://boringmax.com
Environment=SHIPNOW_PREVIEW_BASE_URL=https://api.boringmax.com/shipnow/preview
Environment=SHIPNOW_API_BASE_URL=https://api.boringmax.com/shipnow/api
Environment=SHIPNOW_APP_PREFIX=/shipnow
```

Expected:
- the service reads the private workspace from `/opt/boringmax/workspace/project`
- the public site root remains `/opt/boringmax/site`

---

### Task 3: Restart ShipNow and re-publish the public UI into `/opt/boringmax/site/shipnow`

**Files:**
- Modify (VPS): `/opt/boringmax/site/shipnow/*`
- Modify (VPS): `/opt/boringmax/shipnow/dist/client/*`

- [ ] **Step 1: Rebuild ShipNow locally before syncing the public UI**

```bash
cd /Users/linpeiwen/knightspace/shipnow
pnpm build
```

Expected:
- build passes before any VPS sync

- [ ] **Step 2: Sync the generated client bundle to the VPS ShipNow UI directory**

```bash
rsync -az --delete \
  -e 'ssh -o StrictHostKeyChecking=no' \
  /Users/linpeiwen/knightspace/shipnow/dist/client/ \
  root@89.208.242.44:/opt/boringmax/site/shipnow/
```

Expected:
- `/opt/boringmax/site/shipnow/index.html` and `assets/` are refreshed with the latest build

- [ ] **Step 3: Restart the ShipNow service with the new environment**

```bash
ssh root@89.208.242.44 '
  set -e
  systemctl daemon-reload
  systemctl restart shipnow
  systemctl is-active shipnow
'
```

Expected:
- `shipnow` returns `active`
- the service now reads `SHIPNOW_WORKSPACE_ROOT=/opt/boringmax/workspace/project`
- the sqlite file under `/opt/boringmax/workspace` is writable by the `shipnow` user

---

### Task 4: Verify local and VPS are independent and both remain healthy

**Files:**
- Test: `/Users/linpeiwen/knightspace/shipnow/server/*.test.ts`
- Modify: `/Users/linpeiwen/knightspace/shipnow/docs/SHIPNOW_VPS_DEPLOYMENT.md`
- Modify: `/Users/linpeiwen/knightspace/shipnow/PROJECT_CONTEXT.md`
- Modify: `/Users/linpeiwen/knightspace/shipnow/docs/handoff/CHANGELOG.md`

- [ ] **Step 1: Re-run the local test suite after the migration-related path changes**

```bash
cd /Users/linpeiwen/knightspace/shipnow
pnpm exec node --import tsx --test server/*.test.ts
pnpm typecheck
pnpm build
```

Expected:
- all local tests pass
- typecheck passes
- build passes
- local layout continues to use `workspace/project` and `workspace/public`

- [ ] **Step 2: Verify the VPS public and internal paths separately**

```bash
ssh root@89.208.242.44 '
  set -e
  curl -fsS http://127.0.0.1:8090/health
  curl -fsSI https://boringmax.com/shipnow
  curl -fsSI https://boringmax.com/untitle-n2hc
  curl -fsSI https://api.boringmax.com/shipnow/api/settings
  curl -fsSI https://api.boringmax.com/shipnow/preview/untitle-n2hc || true
'
```

Expected:
- `/health` returns `{"ok":true}`
- `boringmax.com/shipnow` returns 200
- at least one public handle site returns 200
- `api.boringmax.com/shipnow/api/settings` returns 200
- the preview endpoint is checked separately for the expected project state, not assumed

- [ ] **Step 3: Re-scan both environments for stale mixed-layout references**

```bash
cd /Users/linpeiwen/knightspace/shipnow
rg -n "/opt/boringmax/site/proj_|/opt/boringmax/shipnow/workspace|workspace/project|workspace/public" \
  PROJECT_CONTEXT.md docs/SHIPNOW_VPS_DEPLOYMENT.md docs/handoff/CHANGELOG.md server
```

Expected:
- local docs mention `workspace/project + workspace/public`
- VPS docs mention `/opt/boringmax/workspace + /opt/boringmax/site`
- no live path still claims the old mixed-root VPS layout as the current truth

---

## Rollback Notes

- Restore `/opt/boringmax/site` from `/opt/boringmax/backups/shipnow-vps-split-2026-05-30/site.tgz`
- Restore `/opt/boringmax/shipnow/workspace` from `/opt/boringmax/backups/shipnow-vps-split-2026-05-30/shipnow-workspace.tgz`
- Revert `/etc/shipnow/shipnow.env` and restart `shipnow` if the new workspace root fails to mount or fails permission checks
- If public site validation fails after the move, stop before deleting any old directories and restore the backups first

## Completion Checklist

- [ ] VPS internal workspaces live under `/opt/boringmax/workspace/project`
- [ ] VPS public sites remain under `/opt/boringmax/site/<publicHandle>`
- [ ] VPS ShipNow UI remains under `/opt/boringmax/site/shipnow`
- [ ] VPS sqlite lives under `/opt/boringmax/workspace/shipnow.sqlite`
- [ ] Local still uses `workspace/project + workspace/public`
- [ ] Docs match the final split exactly
- [ ] Local tests, typecheck, build, and VPS smoke checks are all green
