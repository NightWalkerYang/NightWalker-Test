# 零侵入租户部署与运维约束

这份文档只回答部署与运维层规则：

- 本机到服务器的固定工作流
- direct-docker 路径必须遵守的约束
- proxy、origin、token、镜像、vendor、容器重建规则

## 固定工作流

零侵入租户项目固定遵守：

1. 本机修改和测试
2. 推 Gitee
3. `10.20.30.31` 拉取验证
4. 按既定部署脚本部署

明确禁止：

- 直接上服务器修改仓库文件
- 在服务器上临时新增文件夹后手工塞实现
- 把“服务器上热修好了”当成最终状态

测试例外：

- 可以在服务器做验证性命令
- 可以看容器、日志、网络和部署结果
- 但最终实现仍必须回到本机仓库产物

## 敏感信息约束

服务器连接信息、密码、支付密钥、授权文件、公私钥等敏感内容：

- 不写入仓库文档
- 不写入 project skill
- 不写入 prompt 模板

仓库中只保留占位说明，真实值由运营或操作者外部提供。

## direct-docker 中心入口

Docker 侧部署流程以：

- `tools/openclaw-control-ui-echarts/setup-direct-docker-compose-up.sh`

为准。

零侵入页面、运行时脚本、sidecar、proxy 相关能力默认都要经过这条路径。

## 构建链中心化

shell 部署路径里的 Control UI 产物构建，必须复用：

- `tools/openclaw-control-ui-echarts/build-custom-control-ui.mjs`

不能再各自复制一套 HTML 注入步骤。

否则容易发生：

- `tenant/preboot.js` 注入漂移
- `auto-token-preboot.js` 注入漂移
- 公共路由 preboot 漂移
- 统一登录壳不挂载
- 成员路由预处理失效
- 线上 HTML 与本地测试产物不一致

## 零侵入 runtime 资源指纹规则

当前零侵入构建链默认把 runtime 产物写到内容指纹目录，而不是固定路径：

- `assets/openclaw-echarts/<fingerprint>/openclaw-echarts-renderer.js`
- `assets/openclaw-echarts/<fingerprint>/runtime/**`
- `assets/openclaw-echarts/<fingerprint>/vendor/**`

并且 `index.html` 与 `/echarts-view/index.html` 都会注入同一指纹根。

这样做的直接目的：

- 在 Control UI Service Worker 对 `/assets/` 的 cache-first 策略下，避免固定路径长期命中旧零侵入 runtime。
- 每次 runtime 内容变化都会得到新的路径，从而让浏览器取到新版本代码。

兼容性约束：

- 仍保留 `assets/vendor/echarts.min.js`、`assets/vendor/json5.min.js` 与 `assets/runtime/echarts/*.js` 给旧 bundle/旧缓存路径兜底。
- 新部署链路的零侵入入口必须以指纹路径为主，不应继续依赖固定 `assets/openclaw-echarts-renderer.js` 或固定 `assets/runtime/**`。

## gateway 镜像重建规则

在 direct-docker 路径里，读取宿主机 `dist/control-ui` 或复用 `openclaw:local` 镜像里的 `/app/dist/control-ui` 之前，必须先基于当前仓库 checkout 执行：

- `docker compose build openclaw-gateway`

原因：

- 如果服务器仓库代码已经同步，但部署继续复用旧 `openclaw:local`
- 页面左下角 `版本` 仍会显示旧版
- 零侵入覆盖层也可能继续从旧镜像抽取旧的原生 Control UI 产物

唯一例外：

- 镜像已经由其他机器预构建并导入当前服务器
- 这时可以显式设置 `OPENCLAW_SKIP_GATEWAY_IMAGE_BUILD=1`
- 但前提仍然是服务器当前 `openclaw:local` 已确认对应本次仓库版本

## token 注入规则

`tools/openclaw-control-ui-echarts/generated/control-ui/index.html` 会通过零侵入 auto-token bootstrap 嵌入：

- `OPENCLAW_GATEWAY_TOKEN`

因此跨机器部署时：

- 不能直接复用另一台机器已经构建好的 `generated/control-ui/`
- 必须在目标机器上用该机器当前容器/配置里的 token 重新生成
- 或至少在目标机器上定向重写嵌入 token

否则浏览器会回落到原生连接门，并报：

- `unauthorized: gateway token mismatch`

## vendor 目录同步规则

部署路径产出的：

- `generated/control-ui/assets/vendor/`

必须同步零侵入层完整 vendor 目录，而不是只同步 userscript 内嵌的少量库。

否则 AI 生成大屏一旦引用下面这些库，就会在正式环境直接 `404`：

- `ECharts-GL`
- `GSAP`
- `tsParticles`
- `PixiJS`
- `Babylon.js`
- `Three.js`

## proxy-fronted 本地 Docker 规则

本地 Docker 部署必须通过部署层追加同源反向代理容器。

当前要求：

- 浏览器暴露的 `18789` 不再直接映射原始 gateway
- 代理层把 `/tenant-platform-api/` 转发到 tenant sidecar
- 其它 HTTP/WebSocket 再转发回 gateway

目的：

- 避免修改 gateway 源码
- 避开浏览器对 `18801` 跨端口请求的 CSP 限制

## 同源 API 与本地脏值恢复

浏览器侧租户 runtime 默认只能走同源 `/tenant-platform-api/v1`。

如果旧版浏览器本地状态里已经持久化过跨端口覆盖值：

- `openclaw:tenant-platform:api-base:v1=http://<host>:18801/tenant-platform-api/v1`

新的零侵入 runtime 必须在读取时自动清掉。

## 容器重建规则

生成完 `docker-compose.override.yml` 后，默认还必须执行一次定向：

- `docker compose up -d --force-recreate openclaw-gateway openclaw-tenant-platform openclaw-gateway-proxy`

否则浏览器即使拿到了最新 HTML：

- gateway 可能仍跑在旧容器配置
- proxy 可能仍跑在旧容器配置
- 最终重写脚本资源或 sidecar API 仍可能继续 `404`

## Origin 与配对相关规则

同一条部署路径还必须同步：

- `gateway.controlUi.allowedOrigins`
  - 至少覆盖 `http://127.0.0.1:${OPENCLAW_GATEWAY_PORT}`
  - 至少覆盖 `http://localhost:${OPENCLAW_GATEWAY_PORT}`
- `gateway.controlUi.dangerouslyAllowHostHeaderOriginFallback=false`

原因：

- 前置代理会让 Host-header fallback 在端口处理上变脆弱
- 显式 Origin allowlist 才是稳定路径

本地 Docker 的 proxy-fronted 部署还必须同步：

- `gateway.controlUi.dangerouslyDisableDeviceAuth=true`

原因：

- 浏览器现在经由前置代理进入 gateway
- 本地 loopback 自动配对不再稳定命中
- 否则用户会先卡在原生 `pairing required`

## non-Docker 本地运行包

当前零侵入链路还支持把本地版打包成可运行目录，主入口是：

- `tools/openclaw-control-ui-echarts/package-local-runtime.mjs`

当前运行包定位：

- 不允许 Docker 的客户机器
- 只需要运行、不参与构建的客户环境

运行包主要负责：

- tenant sidecar
- 零侵入 Control UI
- 本地授权模板
- runtime.env 与 portable config 基线

## 部署问题排查时先看哪里

遇到这些问题时，优先回到本文件：

- 为什么页面还是旧版
- 为什么 sidecar API 走成跨端口
- 为什么登录后还掉到原生 pairing
- 为什么容器重建后资源仍 404
- 为什么目标机器不能直接复用别处生成好的 Control UI 成品
