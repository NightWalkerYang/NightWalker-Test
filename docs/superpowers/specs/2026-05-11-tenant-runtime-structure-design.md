# 零侵入 tenant runtime 结构重构设计

日期：2026-05-11

## 背景

当前零侵入 tenant runtime 已经具备完整能力，但前端运行时结构正在向“大入口 + 大页面 + 分散清理”的方向增长。

当前最明显的结构压力集中在：

- `tools/openclaw-control-ui-echarts/runtime/tenant/entry.js`
- `tools/openclaw-control-ui-echarts/runtime/tenant/member-chat-surface.js`
- `tools/openclaw-control-ui-echarts/runtime/tenant/platform-console-page.js`
- `tools/openclaw-control-ui-echarts/runtime/tenant/tenant-console-page.js`

这些文件已经同时承担：

- route 判断
- session / role 读取
- DOM 壳节点接管
- sidebar / topbar / breadcrumb 注入
- 页面 controller
- 页面 render
- dialog 状态
- polling / observer 清理

这会带来几个直接问题：

1. 后续新增功能时，很容易继续把逻辑堆进 `entry.js` 或超大页面文件。
2. 壳层逻辑、页面逻辑、状态逻辑耦合过深，修一个点更容易误伤别的链路。
3. 代码测试边界不清晰，很多行为只能依赖集成测试兜底。

这轮重构的目标不是修改功能，而是在不改变现有对外行为的前提下，把零侵入前端 runtime 整理成更稳定的结构。

## 目标

本次重构只做前端零侵入 runtime 结构优化：

- 不改变现有登录链路
- 不改变现有 `ocTenantView` 路由契约
- 不改变成员聊天、平台管理、租户控制台的现有功能行为
- 不碰 sidecar `tenant-platform` 的服务端结构
- 不碰构建、部署、manifest、smoke gate 契约

本次重构完成后，应达到：

1. `entry.js` 从总控器收敛为装配器。
2. route / session / storage 真值集中管理。
3. sidebar / topbar / breadcrumb / content-area 的接管逻辑集中到 shell 协调层。
4. 页面模块只处理自己的 controller / render / interaction。
5. 后续新增页面和功能时，有明确落点，避免再次把 `entry.js` 堆大。

## 范围

本次只覆盖：

- `tools/openclaw-control-ui-echarts/runtime/tenant/*`
- `tools/openclaw-control-ui-echarts/runtime/framework/*`
- 对应零侵入测试
- 对应零侵入文档

本次不覆盖：

- `tools/openclaw-control-ui-echarts/sidecar/tenant-platform/*`
- `tools/openclaw-control-ui-echarts/build-custom-control-ui.mjs`
- build manifest
- smoke gate
- preflight
- 部署脚本

## 设计原则

### 1. 保留现有入口，不推倒重写

第一轮重构保留现有主入口文件与主导出：

- `bootTenantEntry`
- `resetTenantEntryForTests`
- `bootMemberChatSurface`
- `resetMemberChatSurfaceForTests`

这样做的目的是：

- 降低回归风险
- 让结构重组与行为修复解耦
- 先移动职责，再决定是否继续对外收缩模块边界

### 2. 先抽共享层，再瘦身大文件

本次重构优先新增最小共享层：

- runtime store
- view registry
- shell coordinator
- lifecycle helpers

在共享层存在后，再把大文件内的逻辑迁出。

### 3. DOM 壳节点接管只走 `dom-compat.js`

所有依赖原生 Control UI DOM 的零侵入逻辑，继续统一复用：

- `tools/openclaw-control-ui-echarts/runtime/framework/dom-compat.js`

不允许在新文件里重新散写上游 selector。

### 4. 不把 Claude 实现生搬进来，只借结构模式

这轮参考 Claude 源码时，只借鉴这些模式：

- 入口装配和核心协调分离
- 注册表式扩展
- 状态来源集中
- 生命周期与 cleanup 集中治理

不直接引入 Claude 的 CLI/TUI 结构，也不把其全套状态体系照搬进零侵入 runtime。

## 目标结构

### A. state / context

职责：

- 当前 session 真值读取
- 当前 role / tenant view / selected tenant agent 派生
- storage key 统一读写
- route 相关共享判断

现有主文件：

- `runtime/tenant/tenant-context.js`

建议新增：

- `runtime/tenant/runtime-store.js`

说明：

`tenant-context.js` 继续保留为共享上下文工具层；`runtime-store.js` 负责保存本次运行期间的共享状态和订阅能力。

### B. navigation / lifecycle

职责：

- route sync
- route event 派发
- observer / polling / event cleanup 注册与释放
- 测试 reset 入口

现有主文件：

- `runtime/tenant/route-sync.js`

建议新增：

- `runtime/tenant/lifecycle.js`

说明：

`route-sync.js` 继续只负责 route 事件同步；`lifecycle.js` 统一承接 teardown、observer、poll timer 等生命周期资源。

### C. shell coordination

职责：

- sidebar / topbar / breadcrumb / content area 的统一接管
- role 对应导航区块装配
- 壳层元素状态同步
- 壳层 cleanup

建议新增：

- `runtime/tenant/shell-coordinator.js`

说明：

当前 `entry.js` 中大量与壳层装配相关的逻辑将迁移到这里，页面模块不再直接管理壳节点接管。

### D. view / page / surface

职责：

- 平台管理页
- 租户控制台页
- 成员聊天页
- 其它 tenant runtime 页面或弹层

建议新增：

- `runtime/tenant/view-registry.js`

页面模块遵守统一 contract：

- `id`
- `match(context)`
- `mount(context)`
- `unmount(context)`
- `sync?(context)`

## 文件拆分草案

### 1. `runtime/tenant/entry.js`

保留：

- `bootTenantEntry`
- `resetTenantEntryForTests`

迁出职责：

- shell 接管逻辑
- sidebar / topbar / utility 区块同步
- visualization / sandbox section 注入与 polling
- 大部分页面分流逻辑

最终定位：

- 装配 runtime store
- 启动 route sync
- 连接 shell coordinator
- 连接 view registry
- 注册全局 cleanup

### 2. `runtime/tenant/member-chat-surface.js`

保留：

- 成员聊天 surface 启动入口
- 成员聊天整体装配逻辑

建议拆出：

- `runtime/tenant/member-chat-storage.js`
- `runtime/tenant/member-chat-history.js`
- `runtime/tenant/member-chat-sidebar.js`
- `runtime/tenant/member-chat-failsafe.js`
- `runtime/tenant/member-chat-usage-sync.js`
- `runtime/tenant/member-chat-route-state.js`

最终定位：

- 协调成员聊天页面装配
- 不再承载所有内部 helper 和状态细节

### 3. `runtime/tenant/platform-console-page.js`

保留：

- 页面入口
- controller 初始化入口

建议拆出：

- `runtime/tenant/platform-console-controller.js`
- `runtime/tenant/platform-console-render.js`
- `runtime/tenant/platform-console-dialogs.js`
- `runtime/tenant/platform-console-data-sources.js`
- `runtime/tenant/platform-console-nodes.js`

最终定位：

- 页面装配器
- 不再直接容纳全部 dialog/render/helper

### 4. `runtime/tenant/tenant-console-page.js`

保留：

- 页面入口
- controller 初始化入口

建议拆出：

- `runtime/tenant/tenant-console-controller.js`
- `runtime/tenant/tenant-console-render.js`
- `runtime/tenant/tenant-console-dialogs.js`
- `runtime/tenant/tenant-console-members.js`
- `runtime/tenant/tenant-console-wallet.js`

最终定位：

- 页面装配器
- 保持现有功能行为不变

## 新增功能治理规则

为了避免后续继续把逻辑堆回 `entry.js`，后续 agent 在新增功能时必须遵守：

1. `entry.js` 只负责 boot、registry 装配、全局 lifecycle 接线。
2. 新增 tenant 页面时，优先新增独立 page / surface 模块，再通过 registry 接入。
3. 不允许把页面级 render、页面级 API 调用、页面级表单状态直接追加到 `entry.js`。
4. 所有 route 切换统一走 `route-sync.js` 与 tenant route helper，不允许页面模块散写 `history.pushState/replaceState`。
5. 所有 session、role、selected agent、tenant view、storage 访问，统一复用 `tenant-context.js` 或 runtime store helper。
6. 所有原生 Control UI DOM 壳节点定位，统一复用 `runtime/framework/dom-compat.js`。
7. shell 级逻辑和 page 级逻辑严格分开：sidebar/topbar/breadcrumb/content-area 归 shell coordinator，业务页面只关心 controller / render / interaction。
8. 新增 polling、observer、事件订阅时，必须通过统一 lifecycle helper 注册 cleanup。
9. 如果未来继续参考 Claude 源码，只借鉴 registry、store、lifecycle、preboot 分层模式，不直接照搬 Claude 的运行时实现。

## 验证策略

本次结构重构属于“不改功能，只调结构”，验证以针对性回归为主：

1. 现有 tenant runtime 相关单测必须继续通过。
2. 新增共享层要补对应单测：
   - registry
   - lifecycle
   - runtime store
   - shell coordinator
3. 被拆分的大页面要至少保留原有行为级测试，不接受只拆文件不补结构回归测试。

## 实施顺序

建议分三步：

1. 先新增共享层与治理文档
   - `runtime-store.js`
   - `view-registry.js`
   - `shell-coordinator.js`
   - `lifecycle.js`
   - 扩展指南文档

2. 再瘦身入口与成员聊天
   - `entry.js`
   - `member-chat-surface.js`

3. 最后拆平台页与租户页
   - `platform-console-page.js`
   - `tenant-console-page.js`

这样可以保证：

- 先建立未来扩展规则
- 再处理高耦合入口
- 最后处理超大页面文件

## 非目标

本次明确不做：

- 不调整 sidecar 服务端边界
- 不改变数据库结构
- 不调整部署链与 build manifest 契约
- 不借本次重构顺手修产品行为问题
- 不做与当前结构治理无关的样式或交互优化

## 结论

推荐采用“轻量内核化”路线：

- 保留现有功能行为
- 保留主要入口导出
- 增加最小共享层
- 把大入口和大页面收敛成更清晰的结构

这是当前零侵入 tenant runtime 最稳妥、同时也最有长期收益的结构优化路径。
