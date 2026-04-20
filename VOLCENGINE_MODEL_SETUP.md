# 火山引擎模型配置修复记录

## 问题描述

租户 Agent 回复失败，出现以下两个错误：

```
⚠ 代理回复失败：未知型号：volcengine/ark-code-latest
⚠ 代理回复失败：未找到'anthropic'提供者的API密钥
   认证存储：/home/node/.openclaw/agents/tenant-tenant-c28fb-main-cd7977c0e256/agent/auth-profiles.json
```

## 根本原因

### 错误 1：模型名称错误
`volcengine/ark-code-latest` 是无效的模型引用。

火山引擎有两个 provider：
- `volcengine` — 通用对话模型（豆包系列），base URL: `https://ark.cn-beijing.volces.com/api/v3`
- `volcengine-plan` — **编程专用模型**，base URL: `https://ark.cn-beijing.volces.com/api/coding/v3`

`ark-code-latest` 属于编程专用 provider，正确引用格式为 **`volcengine-plan/ark-code-latest`**。

### 错误 2：未配置认证
主 Agent（`~/.openclaw/agents/main/agent/auth-profiles.json`）没有火山引擎的 API key。

租户 Agent 在无自身认证时会从主 Agent 继承（`store.ts` 继承逻辑），但主 Agent 也没有配置，导致回退到 `anthropic` 并因缺少密钥报错。

## 修复步骤

### 步骤 1：写入主 Agent 的认证文件

直接创建 `~/.openclaw/agents/main/agent/auth-profiles.json`：

```json
{
  "version": 1,
  "profiles": {
    "volcengine:default": {
      "type": "api_key",
      "provider": "volcengine",
      "apiKey": "<VOLCANO_ENGINE_API_KEY>"
    }
  }
}
```

> 在 Windows 宿主机上，配置目录挂载自 `C:/Users/JM/.openclaw`，对应容器内 `/home/node/.openclaw`。

### 步骤 2：通过 CLI 设置默认模型

```bash
docker compose run --rm openclaw-cli models set volcengine-plan/ark-code-latest
```

输出示例：
```
Updated ~/.openclaw/openclaw.json
Default model: volcengine-plan/ark-code-latest
```

### 步骤 3：验证配置

```bash
docker compose run --rm openclaw-cli models status
```

预期输出关键字段：
```
Default       : volcengine-plan/ark-code-latest
- volcengine  profiles=1 (api_key=1) | volcengine:default=7247db83...
- volcengine-plan  profiles=1 (api_key=1) | volcengine:default=7247db83...
```

## 配置后效果

- 主 Agent 使用 `volcengine-plan/ark-code-latest`
- 租户 Agent（`tenant-tenant-c28fb-main-cd7977c0e256`）无自身 auth 时，自动从主 Agent 继承 `volcengine:default` 认证
- 不再回退到 anthropic，两个错误均消除

## 相关文件

| 文件 | 说明 |
|------|------|
| `~/.openclaw/openclaw.json` | 全局配置，存储默认模型 |
| `~/.openclaw/agents/main/agent/auth-profiles.json` | 主 Agent 认证存储 |
| `src/agents/doubao-models.ts` | 火山引擎模型目录定义 |
| `src/agents/auth-profiles/store.ts:496` | 租户 Agent 继承主 Agent 认证的逻辑 |

## 可用的火山引擎模型（volcengine-plan provider）

| 模型 ID | 名称 |
|---------|------|
| `ark-code-latest` | Ark Coding Plan（默认） |
| `doubao-seed-code` | Doubao Seed Code |
| `glm-4.7` | GLM 4.7 Coding |
| `kimi-k2-thinking` | Kimi K2 Thinking |
| `kimi-k2.5` | Kimi K2.5 Coding |
