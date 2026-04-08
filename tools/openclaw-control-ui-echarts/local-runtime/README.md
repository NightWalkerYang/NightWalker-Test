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
  - 已补齐本地运行包所需的额外运行时依赖
  - 已补齐 `file-type/core.js` 兼容入口
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
2. 运行包默认已经附带：
   - `runtime.env`
   - `data/.openclaw/openclaw.json`
   - 默认 `runtime.env` 使用 `OPENCLAW_GATEWAY_BIND=loopback`，本机开箱即可访问
3. 如需调整，再修改：
   - `runtime.env`
   - `data/.openclaw/openclaw.json`
4. 将 `openclaw.local.example.json5` 按需改成客户自己的 `openclaw.json`，放到：
   - `data/.openclaw/openclaw.json`
5. 将授权公钥放到：
   - `data/.openclaw/tenant-platform/license-public.pem`
6. 启动：
   - Windows: `start-local-runtime.cmd`
   - macOS/Linux: `./start-local-runtime.sh`

最小填写建议：

- `runtime.env`
  - 至少确认 `OPENCLAW_GATEWAY_TOKEN`
  - 再填写一种实际会用到的模型凭证，例如：
    - `OPENAI_API_KEY`
    - `OPENROUTER_API_KEY`
    - `VOLCENGINE_API_KEY`
  - 如果客户需要让局域网其他浏览器访问，再把 `OPENCLAW_GATEWAY_BIND` 改成 `lan`，并同步配置 Control UI origin 放行
- `data/.openclaw/openclaw.json`
  - 至少确认 `agents.defaults.model.primary`
  - 让它和你上面实际提供的模型提供商一致

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
- 本地版不再要求平台管理员
- 本地版只有：
  - 租户管理员
  - 租户成员
- 租户管理员通过：
  - 导入授权文件
  - 输入续期码
来控制有效期
- 到期后保持只读，不允许继续写操作

## 说明

- 运行包启动时会自动：
  - 同步 Gateway token 到 Control UI 预启动脚本
  - 将 `workspace-downloads` 和 `workspace-agent-downloads` 指向本地数据目录
- 因为这是**运行包**，不是源码仓库，交付时只需要打包生成目录，不需要额外交付 Git 历史
