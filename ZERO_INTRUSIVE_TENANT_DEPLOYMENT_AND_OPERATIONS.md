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
- `knowledge-graph.html` 这类静态零侵入页也必须在构建阶段重写到当前指纹 runtime 根；源文件可以保留开发期相对路径，但部署产物不能继续指向固定 `assets/runtime/knowledge-graph/*`。

## 构建产物 manifest 与 smoke gate

当前 Control UI 零侵入构建产物必须同时输出：

- `openclaw-control-ui-build-manifest.json`

它不是可选附件，而是后续部署判断和本地运行预检的契约输入。当前至少承担：

- 记录本轮 upstream Control UI 指纹与零侵入 runtime 指纹
- 区分这次变更是 upstream 变化还是 zero-intrusive-only 变化
- 让部署层知道是否需要先重建 gateway image

构建阶段还必须对关键注入点做 fail-fast smoke：

- `index.html` 主 bundle 存在且零侵入 preboot 标记位只出现一次
- `tenant preboot`、`auto-token preboot`、`lufeng preboot`、`echarts-view preboot` 都在主 bundle 前注入
- `login/index.html`、`login.html`、`/echarts-view/index.html` 这些入口别名存在
- auto-token 与 lufeng bootstrap 已嵌入当前机器 token
- `knowledge-graph.html` 已重写到当前指纹 runtime/vendor 路径

如果这些 smoke 失败，构建必须直接报错，不能继续把缺注入或旧路径产物当成“可部署”结果。

## gateway 镜像重建规则

在 direct-docker 路径里，是否需要重建 `openclaw-gateway` image，必须按下面规则判断：

- 如果宿主机 `dist/control-ui/index.html` 存在，且 `dist/.buildstamp` 里的 `head` 与当前仓库 `git HEAD` 一致：
  - 可以直接把它当作当前 checkout 的 upstream Control UI 来源
  - 这时允许跳过 `docker compose build openclaw-gateway`
- 只要宿主机 `dist/control-ui` 缺失，或 `dist/.buildstamp` 缺失，或 buildstamp 里的 `head` 与当前 `git HEAD` 不一致：
  - 就不能再信任宿主机 `dist/control-ui`
  - 必须先执行 `docker compose build openclaw-gateway`
  - 然后再从当前 image 提取 `/app/dist/control-ui`

原因：

- 服务器上残留的 `dist/control-ui` 不受 `git pull` 自动刷新保护
- 如果它不是当前 checkout 构建出来的产物，部署会把旧 upstream UI 当成新版本继续覆盖
- 这会同时带来页面 `版本` 漂移和零侵入入口注入漂移

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

shell 的 docker fallback 还必须同时把目标机当前 token/config 来源带进 builder 容器：

- 优先透传 `OPENCLAW_GATEWAY_TOKEN`
- 同时把目标机 `OPENCLAW_CONFIG_DIR` 只读挂到容器内，并传给 builder

原因：

- builder 现在会对 token 注入做 hard-fail smoke
- 某些服务器并不会把 token 写进 repo `.env`
- 如果 fallback 不透传宿主 env/config，builder 会因为拿不到目标机 token 而直接失败

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

## 本地运行包 preflight 规则

当前本地运行包在启动 gateway 或一键本地 runtime 前，必须先校验 Control UI 产物是否仍与当前零侵入契约一致。

preflight 至少要拦住这些情况：

- `openclaw-control-ui-build-manifest.json` 缺失或字段损坏
- `index.html` 缺少关键 bootstrap marker
- marker 指向的 runtime 脚本、renderer、login 别名页、`/echarts-view/index.html` 缺失
- 构建 manifest 缺失关键路径字段，导致 preflight 无法确认当前 Control UI 产物结构

只有紧急排障时才允许通过：

- `OPENCLAW_SKIP_CONTROL_UI_PREFLIGHT=1`

绕过 preflight。

这不是常规部署选项；如果需要长期依赖这个开关，说明本地运行包或构建链已经与真实零侵入契约漂移。

## 部署问题排查时先看哪里

遇到这些问题时，优先回到本文件：

- 为什么页面还是旧版
- 为什么 sidecar API 走成跨端口
- 为什么登录后还掉到原生 pairing
- 为什么容器重建后资源仍 404
- 为什么目标机器不能直接复用别处生成好的 Control UI 成品
