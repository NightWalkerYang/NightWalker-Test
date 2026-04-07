# OpenClaw 本地运行包

这是给**不安装 Docker 的客户机器**准备的本地运行包模板。

目标：
- 客户机器不参与构建
- 客户机器只负责运行
- 本地版只走 **License 授权**
- **不包含在线支付逻辑**

## 运行要求

- Node.js `22.12+`
- 能在本机监听两个端口：
  - `18789`：OpenClaw Gateway
  - `18801`：租户 sidecar

## 打包后目录会包含什么

- `runtime/`
  - 预装好的 OpenClaw npm 运行时
- `scripts/`
  - `start-gateway.mjs`
  - `start-tenant-platform.mjs`
  - `start-local-runtime.mjs`
- `runtime.env.example`
  - 本地运行包环境变量模板
- `openclaw.local.example.json5`
  - OpenClaw 配置示例
- `README-customer-deploy.md`
  - 面向客户现场实施人员的部署说明
- `data/`
  - 运行时数据目录

## 客户机器启动步骤

1. 安装 Node.js `22.12+`
2. 将 `runtime.env.example` 复制为 `runtime.env`
3. 将 `openclaw.local.example.json5` 按需改成客户自己的 `openclaw.json`，放到：
   - `data/.openclaw/openclaw.json`
4. 将授权公钥放到：
   - `data/.openclaw/tenant-platform/license-public.pem`
5. 启动：
   - Windows: `start-local-runtime.cmd`
   - macOS/Linux: `./start-local-runtime.sh`

## 单独启动

- 只启动 Gateway
  - Windows: `start-gateway.cmd`
  - macOS/Linux: `./start-gateway.sh`
- 只启动租户 sidecar
  - Windows: `start-tenant-platform.cmd`
  - macOS/Linux: `./start-tenant-platform.sh`

## 授权机制

- 本地版不走在线支付
- 客户自行管理大模型 API Key / coding plan
- 平台管理员通过：
  - 导入授权文件
  - 输入续期码
来控制有效期
- 到期后保持只读，不允许继续写操作

## 说明

- 运行包启动时会自动：
  - 同步 Gateway token 到 Control UI 预启动脚本
  - 将 `workspace-downloads` 和 `workspace-agent-downloads` 指向本地数据目录
- 因为这是**运行包**，不是源码仓库，交付时只需要打包生成目录，不需要额外交付 Git 历史
