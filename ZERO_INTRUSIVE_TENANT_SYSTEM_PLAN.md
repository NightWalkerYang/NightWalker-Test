# 零侵入租户系统改造总方案

## 零侵入协作注意事项

1. 不允许修改 OpenClaw 现有源码文件。
   - 这里的“源码”主要指现有 `src/`、`ui/`、`apps/`、`extensions/` 下的文件。
   - 允许通过新增文件，或修改之前已经新增的非源码文件，来改变系统最终逻辑。

2. 当前零侵入文件清单以 `ZERO_INTRUSIVE_ECHARTS_ADDITIONS.md` 为准。
   - 以后新增零侵入文件时，必须同步维护这份清单。

3. 每次完成一个实际功能后，默认执行完整流程：
   - 本地修改
   - 提交到 Git
   - 服务器拉取
   - 执行部署脚本
   - 校验容器状态

4. Docker 侧部署流程以 `tools/openclaw-control-ui-echarts/setup-direct-docker-compose-up.sh` 为准。
   - 零侵入页面、运行时脚本和 sidecar 相关能力，默认都要经过这条部署路径。

5. 服务器连接信息和密码不写入仓库文档。
   - 真实连接信息由运营侧单独保管。
   - 如果服务器连接超时，默认止步到 Git 上传阶段，不强行继续部署。

本文档只回答四件事：

- 最终系统要做成什么样
- 第一阶段先做什么
- 需要新增哪些零侵入文件
- 还有哪些问题需要你拍板

说明：

- 禁止修改 OpenClaw 现有源码文件
- 允许通过新增文件、sidecar、代理层、部署层、运行时注入来改变系统逻辑
- 本文档当前不以知识图谱为中心
- 知识图谱如果以后要接入，属于租户系统下的某个业务模块，不是主线

## 一、设计前提

当前 OpenClaw 的原始设计不是成熟多租户系统，主要有三个限制：

1. 当前默认是单一可信操作者边界
   - 见 `src/wizard/setup.ts`
2. `sessionKey` 只是路由和上下文，不是用户或租户边界
   - 见 `docs/gateway/security/index.md`
3. 多 agent、workspace、agentDir 可以复用，但它们本身不是租户系统
   - 见 `docs/concepts/multi-agent.md`

所以本方案默认走这条路：

- 不改 OpenClaw 核心源码
- 在 OpenClaw 外面增加租户控制面
- 用数据库承接租户、用户、钱包、分配、计费
- 用零侵入页面承接登录页、管理员页、成员页、钱包页

## 二、最终要完成成什么样

### 1. 登录页

用户进入系统后，先看到统一登录页，而不是原生网关连接页。

第一阶段登录方式先采用：

- 账号密码登录

登录成功后按角色进入不同页面：

- 平台管理员 -> 平台租户管理页
- 租户管理员 -> 租户管理工作台
- 租户成员 -> 成员使用工作台

平台管理员账号规则：

- 支持多个平台管理员账号

### 2. 平台管理员页

我们开发和运营侧使用的平台页需要能做这些事：

- 创建租户
- 为租户创建管理员账号和初始密码
- 给租户分配已有 Agent
- 给租户设置人数上限
- 给租户下的 Agent 设置计费倍率
- 查看租户钱包、Agent 预算、使用情况
- 查看租户审计和关键数据
- 查看各租户成员列表
- 管理平台管理员账号

当前页面定位：

- 放在当前 OpenClaw 页面里，作为零侵入扩展页
- 平台管理员只做平台级管理，不进入租户代操作

### 3. 租户管理员页

租户管理员进入后，需要能做这些事：

- 查看本租户基础信息
- 查看当前成员数和成员上限
- 在人数上限内添加成员
- 给成员分配 Agent
- 查看租户钱包余额
- 从租户钱包划转积分到某个 Agent
- 查看每个 Agent 的预算、消耗和计费倍率
- 查看扣费流水和充值记录
- 重置本租户成员账号密码
- 查看按成员、按 Agent、按天的统计报表

当前约束：

- 一个租户只允许一个管理员
- 租户成员账号第一阶段只保留账号和密码
- 成员停用后禁止登录，但保留历史

### 4. 租户成员入口与聊天页

租户成员进入后，只需要做使用相关的事情：

- 只看到被分配给自己的 Agent
- 可以在已分配的多个 Agent 之间自主切换
- 选择某个 Agent 后直接进入聊天页
- 只看到当前 Agent 剩余积分提示

当前限制：

- 租户成员不能看到自己的消费明细
- 租户成员不能看到租户总钱包余额
- 租户成员页面结构只保留：
  - Agent 选择页
  - 某个 Agent 对应的聊天页

### 5. 钱包与积分

系统里需要有租户钱包概念。

规则是：

- 租户先充值
- 充值后，租户钱包获得积分
- 租户管理员再把积分划转到某个 Agent
- 成员使用某个 Agent 时，从该 Agent 预算中扣减
- Agent 预算不足时，直接拦截消息发送
- 页面需要明确提示“积分不足”或“预算不足”
- 租户钱包余额不足时不做额外预警

第一阶段支付形式确定为：

- 支付宝扫码支付
- 微信扫码支付

### 5.1 公有云部署下的钱包模式

公有云部署下：

- 租户通过在线支付充值
- 支付成功后先进入待确认订单
- 订单确认后，钱包增加积分
- 租户管理员再把积分划转到 Agent
- 成员使用 Agent 时按规则扣减

### 5.2 客户本地部署下的授权与用量模式

客户本地部署下，不走在线充值。

更合理的方案是：

- 客户公司自行管理大模型厂商 API Key 或 coding plan
- 这部分属于客户自己的模型接入能力
- 我们不介入客户本地模型凭证管理
- 不走在线支付
- 不做积分扣费
- 只做使用期限控制和用量统计

也就是说，客户本地部署不是“公有云钱包的线下版”，而是另一套模式：

- 厂商控制 License 有效性和到期时间
- 客户自己承担模型调用成本
- 系统只负责权限、期限、统计和审计

当前本地部署模式下，页面层应体现为：

- 隐藏在线充值入口
- 隐藏钱包充值文案
- 隐藏 Agent 积分划转入口
- 保留用量统计
- 保留会话与 Agent 使用统计

如果后续仍需要“本地额度控制”，可以作为增强选项保留，但不是第一阶段主路径。

目前可选的本地增强模式有：

- 手工授予积分
  - 作为可选增强，不是当前主路径
- 导入离线额度包
  - 作为可选增强，不是当前主路径
- 按合同初始化固定额度
  - 作为可选增强，不是当前主路径
- 按周期自动重置额度
  - 作为可选增强，不是当前主路径
- License 绑定额度
  - 作为可选增强，不是当前主路径
- 本地无限额模式
  - 当前路径最接近这个模式，但仍保留期限控制和审计

### 5.3 公有云模式与本地部署模式共存

这两种模式可以长期共存，而且应该从一开始就明确区分：

- 公有云模式
  - 有在线支付
  - 有租户钱包充值
  - 有支付订单与回调
  - 有积分划转与扣费
- 本地部署模式
  - 没有在线支付
  - 客户自带模型厂商 API Key 或 coding plan
  - 没有积分扣费
  - 只有期限控制、用量统计、审计和权限管理

也就是说：

- 公有云版解决“在线商业化”
- 本地版解决“已购买软件后的本地授权、使用期限和用量统计”

这两者不应该混成同一套页面文案和同一套管理逻辑。

页面上建议明确区分：

- 部署模式标识
- 钱包页文案
- 充值入口是否显示
- 平台管理员可见功能

### 5.4 客户本地部署下如何保证系统控制权限

本地部署下，最核心的问题不是支付，而是“谁真正拥有系统控制权”。

建议把控制权拆成三层：

#### 第一层：厂商控制权

厂商控制的不是日常使用，而是授权边界。

建议由厂商控制这些内容：

- License 是否有效
- 许可到期时间
- 最大租户数
- 每租户最大成员数
- 允许使用哪些 Agent
- 是否允许本地自带模型凭证
- 是否允许开启本地增强额度模式

建议方式：

- 使用厂商签名的 License 文件
- 本地 sidecar 只校验 License，不允许用户自行伪造
- 这样本地客户可以使用系统，但不能随意突破授权边界

#### 第二层：本地平台管理员控制权

本地平台管理员负责日常系统管理，但只能在 License 允许范围内操作。

本地平台管理员建议能做：

- 创建租户
- 创建租户管理员
- 查看所有租户与成员
- 按本地模式给租户授予积分或额度
- 查看审计日志
- 冻结租户
- 管理本地模式下的 Agent 预算

本地平台管理员不应能做：

- 修改 License 授权边界
- 自行增加超出 License 的人数上限
- 自行启用未授权 Agent
- 自行改成公有云支付模式

#### 第三层：租户管理员与成员控制权

租户管理员和成员的权限与公有云版保持一致：

- 租户管理员管本租户成员和 Agent 分配
- 成员只使用被分配的 Agent
- 成员不能接触平台级控制能力

#### 本地控制权的推荐实现方式

推荐按下面这条线实现：

1. 用本地平台管理员账号掌管整套系统
2. 用 License 文件限制可用范围
3. 用 sidecar 校验 License 与角色权限
4. 用零侵入页面承接所有管理动作
5. 原生 OpenClaw 控制台不直接暴露给普通租户成员

这条路线的好处是：

- 不改 OpenClaw 源码
- 本地客户有可用管理权
- 厂商仍然保留授权边界控制权
- 公有云和本地版可以复用同一套租户数据模型

### 6. Agent 分配规则

系统里需要有两层分配关系：

- 平台管理员把已有 Agent 分配给租户
- 租户管理员再把租户可用 Agent 分配给具体成员

成员只能看到自己被分配到的 Agent。
成员可以同时被分配多个 Agent。
成员在某个 Agent 下的会话数量第一阶段不做限制。

当平台管理员把某个 Agent 从租户上撤销后：

- 该租户下所有成员立即看不到这个 Agent
- 该 Agent 剩余积分退回租户钱包
- 该 Agent 历史会话保留

### 7. Agent 会话管理

这一块必须基于 OpenClaw 现有会话设计来做，不能凭空发明。

从现有代码和文档看，有几个硬前提：

- 每个 Agent 本来就有独立 session store
  - 见 `docs/concepts/multi-agent.md`
- `sessionKey` 是路由键，不是用户授权边界
  - 见 `docs/gateway/security/index.md`
- 默认直聊会收敛到 `agent:<agentId>:<mainKey>`
  - 见 `docs/concepts/session.md`
- `session.dmScope` 主要解决“多发信人共享 DM 上下文”的问题
  - 见 `docs/concepts/session.md`

所以在租户系统里，不能直接把租户成员都丢进某个 Agent 的默认 `main` 会话。

更合理的方案是：

- 平台层自己管理“会话列表”
- 每次创建新会话时，平台层生成明确的会话标识
- 聊天页始终带着这个明确会话标识去调用 OpenClaw
- 不把原生 `sessions.list` 直接暴露成租户成员的会话来源

第一阶段建议采用的会话模型是：

- 一个成员在一个 Agent 下可以有多个会话
- 每个会话都绑定：
  - `tenant_id`
  - `user_id`
  - `agent_id`
  - `openclaw_session_key`
  - `openclaw_session_id`
- Agent 选择页进入后，先看到“该成员在该 Agent 下的会话列表”
- 新建会话时，由平台层生成新会话并落库
- 继续聊天时，始终回到同一个 `openclaw_session_key`

也就是说，未来页面上的会话来源应该是我们自己的数据库，而不是直接把 OpenClaw 全量 session store 暴露给用户。

建议增加一张会话表：

- `tenant_agent_sessions`

建议字段：

- `id`
- `tenant_id`
- `user_id`
- `agent_id`
- `title`
- `status`
- `openclaw_session_key`
- `openclaw_session_id`
- `last_message_at`
- `last_cost`
- `last_tokens`
- `created_at`
- `updated_at`
- `archived_at`

第一阶段页面体验建议：

- 用户登录
- 进入 Agent 选择页
- 点某个 Agent 后，看到自己的会话列表
- 可以新建会话
- 可以继续已有会话
- 可以归档会话

第一阶段权限边界建议：

- 租户成员只能看到自己的会话
- 租户管理员可以看到本租户成员的会话摘要，但默认不看正文
- 平台管理员不直接通过租户页看会话正文，而是看审计摘要

这里最关键的一条是：

- OpenClaw 原生的 session 机制继续负责“实际聊天上下文”
- 我们新增的平台数据库负责“租户视角下谁拥有哪个会话、页面显示哪些会话、哪些会话允许继续使用”

## 三、第一阶段只做什么

第一阶段只做控制面，不碰 OpenClaw 核心源码。

第一阶段目标：

- 有统一登录页
- 有平台管理员页
- 有租户管理员页
- 有租户成员 Agent 选择页
- 有租户成员聊天页
- 有租户钱包
- 有 Agent 预算
- 有成员与 Agent 分配关系
- 有基础扣分规则
- 有数据库持久化
- 有审计日志

第一阶段不做：

- 不做强隔离多租户
- 不做每租户独立 OpenClaw 核心进程
- 不做每租户独立 node host
- 不做精确模型成本结算
- 不做复杂计费引擎

## 四、第一阶段扣费怎么设计

第一阶段不要假装能拿到 OpenClaw 核心内部的精确模型成本。

第一阶段确定采用：

- 按 token 或估算 cost 扣费

可直接复用的现有能力：

- `docs/reference/token-use.md`
- `docs/logging.md`
- `src/utils/usage-format.ts`

更合理的控制面计费设计是：

- 以 token usage 和估算 cost 为基础
- 再乘以该 Agent 在该租户下的计费倍率

第一阶段计费数据来源明确为：

- 优先使用正常大模型 API 调用返回的 usage 和模型定价来估算
- 暂不把 `volcengine-plan/ark-code-latest` 这类 coding plan 路由模型作为第一阶段主计费口径

原因是：

- coding plan 当前只能看到整体用量百分比
- 看不到稳定的“底层具体模型 + 精确 token + 精确费用”
- 因此不适合拿来做第一阶段的租户扣费主依据

也就是说，第一阶段先做：

- 可执行
- 可解释
- 可审计

而不是先做极度精确的成本核算。

## 五、线性实施步骤

### 步骤 1

先做统一身份入口。

目标：

- 统一登录页
- 登录后识别角色
- 登录后先进入 Agent 选择页
- 再从 Agent 选择页进入具体聊天或业务页面
- 平台管理员负责创建租户管理员账号
- 租户管理员负责创建本租户成员账号

### 步骤 2

先落租户数据库。

目标：

- 租户
- 用户
- 成员关系
- Agent 分配
- 钱包
- 预算
- 扣费流水
- 审计

### 步骤 3

做平台管理员页。

目标：

- 创建租户
- 创建租户管理员
- 分配 Agent
- 设置人数上限
- 设置计费倍率

### 步骤 4

做租户管理员页。

目标：

- 添加成员
- 给成员分配 Agent
- 查看钱包
- 给 Agent 划转预算

### 步骤 5

做租户成员页。

目标：

- 只展示被分配的 Agent
- 从成员页进入聊天或业务页

### 步骤 6

做钱包与积分流水。

目标：

- 充值
- 划转
- 扣减
- 回退
- 审计
- 接支付宝和微信扫码支付
- 为客户本地部署保留“手工授予积分/导入额度”的分支

### 步骤 7

做 Agent 使用前校验。

目标：

- 是否分配给当前成员
- 当前 Agent 是否还有预算
- 当前租户是否超限
- 如果预算不足，直接拦截消息发送
- 预算不允许透支，最低归零

### 步骤 8

做 Agent 使用后扣费。

目标：

- 记录这次使用
- 每次模型回复完成后扣积分
- 写入流水

### 步骤 9

做平台运营能力。

目标：

- 查看租户概况
- 查看充值和消耗
- 查看成员规模
- 查看 Agent 使用情况
- 平台管理员可以手动冻结租户
- 冻结后的租户完全禁止登录
- 平台管理员可以查看各租户成员列表

## 六、数据库模型

这里只保留与当前主线直接相关的表。

### `tenants`

作用：

- 租户主表

建议字段：

- `id`
- `code`
- `name`
- `status`
- `created_at`
- `updated_at`

### `users`

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

### `tenant_memberships`

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

### `tenant_quotas`

作用：

- 保存租户人数上限和其他配额
- 由平台管理员配置

建议字段：

- `tenant_id`
- `member_limit`
- `agent_limit`
- `created_at`
- `updated_at`

### `tenant_agents`

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

### `user_agent_assignments`

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

### `tenant_wallets`

作用：

- 租户钱包总账

当前积分规则：

- `1 元人民币 = 1 积分`

建议字段：

- `id`
- `tenant_id`
- `currency_type`
- `total_balance`
- `available_balance`
- `locked_balance`
- `created_at`
- `updated_at`

### `tenant_agent_budgets`

作用：

- 租户管理员划转给某个 Agent 的预算子账
- 不允许透支，扣减后最低为 `0`

建议字段：

- `id`
- `tenant_id`
- `tenant_agent_id`
- `allocated_credits`
- `used_credits`
- `remaining_credits`
- `created_at`
- `updated_at`

### `tenant_wallet_ledger`

作用：

- 钱包和预算相关的流水账

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

流水类型除了在线充值和扣费，还应支持：

- 手工授予积分
- 本地部署额度初始化
- 额度导入
- 冻结回收

### `payment_orders`

作用：

- 保存支付订单和充值订单

建议字段：

- `id`
- `tenant_id`
- `order_no`
- `payment_channel`
- `amount`
- `credits_granted`
- `status`
- `created_by`
- `paid_at`
- `confirmed_at`
- `created_at`
- `updated_at`

说明：

- 第一阶段需要支持真实支付
- 第一阶段支付渠道为支付宝扫码支付和微信扫码支付
- 第一阶段不需要平台管理员手动续费、补单、退款
- 支付成功后先进入待确认订单，再入账
- 支付接入确认走通联聚合
- 支付宝和微信扫码支付由通联聚合承接
- 后续实施时再接入具体参数和接口文档

说明：

- 第一阶段需要支持真实支付

### `audit_logs`

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

## 七、未来新增的零侵入文件

### 1. 系统级 sidecar

- `tools/openclaw-control-ui-echarts/sidecar/tenant-platform/server.mjs`
  - sidecar 服务入口
- `tools/openclaw-control-ui-echarts/sidecar/tenant-platform/config.mjs`
  - 读取配置
- `tools/openclaw-control-ui-echarts/sidecar/tenant-platform/db.mjs`
  - 数据库连接和迁移
- `tools/openclaw-control-ui-echarts/sidecar/tenant-platform/identity.mjs`
  - 解析用户和租户身份
- `tools/openclaw-control-ui-echarts/sidecar/tenant-platform/authz.mjs`
  - 权限判断
- `tools/openclaw-control-ui-echarts/sidecar/tenant-platform/membership.mjs`
  - 成员和角色管理
- `tools/openclaw-control-ui-echarts/sidecar/tenant-platform/wallet.mjs`
  - 钱包和流水处理
- `tools/openclaw-control-ui-echarts/sidecar/tenant-platform/billing.mjs`
  - 计费倍率和扣费逻辑
- `tools/openclaw-control-ui-echarts/sidecar/tenant-platform/agent-assignment.mjs`
  - Agent 分配逻辑
- `tools/openclaw-control-ui-echarts/sidecar/tenant-platform/sessions.mjs`
  - 租户会话列表、创建、归档、绑定 OpenClaw 会话
- `tools/openclaw-control-ui-echarts/sidecar/tenant-platform/audit.mjs`
  - 审计日志
- `tools/openclaw-control-ui-echarts/sidecar/tenant-platform/routes.mjs`
  - 路由聚合
- `tools/openclaw-control-ui-echarts/sidecar/tenant-platform/migrations/001_init.sql`
  - 初始化表结构

### 2. 前端运行时

- `tools/openclaw-control-ui-echarts/runtime/tenant/tenant-context.js`
  - 当前用户、当前租户、当前角色上下文
- `tools/openclaw-control-ui-echarts/runtime/tenant/api-client.js`
  - 前端统一 API 调用层
- `tools/openclaw-control-ui-echarts/runtime/tenant/login-page.js`
  - 登录页逻辑
- `tools/openclaw-control-ui-echarts/runtime/tenant/agent-selector-page.js`
  - 登录后的 Agent 选择页逻辑
- `tools/openclaw-control-ui-echarts/runtime/tenant/chat-shell.js`
  - 租户聊天壳层，负责把当前租户会话映射到 OpenClaw 会话
- `tools/openclaw-control-ui-echarts/runtime/tenant/chat-page.js`
  - 租户成员聊天页逻辑
- `tools/openclaw-control-ui-echarts/runtime/tenant/admin-page.js`
  - 租户管理员页逻辑
- `tools/openclaw-control-ui-echarts/runtime/tenant/wallet-page.js`
  - 钱包与支付页逻辑
- `tools/openclaw-control-ui-echarts/runtime/tenant/platform-console-page.js`
  - 平台管理员页逻辑

### 3. 静态页面

- `tools/openclaw-control-ui-echarts/static/tenant-login.html`
  - 登录页
- `tools/openclaw-control-ui-echarts/static/tenant-agent-selector.html`
  - Agent 选择页
- `tools/openclaw-control-ui-echarts/static/tenant-chat.html`
  - 租户成员聊天页
- `tools/openclaw-control-ui-echarts/static/tenant-admin.html`
  - 租户管理员页
- `tools/openclaw-control-ui-echarts/static/tenant-wallet.html`
  - 钱包页
- `tools/openclaw-control-ui-echarts/static/platform-tenant-console.html`
  - 平台管理员页

### 4. 未来会修改的零侵入文件

- `tools/openclaw-control-ui-echarts/openclaw-echarts-renderer.js`
  - 注册新增页面入口
- `tools/openclaw-control-ui-echarts/build-custom-control-ui.mjs`
  - 打包新增页面和 sidecar 配置
- `tools/openclaw-control-ui-echarts/setup-direct-docker-compose-up.mjs`
  - 生成 sidecar 服务配置
- `tools/openclaw-control-ui-echarts/setup-direct-docker-compose-up.sh`
  - shell 路径下生成 sidecar 服务配置
- `tools/openclaw-control-ui-echarts/README.md`
  - 部署和运维说明
- `ZERO_INTRUSIVE_ECHARTS_ADDITIONS.md`
  - 维护零侵入文件总清单

### 5. 测试

- `test/tools/openclaw-control-ui-echarts/tenant-platform.test.ts`
  - sidecar 总体测试
- `test/tools/openclaw-control-ui-echarts/tenant-billing.test.ts`
  - 钱包和扣费测试
- `test/tools/openclaw-control-ui-echarts/tenant-assignment.test.ts`
  - 成员与 Agent 分配测试
- `test/tools/openclaw-control-ui-echarts/tenant-sessions.test.ts`
  - 会话创建、归档、续聊测试
- `test/tools/openclaw-control-ui-echarts/tenant-pages.test.ts`
  - 登录页和各工作台测试

## 八、运行时生成文件

- `${OPENCLAW_CONFIG_DIR}/tenant-platform/tenant-platform.sqlite`
  - 租户平台数据库
- `${OPENCLAW_CONFIG_DIR}/tenant-platform/tenant-platform.sqlite-wal`
  - SQLite WAL 文件
- `${OPENCLAW_CONFIG_DIR}/tenant-platform/tenant-platform.sqlite-shm`
  - SQLite 共享内存文件
- `${OPENCLAW_CONFIG_DIR}/tenant-platform/backups/`
  - 备份目录

## 九、当前已确认事项

1. 密码重置层级
   - 平台管理员重置租户管理员密码
   - 租户管理员重置本租户成员密码

2. 积分兑换比例
   - `1 元人民币 = 1 积分`

3. 登录账号唯一性
   - 租户内唯一账号

4. 第一阶段扣费口径
   - 使用正常大模型 API 调用返回的 usage 与定价估算
   - 暂不把 coding plan 当作主计费口径

5. 客户本地部署
   - 不走在线充值
   - 客户公司自行管理大模型厂商 API Key 或 coding plan
   - 我们不介入客户本地模型凭证管理
   - 页面上要与公有云模式显式区分
   - 本地平台管理员只能在 License 允许范围内管理系统
   - 不做积分扣费，只做用量统计
   - 核心控制目标是系统可用性与到期时间

6. 租户会话默认命名
   - 自动摘要生成标题
   - 允许成员手工改名

7. 租户管理员可见范围
   - 不看具体会话
   - 只看某个 Agent 被谁使用了
   - 只看某个成员消耗了多少

8. 本地部署下 License 控制范围
   - 第一阶段只控制可用性和到期时间

9. 会话删除策略
   - 允许用户直接删除
   - 前端隐藏即可
   - 历史统计完全保留

10. 本地部署到期后的系统表现
   - 允许只读查看历史和统计
   - 禁止继续发送消息

11. 公有云模式下模型凭证管理
   - 租户管理员完全不允许自行配置模型凭证

12. 本地部署下 License 展示方式
   - 同时显示到期日期和剩余天数

13. 本地部署下到期预警
   - 提前 7 天开始预警
   - 在最后 7 天内按天提醒
   - 不是每次打开页面都提醒
   - 更合理的方式是“每天首次登录或首次进入管理页时提醒一次”

14. 平台管理员账号
   - 支持多个平台管理员账号

15. 租户成员账号字段
   - 第一阶段只保留账号和密码

16. 成员停用处理
   - 禁止登录
   - 保留历史

17. Agent 分配取消后的历史可见性
   - 取消分配后不能再看到该 Agent 下的历史

18. 公有云扣费时机
   - 每次模型回复完成后扣积分

19. 公有云支付到账方式
   - 支付成功后先进入待确认订单
   - 订单确认后再入账

20. 本地部署续期方式
   - 续期码和重新部署导入新的授权文件可以共存
   - 日常续期优先走续期码
   - 重新部署并导入新的授权文件用于补救、替换或较大版本更新
   - 两者不冲突，关键是要定义清楚优先级

21. 公有云订单确认方式
   - 支付回调自动确认
   - 系统需要提供确认接口供支付回调调用

22. 租户成员页面范围
   - 只保留 Agent 选择页
   - 只保留某个 Agent 对应的聊天页
   - 不再单独提供成员最近使用记录页面

23. 平台管理员代操作能力
   - 不允许进入租户执行代操作
   - 平台管理员只保留平台级管理和统计查看权限

24. 平台管理员撤销租户 Agent 时的处理
   - 该租户下所有成员立即看不到这个 Agent
   - 该 Agent 剩余积分退回租户钱包
   - 该 Agent 历史会话保留

25. 成员停用后的 Agent 预算处理
   - 原地保留在 Agent 上

26. 成员会话数量
   - 第一阶段不限制

27. 租户钱包余额不足
   - 不做额外预警

28. 租户管理员报表范围
   - 可以看按成员、按 Agent、按天的统计报表

29. 租户管理员统计报表默认时间范围
   - 今天

30. Agent 选择页卡片展示项
   - Agent 头像或 emoji
   - Agent 名称
   - Agent 简短描述
   - 当前剩余积分
   - 状态标签
   - 其中：
     - 头像 / emoji / 名称复用 OpenClaw 原生 identity
     - 简短描述由租户平台单独维护
     - 状态标签第一阶段使用：正常 / 预算不足 / 已停用

## 十、第一阶段实施清单（压缩版）

1. 先落租户控制面 sidecar
   - 新增独立 sidecar 服务
   - 不改 `src/`、`ui/`、`apps/`、`extensions/`
   - 由 sidecar 负责租户、用户、钱包、订单、会话映射、报表

2. 先落第一阶段数据库
   - 必需表：
     - `tenants`
     - `users`
     - `tenant_memberships`
     - `tenant_quotas`
     - `tenant_agents`
     - `user_agent_assignments`
     - `tenant_wallets`
     - `tenant_agent_budgets`
     - `tenant_wallet_ledger`
     - `payment_orders`
     - `audit_logs`
   - 第一阶段先用 SQLite

3. 先完成平台管理员能力
   - 创建租户
   - 创建租户管理员账号
   - 给租户分配已有 Agent
   - 配置租户人数上限
   - 配置“租户 + Agent”计费倍率
   - 冻结 / 启用租户
   - 查看租户成员列表与平台级统计

4. 再完成租户管理员能力
   - 新增成员账号
   - 停用成员账号
   - 给成员分配多个 Agent
   - 查看租户钱包余额
   - 给 Agent 划转积分
   - 查看按成员 / 按 Agent / 按天报表

5. 再完成租户成员页面
   - 所有人先进入登录页
   - 登录后进入 Agent 选择页
   - 点选某个 Agent 后进入聊天页
   - 不再提供其他成员端页面

6. Agent 选择页按以下固定结构实现
   - 卡片展示：
     - 头像或 emoji
     - Agent 名称
     - Agent 简短描述
     - 当前剩余积分
     - 状态标签
   - 数据来源：
     - 头像 / emoji / 名称复用 OpenClaw 原生 identity
     - 简短描述由租户平台维护
     - 剩余积分与状态标签由 sidecar 维护

7. 聊天页按以下规则接入
   - 页面仍复用 OpenClaw 原生聊天能力
   - 但成员看到的会话列表和可见范围由租户平台控制
   - 用户删会话只做前端隐藏
   - 统计和账务流水完全保留
   - 成员失去某个 Agent 分配后，不能再看到该 Agent 历史

8. 公有云模式先完成支付与扣费
   - 账号密码登录
   - `1 元 = 1 积分`
   - 支付方式：通联承接支付宝 / 微信扫码
   - 支付成功后先进入待确认订单
   - 支付回调自动确认后再入账
   - 每次模型回复完成后按 token / 估算 cost 扣费
   - Agent 积分不足时直接拦截消息发送

9. 本地部署模式第一阶段只做授权与统计
   - 不做在线充值
   - 不做积分扣费
   - 客户自行管理模型 API Key 或 coding plan
   - 我们只控制系统可用性和到期时间
   - 到期后允许只读查看历史和统计
   - 不允许继续发送消息

10. 本地部署授权页第一阶段要做到
   - 显示到期日期
   - 显示剩余天数
   - 提前 7 天开始提醒
   - 7 天内按天提醒一次
   - 支持续期码
   - 支持重新部署并导入新的授权文件

11. 第一阶段必须新增的零侵入页面
   - `tenant-login.html`
   - `tenant-agent-selector.html`
   - `tenant-chat.html`
   - `tenant-admin.html`
   - `tenant-wallet.html`
   - `platform-tenant-console.html`

12. 第一阶段必须新增的零侵入运行时文件
   - `runtime/tenant/tenant-context.js`
   - `runtime/tenant/api-client.js`
   - `runtime/tenant/login-page.js`
   - `runtime/tenant/agent-selector-page.js`
   - `runtime/tenant/chat-shell.js`
   - `runtime/tenant/chat-page.js`
   - `runtime/tenant/admin-page.js`
   - `runtime/tenant/wallet-page.js`
   - `runtime/tenant/platform-console-page.js`

13. 第一阶段必须新增的 sidecar 文件
   - `sidecar/tenant-platform/server.mjs`
   - `sidecar/tenant-platform/config.mjs`
   - `sidecar/tenant-platform/db.mjs`
   - `sidecar/tenant-platform/auth.mjs`
   - `sidecar/tenant-platform/license.mjs`
   - `sidecar/tenant-platform/membership.mjs`
   - `sidecar/tenant-platform/wallet.mjs`
   - `sidecar/tenant-platform/billing.mjs`
   - `sidecar/tenant-platform/payments.mjs`
   - `sidecar/tenant-platform/agent-assignment.mjs`
   - `sidecar/tenant-platform/sessions.mjs`
   - `sidecar/tenant-platform/audit.mjs`
   - `sidecar/tenant-platform/routes.mjs`
   - `sidecar/tenant-platform/migrations/001_init.sql`

14. 第一阶段上线后的页面结果
   - 平台管理员：
     - OpenClaw 内嵌“租户管理页”
   - 租户管理员：
     - 成员管理页
     - Agent 分配页
     - 钱包页
     - 统计页
   - 租户成员：
     - 登录页
     - Agent 选择页
     - 聊天页

15. 第一阶段验收标准
   - 不改 OpenClaw 原有源码文件
   - 租户、用户、Agent 分配、钱包、订单、会话映射都能落库
   - 平台管理员能创建租户并分配 Agent
   - 租户管理员能添加成员并划转积分
   - 成员只能看到被分配的 Agent
   - 积分不足时消息被拦截
   - 本地部署模式与公有云模式页面表现明确区分

## 十一、当前还需要继续确认的事项

1. 通联聚合接入材料
   - 你已说明可以提供 `appid`、商户号、交易密码、RSA 私钥、RSA 通联公钥
   - 后续进入实施阶段时，还需要对应 API 文档、回调约定和测试环境说明
