# infinite-studio

面向海外用户的 AI 图片创作项目，视频能力作为辅助方向。当前已有可在本地运行的架构基础与工作区预览；平台的图片生成和云端服务尚未接通。

“画布项目”集成了 Infinite Canvas 的画布编辑器，项目保存在当前浏览器。画布内的 AI 生成、Agent 和插件功能需要分别配置相应服务或插件。

画布源码基于 [basketikun/infinite-canvas](https://github.com/basketikun/infinite-canvas) 的 `9cd3deacbcc598361807afc16c059a80dd18b6f9`，许可证保留在 `apps/canvas/LICENSE`。

## 本地启动

需要 Node.js 22.12 以上和 pnpm 11。安装依赖后在两个终端分别启动：

```bash
pnpm install
pnpm dev:api
pnpm dev
```

访问 http://127.0.0.1:5173 。不配置 Supabase 也可以查看界面；账号、迁移和服务配置见[开发与运行说明](docs/开发与运行说明.md)。

- [产品定位与范围](docs/产品定位与范围.md)
- [融合架构草案](docs/融合架构草案.md)
- [技术栈与架构方案](docs/技术栈与架构方案.md)
- [开发与运行说明](docs/开发与运行说明.md)
- [参考仓库说明](docs/二次开发基础.md)
- [文档索引](docs/index.md)
