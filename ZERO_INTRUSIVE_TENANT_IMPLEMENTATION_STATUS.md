# 零侵入租户当前实施现状

这份文档记录当前已经真实落地并验证通过的能力。

如果旧方案描述和当前实现冲突：

- 先信当前代码与当前可运行结果
- 再用本文件回写事实

## 1. 统一登录视图已落地

当前真实状态：

- 统一登录路由是 `./?ocTenantView=login`
- 仍兼容直接访问 `/login` 路径别名
- 退出登录和守卫跳转统一使用查询参数形式
- 平台管理员、租户管理员、租户成员共用同一登录入口
- 登录页已经改成基于原生 Control UI 单入口运行时接管

已补齐的行为：

- 会话有效性校验
- 过期/无效会话自动清理
- 退出登录统一清理平台与租户两套本地会话
- 命中 `/chat?ocTenantView=login...` 这类脏路由时，会先修正回干净的租户路由
- 登录视图现在还会主动清掉原生 Control UI 本地会话恢复值，并清空底层 `openclaw-app` 已挂载的聊天 hydration 状态，避免“登录页可见但底层旧聊天页仍残留在不可见层里”

## 2. 成员聊天 preboot 与 draft route lock 已落地

当前真实状态：

- 成员聊天路由修正已经前移到原生 Control UI 主 bundle 之前
- 零侵入构建会在 `index-*.js` 前注入 `runtime/tenant/preboot.js`
- preboot 优先复用本地缓存的安全成员 session
- 本地没有缓存时，会在同源 `/tenant-platform-api/v1/member/sessions` 上同步读取最近一次非草稿成员会话
- 只有都拿不到时，才保持无 `session` 路由，等成员聊天 surface 以内存草稿态接管

当前还补了一层 draft route lock：

- 只要成员当前会话仍是未发送首条消息的新草稿
- `preboot` 与 `history.pushState/replaceState` patch 都必须继续保留无 `session` 路由
- 不能退回旧稳定会话

当前真实补充：

- `preboot` 不再只负责路由归一化和成员会话预处理
- 构建产物已经同步注入首屏 boot lock 样式
- `preboot` 会在 login、成员选择、平台管理、租户管理、成员聊天这些零侵入接管路由上，先打 `data-oc-tenant-boot-lock`
- 各 zero-intrusive surface 会在自己的宿主壳 ready 后主动解锁
- 这样即使网络偏慢，原生 Control UI DOM 也不会先短暂露出并允许点击

## 3. 平台管理员守卫与平台页已落地

当前真实状态：

- 未登录访问根入口时，会先进入统一登录视图
- 平台管理员登录成功后，回到原生根控制台继续工作
- 原生侧边栏“管理”分组已置顶
- 当前平台管理员子项至少包含：
  - `租户管理`
  - `Agent 分配`
- 命中 `/chat?ocTenantView=platform-*` 这类脏地址时，preboot 会先修正回根入口查询路由，不再允许原生聊天页当平台管理宿主

平台管理内容区当前已直接渲染在原生控制台内容区，不再跳转旧独立平台页。

## 4. 平台管理员基础能力已落地

当前已落地：

- 平台管理员初始化
- 平台管理员登录
- 平台管理员退出
- 租户创建
- 租户列表展示
- 平台管理员向租户下发 Agent
- 平台管理员撤回租户已接收的 Agent
- 撤回时同步失效相关成员分配

`租户管理` 当前已经收敛为表格化页面：

- 顶部搜索框
- 创建租户
- 人数调整
- 底部分页

`Agent 分配` 当前已经收敛为表格化页面：

- 顶部搜索框
- 分配Agent
- 撤回分配
- 倍率调整
- 分页

## 5. 平台级更新日志中心已落地

当前真实状态：

- sidecar SQLite 已新增专用更新日志表
- 平台管理员可以在右下角 `版本` 弹窗中查看历史、新建、修改、删除
- 租户管理员与租户成员可以查看历史更新
- 平台管理员、租户管理员、租户成员登录进入工作视图后，会自动弹出最新更新日志
- 自动弹窗按浏览器本地已读签名控制，不额外引入服务端已读状态表

## 6. 租户管理员控制台已落地

当前真实状态：

- 租户管理员已切换为原生控制台内容区视图
- 不再依赖独立租户管理员页
- 原生侧边栏会按租户管理员角色裁剪

当前分组与子项主要为：

- `管理`
  - `成员管理`
  - `Agent 分配`
- `Agent`
  - `已有Agent`
- `统计`
  - `统计总览`
  - `耗量统计`

顶栏搜索位已被租户管理员状态条接管，统一显示：

- 当前角色
- 当前登录
- 退出登录

## 7. 租户管理员基础能力已落地

当前已落地：

- 租户管理员登录
- 租户成员创建
- 给成员分配已下发到本租户的 Agent
- 撤回成员已接收的 Agent 分配
- `已有Agent` 视图和详情弹窗
- `耗量统计` 搜索 + 服务端分页
- 成功/错误反馈统一 toast

当前真实补充约束：

- 成员分配撤回时，除了把 `user_agent_assignments.status` 置为失效，还要同步清理派生工作区、运行时别名和 `exec-approvals.json` 里的派生授权桶

## 8. 租户成员 Agent 选择与聊天壳已落地

当前真实状态：

- 租户成员已切换为原生控制台内容区视图
- 不再依赖独立 `tenant-agent-selector.html / tenant-chat.html`
- Agent 选择页以卡片方式显示已分配 Agent
- 成员从卡片进入聊天后，复用原生 `/chat`
- 聊天页顶部 breadcrumb 承接 `Agent选择` 返回入口与当前 Agent 信息
- 当前聊天页已经不再挂载 `oc-chat-ambient` 整屏动态背景；成员聊天路由仍会继续收敛消息卡片 / 输入区阴影，避免长聊天记录滚动时持续掉帧
- 成员 `Agent选择` 视图现在还会主动清掉原生 Control UI 本地会话恢复值，并清空底层 `openclaw-app` 已挂载的聊天 hydration 状态，避免“已回到选择页，但不可见层里仍残留旧聊天页状态”

原生聊天内容保持不变，会话管理改为零侵入侧边栏承接：

- 新建会话
- 当前 Agent 下的会话列表
- 删除确认
- 标题回填
- 草稿切换清理
- 首屏最近页加载 + 顶部滚动触发 sidecar 成员历史分页 prepend

当前真实补充约束：

- 首屏仍复用原生 `chat.history`
- 但成员旧页分页不能把首屏返回消息里的 `__openclaw.seq` 当成全量 transcript 全局序号
- 当前真实实现已经改成：旧页游标优先使用首屏最老可见消息的 transcript `id`，sidecar 再按这个 `id` 在派生 Agent transcript 里定位并回拉更早页

## 9. 租户 sidecar 与 SQLite 底座已落地

当前真实状态：

- SQLite 持久化已打通
- 平台初始化、登录、租户创建、成员管理、Agent 下发等基础接口已打通
- 服务器侧 `openclaw-tenant-platform` 已并入部署链路

## 10. 当前已经落地三种 nodeRole

当前真实状态：

- `control-plane`
- `managed-node`
- `standalone-local`

它们已经不是纸面规划，而是当前真实产品模型。

适配关系当前为：

- `10.20.30.31` 更适合作为 `control-plane`
- `172.30.31.203` 更适合作为 `managed-node`
- 客户离线交付机继续走 `standalone-local`

## 11. standalone local 非 Docker 运行包已落地

当前真实状态：

- 新增本地运行包脚本：`tools/openclaw-control-ui-echarts/package-local-runtime.mjs`
- 可以把本地部署版打包成“预装运行时 + tenant sidecar + 零侵入 Control UI + 本地授权模板”的交付目录
- 运行包启动前会自动补 token、目录链接和本地版 tenant edition 基线
- 如果客户误删 `data/.openclaw/openclaw.json`，启动准备层会按模板自动补回

## 12. direct-docker 本地部署代理链路已落地

当前真实状态：

- `docker-compose.override.yml` 会额外挂出 `openclaw-gateway-proxy`
- 浏览器访问的 `18789` 先到代理层
- `/tenant-platform-api/` 被代理到 `openclaw-tenant-platform:18801`
- 其它请求与 WebSocket 再转发到 `openclaw-gateway:18789`
- 部署脚本会合并 `gateway.controlUi.allowedOrigins`
- 部署脚本会显式同步 `gateway.controlUi.dangerouslyAllowHostHeaderOriginFallback=false`
- 只要走本地前置代理链路，就会同步 `gateway.controlUi.dangerouslyDisableDeviceAuth=true`

## 13. 成员级派生 Agent 隔离已落地

当前真实状态：

- 租户管理员给成员分配 Agent 时，sidecar 会生成稳定的派生 `agentId`
- 这个派生 `agentId` 会写入 `user_agent_assignments.derived_agent_id`
- sidecar 会初始化独立工作区：
  - `workspace-agents/<derived-agent-id>`
- 还会把派生 `agentId` 注册成 runtime config 里的真实 agent entry

当前工作区初始化采用“分层模板继承”：

- 首次分配时，派生工作区会复制母 Agent 的关键顶层 `.md`、`memory/`、`hooks/`
- 后续再次命中派生工作区 ensure 时，只持续回刷 `hooks/`
- 顶层 `AGENTS.md`、`IDENTITY.md`、`USER.md`、`TOOLS.md`、`SOUL.md`、`HEARTBEAT.md`、`BOOTSTRAP.md`、`MEMORY.md` 与 `memory/` 仅在缺失时补种子，不再按母 Agent 后续改动覆盖成员侧个性化内容
- 不继承旧会话或其它运行时产物

当前已经补上的 Skills 隔离：

- `skills/` 不再盲目整树复制
- sidecar 先根据租户模板 + 成员 override 解析最终 skill 集
- 成员分配、模板变更、成员 override 变更、购买确认、启停、重分类、resync 这类显式写操作才会按最终 resolved 集合 reconcile 派生工作区 `skills/`
- 成员聊天、`GET /member/agents`、只读查看成员 Agent、可视化/沙盒/批注/上传等 read/helper 路径不再触发 skills 目录同步
- bundled/base workspace skill 会优先从母 Agent 对应 skill 目录整树物化到派生工作区
- managed skill 当前仍以 `SKILL.md` 为存储真值，因此先只物化该文件
- reconcile 只删除不再 resolved 的 skill 目录，不会清空仍然 resolved skill 目录内部的脚本、`references/`、子目录等附属文件
- 最后同步 derived agent config 的 `skills` allowlist
- 这意味着物理文件层和 runtime 可见层都已经落地

## 14. Skills 市场与租户技能分配已落地第一版

当前真实状态：

- 平台侧已存在独立 `Skills` 视图
- 租户侧当前真实导航已经收敛为独立 `技能` 分组：
  - `市场`
  - `已有技能`
  - `技能分配`
- 旧 `授权` / `分配` 路由仍保留兼容，但内容区已经统一落到同一个成员技能工作台
- sidecar 已落地 Skills 市场数据模型、授权模型、模板模型、成员 override 模型、审计快照模型

当前真实后端表已经存在：

- `platform_skills`
- `platform_skill_versions`
- `platform_skill_agent_bindings`
- `tenant_skill_orders`
- `tenant_skill_entitlements`
- `tenant_agent_skill_templates`
- `user_agent_skill_overrides`
- `tenant_agent_skill_snapshots`

当前真实业务规则已经落地：

- skill 归属按 `tenant`
- skill 分类按 `bundled / free / paid`
- 基础 Agent 工作区里发现的新 skill 会自动建档为 `bundled`
- `bundled` 首次发现后自动写入租户 entitlement 和模板
- `free` 需要租户管理员显式启用
- `paid` 需要租户下单并确认，确认时走租户钱包扣减
- 成员最终 skill 公式已经固定为：
  - `(tenant_agent_template_enabled ∪ member_force_add) - member_force_remove`

当前真实租户操作已经落地第一版：

- 市场页：
  - 以卡片形式查看可用 skill，不再用表格列表作为主展示
  - 点击 skill 卡片或 `详情` 可打开详情弹窗，查看类型、价格、版本、授权状态、兼容 Agent、影响模板与影响成员数量
  - `paid` skill 下单
  - 待确认订单确认购买
  - `free` skill 启用
- 已有技能页：
  - 只读展示当前租户已经拥有的技能授权
  - 支持按技能名称、标识或授权状态筛选
  - 复用 `GET /tenant/admin/skills/entitlements`，不新增后端表或接口
- 技能分配工作台：
  - 左侧为成员树
  - 每个成员可展开查看该成员已分配 Agent
  - 点击具体 Agent 后，右侧只渲染该 Agent 的技能卡片
  - 同一张卡片里同时管理：
    - skill entitlement 启用 / 停用
    - `tenant_agent` 默认模板
    - 成员 assignment 级 `force_add / force_remove`
  - 旧 `授权` / `分配` route 只是别名，不再维护两套独立页面

当前真实平台操作已经落地第一版：

- Skills 列表展示
- 重新发现 bundled skill
- Skill 重同步
- Skill 改分类 `bundled / free / paid`
- Skill 版本查看路由

当前真实路由已经存在：

- 平台：
  - `GET /platform/skills`
  - `POST /platform/skills`
  - `POST /platform/skills/discover`
  - `POST /platform/skills/:id/publish`
  - `POST /platform/skills/:id/reclassify`
  - `POST /platform/skills/:id/resync`
  - `GET /platform/skills/:id/versions`
- 租户：
  - `GET /tenant/admin/skills/market`
  - `GET /tenant/admin/skills/entitlements`
  - `GET /tenant/admin/skills/assignments`
  - `POST /tenant/admin/skills/orders`
  - `POST /tenant/admin/skills/orders/:id/confirm`
  - `POST /tenant/admin/skills/entitlements/:id/enable`
  - `POST /tenant/admin/skills/entitlements/:id/disable`
  - `POST /tenant/admin/skills/templates`
  - `POST /tenant/admin/skills/overrides`

## 15. Skills 缺授权阻断已落地

当前真实状态：

- 当 `tenant_agent` 模板包含未购买或已停用的非 bundled skill 时：
  - 该模板项会被重协调为 `blocked_missing_entitlement`
  - 成员分配接口会直接失败
  - 返回结构里会带 `blockedReasons` 和 `missingSkills`
- 已存在的成员 assignment 不再继续假装可用：
  - `user_agent_assignments.status -> blocked_missing_skills`
  - 成员侧 `listAssignedAgentsForUser()` 会直接隐藏这些 Agent
- 租户管理员在原有成员分配弹窗里已经能看到“缺少技能授权”的禁配提示

## 16. managed-node Skills desired state 已接通

当前真实状态：

- control-plane desired state 里已经包含：
  - `platformSkills`
  - `platformSkillVersions`
  - `tenantSkillEntitlements`
  - `tenantAgentSkillTemplates`
  - `userAgentSkillOverrides`
- managed-node apply 阶段会回放这些数据，并重新 reconcile 派生成员工作区
- 受管节点本地管理写入仍然被 `managed_node_controlled` 阻断

## 17. Skills 相关定向验证已补齐

当前真实已验证：

- `tenant-platform.test.ts`
  - bundled skill 自动发现
  - derived workspace 只保留允许 skill
  - derived agent config `skills` allowlist 同步
  - paid skill 未购买时阻断成员分配
  - paid skill 购买确认后恢复分配
  - 模板 + 成员 override 最终公式
- `tenant-entry.test.ts`
  - 平台 / 租户 Skills 导航入口存在
- `tenant-surface.test.ts`
  - 租户 runtime surface 未因 Skills 页面新增而回归
  - `tenant-skills-workbench` 与旧 `tenant-skills-entitlements` / `tenant-skills-assignments` 别名路由统一落到成员技能工作台
  - `tenant-skills-workbench` 已移除页面顶部搜索框，左侧成员栏新增“搜索用户名称”输入，并仅按用户名过滤成员树

## 18. bootstrap 过滤 hook 已落地

当前真实状态：

- 不再删除派生工作区里的 `BOOTSTRAP.md`
- 真正修复点改成：
  - `tenant-member-bootstrap-filter`
  - 仅在“租户成员普通聊天会话”的 `agent:bootstrap` 中过滤掉 `BOOTSTRAP.md`

而且：

- hook 不只存在于派生工作区
- 零侵入部署层还会同步到 `OPENCLAW_CONFIG_DIR/hooks/tenant-member-bootstrap-filter`
- 确保 gateway 常驻进程能够发现并注册

## 19. sidecar 自动批准辅助链路已落地

当前真实状态：

- tenant sidecar 启动时会在共享 `OPENCLAW_CONFIG_DIR` 下自愈一份专用 operator 设备
- sidecar 会用这份设备身份建立 `operator.approvals` gateway WebSocket 客户端
- 当命中租户派生上下文时，会自动回写 `allow-once`

当前真实边界：

- 这套链路是“异步 follow-up 审批”
- 不是把 gateway 当前这次 `exec` 同步改成无审批
- 当前轮模型仍可能先看到 `approval-pending`

所以它解决的是：

- 租户成员不用自己点批准

它没有解决的是：

- 当前轮一定不出现 `approval-pending`

## 20. Kingdee analytics 宿主桥接已落地

当前真实状态：

- `kingdee-cloud` 类工作区已经支持受控写库链路
- 零侵入 overlay 会同步到基础工作区和现有派生成员工作区
- 目前支持：
  - `query`
  - `write_sql`
  - `cli`

因此当前真实可运行方案已经支持：

- AI 建表
- AI 插入 / 更新 analytics PostgreSQL 数据
- AI 执行宿主工程的 `init-db`、对象同步、销售模块同步

## 21. 选择块协议已落地

当前真实状态：

- 零侵入回复块协议固定为：
  - `single-select { ... }`
  - `multi-select { ... }`

不是做通用表单 DSL，而是做稳定窄协议。

前端会把这些 fenced block 渲染成可点击选择器，并支持：

- “发送至聊天框”
- “按所选继续”

## 22. 当前如何用这份文档

遇到这些情况时，优先回到本文件：

- 你怀疑总方案已经落后
- 你想知道“现在到底做到哪里了”
- 你要判断某个问题是未实现、已实现、还是实现方式已经变了
