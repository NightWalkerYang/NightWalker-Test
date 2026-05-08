# 零侵入租户数据模型

这份文档只保留当前主线直接相关的数据表与业务约束。

当前第一阶段底座默认使用：

- SQLite

主库运行时生成路径见：

- `ZERO_INTRUSIVE_TENANT_DEPLOYMENT_AND_OPERATIONS.md`

## `tenants`

作用：

- 租户主表

建议字段：

- `id`
- `code`
- `name`
- `status`
- `created_at`
- `updated_at`

## `users`

作用：

- 用户主表
- 平台管理员创建租户管理员账号
- 租户管理员创建本租户成员账号

账号规则：

- 登录账号按租户内唯一设计

建议字段：

- `id`
- `tenant_id`
- `username`
- `password_hash`
- `status`
- `disabled_at`
- `created_at`
- `updated_at`

## `tenant_memberships`

作用：

- 用户与租户关系

建议字段：

- `tenant_id`
- `user_id`
- `role`
- `status`
- `created_at`
- `updated_at`

角色建议：

- `platform_admin`
- `tenant_admin`
- `tenant_member`

当前业务约束：

- 每个租户仅允许一个 `tenant_admin`

## `tenant_quotas`

作用：

- 保存租户人数上限和其他配额
- 由平台管理员配置

建议字段：

- `tenant_id`
- `member_limit`
- `agent_limit`
- `created_at`
- `updated_at`

## `tenant_agents`

作用：

- 表达某个租户能使用哪些 Agent
- 承载租户和 Agent 之间的计费倍率

当前规则：

- 计费倍率按“租户 + Agent”维度配置
- 不同租户、不同 Agent 的计费倍率可以不同
- 平台管理员把某个 Agent 从租户上撤销后：
  - 该租户下所有成员立即看不到这个 Agent
  - 该 Agent 剩余积分退回租户钱包
  - 该 Agent 历史会话保留

建议字段：

- `id`
- `tenant_id`
- `agent_key`
- `agent_id`
- `workspace_path`
- `agent_dir_path`
- `pricing_multiplier`
- `wallet_mode`
- `status`
- `created_at`
- `updated_at`

## `user_agent_assignments`

作用：

- 表达某个租户成员被分配了哪些 Agent

建议字段：

- `id`
- `tenant_id`
- `user_id`
- `tenant_agent_id`
- `status`
- `revoked_at`
- `assigned_by`
- `created_at`
- `updated_at`

当前规则：

- 成员取消某个 Agent 分配后，不能再看到该 Agent 下的历史
- 成员被停用后，其名下未用完的 Agent 预算原地保留在 Agent 上

## `tenant_wallets`

作用：

- 租户钱包总账

当前积分规则：

- 最终结算币种固定为人民币 `CNY`
- `1 积分 = 1 人民币`
- sidecar 以本地静态模型单价表与本地静态汇率表作为租户计费真值
- 不依赖供应商在线价格查询

建议字段：

- `id`
- `tenant_id`
- `currency_type`
- `total_balance`
- `available_balance`
- `locked_balance`
- `created_at`
- `updated_at`

## `tenant_agent_budgets`

作用：

- 租户管理员划转给某个 Agent 的预算子账
- 不允许透支

建议字段：

- `id`
- `tenant_id`
- `tenant_agent_id`
- `allocated_credits`
- `used_credits`
- `remaining_credits`
- `created_at`
- `updated_at`

## `tenant_wallet_ledger`

作用：

- 钱包和预算相关流水账

建议字段：

- `id`
- `tenant_id`
- `wallet_id`
- `entry_type`
- `amount`
- `balance_after`
- `related_resource_type`
- `related_resource_id`
- `operator_user_id`
- `metadata_json`
- `created_at`

当前流水除了在线充值和扣费，还应支持：

- 手工授予积分
- 本地部署额度初始化
- 额度导入
- 冻结回收

## `payment_orders`

作用：

- 保存支付订单和充值订单

当前实际字段：

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

当前说明：

- 第一阶段真实支付由通联 H5 收银台承接
- 第一阶段不需要平台管理员手动续费、补单、退款
- 支付成功后先进入待确认订单，再入账
- `provider_payload` 当前同时保存支付渠道、创建人和最近一次通联返回报文

## `audit_logs`

作用：

- 保存系统级审计事件

建议字段：

- `id`
- `tenant_id`
- `user_id`
- `action`
- `resource_type`
- `resource_id`
- `payload_json`
- `created_at`

## 当前阅读建议

遇到这些任务时优先读本文件：

- 新增字段或修表
- 成员、租户、Agent 关系怎么落库
- 钱包流水、订单、预算子账的字段怎么对齐
- 需要确认某个业务约束应该落在哪张表
