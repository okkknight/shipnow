# ShipNow

ShipNow 是一个自托管的小站创建与发布工作台。用户创建项目、用 Codex 修改页面，然后构建预览并发布静态站点。主应用使用 Vite/React 前端和 Fastify/SQLite 服务端。

在线体验：[ShipNow](https://boringmax.com/shipnow/)。

## 本地开发

需要 Node.js 和 pnpm。

```bash
pnpm install
pnpm dev
```

构建命令为 `pnpm build`。运行产生的 SQLite 数据库、日志和站点发布目录属于本地状态。详细架构见 [项目上下文](PROJECT_CONTEXT.md)，部署说明见 [VPS 文档](docs/SHIPNOW_VPS_DEPLOYMENT.md)。

## 许可

ShipNow 主应用代码采用 [MIT 许可证](LICENSE)。`workspace/project/` 下的站点源码是由工作台管理的独立项目，不自动获得 ShipNow 主应用的 MIT 授权；使用这些站点前请确认各自的权利和许可。第三方依赖遵循各自的许可证。
