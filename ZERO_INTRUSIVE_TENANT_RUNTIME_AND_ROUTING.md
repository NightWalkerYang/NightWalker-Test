# 零侵入租户运行时与路由规则

这份文档只回答浏览器侧零侵入运行时规则：

- 登录和页面路由
- 平台、租户、成员三类视图切换
- 成员聊天页的会话与草稿规则
- preboot、same-page navigation、draft route lock 等真实实现约束

## 主路由约定

统一通过原生 Control UI 单入口承接零侵入视图，核心查询参数为：

- `ocTenantView`

当前主视图至少包括：

- `?ocTenantView=login`
- `?ocTenantView=platform-tenants`
- `?ocTenantView=platform-agent-assignment`
- `?ocTenantView=tenant-agent-selector`
- `?ocTenantView=tenant-wallet`

平台管理员、租户管理员、租户成员都尽量复用原生单入口，不再长期依赖独立静态页。

## 登录壳规则

当前统一登录视图已经改成：

- 优先复用原生 Control UI 单入口
- 平台管理员、租户管理员、租户成员共用登录入口
- 平台守卫、角色回首页、退出登录等内部跳转统一走同页 `navigateTenantRoute(...)`
- `auth-surface` 自己订阅租户路由变化

原因：

- 不能继续依赖内部同源跳转触发整页刷新完成挂载/卸载
- 否则会出现登录后重复请求、壳层残留、成员欢迎页链路被打断

## 成员路由预处理

成员路由修正不能只依赖后续 `pushState/replaceState`。

如果首屏就落到这些坏地址：

- `/chat?ocTenantView=tenant-agent-selector`
- `/chat?ocTenantView=tenant-agent-selector&session=...`

那么 preboot 阶段必须立即归一化回：

- `/?ocTenantView=tenant-agent-selector`

否则原生聊天壳会先按 `/chat` 启动，最终表现为白屏聊天页或错误的聊天会话恢复。

## preboot 真实职责

当前成员聊天路由修正已经前移到原生 Control UI 主 bundle 之前：

- 零侵入构建在 `index-*.js` 前注入 `runtime/tenant/preboot.js`
- preboot 优先复用本地缓存的安全成员 session
- 如果本地没有缓存，则允许同步调用同源 `/tenant-platform-api/v1/member/sessions`
- 只有这两条都拿不到时，才保持无 `session` 路由，后续由成员聊天 surface 接管

目标：

- 避免原生首轮 `chat.history` 直接撞上错误或随机 session
- 降低成员打开聊天页即卡死的概率

## same-origin API 规则

浏览器侧租户 runtime 默认只允许走：

- `/tenant-platform-api/v1`

不能再优先猜测跨端口地址，例如：

- `http://<host>:18801/tenant-platform-api/v1`
- `http://127.0.0.1:18801/...`
- `http://localhost:18801/...`

原因：

- Control UI 的 CSP 会先拦截这类跨端口请求
- 首屏会卡顿，甚至出现“页面进不去”的假死

因此运行时还必须自动清掉旧的跨端口本地覆盖值，例如：

- `openclaw:tenant-platform:api-base:v1=http://<host>:18801/tenant-platform-api/v1`

## 成员聊天会话规则

成员聊天页所有“新建会话”入口必须统一走零侵入成员会话创建逻辑：

- 直接生成新的 `createTenantMemberSessionKey(...)`

不能继续放任原生聊天工具栏右上角 `New session (+)` 走原生 `/new`，因为：

- Web Chat 原生 `/new` 不等价于新的租户成员会话
- 它仍可能复用当前 `sessionKey` 或当前上下文链
- 表面上像新会话，实际会把旧会话上下文带过去

实现约束补充：

- 成员聊天页对输入框、发送按钮、原生 `New session`、侧边栏、面包屑、顶栏搜索位等原生 DOM 壳节点的定位，必须统一经由 `runtime/framework/dom-compat.js`
- 这层 `dom-compat` 不是只给成员聊天发送链路使用；租户入口挂载、聊天 ambient、品牌面包屑替换、路丰公共壳裁剪、顶栏搜索位与 utility/footer 分组定位，也都必须复用这层兼容契约
- 功能文件不应再直接把这些上游 class selector 散落在各自模块里，否则上游 Control UI 一次结构同步就会把登录壳、成员聊天、公共页裁剪、品牌替换等多条零侵入链路同时打断

## draft route lock

当前真实方案要求：

- 草稿新会话在未发送首条消息前，不把随机 `sessionKey` 持久化进 URL
- 页面内部可以立即切到该草稿会话
- 只有等会话真正变成可用成员会话后，才回写 `?session=`

为了防止原生壳层把随机草稿 key 又写回 URL，运行时还必须维护：

- draft route lock

实现要求：

- `sessionStorage` 为当前成员记录当前 draft key
- `preboot`
- `history.pushState`
- `history.replaceState`

都必须继续尊重这把 lock，直到：

- 首条消息真正发出
- 标题回填完成
- 或草稿被切走 / 删除

## 成员聊天当前会话钉住规则

如果新草稿已经发出首轮消息，但 `sessions.list` 暂时还看不到这条会话：

- 零侵入层仍必须继续钉住当前草稿 `sessionKey`
- 不能因为后台重同步把当前会话回退成旧会话

否则用户点停止/中止按钮时：

- `chat.abort` 会打到错误会话
- 页面表现就是“点击暂停没有任何反应”

## 成员聊天删除规则

当前成员聊天历史删除采用：

- sidecar 隐藏删除
- 不物理删除底层统计与历史数据

草稿会话例外：

- 未发送首条消息的草稿会话切走时，直接删除对应 `tenant_agent_sessions` 草稿记录

删除时要求：

- 二次确认
- 统一复用标准确认弹窗样式

## 成员会话恢复脏状态清理

如果浏览器本地状态里残留了原生 Control UI 会话恢复值：

- `openclaw.control.settings.v1:*`
  - `sessionKey`
  - `lastActiveSessionKey`

但当前成员已经回到：

- `/?ocTenantView=tenant-agent-selector`

或聊天地址缺少 `tenantAgentId`，运行时必须自动清掉这些脏值，避免在：

- `/chat?...session=...`
- `/?ocTenantView=tenant-agent-selector`

之间循环跳转。

## 成员聊天进展判定和 failsafe

成员聊天零侵入层曾有固定 75 秒绝对超时，当前已经改为：

- 更长的空闲超时
- 进展续期

只要下面任一仍在推进，就持续续期：

- 文本流
- 消息列表
- 工具流

当前真实进展判定不能只看“工具卡片数量增加”，还必须把：

- 最后一条 tool 卡片的输出变化
- 状态变化

纳入签名。

原因：

- 原生 Control UI tool stream 会复用同一个 `toolCallId`
- AI 可能长时间在同一张 `write_file` / `exec` / `fetch` 卡片里持续刷进度

## 派生工作区与 bootstrap 过滤

成员派生工作区必须完整继承母 Agent 的：

- `AGENTS.md`
- `SOUL.md`
- `IDENTITY.md`
- `USER.md`
- `TOOLS.md`
- `HEARTBEAT.md`
- `BOOTSTRAP.md`
- `hooks`
- `skills`

不能靠删文件来规避串台。

真正的修复点是：

- 运行时只对“租户成员普通聊天会话”的 `agent:bootstrap`
- 过滤掉 `BOOTSTRAP.md`

而且这条过滤不能只存在于派生工作区的 `hooks/` 内：

- gateway 只会在启动时按默认工作区和受管 hooks 目录做一次全局 hook 装载
- 所以部署层还必须把 `tenant-member-bootstrap-filter` 同步到：
  - `OPENCLAW_CONFIG_DIR/hooks/tenant-member-bootstrap-filter`

## 平台、租户、成员三类视图裁剪

运行时当前还承担三类 UI 裁剪：

### 平台管理员

- 根入口未登录时跳登录
- 原生侧边栏注入“管理”
- 顶栏搜索位改为平台状态条

### 租户管理员

- 侧边栏只保留租户相关分组
- 底部入口只保留版本块
- 顶栏搜索位改为租户管理员状态条

### 租户成员

- 侧边栏只保留 `Agent选择`
- 底部入口只保留版本块
- 顶栏搜索位改为成员状态条

## 读取建议

遇到这些问题时，先读本文件：

- 登录后跳回旧页面
- 成员聊天欢迎页异常
- 新建会话串台
- URL 和页面状态不一致
- route、preboot、history patch、same-page navigation 相关问题
