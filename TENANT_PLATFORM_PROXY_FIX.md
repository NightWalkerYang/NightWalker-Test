# 租户平台 API 代理修复文档

## 当前结论

当前本地 Docker 问题不是 tenant sidecar 没启动，而是浏览器访问链路不对：

1. Control UI 运行在 `127.0.0.1:18789`
2. tenant sidecar 运行在 `127.0.0.1:18801`
3. 前端先尝试跨端口请求 `18801`
4. gateway 返回的 CSP 只允许 `connect-src 'self' ws: wss:`
5. 浏览器因此拦截跨端口请求
6. 前端再回退到同源 `/tenant-platform-api/v1`
7. 但 gateway 本身没有这个代理路由，于是返回 Control UI HTML，前端最终显示 `HTTP 200`

## 零侵入修复方案

由于当前约束是不改 OpenClaw 源码，所以不再采用“修改 `src/gateway/*`”的旧方案。

改为在 Docker 部署层加入一个同源前置代理：

- 浏览器仍然访问 `127.0.0.1:18789`
- 新增 `openclaw-gateway-proxy` 容器占用宿主机 `18789`
- 代理把 `/tenant-platform-api/` 转发到 `openclaw-tenant-platform:18801`
- 其它 HTTP 请求和 WebSocket 升级流量都转发到 `openclaw-gateway:18789`
- `openclaw-gateway` 不再直接暴露宿主机 `18789`，只继续暴露 bridge 端口 `18790`

这样有两个直接效果：

1. 租户 API 从浏览器视角变成同源访问，不再依赖跨端口直连 `18801`
2. 不需要修改 gateway 源码，也不需要改 gateway 的 CSP 头

## 代理接入后的本地配对问题

前置代理接入后，本地浏览器虽然仍然访问 `127.0.0.1:18789`，但 gateway 侧看到的上游连接已经不是原来的“浏览器直连 loopback”形态，因此原生 Control UI 的本地自动配对不再稳定命中，页面会先落到：

- `pairing required`

对于当前本地 Docker 的 proxy-fronted 部署链路，零侵入部署脚本已经额外同步：

- `gateway.controlUi.allowedOrigins=["http://127.0.0.1:18789","http://localhost:18789"]`
- `gateway.controlUi.dangerouslyAllowHostHeaderOriginFallback=false`
- `gateway.controlUi.dangerouslyDisableDeviceAuth=true`

前两项是为了让 proxy-fronted 的本地 Control UI 使用显式 Origin allowlist 稳定通过 WebSocket 握手，而不是继续依赖脆弱的 Host-header fallback。

最后一项不是为了 tenant API，而是为了让 proxy-fronted 的本地 Control UI 不再卡在配对页；否则 tenant 登录视图还没接管前，用户就会先被原生配对门挡住。

## 实际落地文件

- `tools/openclaw-control-ui-echarts/docker-local-proxy/nginx.conf`
- `tools/openclaw-control-ui-echarts/setup-direct-docker-compose-up.mjs`
- `tools/openclaw-control-ui-echarts/setup-direct-docker-compose-up.sh`
- `docker-compose.override.yml`（运行时生成）
- `C:\Users\ASUS\.openclaw\openclaw.json`（运行时由部署脚本同步）

## 验证标准

修复后应该满足：

1. `http://127.0.0.1:18801/tenant-platform-api/v1/bootstrap` 直接访问返回 JSON
2. `http://127.0.0.1:18789/tenant-platform-api/v1/bootstrap` 也返回同样的 JSON，而不是 Control UI HTML
3. `http://127.0.0.1:18789/chat?ocTenantView=login&session=agent%3Amain%3Amain` 能正常进入租户登录页
4. 登录页不再显示“租户平台 API 暂不可用: HTTP 200”
5. 通过 `ws://127.0.0.1:18789` 发起的 Control UI 握手不再返回 `gateway token mismatch`、`pairing required` 或 `origin not allowed`，而是正常返回 `hello-ok`

## 说明

浏览器控制台里如果仍残留对 `18801` 的旧探测报错，那是前端候选基址顺序带来的噪声，不再会阻断实际登录流程；只要同源 `/tenant-platform-api/v1/*` 已经返回 JSON，页面功能就是正常的。
