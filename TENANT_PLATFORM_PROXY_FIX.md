# 租户平台 API 代理修复文档

## 问题描述

本地 Docker 部署的 open-claw 项目无法访问租户平台，浏览器显示两个错误：

**错误 1（初始）：**
```
租户平台 API 暂不可用：Failed to fetch
```

**错误 2（修复代理后）：**
```
浏览器租户平台桥接未就绪，无法访问本地租户 API。
```

## 根本原因

两个独立问题共同导致了租户平台无法访问：

### 问题 1：网关缺少 API 代理路由

网关（openclaw-gateway）缺少 HTTP 代理配置，无法将前端的 `/tenant-platform-api/v1` 请求转发到租户平台服务（openclaw-tenant-platform:18801）。

### 问题 2：CSP 阻止 Service Worker 连接

前端使用 Service Worker（`tenant-platform-proxy-sw.js`）作为桥接，拦截 `/tenant-platform-api/v1` 请求并转发到 `localhost:18801`。但网关的 CSP 头 `connect-src 'self' ws: wss:` 只允许同源连接，阻止了 Service Worker 连接到不同端口（18801）。

## 解决方案

两个修复对应两个问题：

**修复 1**：在网关中添加 HTTP 代理处理器，将 `/tenant-platform-api/` 请求转发到 `openclaw-tenant-platform:18801`。

**修复 2**：在 CSP 头的 `connect-src` 中添加 `http://localhost:18801` 和 `http://127.0.0.1:18801`，允许 Service Worker 连接到租户平台服务。

## 修改的文件

### 1. 新增文件：`src/gateway/tenant-platform-proxy.ts`

**位置**：`src/gateway/tenant-platform-proxy.ts`

**作用**：实现租户平台 API 的 HTTP 代理功能

**代码**：
```typescript
import type { IncomingMessage, ServerResponse } from "node:http";
import { request as httpRequest } from "node:http";

const TENANT_PLATFORM_API_PREFIX = "/tenant-platform-api/";

export function handleTenantPlatformProxyRequest(
  req: IncomingMessage,
  res: ServerResponse,
  targetHost: string,
  targetPort: number,
): boolean {
  const url = req.url;
  if (!url || !url.startsWith(TENANT_PLATFORM_API_PREFIX)) {
    return false;
  }

  const proxyReq = httpRequest(
    {
      hostname: targetHost,
      port: targetPort,
      path: url,
      method: req.method,
      headers: {
        ...req.headers,
        host: `${targetHost}:${targetPort}`,
      },
    },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode ?? 500, proxyRes.headers);
      proxyRes.pipe(res);
    },
  );

  proxyReq.on("error", (err) => {
    if (!res.headersSent) {
      res.writeHead(502, { "Content-Type": "text/plain; charset=utf-8" });
      res.end(`Bad Gateway: ${String(err)}`);
    }
  });

  req.pipe(proxyReq);
  return true;
}
```

**功能说明**：
- 检查请求路径是否以 `/tenant-platform-api/` 开头
- 如果匹配，创建到租户平台服务的 HTTP 代理请求
- 将请求体和响应体通过管道传输
- 处理代理错误，返回 502 Bad Gateway

### 2. 修改文件：`src/gateway/server-http.ts`

**位置**：`src/gateway/server-http.ts`

**修改 1：添加导入**

在文件顶部添加：
```typescript
import { handleTenantPlatformProxyRequest } from "./tenant-platform-proxy.js";
```

**位置**：第 81 行之后

**修改 2：注册代理处理器**

在 `requestStages` 数组中添加租户平台代理阶段：

**原代码**（约第 902-906 行）：
```typescript
        {
          name: "slack",
          run: () => handleSlackHttpRequest(req, res),
        },
      ];
```

**修改后**：
```typescript
        {
          name: "slack",
          run: () => handleSlackHttpRequest(req, res),
        },
        {
          name: "tenant-platform-proxy",
          run: () =>
            handleTenantPlatformProxyRequest(
              req,
              res,
              "openclaw-tenant-platform",
              18801,
            ),
        },
      ];
```

**位置**：约第 902-906 行

**功能说明**：
- 在请求处理流程中添加租户平台代理阶段
- 代理目标：`openclaw-tenant-platform:18801`
- 处理顺序：在 Slack 处理器之后，插件路由之前

### 3. 修改文件：`src/gateway/control-ui-csp.ts`

**位置**：`src/gateway/control-ui-csp.ts`

**修改**：在 `connect-src` 中添加租户平台地址

**原代码**：
```typescript
"connect-src 'self' ws: wss:",
```

**修改后**：
```typescript
"connect-src 'self' ws: wss: http://localhost:18801 http://127.0.0.1:18801",
```

**原因**：Service Worker 在浏览器中运行，需要连接到 `localhost:18801`（租户平台服务），但原 CSP 的 `connect-src 'self'` 只允许同源连接，阻止了跨端口请求。

## 部署步骤

### 1. 编译代码

```bash
node scripts/tsdown-build.mjs
```

### 2. 更新 Docker 容器

**方法 A：复制编译后的代码到容器**
```bash
docker cp dist/. open-claw-openclaw-gateway-1:/app/dist/
docker compose restart openclaw-gateway
```

**方法 B：重新构建镜像（推荐）**
```bash
# 重新构建镜像
docker build -t openclaw:local .

# 重启容器
docker compose down
docker compose up -d
```

### 3. 验证修复

```bash
# 测试代理是否工作
curl http://localhost:18789/tenant-platform-api/v1/bootstrap

# 预期输出：JSON 响应
# {"ok":true,"data":{"initialized":false,...}}
```

## 验证结果

修复后，访问 `http://localhost:18789/tenant-platform-api/v1/bootstrap` 返回正确的 JSON 响应：

```json
{
  "ok": true,
  "data": {
    "initialized": false,
    "platformAdminCount": 0,
    "localTenantAdminCount": 0,
    "apiBasePath": "/tenant-platform-api/v1",
    "edition": "cloud",
    "localLicense": {
      "edition": "cloud",
      "status": "disabled",
      "valid": false,
      "readonly": false,
      "customerName": null,
      "licenseId": null,
      "expiresAt": null,
      "remainingDays": null,
      "sourcePath": null,
      "reason": null
    },
    "configAgents": [
      {
        "id": "main",
        "name": "main",
        "emoji": null,
        "avatar": null
      }
    ]
  }
}
```

## 技术细节

### 请求处理流程

网关的 HTTP 请求按以下顺序处理：

1. Slack 处理器
2. OpenResponses API（如果启用）
3. OpenAI API（如果启用）
4. Canvas（如果启用）
5. **租户平台代理**（新增）← 在这里处理
6. 插件路由
7. Control UI（SPA catch-all）

### 为什么在这个位置

- **在插件路由之前**：确保租户平台 API 优先处理
- **在 Control UI 之前**：避免被 SPA catch-all 捕获
- **在核心 API 之后**：保持核心功能的优先级

### Docker 网络

容器间通过 Docker 内部网络通信：
- 网关容器：`open-claw-openclaw-gateway-1`
- 租户平台容器：`open-claw-openclaw-tenant-platform-1`
- 服务名：`openclaw-tenant-platform`（Docker Compose 自动 DNS）
- 端口：`18801`

## 注意事项

1. **代码编译**：修改 TypeScript 代码后必须重新编译
2. **容器更新**：编译后需要更新容器中的代码
3. **持久化**：如果重新构建镜像，修改会永久保留
4. **端口配置**：代理目标硬编码为 `openclaw-tenant-platform:18801`

## 相关文件

- `src/gateway/tenant-platform-proxy.ts` - 代理实现
- `src/gateway/server-http.ts` - 网关 HTTP 请求处理
- `docker-compose.yml` - Docker 服务配置
- `tools/openclaw-control-ui-echarts/runtime/tenant/tenant-context.js` - 前端 API 客户端

## 修复日期

2026-04-18

## 修复人员
