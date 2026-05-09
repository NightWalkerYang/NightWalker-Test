# Sandbox V1 租户数据源绑定与成员组织范围设计

- 日期: 2026-04-28
- 状态: 已评审通过，待进入实现计划
- 适用范围:
  - OpenClaw 租户管理平台
  - `kingdee-analytics` 业务缓存库
- 本文目的:
  - 说明为什么要引入“租户绑定数据源 + 成员组织范围”
  - 明确 OpenClaw 与 `kingdee-analytics` 的职责边界
  - 为后续实现、测试、迁移和维护提供统一语义

## 1. 背景与问题

当前系统已经有：

- OpenClaw 的平台管理员、租户管理员、成员、Agent 分配能力
- `kingdee-analytics` 的业务缓存库和按对象落表能力

但当前缺少两层关键治理能力：

1. OpenClaw 无法在租户层明确绑定“当前使用哪一套业务数据库”
2. OpenClaw 无法在成员层明确约束“当前成员能看哪些组织的数据”

现状会带来这些问题：

- 同一个租户无法被稳定映射到一套明确的数据源
- 同一个租户下的不同成员，无法按公司或组织范围做数据隔离
- 前端虽然已有租户管理和成员管理，但缺少数据源和组织权限的配置入口
- `kingdee-analytics` 当前销售对象只有 `sale_org_name`，没有稳定的 `sale_org_id`，导致后续授权过滤基础不牢

本次设计的目标不是把两个项目拆开，而是把它们作为一个持续演进的整体系统进行对接：

- `kingdee-analytics` 负责沉淀和表达业务数据及组织主数据
- OpenClaw 负责租户、成员、Agent、数据源绑定和可见范围授权

## 2. 关键定义

### 2.1 tenant

`tenant` 是 OpenClaw 里的团队容器。

它的职责是：

- 承载成员
- 承载租户级可用 Agent
- 绑定一套业务数据源

它不是业务组织，也不是金蝶账套里的公司主数据。

### 2.2 data source

`data source` 是一个可被租户绑定的业务数据源实例。

在第一阶段，它主要对应：

- 一套 `kingdee_analytics` 数据库

后续允许扩展为同级的其他数据库类型，但 OpenClaw 对它们的接入方式保持统一抽象。

### 2.3 org scope

`org scope` 是成员在当前租户绑定的数据源内，允许看到哪些业务组织。

这个范围必须挂在成员层，而不是租户层。原因是：

- 租户只是团队容器
- 真正消费数据的是成员
- 同一个租户下的不同成员，可能需要看到不同组织

### 2.4 org_id

`org_id` 定义为源系统中的权威组织标识，不由 OpenClaw 自造。

对于金蝶场景，它应该来自金蝶组织主数据或业务对象中的真实组织 ID。

OpenClaw 只保存和使用这个权威 ID 进行授权，不重新发明一套组织编号体系。

## 3. 设计目标

本次设计要达成以下结果：

1. 平台管理员可以维护可用数据源，并把一套数据源绑定给一个租户
2. 一个租户在同一时刻只能绑定一套数据源
3. 租户管理员可以给成员分配可见组织范围
4. 成员默认无组织权限，未授权时不可见任何组织数据
5. 前端在现有租户平台基础上增加配置入口，而不是另起系统
6. `kingdee-analytics` 提供稳定可授权的组织字段，尤其补齐销售对象的 `sale_org_id`
7. 为未来新增其他同级数据源保留扩展空间

## 4. 非目标

本次设计不包含以下内容：

- 不把 `tenant_id` 物理写入 `kingdee-analytics` 所有业务表
- 不把组织权限挂到租户层做统一可见范围
- 不把成员改造成可以自行选择或修改 org 范围
- 不自动把当前 `sale_org_name` 推断映射成永久可信的 `org_id`
- 不在本次设计内完成所有多数据源查询抽象的最终形态

## 5. 角色与权限

### 5.1 platform_admin

最高权限角色。

可执行：

- 管理数据源目录
- 把数据源绑定到租户
- 调整租户成员上限
- 给租户下发可用 Agent

不可下放给租户管理员的能力：

- 修改租户绑定的数据源
- 管理平台级数据源目录

### 5.2 tenant_admin

租户管理员角色。

可执行：

- 创建、删除、启用、禁用成员
- 给成员分配本租户已拥有的 Agent
- 给成员分配 org 可见范围

不可执行：

- 修改租户绑定的数据源
- 管理平台级数据源目录

### 5.3 member

普通成员角色。

可执行：

- 使用被分配的 Agent
- 访问自己被授权的组织数据

不可执行：

- 修改 org 范围
- 修改租户数据源绑定
- 修改其他成员授权

## 6. 核心决策

### 6.1 不在 `kingdee-analytics` 业务表中增加 `tenant_id`

这是本设计最重要的边界之一。

原因：

- `kingdee-analytics` 的业务表表达的是业务数据来源
- OpenClaw 表达的是“哪个租户、哪个成员、能看什么”
- 如果把 OpenClaw 的租户权限边界混入业务缓存表，会让未来多数据源扩展和迁移变得脆弱

因此：

- `kingdee-analytics` 保持业务视角
- OpenClaw 保持授权视角
- 查询时由 OpenClaw 把绑定的数据源和允许的 org 列表解析出来，再传给后续执行链路

### 6.2 租户只绑定一套数据源

一个租户在同一时刻只能有一条生效的数据源绑定。

原因：

- 用户已经明确租户绑定关系是一对一
- 这能显著降低查询、授权、前端交互和排障复杂度
- 成员只需要在该租户唯一的数据源内选择 org 范围

### 6.3 成员 org 权限必须支持三态

成员组织权限不能只靠明细表表达，必须有三种模式：

- `none`: 无权限
- `custom`: 仅允许指定组织
- `all`: 允许当前数据源下所有组织

原因：

- 如果只存明细表，`全选` 无法稳定表达
- 当源数据后续新增组织时，`全选` 应自动继承，不应要求租户管理员再次勾选

### 6.4 更换租户绑定数据源时，成员 org 权限全部失效

当平台管理员修改租户绑定的数据源后：

- 清空该租户的成员 org 明细授权
- 将成员授权模式重置为 `none`

原因：

- 不同数据源下的 `org_id` 集合不一定兼容
- 静默沿用旧授权会造成误授权风险

## 7. 职责边界

### 7.1 `kingdee-analytics` 负责

- 缓存业务对象
- 暴露组织目录
- 为业务对象补齐组织字段
- 保持源系统组织 ID 的稳定性

### 7.2 OpenClaw 负责

- 数据源目录管理
- 租户到数据源的绑定
- 成员 org 范围授权
- Agent 授权
- 运行时按成员权限解析可见数据范围

### 7.3 运行时协作边界

运行时不直接信任前端上传的 org 列表，而是由 OpenClaw 服务端根据当前登录态解析：

- `tenant_id`
- `user_id`
- `data_source_id`
- `source_type`
- `source_connection`
- `scope_mode`
- `allowed_org_ids`

后续查询、报表、Sandbox、Agent 执行都只消费这个解析结果。

## 8. OpenClaw 数据模型设计

本次在租户平台 SQLite 中新增 4 张表。

### 8.1 `data_sources`

平台级数据源目录。

建议字段：

- `id`
- `code`
- `name`
- `source_type`
- `status`
- `connection_json`
- `source_dbid`
- `source_tenant_code`
- `created_at`
- `updated_at`

说明：

- 第一阶段 `source_type` 主要是 `kingdee_analytics`
- `connection_json` 用于存放连接信息或引用信息
- `source_dbid` 和 `source_tenant_code` 用于映射源端租户标识

### 8.2 `tenant_data_source_bindings`

租户与数据源的一对一绑定表。

建议字段：

- `id`
- `tenant_id`
- `data_source_id`
- `bound_by_user_id`
- `created_at`
- `updated_at`

约束：

- `tenant_id` 唯一

### 8.3 `tenant_member_source_policies`

成员在当前绑定数据源上的授权策略表。

建议字段：

- `id`
- `tenant_id`
- `user_id`
- `data_source_id`
- `scope_mode`
- `created_by_user_id`
- `created_at`
- `updated_at`

约束：

- `(tenant_id, user_id, data_source_id)` 唯一

### 8.4 `tenant_member_org_scopes`

成员自定义 org 明细授权表。

仅在 `scope_mode = custom` 时生效。

建议字段：

- `id`
- `tenant_id`
- `user_id`
- `data_source_id`
- `org_id`
- `org_name_snapshot`
- `created_at`

约束：

- `(tenant_id, user_id, data_source_id, org_id)` 唯一

## 9. `kingdee-analytics` 侧契约设计

### 9.1 不改变“一个数据库承载一个账套租户”的前提

保留当前约束：

- 一个数据库只承载一个账套租户的数据
- `tenant_profile.source_dbid` 仍然是源端边界标识

### 9.2 新增统一组织目录出口

建议新增 `org_directory_current`，最少包含：

- `org_id`
- `org_number`
- `org_name`
- `parent_org_id`
- `status`
- `source_dbid`
- `updated_at`

作用：

- 作为 OpenClaw 组织选择弹窗的数据来源
- 作为授权校验时的组织全集来源

### 9.3 新增对象组织字段契约

建议新增 `object_org_scope_registry`，声明每张对象表使用哪个字段做组织过滤。

第一阶段至少覆盖：

- 销售订单
- 销售出库
- 发货通知
- 采购订单
- 收料通知或收货类对象
- 库存和入库类对象
- BOM 和请购类对象

作用：

- 避免在 OpenClaw 中硬编码“哪张表看哪个字段”
- 为未来多对象、多来源扩展保留统一注册表

### 9.4 销售对象补齐 `sale_org_id`

销售对象当前问题已经确认：

- 已取到 `FSaleOrgId.FName`
- 未取到 `FSaleOrgId`

因此需要：

- 调整销售对象 `field_keys`
- 增加 `sale_org_id`
- 可选增加 `sale_org_number`
- 保留 `sale_org_name`

第一阶段至少覆盖：

- `sales_order_current`
- `sales_outstock_current`
- `sales_delivery_notice_current`

### 9.5 销售数据需要重拉

当前 `sales_order_current` 数据没有拉全，并且此前只指定了单一公司口径。

因此补字段后需要：

- 重新执行销售对象全量同步
- 确认不再只有一个 `sale_org_name`
- 确认 `sale_org_id` 有稳定值

### 9.6 本次不升级销售 `row_key`

本轮设计只要求补齐字段和全量重拉，不把 `row_key` 升级迁移一并塞进来。

如果后续验证发现跨组织冲突，再单独设计 `storage_profile` 版本升级。

## 10. API 契约设计

本次在现有租户平台 sidecar API 基础上扩展，不另起服务。

### 10.1 平台管理员 API

- `GET /platform/data-sources`
  - 返回平台可用数据源列表
- `POST /platform/data-sources`
  - 创建数据源
- `PUT /platform/data-sources`
  - 更新数据源
- `GET /platform/tenant-data-source-binding?tenantId=...`
  - 查询租户当前绑定
- `POST /platform/tenant-data-source-binding`
  - 设置或替换租户绑定

### 10.2 租户管理员 API

- `GET /tenant/admin/data-source-binding`
  - 查询当前租户绑定的数据源
- `GET /tenant/admin/orgs`
  - 从当前绑定数据源获取组织目录
- `GET /tenant/admin/member-org-scope?userId=...`
  - 查询成员当前授权模式和 org 明细
- `POST /tenant/admin/member-org-scope`
  - 保存成员 org 授权

### 10.3 运行时解析接口

内部统一返回：

- `tenantId`
- `userId`
- `dataSourceId`
- `sourceType`
- `connection`
- `scopeMode`
- `allowedOrgIds`

### 10.4 错误码

需要显式保留以下错误码，不能静默降级：

- `tenant_data_source_unbound`
- `member_org_scope_empty`
- `data_source_not_found`
- `org_directory_unavailable`
- `member_not_found`
- `forbidden`

## 11. 前端交互设计

### 11.1 平台端

复用现有平台页，不另起系统。

现有落点：

- `tools/openclaw-control-ui-echarts/runtime/tenant/platform-console-page.js`

新增内容：

- 在“租户管理”表增加 `数据源` 列
- 每个租户增加“绑定数据源”按钮
- 新增“数据源管理”页签或区域，用于管理平台级数据源目录

绑定弹窗最少包含：

- 数据源下拉框
- 当前绑定展示
- 变更影响提示

变更提示必须明确说明：

- 更换数据源后，该租户全部成员 org 权限会被清空并重置为无权限

### 11.2 租户端

复用现有租户管理员页。

现有落点：

- `tools/openclaw-control-ui-echarts/runtime/tenant/tenant-console-page.js`

在成员管理表增加：

- `组织范围` 列
- `选择组织范围` 按钮

弹窗交互：

- 显示当前绑定的数据源名称
- 搜索框
- 组织复选框列表
- `全选` 选项
- 支持一个、多个、全部

成员列表摘要显示：

- `未分配`
- `全部组织`
- `1 个组织`
- `N 个组织`

如果租户未绑定数据源：

- `选择组织范围` 按钮禁用
- 摘要显示 `未绑定数据源`

### 11.3 成员端

成员没有配置权限。

当成员无绑定数据源或无 org 权限时，界面应明确返回无权限状态，而不是空白降级。

## 12. 运行时授权解析

运行时必须在服务端解析成员权限，而不是依赖前端传参。

解析流程：

1. 根据登录态找到 `tenant_id` 和 `user_id`
2. 查询租户当前绑定的数据源
3. 查询成员在该数据源上的 `scope_mode`
4. 如果是 `custom`，读取授权 org 列表
5. 如果是 `all`，以组织目录全集作为授权范围
6. 如果是 `none` 或无记录，直接拒绝

输出结果：

- 上游前端和 Agent 不再关心底层授权细节
- 下游只接收已经解析好的授权上下文

## 13. 迁移策略

### 13.1 OpenClaw 迁移

对现有租户平台：

- 所有租户默认“未绑定数据源”
- 所有成员默认 `scope_mode = none`
- 不做静默自动授权

### 13.2 `kingdee-analytics` 迁移

需要完成：

- 补组织目录出口
- 补销售对象 `sale_org_id`
- 重新执行销售对象全量同步

### 13.3 数据源切换迁移

当租户绑定发生切换时：

- 删除该租户旧的 `tenant_member_org_scopes`
- 重置该租户所有成员的 `scope_mode = none`
- 由租户管理员重新授权

## 14. 验收标准

### 14.1 数据层

- `kingdee-analytics` 销售对象可读到 `sale_org_id`
- 组织目录可以稳定列出 org 集合
- 销售全量重拉后，不再只剩单一 `sale_org_name`

### 14.2 平台端

- 平台管理员能创建和维护数据源
- 平台管理员能给租户绑定或替换数据源
- 替换时能看到清空成员 org 权限的提示

### 14.3 租户端

- 租户管理员能为成员设置 `none/custom/all`
- `全选` 在新增组织后仍然保持“全部可见”语义
- 未绑定数据源时不允许配置 org

### 14.4 成员端

- 未授权成员无法查看组织数据
- 已授权成员只能看到自己的 org 范围
- 无权限时返回显式错误，不做隐式降级

## 15. 风险与控制

### 15.1 风险: 源对象组织字段不一致

控制：

- 通过 `object_org_scope_registry` 做对象级声明
- 不在 OpenClaw 中写死每张表的组织字段

### 15.2 风险: `全选` 语义实现错误

控制：

- 必须引入 `scope_mode`
- 不能仅靠 org 明细表表达 `全选`

### 15.3 风险: 切换数据源后误授权

控制：

- 强制清空成员 org 明细
- 强制重置为 `none`

### 15.4 风险: 销售数据重拉范围不完整

控制：

- 补 `sale_org_id` 后执行全量重拉
- 对结果做组织去重和行数验证

## 16. 为什么不是别的方案

### 16.1 为什么不把 org 权限直接挂在租户上

因为同一租户下，不同成员可能看不同公司。

如果把 org 权限挂在租户上，租户内所有成员都只能共享一份组织范围，无法满足成员级隔离。

### 16.2 为什么不直接给 `kingdee-analytics` 表加 `tenant_id`

因为这会把授权边界和业务来源边界耦合到一起。

短期看像是简单，长期会让：

- 多数据源扩展
- 数据迁移
- 跨项目维护

都变得更难。

### 16.3 为什么成员默认无权限

因为默认放开比默认拒绝风险更高。

在租户已经绑定数据源但尚未完成成员授权时，默认拒绝最符合隔离要求。

## 17. 实施顺序建议

1. OpenClaw:
   - 补 SQLite 迁移
   - 补平台端数据源 API
   - 补租户端 org 授权 API
   - 补运行时授权解析
   - 补前端页面与弹窗
2. `kingdee-analytics`:
   - 补销售对象 `sale_org_id`
   - 增加组织目录出口
   - 增加对象组织字段注册信息
   - 执行销售对象全量重拉
3. 联调:
   - 绑定租户到数据源
   - 给成员分配 org 范围
   - 验证成员视图和查询结果

## 18. 对后续维护者的说明

这个功能存在的目的，不是为了给数据库再套一层复杂配置，而是为了解决两个长期问题：

1. OpenClaw 需要知道一个租户到底使用哪一套业务数据
2. OpenClaw 需要知道同一租户下不同成员能看哪些组织

后续如果再接入新的同级数据库，不要绕开这套边界：

- 数据源绑定仍然放在租户层
- 组织范围仍然放在成员层
- 源系统 org ID 仍然使用源端权威字段

如果未来要改动这个方案，优先检查：

- 是否破坏了“一个租户只绑定一套数据源”
- 是否破坏了“成员 org 授权三态”
- 是否把 OpenClaw 权限逻辑重新写回了业务缓存表

这三条是本设计的核心约束。
