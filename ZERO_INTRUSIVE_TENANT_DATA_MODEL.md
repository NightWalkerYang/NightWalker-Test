# 零侵入租户数据模型

这份文档只保留当前已落地且与 Skills 市场、租户 Agent 分配、钱包结算直接相关的数据模型。

当前真实底座：

- SQLite
- 主迁移文件：`tools/openclaw-control-ui-echarts/sidecar/tenant-platform/migrations/001_init.sql`
- 主运行实现：`tools/openclaw-control-ui-echarts/sidecar/tenant-platform/db.mjs`

## 当前主线实体

### `tenants`

作用：

- 租户主表

当前关键字段：

- `id`
- `code`
- `name`
- `status`
- `deployment_mode`
- `created_at`
- `updated_at`

### `users`

作用：

- 平台管理员、租户管理员、租户成员账号主表

当前关键字段：

- `id`
- `username`
- `password_hash`
- `role`
- `status`
- `created_at`
- `updated_at`

当前真实约束：

- `username` 全局唯一
- 用户归属租户通过 `tenant_memberships` 表达，不在 `users` 直接带 `tenant_id`

### `tenant_memberships`

作用：

- 用户与租户关系

当前关键字段：

- `id`
- `tenant_id`
- `user_id`
- `role`
- `status`
- `created_at`

当前真实角色：

- `tenant_admin`
- `member`

### `tenant_quotas`

作用：

- 租户人数限制与到期控制

当前关键字段：

- `tenant_id`
- `member_limit`
- `license_expires_at`
- `renewal_code`
- `readonly_after_expiry`
- `created_at`
- `updated_at`

### `tenant_agents`

作用：

- 表达某个租户当前拥有的基础 Agent
- 承载租户 Agent 级积分余额与倍率

当前关键字段：

- `id`
- `tenant_id`
- `agent_id`
- `description`
- `rate_multiplier`
- `status`
- `balance_points`
- `created_at`
- `updated_at`

当前真实约束：

- `(tenant_id, agent_id)` 唯一
- 平台撤回租户 Agent 时：
  - `tenant_agents.status -> inactive`
  - 相关成员分配同步失效
  - Agent 剩余积分退回租户钱包

### `user_agent_assignments`

作用：

- 表达某个成员被分配了哪个租户 Agent
- 持久化成员派生 Agent 与派生工作区

当前关键字段：

- `id`
- `tenant_id`
- `user_id`
- `tenant_agent_id`
- `derived_agent_id`
- `derived_workspace_dir`
- `status`
- `created_at`

当前真实状态：

- `active`
- `inactive`
- `blocked_missing_skills`

当前真实含义：

- `active`：成员可见且可用
- `inactive`：已撤回或已清理
- `blocked_missing_skills`：模板或成员覆盖引用了当前不可用 skill，成员侧必须隐藏

## 钱包与充值主线

### `tenant_wallets`

作用：

- 租户钱包总账

当前关键字段：

- `tenant_id`
- `balance_points`
- `created_at`
- `updated_at`

当前真实规则：

- 结算币种固定 `CNY`
- `1 积分 = 1 CNY`
- 钱包只记录租户总余额

### `tenant_agent_budgets`

作用：

- 租户钱包向某个租户 Agent 划拨预算的留痕

当前关键字段：

- `id`
- `tenant_id`
- `tenant_agent_id`
- `amount_points`
- `created_by_user_id`
- `created_at`

### `tenant_wallet_ledger`

作用：

- 钱包相关审计真值

当前关键字段：

- `id`
- `tenant_id`
- `direction`
- `category`
- `amount_points`
- `balance_after`
- `tenant_agent_id`
- `payment_order_id`
- `actor_user_id`
- `note`
- `created_at`

当前真实 category：

- `recharge`
- `agent_transfer`
- `agent_revoke_refund`
- `usage_charge`
- `skill_purchase`

### `payment_orders`

作用：

- 外部充值订单

当前关键字段：

- `id`
- `tenant_id`
- `amount_cny`
- `amount_points`
- `provider`
- `status`
- `provider_order_id`
- `provider_payload`
- `created_at`
- `updated_at`

## Skills 市场主线

### `platform_skills`

作用：

- 平台技能总目录

当前关键字段：

- `id`
- `skill_key`
- `name`
- `description`
- `classification`
- `source_type`
- `source_root`
- `source_workspace_dir`
- `status`
- `price_points`
- `compatible_base_agents_json`
- `latest_version_id`
- `latest_version_label`
- `latest_version_hash`
- `latest_synced_at`
- `latest_published_at`
- `affected_tenant_count`
- `created_at`
- `updated_at`

当前真实分类：

- `bundled`
- `free`
- `paid`

当前真实来源：

- `workspace`
- `managed`

当前真实规则：

- 基础 Agent 工作区 `skills/*/SKILL.md` 会自动建档为 `bundled`
- 未编目的基础 skill 不报错，自动入 catalog

### `platform_skill_versions`

作用：

- 技能版本表

当前关键字段：

- `id`
- `skill_id`
- `version_label`
- `version_hash`
- `skill_md_path`
- `skill_md_content`
- `skill_metadata_json`
- `status`
- `created_at`
- `updated_at`

当前真实规则：

- 版本唯一性按 `(skill_id, version_hash)`
- `managed` skill 版本内容会持久化到 sidecar managed skill storage
- `bundled` skill 版本按 `SKILL.md` 内容 hash 自动滚动

### `platform_skill_agent_bindings`

作用：

- 记录 skill 兼容哪些基础 Agent

当前关键字段：

- `id`
- `skill_id`
- `base_agent_id`
- `status`
- `created_at`
- `updated_at`

### `tenant_skill_orders`

作用：

- paid skill 购买订单

当前关键字段：

- `id`
- `tenant_id`
- `skill_id`
- `order_status`
- `acquire_type`
- `amount_points`
- `version_policy`
- `current_version_id`
- `created_by_user_id`
- `confirmed_by_user_id`
- `confirmed_at`
- `created_at`
- `updated_at`

当前真实状态：

- `pending_confirmation`
- `confirmed`

当前真实规则：

- v1 只对 `paid` 生效
- `free` 不走钱包扣费链路
- 订单确认时会同步写 `tenant_wallet_ledger.category = skill_purchase`

### `tenant_skill_entitlements`

作用：

- 租户维度 skill 授权真值

当前关键字段：

- `id`
- `tenant_id`
- `skill_id`
- `status`
- `acquire_type`
- `version_policy`
- `current_version_id`
- `enabled_by_tenant`
- `blocked_reason`
- `order_id`
- `created_at`
- `updated_at`

当前真实状态：

- `active`
- `pending`
- `disabled`
- `revoked`

当前真实规则：

- `bundled` 自动生成 `active + enabled_by_tenant = true`
- `free` 显式启用后进入 `active`
- `paid` 订单确认后进入 `active`
- 最终是否可用同时看：
  - `status === active`
  - `enabled_by_tenant === true`

### `tenant_agent_skill_templates`

作用：

- 某个租户 Agent 的默认技能模板

当前关键字段：

- `id`
- `tenant_agent_id`
- `skill_id`
- `template_state`
- `source_type`
- `created_at`
- `updated_at`

当前真实状态：

- `enabled`
- `disabled`
- `blocked_missing_entitlement`

当前真实规则：

- bundled skill 首次发现后自动写入模板并默认 `enabled`
- 模板里引用未购买或已停用 skill 时，状态会被重协调为 `blocked_missing_entitlement`

### `user_agent_skill_overrides`

作用：

- 成员维度 skill 增删覆盖

当前关键字段：

- `id`
- `assignment_id`
- `tenant_agent_id`
- `user_id`
- `skill_id`
- `action`
- `created_at`
- `updated_at`

当前真实动作：

- `force_add`
- `force_remove`

当前真实公式：

- `(tenant_agent_template_enabled ∪ member_force_add) - member_force_remove`

### `tenant_agent_skill_snapshots`

作用：

- 每次派生 Agent reconcile 后的审计快照

当前关键字段：

- `id`
- `assignment_id`
- `tenant_id`
- `tenant_agent_id`
- `user_id`
- `derived_agent_id`
- `resolved_skill_keys_json`
- `resolved_version_ids_json`
- `blocked_reasons_json`
- `applied_at`

当前真实用途：

- 回放某个成员某次最终生效 skill 集
- 追查为什么某个成员 Agent 被 blocked

## 当前技能隔离真实规则

- 基础顶层 `.md` 和 `memory/` 继续按派生工作区逻辑保留
- `skills/` 不再整树盲拷贝整个母工作区，也不再先整目录删除后只回写 `SKILL.md`
- sidecar 会按最终 skill 集 reconcile 派生工作区 `skills/`：
  - 删除不在 resolved 集合里的 skill 目录
  - 对仍然 resolved 的 bundled/base workspace skill，按 `platform_skill_versions.skill_md_path` 反推母 skill 目录并整树复制
  - 复制后回刷 `skills/<skillKey>/SKILL.md` 为当前 resolved version 的 `skill_md_content`
  - 对当前只存 `SKILL.md` 的 managed skill，先只物化该文件
- 然后在 runtime derived agent config 里显式写 `skills: [...]`
- 两层都生效，任何一层单独成功都不算完成

## 当前阅读建议

遇到这些任务时优先读本文件：

- Skills 市场要加字段或修规则
- 成员 skill override 应该落在哪张表
- paid/free/bundled 状态流怎么落库
- 派生 Agent 为什么会被 blocked
