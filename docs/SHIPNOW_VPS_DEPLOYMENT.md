# ShipNow VPS 部署说明

这份说明记录 ShipNow 在本机开发环境和 VPS 生产环境的不同部署结构，重点是把“子站运行资产”与“ShipNow 编排程序”分开，避免以后只剩 ShipNow 目录时子站跟着失效。

## 目标

- ShipNow 负责索引项目、发起生成、发布预览和正式站
- 项目的源码、预览产物、正式产物、日志和数据库都落在 `boringmax/site/.shipnow`
- 对外可访问的子站落在 `boringmax/site/<projectName>`
- 就算未来 `shipnow` 目录删除，已经发布的子站仍然可以继续运行

## VPS 目录约定

### ShipNow 应用本体

- 代码目录: `/opt/boringmax/shipnow`
- systemd 服务: `shipnow.service`
- 监听端口: `127.0.0.1:8090`

### 站点根目录

- 公共站点根目录: `/opt/boringmax/site`
- 子站正式入口: `/opt/boringmax/site/<projectName>`
- 预览静态根目录: `/opt/boringmax/site/.shipnow/preview`

### ShipNow 私有数据

- 私有数据根目录: `/opt/boringmax/site/.shipnow`
- 项目源码: `/opt/boringmax/site/.shipnow/projects/<projectName>/source`
- 预览 release: `/opt/boringmax/site/.shipnow/releases/preview/<projectName>/<releaseId>`
- 正式 release: `/opt/boringmax/site/.shipnow/releases/public/<projectName>/<releaseId>`
- 任务日志: `/opt/boringmax/site/.shipnow/logs/<projectName>.log`
- 数据库: `/opt/boringmax/site/.shipnow/shipnow.sqlite`

## systemd 配置

VPS 上的 `shipnow.service` 需要显式指定这些环境变量：

```ini
WorkingDirectory=/opt/boringmax/shipnow
Environment=NODE_ENV=production
Environment=SHIPNOW_PORT=8090
Environment=SHIPNOW_PUBLIC_BASE_URL=https://boringmax.com
Environment=SHIPNOW_PREVIEW_BASE_URL=https://preview.boringmax.com
Environment=SHIPNOW_API_BASE_URL=https://shipnow.boringmax.com/api
Environment=SHIPNOW_APP_PREFIX=/shipnow
Environment=SHIPNOW_WORKSPACE_ROOT=/opt/boringmax/site/.shipnow
Environment=SHIPNOW_TEMPLATE_ROOT=/opt/boringmax/shipnow/templates
Environment=SHIPNOW_PREVIEW_STATIC_ROOT=/opt/boringmax/site/.shipnow/preview
Environment=SHIPNOW_PUBLIC_STATIC_ROOT=/opt/boringmax/site
Environment=SHIPNOW_DB_PATH=/opt/boringmax/site/.shipnow/shipnow.sqlite
Environment=SHIPNOW_CODEX_BIN=/usr/bin/codex
ExecStart=/usr/bin/node /opt/boringmax/shipnow/dist/server/index.js
```

说明:

- `SHIPNOW_WORKSPACE_ROOT` 现在只作为私有工作区的根目录，建议直接放到 `/opt/boringmax/site/.shipnow`
- `SHIPNOW_PUBLIC_STATIC_ROOT` 指向 `/opt/boringmax/site`
- `SHIPNOW_PREVIEW_STATIC_ROOT` 指向 `/opt/boringmax/site/.shipnow/preview`
- `SHIPNOW_DB_PATH` 也放在 `.shipnow` 目录下，方便整体迁移和备份

## Caddy 配置

VPS 上的公开路由建议如下:

- `boringmax.com`:
  - `root * /opt/boringmax/site`
  - `try_files {path}/index.html {path}.html {path} /index.html`
  - `file_server`
- `boringmax.com/shipnow`:
  - 反向代理到 `127.0.0.1:8090`
- `preview.boringmax.com`:
  - `root * /opt/boringmax/site/.shipnow/preview`
  - `try_files {path}/index.html {path}.html {path} /index.html`
  - `file_server`
- `shipnow.boringmax.com/api`:
  - 反向代理到 `127.0.0.1:8090`

关键点:

- `boringmax.com/<projectName>` 是正式站入口，应该始终指向 `/opt/boringmax/site/<projectName>`
- 正式站本身不依赖 ShipNow 进程继续存在
- 预览页依赖的是 `.shipnow/preview` 静态目录，不依赖 ShipNow 进程实时渲染

## 发布链路

1. ShipNow 在 `.shipnow/projects/<projectName>/source` 中维护源码
2. Codex 修改源码并在同一源码目录里执行 `pnpm build`
3. 构建产物复制到 `.shipnow/releases/preview/<projectName>/<releaseId>`
4. 预览入口 symlink 指向 `.shipnow/preview/<projectName>`
5. 点击 Publish 时，最新 preview release 被复制到 `.shipnow/releases/public/<projectName>/<releaseId>`
6. 正式站入口 symlink 指向 `/opt/boringmax/site/<projectName>`

## 迁移提醒

如果以后重装 ShipNow 或搬迁 VPS，只要保住这几个目录，子站就还能继续跑:

- `/opt/boringmax/site`
- `/opt/boringmax/site/.shipnow`

ShipNow 重新启动后，会继续索引 `.shipnow` 里的历史项目。

## 验证命令

```bash
systemctl status shipnow
curl -I https://boringmax.com/test
curl -I https://preview.boringmax.com/test
ls -la /opt/boringmax/site
ls -la /opt/boringmax/site/.shipnow
```

