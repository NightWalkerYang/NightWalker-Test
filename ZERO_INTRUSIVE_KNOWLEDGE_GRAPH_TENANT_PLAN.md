# 零侵入知识图谱租户化子方案

> 上位文档：`ZERO_INTRUSIVE_TENANT_SYSTEM_PLAN.md`

本文档用于规划知识图谱页面的租户化与持久化升级，前提是不修改 OpenClaw 现有源码目录 `src/`、`ui/`、`apps/`、`extensions/`。

这里的“零侵入”同样指：

- 不修改 OpenClaw 现有源码文件
- 允许通过新增文件、sidecar、代理和部署层去改变知识图谱模块的最终行为逻辑

## 目标

- 保持当前知识图谱页面为零侵入实现
- 保留现有导入导出能力
- 将持久化从浏览器本地 `localStorage` 提升到服务端
- 为图谱数据引入租户与用户维度
- 不修改 OpenClaw 现有核心源码文件

## 非目标

- 第一阶段不把整个 OpenClaw 执行面直接做成真正多租户
- 不把 `sessionKey` 当成用户或租户边界
- 第一阶段不修改核心网关认证、核心 Web UI、Agent 运行时内部实现

## 推荐方向

采用“同源 sidecar API + SQLite”的方案。

知识图谱页面仍然保持为零侵入静态页面，真正的持久化能力由旁路 sidecar 服务提供。浏览器页面通过同源路径，例如 `/knowledge-graph-api/*`，与 sidecar 通信。

## 采用该方向的原因

- 避免修改 `src/` 和 `ui/`
- 对上游 OpenClaw 升级更稳
- 让知识图谱页面不直接依赖网关内部存储契约
- 让 `localStorage` 退化为缓存与兜底，而不是最终真实数据源

## 分阶段方案

### 第一阶段

- 可以接受单共享租户回退模式
- 可以先只支持单张图谱或少量命名图谱
- 使用 SQLite 做持久化
- 图谱页面通过 sidecar API 读写数据
- `localStorage` 继续保留，但只作为浏览器缓存与离线兜底

### 第二阶段

- 从反向代理请求头中获取真实租户和用户身份
- 增加版本历史和乐观锁校验
- 引入图谱级权限
- 增加审计日志

### 第三阶段

- 支持多图谱工作区模型
- 支持协作能力
- 当并发或规模超出 SQLite 能力时再考虑 PostgreSQL

## 按本子方案落地后知识图谱页面会是什么样子

这一节只描述知识图谱页面本身的最终形态，用来配合上位文档中的系统级页面规划。

### 1. 页面整体结构

知识图谱页面仍然建议保持“左图谱、右编辑”的基本结构，因为这种结构最适合图谱浏览、聚焦和编辑。

按本方案演进后，页面建议由四个区域组成：

- 顶部状态区
- 中央图谱画布区
- 右侧实体与关系编辑区
- 底部或次级区域的版本与保存反馈区

### 2. 顶部状态区会显示什么

顶部状态区不应该只是页面标题，而应该承担当前图谱上下文说明。

建议展示：

- 当前租户名称
- 当前图谱名称
- 当前图谱版本号
- 最近保存时间
- 最近编辑人
- 当前保存状态，例如“已同步”“保存中”“存在冲突”

这样用户打开图谱页面时，第一眼就知道自己在编辑哪张图、属于哪个租户、当前状态是否安全。

### 3. 中央图谱画布区会保持什么体验

中央区域仍然是图谱可视化主画布。

体验上建议继续保持：

- 节点可拖拽
- 画布可缩放和平移
- 点击某个实体时，只突出与它直接关联的节点和关系
- 未关联节点自动弱化
- 当前选中节点拥有更明确的视觉焦点

也就是说，图谱的浏览方式仍然接近 Obsidian 式的关系探索，而不是退化成单纯表格。

### 4. 右侧编辑区会变成什么样

右侧编辑区不只负责编辑实体字段，还应成为“当前资源上下文面板”。

建议内容包括：

- 当前选中实体的基础字段
- 自定义属性列表
- 与当前实体直接关联的关系摘要
- 当前实体最后修改时间
- 当前实体最后修改人
- 当前用户是否拥有编辑权限

这样右侧面板既承担编辑功能，也承担租户化后的状态反馈功能。

### 5. 导入导出和持久化反馈如何呈现

导入导出建议保留，但不再作为唯一的数据管理方式。

页面上建议保留：

- 导入 JSON
- 导出 JSON
- 恢复默认图谱

同时新增更明显的持久化反馈：

- 页面加载时显示“正在从服务端加载”
- 保存后显示“已同步到服务端”
- 网络失败时显示“当前仅保存在本地缓存”
- 版本冲突时显示“发现新版本，请刷新或合并”

### 6. 租户化之后用户体感上的变化

租户化后的知识图谱页，对用户最直接的变化不应该是“页面更复杂了”，而应该是：

- 刷新后数据不丢
- 换浏览器还能看到同一张图
- 同租户成员看到的是同一份共享图谱
- 不同租户之间互相看不到对方的图谱
- 页面会明确提示资源归属、版本和同步状态

因此，用户体感上它仍然是一张熟悉的知识图谱页，但背后已经从“浏览器临时玩具”升级为“租户共享业务页面”。

## 身份模型

推荐身份来源：

- 从反向代理请求头中读取租户，例如 `X-OpenClaw-Tenant`
- 从反向代理请求头中读取用户，例如 `X-OpenClaw-User`

过渡期回退值：

- `tenant = default`
- `user = operator`

这样可以在真正接入统一身份系统前，先把服务端持久化跑起来。

## 数据库模型

### `tenants`

字段建议：

- `id`
- `code`
- `name`
- `status`
- `created_at`
- `updated_at`

作用：

- 作为顶层租户边界，用于图谱归属和策略查询

### `users`

字段建议：

- `id`
- `external_key`
- `display_name`
- `email`
- `status`
- `created_at`
- `updated_at`

作用：

- 保存用户主数据，脱离浏览器本地存储

### `tenant_memberships`

字段建议：

- `tenant_id`
- `user_id`
- `role`
- `status`
- `created_at`

作用：

- 建立用户与租户之间的关系，并记录角色

### `knowledge_graphs`

字段建议：

- `id`
- `tenant_id`
- `graph_key`
- `name`
- `description`
- `current_snapshot_json`
- `current_version`
- `created_by`
- `updated_by`
- `created_at`
- `updated_at`

作用：

- 保存图谱当前最新版内容，便于快速读取

### `knowledge_graph_revisions`

字段建议：

- `id`
- `graph_id`
- `tenant_id`
- `version`
- `snapshot_json`
- `created_by`
- `created_at`
- `change_note`

作用：

- 保存图谱变更历史

### `user_preferences`

字段建议：

- `tenant_id`
- `user_id`
- `pref_key`
- `pref_value_json`
- `updated_at`

作用：

- 保存页面级偏好，例如上次选中的图谱、布局状态等

### `audit_logs`

字段建议：

- `id`
- `tenant_id`
- `user_id`
- `action`
- `resource_type`
- `resource_id`
- `payload_json`
- `created_at`

作用：

- 记录导入、导出、恢复、修改等操作日志

## 数据归属规则

- 每张图谱必须归属于一个租户
- 每次修改必须归属于一个用户
- 每条版本记录必须归属于一个图谱和一个租户
- 一旦 sidecar 启用，浏览器本地数据不再是最终真实数据源

## 未来新增的零侵入文件

### Sidecar 服务

- `tools/openclaw-control-ui-echarts/sidecar/knowledge-graph-api/server.mjs`
  - sidecar 服务入口
- `tools/openclaw-control-ui-echarts/sidecar/knowledge-graph-api/config.mjs`
  - 读取环境变量、目录路径、数据库配置
- `tools/openclaw-control-ui-echarts/sidecar/knowledge-graph-api/db.mjs`
  - 管理 SQLite 连接、迁移和事务
- `tools/openclaw-control-ui-echarts/sidecar/knowledge-graph-api/repository.mjs`
  - 封装图谱、版本、偏好、审计的读写逻辑
- `tools/openclaw-control-ui-echarts/sidecar/knowledge-graph-api/identity.mjs`
  - 从请求头解析租户和用户，并处理回退规则
- `tools/openclaw-control-ui-echarts/sidecar/knowledge-graph-api/routes.mjs`
  - 定义 `/knowledge-graph-api/*` 路由
- `tools/openclaw-control-ui-echarts/sidecar/knowledge-graph-api/migrations/001_init.sql`
  - 初始化数据库结构

### 前端运行时

- `tools/openclaw-control-ui-echarts/runtime/knowledge-graph/api-client.js`
  - 封装知识图谱页面对 sidecar 的请求

### 测试

- `test/tools/openclaw-control-ui-echarts/knowledge-graph-api-client.test.ts`
  - 验证浏览器侧请求和回退逻辑
- `test/tools/openclaw-control-ui-echarts/knowledge-graph-sidecar.test.ts`
  - 验证 sidecar 路由、持久化和身份解析

## 未来会修改的零侵入文件

- `tools/openclaw-control-ui-echarts/runtime/knowledge-graph/page.js`
  - 从纯浏览器持久化改为“服务端优先，本地缓存兜底”
- `tools/openclaw-control-ui-echarts/runtime/knowledge-graph/page.css`
  - 增加加载态、保存态、冲突态样式
- `tools/openclaw-control-ui-echarts/static/knowledge-graph.html`
  - 增加服务端状态提示区和非阻塞错误提示
- `tools/openclaw-control-ui-echarts/build-custom-control-ui.mjs`
  - 处理 sidecar 相关资源或配置注入
- `tools/openclaw-control-ui-echarts/setup-direct-docker-compose-up.mjs`
  - 在直连 Docker 部署里生成 sidecar 服务配置
- `tools/openclaw-control-ui-echarts/setup-direct-docker-compose-up.sh`
  - Shell 部署路径下生成 sidecar 服务配置
- `tools/openclaw-control-ui-echarts/README.md`
  - 补充部署和备份说明
- `ZERO_INTRUSIVE_ECHARTS_ADDITIONS.md`
  - 保持零侵入文件清单同步

## 运行时生成文件

- `${OPENCLAW_CONFIG_DIR}/knowledge-graph/knowledge-graph.sqlite`
  - SQLite 主数据库文件
- `${OPENCLAW_CONFIG_DIR}/knowledge-graph/knowledge-graph.sqlite-wal`
  - SQLite WAL 日志文件
- `${OPENCLAW_CONFIG_DIR}/knowledge-graph/knowledge-graph.sqlite-shm`
  - SQLite 共享内存文件
- `${OPENCLAW_CONFIG_DIR}/knowledge-graph/backups/`
  - 图谱数据库和导出文件的备份目录

## 接口草案

### `GET /knowledge-graph-api/v1/bootstrap`

返回：

- 当前解析出的租户
- 当前解析出的用户
- 图谱列表
- 默认图谱键

### `GET /knowledge-graph-api/v1/graphs/:graphKey`

返回：

- 最新图谱快照
- 当前版本号
- 最后更新时间和更新人信息

### `PUT /knowledge-graph-api/v1/graphs/:graphKey`

接收：

- 完整图谱快照
- 可选期望版本号
- 可选变更说明

写入：

- 最新图谱状态
- 一条版本记录
- 一条审计记录

### `GET /knowledge-graph-api/v1/graphs/:graphKey/export`

返回：

- 可下载的 JSON 快照

### `POST /knowledge-graph-api/v1/graphs/:graphKey/import`

接收：

- 导入的 JSON 快照

写入：

- 最新图谱状态
- 一条版本记录
- 一条审计记录

## 冲突策略建议

第一阶段：

- 采用最后写入生效
- 每次保存都生成一条版本记录

第二阶段：

- 使用 `current_version` 做乐观锁
- 版本不匹配时提示用户进行刷新或合并

## 备份策略

- 保留页面内的 JSON 导出能力
- 周期性备份 SQLite 文件
- 可选定时把当前图谱导出成 JSON 快照

## 安全与范围说明

- 本方案解决的是“租户化数据持久化”，不是“整个执行面强隔离”
- 数据库层的租户隔离，不等于工具、工作区、node host 的强隔离
- 如果未来需要真正 hostile-user 级别隔离，仍然需要单独的执行边界

## 验收标准

- 不修改 `src/`、`ui/`、`apps/`、`extensions/`
- 图谱数据在刷新和浏览器重启后仍然存在
- 同一租户在不同浏览器中能读到同一份图谱
- 不同租户之间图谱数据互相隔离
- 导入导出能力继续保留
- sidecar 启用后，每次保存都有版本记录

## 待确认问题

- 每个租户是一张图谱还是多张命名图谱
- 第一阶段是否只暴露一张共享图谱
- 反向代理身份是否能立即接入，还是先用回退模式
- 第一阶段 SQLite 是否足够，还是需要直接上 PostgreSQL
