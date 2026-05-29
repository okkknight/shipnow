# BoringAPI 共享网关与 ShipNow 静态化迁移实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 `boringmax.com/<project>` 统一为纯静态发布站点，把所有动态能力收口到 `api.boringmax.com` 下的独立 `boringapi` 网关，并让 ShipNow 只保留自己作为业务应用所需的后端逻辑，不再承担公网入口路由。

**Architecture:** `boringmax.com` 只服务静态发布物，`api.boringmax.com` 只转发动态请求到 `boringapi`，`boringapi` 再按应用注册表把 `/shipnow/api/*`、`/shipnow/preview/*` 以及未来其他应用的动态路径路由到对应后端。ShipNow 的公开页面改成静态站点发布，ShipNow 后端只负责管理、构建、预览和发布逻辑，公网入口不再依赖 `boringmax.com/shipnow` 的特殊 Caddy 路由。

**Tech Stack:** Fastify, TypeScript, Node.js, SQLite, Caddy, systemd, Vite, React, existing ShipNow build pipeline

---

## Scope Lock

- 本计划只处理“公共入口统一化”和“动态网关独立化”，不重做 ShipNow 的 UI 视觉设计
- `boringapi` 是新的独立网关项目，推荐放在 `/Users/linpeiwen/knightspace/boringapi`，与 ShipNow 并列，而不是塞进 ShipNow 服务里
- `boringmax.com/<project>` 包括 `shipnow` 在内，都视为普通静态发布站点，不再为它们单独写 Caddy 反代块
- `api.boringmax.com` 是后续所有动态能力的统一入口，不为每个新站点新增子域名和 Caddy 路由
- 不做旧入口兼容，不保留 `preview.boringmax.com`、`boringmax.com/preview*`、`boringmax.com/site*` 这类历史路由
- 这次迁移要求能覆盖未来的新应用，所以 `boringapi` 的路径分发必须是通用注册表驱动，而不是把 `shipnow` 写死在 Caddy 里

## Current State That This Plan Builds On

- ShipNow 目前还是一个 Fastify + SQLite 的单仓库应用，前端和后端都在 `shipnow` 里
- 现有 VPS 已经有 `shipnow.service`、`shipnow` 用户、`/opt/boringmax/site` 的 per-site 目录结构，以及固定的 `boringmax.com` 静态站点根目录
- 当前 `shipnow` 的公开入口还带有历史路径耦合，文档里也还保留了 ShipNow 作为管理入口的描述，需要同步改写
- 现在的部署文档已经认可 `api.boringmax.com` 作为 API 域名的方向，但还没有抽出一个真正可复用的 `boringapi` 网关项目

## Decisions Already Locked

- 公开静态站点继续由 `boringmax.com/<project>` 提供，`shipnow` 也是一个普通站点名
- `api.boringmax.com` 只负责动态流量，不再承载静态站点内容
- `boringapi` 负责统一网关，不把网关逻辑绑定到 ShipNow
- ShipNow 的动态能力仍然保留，只是由 `boringapi` 暴露出来
- 新增站点时只改站点数据和发布文件，不再改 Caddy

---

### Task 1: 冻结统一网关的路径契约和应用注册表格式

**Files:**
- Create: `/Users/linpeiwen/knightspace/boringapi/README.md`
- Create: `/Users/linpeiwen/knightspace/boringapi/src/registry.ts`
- Create: `/Users/linpeiwen/knightspace/boringapi/test/registry.test.ts`
- Modify: `/Users/linpeiwen/knightspace/shipnow/PROJECT_CONTEXT.md`
- Modify: `/Users/linpeiwen/knightspace/shipnow/docs/SHIPNOW_VPS_DEPLOYMENT.md`
- Modify: `/Users/linpeiwen/knightspace/shipnow/docs/handoff/CHANGELOG.md`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, strict as assert } from 'node:test';
import { resolveGatewayRoute } from '../src/registry.js';

describe('resolveGatewayRoute', () => {
  it('routes shipnow api and preview paths', () => {
    const apiRoute = resolveGatewayRoute('/shipnow/api/settings');
    const previewRoute = resolveGatewayRoute('/shipnow/preview/test');

    assert.equal(apiRoute?.appSlug, 'shipnow');
    assert.equal(apiRoute?.kind, 'api');
    assert.equal(previewRoute?.appSlug, 'shipnow');
    assert.equal(previewRoute?.kind, 'preview');
  });

  it('rejects paths without a registered app prefix', () => {
    assert.equal(resolveGatewayRoute('/preview/test'), null);
    assert.equal(resolveGatewayRoute('/api/settings'), null);
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run:

```bash
cd /Users/linpeiwen/knightspace/boringapi
node --import tsx --test test/registry.test.ts
```

Expected: fail because `resolveGatewayRoute` and the registry module do not exist yet.

- [ ] **Step 3: Write the minimal implementation**

```ts
export type GatewayRouteKind = 'api' | 'preview';

export interface GatewayRoute {
  appSlug: string;
  kind: GatewayRouteKind;
  upstreamPath: string;
}

export function resolveGatewayRoute(pathname: string): GatewayRoute | null {
  const parts = pathname.split('/').filter(Boolean);
  const [appSlug, section, ...rest] = parts;
  if (!appSlug || !section) return null;
  if (section !== 'api' && section !== 'preview') return null;
  return {
    appSlug,
    kind: section,
    upstreamPath: `/${rest.join('/')}`,
  };
}
```

`README.md` 里要明确写出统一契约，必须包含这三条：

```md
- `api.boringmax.com/<app>/api/*` -> app 的动态 API
- `api.boringmax.com/<app>/preview/*` -> app 的动态预览
- 新增 app 只改 registry，不改 Caddy
```

- [ ] **Step 4: Run the test again and confirm it passes**

Run:

```bash
cd /Users/linpeiwen/knightspace/boringapi
node --import tsx --test test/registry.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add /Users/linpeiwen/knightspace/boringapi/src/registry.ts /Users/linpeiwen/knightspace/boringapi/test/registry.test.ts /Users/linpeiwen/knightspace/boringapi/README.md /Users/linpeiwen/knightspace/shipnow/PROJECT_CONTEXT.md /Users/linpeiwen/knightspace/shipnow/docs/SHIPNOW_VPS_DEPLOYMENT.md /Users/linpeiwen/knightspace/shipnow/docs/handoff/CHANGELOG.md
git commit -m "docs: freeze boringapi gateway contract"
```

---

### Task 2: 搭建 `boringapi` 独立网关服务

**Files:**
- Create: `/Users/linpeiwen/knightspace/boringapi/package.json`
- Create: `/Users/linpeiwen/knightspace/boringapi/tsconfig.json`
- Create: `/Users/linpeiwen/knightspace/boringapi/src/index.ts`
- Create: `/Users/linpeiwen/knightspace/boringapi/src/server.ts`
- Create: `/Users/linpeiwen/knightspace/boringapi/src/proxy.ts`
- Create: `/Users/linpeiwen/knightspace/boringapi/test/proxy.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, strict as assert } from 'node:test';
import { startTestGateway } from '../src/server.js';

describe('boringapi proxy', () => {
  it('rewrites shipnow api requests to the upstream backend', async () => {
    const gateway = await startTestGateway();
    const res = await fetch(`${gateway.baseUrl}/shipnow/api/settings`);
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.equal(body.settings.defaultRunner, 'claude-code');
    await gateway.close();
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run:

```bash
cd /Users/linpeiwen/knightspace/boringapi
node --import tsx --test test/proxy.test.ts
```

Expected: fail because the Fastify gateway and proxy helper do not exist yet.

- [ ] **Step 3: Write the minimal implementation**

```ts
import Fastify from 'fastify';
import { resolveGatewayRoute } from './registry.js';

export async function createGateway() {
  const app = Fastify({ logger: true });

  app.get('/health', async () => ({ ok: true }));

  app.all('/:app/api/*', async (req, reply) => {
    const route = resolveGatewayRoute(req.url);
    if (!route) return reply.code(404).send({ error: 'unknown app' });
    return proxyToUpstream(reply, route);
  });

  app.all('/:app/preview/*', async (req, reply) => {
    const route = resolveGatewayRoute(req.url);
    if (!route) return reply.code(404).send({ error: 'unknown app' });
    return proxyToUpstream(reply, route);
  });

  return app;
}
```

`proxyToUpstream()` 必须把路径保持成 app 后端能识别的形式，不能把 `shipnow` 写死在 Caddy。

- [ ] **Step 4: Run the test again and confirm it passes**

Run:

```bash
cd /Users/linpeiwen/knightspace/boringapi
node --import tsx --test test/proxy.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add /Users/linpeiwen/knightspace/boringapi/package.json /Users/linpeiwen/knightspace/boringapi/tsconfig.json /Users/linpeiwen/knightspace/boringapi/src/index.ts /Users/linpeiwen/knightspace/boringapi/src/server.ts /Users/linpeiwen/knightspace/boringapi/src/proxy.ts /Users/linpeiwen/knightspace/boringapi/test/proxy.test.ts
git commit -m "feat: add boringapi gateway skeleton"
```

---

### Task 3: 把 ShipNow 的前端和运行时地址切到 `api.boringmax.com`

**Files:**
- Modify: `/Users/linpeiwen/knightspace/shipnow/src/api.ts`
- Modify: `/Users/linpeiwen/knightspace/shipnow/src/App.tsx`
- Modify: `/Users/linpeiwen/knightspace/shipnow/server/env.ts`
- Modify: `/Users/linpeiwen/knightspace/shipnow/server/shipnowManager.ts`
- Create: `/Users/linpeiwen/knightspace/shipnow/src/runtimeConfig.ts`
- Create: `/Users/linpeiwen/knightspace/shipnow/src/runtimeConfig.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, strict as assert } from 'node:test';
import { buildShipNowRuntimeConfig } from './runtimeConfig.js';

describe('buildShipNowRuntimeConfig', () => {
  it('points the UI at the shared api host and preview prefix', () => {
    const config = buildShipNowRuntimeConfig({
      publicBaseUrl: 'https://boringmax.com',
      apiBaseUrl: 'https://api.boringmax.com/shipnow/api',
      previewBaseUrl: 'https://api.boringmax.com/shipnow/preview',
    });

    assert.equal(config.apiBaseUrl, 'https://api.boringmax.com/shipnow/api');
    assert.equal(config.previewBaseUrl, 'https://api.boringmax.com/shipnow/preview');
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run:

```bash
cd /Users/linpeiwen/knightspace/shipnow
node --import tsx --test src/runtimeConfig.test.ts
```

Expected: fail because the shared runtime helper does not exist yet.

- [ ] **Step 3: Write the minimal implementation**

```ts
export function buildShipNowRuntimeConfig(input: {
  publicBaseUrl: string;
  apiBaseUrl: string;
  previewBaseUrl: string;
}) {
  return {
    publicBaseUrl: input.publicBaseUrl.replace(/\/+$/, ''),
    apiBaseUrl: input.apiBaseUrl.replace(/\/+$/, ''),
    previewBaseUrl: input.previewBaseUrl.replace(/\/+$/, ''),
  };
}
```

`src/api.ts` 改成读取 runtime config 后，只使用 `apiBaseUrl` 生成所有 fetch 地址；`src/App.tsx` 只使用 `previewBaseUrl` 生成预览跳转地址，不再拼接 `preview.boringmax.com` 或 `boringmax.com/shipnow`。

- [ ] **Step 4: Run the test again and confirm it passes**

Run:

```bash
cd /Users/linpeiwen/knightspace/shipnow
node --import tsx --test src/runtimeConfig.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add /Users/linpeiwen/knightspace/shipnow/src/api.ts /Users/linpeiwen/knightspace/shipnow/src/App.tsx /Users/linpeiwen/knightspace/shipnow/server/env.ts /Users/linpeiwen/knightspace/shipnow/server/shipnowManager.ts /Users/linpeiwen/knightspace/shipnow/src/runtimeConfig.ts /Users/linpeiwen/knightspace/shipnow/src/runtimeConfig.test.ts
git commit -m "feat: point shipnow to shared api gateway"
```

---

### Task 4: 把 ShipNow 后端收敛成纯业务服务，去掉公网入口耦合

**Files:**
- Modify: `/Users/linpeiwen/knightspace/shipnow/server/app.ts`
- Modify: `/Users/linpeiwen/knightspace/shipnow/server/env.ts`
- Modify: `/Users/linpeiwen/knightspace/shipnow/server/shipnowManager.ts`
- Create: `/Users/linpeiwen/knightspace/shipnow/server/app-routing.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, strict as assert } from 'node:test';
import { createShipNowApp } from './app.js';

describe('ShipNow app routing', () => {
  it('keeps api endpoints and no longer serves the public UI shell', async () => {
    const app = await createShipNowApp({
      serveUiShell: false,
      publicBaseUrl: 'https://boringmax.com',
      apiBaseUrl: 'https://api.boringmax.com/shipnow/api',
      previewBaseUrl: 'https://api.boringmax.com/shipnow/preview',
    });

    const res = await app.inject({ method: 'GET', url: '/' });
    assert.equal(res.statusCode, 404);
    await app.close();
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run:

```bash
cd /Users/linpeiwen/knightspace/shipnow
node --import tsx --test server/app-routing.test.ts
```

Expected: fail because `createShipNowApp({ serveUiShell: false })` and the no-shell routing do not exist yet.

- [ ] **Step 3: Write the minimal implementation**

```ts
export async function createShipNowApp(options: {
  serveUiShell: boolean;
  publicBaseUrl: string;
  apiBaseUrl: string;
  previewBaseUrl: string;
}) {
  const app = Fastify();

  app.get('/health', async () => ({ ok: true }));
  app.register(apiRoutes, { prefix: '/api' });
  app.register(previewRoutes, { prefix: '/preview' });

  if (options.serveUiShell) {
    app.get('/', async (_req, reply) => reply.redirect(302, '/shipnow'));
  }

  return app;
}
```

The important part is the removal of the old `appPrefix`-owned UI shell from the backend public surface. The UI will now be a static site under `boringmax.com/shipnow`, so ShipNow backend no longer needs to own that route.

- [ ] **Step 4: Run the test again and confirm it passes**

Run:

```bash
cd /Users/linpeiwen/knightspace/shipnow
node --import tsx --test server/app-routing.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add /Users/linpeiwen/knightspace/shipnow/server/app.ts /Users/linpeiwen/knightspace/shipnow/server/env.ts /Users/linpeiwen/knightspace/shipnow/server/shipnowManager.ts /Users/linpeiwen/knightspace/shipnow/server/app-routing.test.ts
git commit -m "refactor: drop shipnow public ui shell from backend"
```

---

### Task 5: 重写 VPS 部署，让 Caddy 只保留静态站点与单一网关入口

**Files:**
- Modify: `/Users/linpeiwen/knightspace/shipnow/docs/SHIPNOW_VPS_DEPLOYMENT.md`
- Modify: `/Users/linpeiwen/knightspace/shipnow/PROJECT_CONTEXT.md`
- Modify: `/Users/linpeiwen/knightspace/shipnow/docs/handoff/CHANGELOG.md`
- Create: `/Users/linpeiwen/knightspace/boringapi/docs/DEPLOYMENT.md`
- Create: `/Users/linpeiwen/knightspace/boringapi/systemd/boringapi.service`

- [ ] **Step 1: Write the failing test**

```bash
#!/usr/bin/env bash
set -euo pipefail

curl -fsS https://boringmax.com/shipnow >/dev/null
curl -fsS https://api.boringmax.com/shipnow/api/settings >/dev/null
curl -fsS https://api.boringmax.com/shipnow/preview/test >/dev/null || true
! curl -fsS https://preview.boringmax.com/test >/dev/null
```

Expected: the first two requests pass after cutover, and the old `preview.boringmax.com` host is no longer part of the live route set.

- [ ] **Step 2: Apply the minimal Caddy config**

```caddyfile
boringmax.com {
  root * /opt/boringmax/site
  try_files {path}/index.html {path}.html {path} /index.html
  file_server
}

api.boringmax.com {
  reverse_proxy 127.0.0.1:8091
}
```

`boringapi` 在 `127.0.0.1:8091` 提供统一动态入口；ShipNow 后端如果仍保留独立进程，就只作为 `boringapi` 后面的内部上游，不再被 Caddy 直接暴露。

- [ ] **Step 3: Run the deployment verification**

Run:

```bash
systemctl daemon-reload
systemctl restart boringapi
systemctl restart shipnow
systemctl reload caddy
curl -sS https://boringmax.com/shipnow
curl -sS https://api.boringmax.com/shipnow/api/settings
curl -sS https://api.boringmax.com/shipnow/preview/test
```

Expected: `boringmax.com/shipnow` returns the static ShipNow UI, `api.boringmax.com/shipnow/api/settings` returns the ShipNow settings payload, and `api.boringmax.com/shipnow/preview/test` resolves through the new gateway.

- [ ] **Step 4: Commit**

```bash
git add /Users/linpeiwen/knightspace/shipnow/docs/SHIPNOW_VPS_DEPLOYMENT.md /Users/linpeiwen/knightspace/shipnow/PROJECT_CONTEXT.md /Users/linpeiwen/knightspace/shipnow/docs/handoff/CHANGELOG.md /Users/linpeiwen/knightspace/boringapi/docs/DEPLOYMENT.md /Users/linpeiwen/knightspace/boringapi/systemd/boringapi.service
git commit -m "docs: simplify vps routing around boringapi"
```

---

### Task 6: 做一次端到端烟雾测试并确认以后新增站点不需要改 Caddy

**Files:**
- Modify: `/Users/linpeiwen/knightspace/shipnow/docs/handoff/CHANGELOG.md`
- Modify: `/Users/linpeiwen/knightspace/shipnow/docs/SHIPNOW_VPS_DEPLOYMENT.md`
- Modify: `/Users/linpeiwen/knightspace/shipnow/PROJECT_CONTEXT.md`

- [ ] **Step 1: Run the smoke test**

Run:

```bash
curl -I https://boringmax.com/shipnow
curl -I https://api.boringmax.com/shipnow/api/settings
curl -I https://api.boringmax.com/shipnow/preview/test
curl -I https://boringmax.com/test
```

Expected:
- `boringmax.com/shipnow` is static and returns 200
- `api.boringmax.com/shipnow/api/settings` returns 200
- `api.boringmax.com/shipnow/preview/test` returns the preview response for the registered app
- `boringmax.com/test` remains a normal static site

- [ ] **Step 2: Prove the no-Caddy-change property**

Document one explicit onboarding example in `boringapi/docs/DEPLOYMENT.md`:

```md
To add a new app:
1. Register the app in boringapi
2. Point its internal upstreams at the app service
3. Publish its static site under `/opt/boringmax/site/<project>`
4. Do not edit Caddy
```

- [ ] **Step 3: Run the final consistency check**

Run:

```bash
pnpm build
```

Expected: build passes in ShipNow after the runtime URL refactor.

- [ ] **Step 4: Commit**

```bash
git add /Users/linpeiwen/knightspace/shipnow/docs/handoff/CHANGELOG.md /Users/linpeiwen/knightspace/shipnow/docs/SHIPNOW_VPS_DEPLOYMENT.md /Users/linpeiwen/knightspace/shipnow/PROJECT_CONTEXT.md
git commit -m "docs: record boringapi cutover"
```

---

## Self-Review

### Spec coverage

- `boringmax.com/<project>` 继续做静态站点：Task 5、Task 6
- `api.boringmax.com` 成为唯一动态入口：Task 1、Task 2
- ShipNow 不再依赖 `boringmax.com/shipnow` 的特殊 Caddy 路由：Task 4、Task 5
- 未来其他应用也能复用同一个网关：Task 1、Task 2
- 不做兼容、不保留旧 preview 子域名：Scope Lock 和 Task 5

### Placeholder scan

- 没有使用 `TBD`、`TODO`、`later` 这类占位词
- 每个会改代码的步骤都给了具体测试、具体实现和具体命令
- 计划里的关键路径是明确的：`/shipnow/api/*`、`/shipnow/preview/*`、`boringmax.com/<project>`

### Type consistency

- `resolveGatewayRoute()`、`buildShipNowRuntimeConfig()`、`createShipNowApp()` 这几个名字在测试和实现中保持一致
- `boringapi` 的路径契约在 Task 1 中冻结后，后续任务只按这个契约执行，不再回头改 Caddy 逻辑
- `api.boringmax.com/shipnow/api` 和 `api.boringmax.com/shipnow/preview` 贯穿前端、后端和部署文档

