# OpenClaw 本地部署客户说明

这是一份交给客户现场实施人员或 IT 管理员的说明文档。

本文档对应的是：

- 本地部署版本
- 非 Docker 运行包
- 本地授权版

本地版特点：

- 不包含在线支付
- 不包含公有云充值逻辑
- 由客户自己管理大模型 API Key 或 coding plan
- 通过授权文件或续期码控制可用期限

## 一、准备条件

部署机器需要满足：

- Windows、Linux 或 macOS
- 已安装 Node.js `22.12+`
- 机器能监听本地端口：
  - `18789`
  - `18801`

## 二、运行包目录

运行包交付后，目录中通常包含：

- `runtime/`
- `scripts/`
- `data/`
- `runtime.env.example`
- `openclaw.local.example.json5`
- `README-local-runtime.md`
- `README-customer-deploy.md`
- 启动脚本：
  - `start-local-runtime.cmd`
  - `start-local-runtime.sh`
  - `start-gateway.cmd`
  - `start-gateway.sh`
  - `start-tenant-platform.cmd`
  - `start-tenant-platform.sh`

## 三、首次部署步骤

### 1. 复制运行包

将整套运行包目录复制到目标机器，例如：

```text
D:\openclaw-local-runtime
```

### 2. 准备环境变量文件

将：

```text
runtime.env.example
```

复制为：

```text
runtime.env
```

如无特殊要求，可先保留默认值。

### 3. 准备 OpenClaw 配置文件

将：

```text
openclaw.local.example.json5
```

作为模板，整理成本地实际配置文件：

```text
data/.openclaw/openclaw.json
```

这里应填写客户自己的模型接入信息，例如：

- API Key
- provider 配置
- coding plan 配置
- Agent 配置

## 四、准备授权文件

本地版不走在线支付，使用授权文件控制有效期。

需要准备：

- 授权公钥：
  - `data/.openclaw/tenant-platform/license-public.pem`
- 本地授权文件：
  - 平台初始化后由管理员导入
  - 或后续输入续期码完成续期

说明：

- 授权公钥由厂商提供
- 授权文件或续期码由厂商签发
- 客户无法自行生成有效授权

## 五、启动方式

### Windows

直接双击：

```text
start-local-runtime.cmd
```

### Linux / macOS

执行：

```bash
./start-local-runtime.sh
```

## 六、访问地址

启动成功后，浏览器访问：

```text
http://localhost:18789
```

平台管理员入口：

```text
http://localhost:18789/?ocTenantView=platform-login
```

租户入口：

```text
http://localhost:18789/?ocTenantView=tenant-login
```

## 七、授权到期后的系统行为

授权到期后：

- 平台管理员仍可登录
- 租户管理员和成员允许只读查看历史和统计
- 不允许继续发送消息
- 不允许继续进行关键写操作

## 八、续期方式

当前支持两种续期方式：

- 输入续期码
- 导入新的授权文件

建议：

- 日常延期优先使用续期码
- 如合同变更、授权范围变化或大版本更换，优先导入新的授权文件

## 九、重要说明

- 本地版不包含在线支付页面
- 本地版不使用钱包充值逻辑
- 客户自己的模型调用费用由客户自行承担
- 系统只负责：
  - 权限
  - 授权期限
  - 审计
  - 使用统计

## 十、排查建议

如果启动失败，优先检查：

- Node.js 版本是否符合要求
- `runtime.env` 是否存在
- `runtime.env` 中 `OPENCLAW_GATEWAY_BIND` 是否保持为 `lan`、`loopback`、`tailnet`、`auto` 或 `custom`
- `data/.openclaw/openclaw.json` 是否存在且格式正确
- 授权公钥文件是否放在正确位置
- 本机 `18789`、`18801` 端口是否被占用

如果页面可以打开但登录异常，优先检查：

- 授权文件是否有效
- 授权是否已过期
- 模型配置是否正确
