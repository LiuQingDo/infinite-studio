# infinite-studio

Infinite Studio 正在调整为中文优先、可自行部署的开源 AI 图片创作工作台。自由提示词、模板和画布服务于图片创作，视频能力后续评估。目标是把项目数据保存在部署机器上，并支持备份和迁移。

**当前仍是开发预览，尚未实现统一的部署机数据存储、生产部署与备份恢复，也尚未选定本项目的根许可证。** 创作记录、参考图、收藏和画布项目主要保存在浏览器，清除站点数据可能丢失。

“画布项目”集成了 Infinite Canvas 的画布编辑器。图片生成需要自行配置模型服务；提示词库、更新检查或插件等功能可能访问外部服务。外部模型请求会发送必要的提示词和参考图。旧 Supabase/Cloudflare 基础代码仍在，计划逐步替换。

画布源码基于 [basketikun/infinite-canvas](https://github.com/basketikun/infinite-canvas) 的 `9cd3deacbcc598361807afc16c059a80dd18b6f9`，许可证保留在 `apps/canvas/LICENSE`。

## 本地启动

需要 Node.js 22.12 以上和 pnpm 11。安装依赖后在两个终端分别启动：

```bash
pnpm install
pnpm dev:api
pnpm dev
```

访问 http://127.0.0.1:5173 。这是开发预览：图片接口依赖 Vite 开发服务，不应直接暴露到公网。详情见[开发与运行说明](docs/开发与运行说明.md)。

- [开源自部署目标与迁移路线](docs/开源自部署目标与迁移路线.md)
- [产品定位与范围](docs/产品定位与范围.md)
- [融合架构草案](docs/融合架构草案.md)
- [技术栈与架构方案](docs/技术栈与架构方案.md)
- [开发与运行说明](docs/开发与运行说明.md)
- [参考仓库说明](docs/二次开发基础.md)
- [文档索引](docs/index.md)
