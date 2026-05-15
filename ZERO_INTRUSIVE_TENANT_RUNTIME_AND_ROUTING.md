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
- 登录遮罩只允许在真实 login route 上激活；一旦 same-page route 离开登录视图，`auth-surface` 必须立即清理 `data-oc-tenant-auth-active` 与 auth root，不能继续把整个原生壳隐藏掉
- 登录态还会把底层原生 `openclaw-app`/`[data-openclaw-app]` 标记为 `data-oc-tenant-auth-hidden="true"`，避免登录页表面可见时，左下角或背景里仍能看到聊天壳继续渲染
- 登录视图还会显式阻止成员聊天 surface 进入会话同步和历史加载分支，避免登录页虽然不可见但仍预热 `sessions.list` / `chat.history`
- 登录视图还会主动清掉原生 Control UI 本地 `sessionKey` / `lastActiveSessionKey` 恢复值，并清空底层 `openclaw-app` 已挂载的聊天 hydration 状态，避免“登录页可见，但底层旧聊天 DOM / 会话状态还残留在不可见层里”

原因：

- 不能继续依赖内部同源跳转触发整页刷新完成挂载/卸载
- 否则会出现登录后重复请求、壳层残留、成员欢迎页链路被打断

## 平台/租户管理挂载规则

当前平台管理员页和租户管理员页的内容区挂载，已经统一经由 `runtime/framework/mount-compat.js`：

- compat 会统一返回 `mode: "native" | "fallback" | "missing"`、`primary`、`appRoot`
- `platform-surface` 与 `tenant-surface` 只消费这套 mount 状态，不再各自拿 `findContentMountRoot() === null` 就直接判失败
- observer 现在先安装，再做首轮扫描
- 首轮扫描会做同步检查、`queueMicrotask`、两次 `requestAnimationFrame` 重试，优先等待原生 `.content` 晚到
- 如果原生 content 仍未出现，才允许进入 fallback
- 进入 fallback 后仍持续监听；只要原生 content 之后出现，必须自动卸载 fallback 并回切到 native mount

当前 fallback 语义也已经收紧：

- fallback 只允许作为“内容区降级容器”
- fallback 不允许再隐藏整个 `openclaw-app`
- 平台、租户、成员选择、成员聊天等依赖原生壳的路由上，顶部和侧边原生壳必须保持可见
- compat 失败时必须进入可识别降级态，不能静默白屏
- 平台管理员和租户管理员这些 root-only 管理视图，不允许再把 `/chat` 当宿主路径
- 如果命中 `/chat?ocTenantView=platform-*` 或 `/chat?ocTenantView=tenant-*` 这类脏地址，preboot 必须先把它改回 `/?ocTenantView=...`，不能先让原生聊天页和会话恢复链路启动，再被零侵入管理页覆盖隐藏

当前 compat observer 还必须继续遵守一条性能边界：

- `runtime/framework/dom-compat.js` 与 `runtime/framework/mount-compat.js` 的 document 级 observer 只允许响应“壳相关 DOM 变化”
- 图表 tooltip、页面业务区表格刷新、弹窗正文、非壳 overlay 子树等高频局部 DOM 抖动，不能再被当成壳重建信号
- observer 必须合并同一轮 mutation 批次，避免一次局部 hover 或 tooltip 更新触发多次 document 级 compat 重扫

原因：

- 零侵入统计页、更新日志、知识图谱、成员业务页面都会产生大量局部 DOM 变化
- 如果 compat 把这些变化错误放大成整页壳扫描，就会表现成 hover 卡顿、控制台高频 long frame/violation、甚至误进 fallback 或误修剪原生壳

## 原生壳识别边界规则

当前 `runtime/framework/dom-compat.js` 对原生壳节点的识别，必须显式排除非壳 overlay 子树：

- `dialog`
- `role="dialog"`
- `aria-modal="true"`
- `data-oc-update-log-root`
- 更新日志弹窗内部节点

这条规则至少覆盖：

- sidebar
- breadcrumb
- topbar search
- sidebar utility
- sidebar footer
- content mount root

原因：

- 更新日志、确认框、管理弹窗等 overlay 会复用 `aside`、`search`、`footer` 一类通用 DOM 结构
- 如果 compat 把这些 overlay 子树误认成原生壳，就会导致 document-global observer 或 tenant shell trim 链路错误接管壳节点
- 即使原生 `.sidebar-nav` 因 rerender 时序短暂进入 `hidden` / `aria-hidden` / `display:none`，document 级 `findSidebar()` 也不能回退改选更新日志弹窗左栏这类 overlay `aside`

## 成员路由预处理

成员路由修正不能只依赖后续 `pushState/replaceState`。

如果首屏就落到这些坏地址：

- `/chat?ocTenantView=tenant-agent-selector`
- `/chat?ocTenantView=tenant-agent-selector&session=...`

那么 preboot 阶段必须立即归一化回：

- `/?ocTenantView=tenant-agent-selector`

否则原生聊天壳会先按 `/chat` 启动，最终表现为白屏聊天页或错误的聊天会话恢复。

## `/echarts-view` 公共页资源基准规则

当前 `/echarts-view` 公共可视化页不是直接整页跳转到工作区 HTML 文件，而是：

- sidecar 解析成员可访问的可视化 HTML
- 把可执行脚本、模块图、样式、工作区资源链接重写到同源 `workspace-agent-downloads`
- 浏览器端再把返回的 HTML 填进 iframe `srcdoc`

这条链路里浏览器端必须继续消费 sidecar 返回的：

- `baseHref`

并把它注入 iframe 文档的 `<base href="...">`。

原因：

- 很多 AI 生成的可视化 HTML 仍会保留相对资源，例如：
  - `./assets/logo.png`
  - `./assets/hero.jpg`
  - `./styles/theme.css`
- 如果 `srcdoc` 文档里没有正确的 `<base>`，这些相对路径会按 `/echarts-view/` 自身解析
- 最终浏览器就会去请求错误地址并稳定报 `404`

实现约束：

- `baseHref` 必须保持 same-origin，并指向当前成员派生工作区的 `workspace-agent-downloads/.../Echarts/`
- 已经被 sidecar 改写成绝对 same-origin 路径的资源保持原样，不应二次改坏
- 如果源 HTML 已经自带 `<base href>`, 浏览器端应以 sidecar 返回的 `baseHref` 覆盖它，避免旧 HTML 把资源重新指回错误目录

## preboot 真实职责

当前成员聊天路由修正已经前移到原生 Control UI 主 bundle 之前：

- 零侵入构建在 `index-*.js` 前注入 `runtime/tenant/preboot.js`
- preboot 优先复用本地缓存的安全成员 session
- 如果本地没有缓存，则允许同步调用同源 `/tenant-platform-api/v1/member/sessions`
- 只有这两条都拿不到时，才保持无 `session` 路由，后续由成员聊天 surface 接管
- preboot 还会把原生 Control UI 的 `control-ui.long-animation-frame` / `control-ui.longtask` 控制台告警压成“每类型首条保留、后续抑制”，避免浏览器 DevTools 因高频响应性诊断刷屏继续放大卡顿；真正的诊断事件仍由原生 event log 缓冲保留有限条数

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

- 成员聊天页对输入框、发送按钮、停止按钮、原生 `New session`、侧边栏、面包屑、顶栏搜索位、session/model picker、brand slots、content root 等原生 DOM 壳节点的定位，当前主链路已经统一经由 `runtime/framework/dom-compat.js`
- `runtime/framework/dom-compat.js` 现在不只负责“找节点”，还会统一给 chat surface / composer / toolbar / send-stop-new-voice / sidebar / utility / footer / content root / brand slots 等关键壳节点同步稳定的 `data-oc-*` 标记，供零侵入样式层和运行时消费
- 当前零侵入运行时已经拆成四层兼容契约：`runtime/framework/dom-compat.js`、`runtime/framework/mount-compat.js`、`runtime/framework/app-compat.js`、`runtime/framework/rpc-compat.js`
- 这四层兼容契约不只给成员聊天发送链路使用；`runtime/lufeng/surface.js`、平台/租户/成员 surface、tenant entry 的 utility/search 探测、品牌替换、知识图谱入口，也已经把 DOM/mount/app/RPC 的高脆弱依赖收口到这四层
- `runtime/framework/styles.js` 与 platform/member/tenant/topbar/lufeng 相关样式现在已经开始优先消费这些 `data-oc-*` 标记，并把旧 upstream class 仅保留为兼容兜底；当前剩余脆弱点主要集中在 compat 内部仍需跟随 upstream 演进维护的壳结构假设、少量聊天内容区内部 class 语义，以及成员聊天里尚未完全去私有化、但已集中封装的少量 `openclaw-app` 私有状态访问
- 当前聊天壳已经彻底移除旧的 `oc-chat-ambient` 整屏 SVG / blur / 持续动画背景；成员聊天路由仍保留更轻量的输入区、消息气泡、tool run 卡片阴影收敛，优先保证长聊天滚动时的帧稳定性
- 成员聊天页会挂载 Canvas 批注入口 `runtime/tenant/member-chat-canvas-annotations.js`；它在原生成员聊天页右侧提供浅色 Canvas 抽屉，加载当前成员可访问的大屏 HTML iframe，支持批注模式开关、区域矩形框选、选区附近浮动评论输入条、批注线程、resolve/reopen，以及单条/全部未解决批注回填到原生聊天输入框的动作
- 这条 Canvas 抽屉批注链路的输入框回填必须继续复用 `runtime/framework/dom-compat.js` 暴露的 composer 定位能力；批注锚点第一版绑定当前大屏预览 iframe 的矩形坐标、成员会话、Agent run、`pageId` / `/echarts-view/?token=...`，不做任意跨域页面 DOM 锚定

当前成员聊天历史加载规则已经调整为：

- 首屏仍只加载最近一页会话消息
- 首屏继续复用原生网关 `chat.history`
- 当用户把聊天滚动到顶部时，零侵入层再走同源 tenant sidecar `/tenant-platform-api/v1/member/sessions/history`
- 返回的更早页会 prepend 到当前 `app.chatMessages`
- 旧页分页游标必须优先使用 transcript message `id`；只有拿不到 `id` 时才允许回退 `seq`
- 原生 `chat.history` 首屏最近页里的 `__openclaw.seq` 不能当成全量 transcript 全局序号，它只是当前 tail 页内序号
- 旧页合并去重必须优先按 transcript message `id`，`seq` 只作为兜底；同时保持当前滚动锚点，不能把视口强制跳到底部或跳回顶部
- 这条链路不额外弹“还有更多历史”之类的 UI 提示
- 这条旧页分页请求不能再直连 gateway `/sessions/:sessionKey/history`，因为当前 Control UI 浏览器 Bearer HTTP 路径不会自动带上 `chat.history` 所需的 `operator.read` scope，线上会稳定得到 `403`
- sidecar 这条成员历史分页接口必须先校验当前登录成员是否真的拥有该 `openclawSessionKey` 对应的成员会话记录，再按派生 Agent transcript 读取旧页

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
- `tenant-skills-workbench` 不能再使用路由级 `100vh` / `calc(100vh - ...)` 高度上限；右侧选中 Agent 的 skill 卡片和 skills grid 必须自然展开并参与原生内容区页面流滚动，避免滚到底仍裁掉底部卡片。
- `tenant-skills-workbench` 页面顶部不再保留独立搜索框；成员筛选入口收口到左侧成员栏顶部，仅按用户名搜索，避免把右侧 Agent / skill 明细过滤和左侧成员导航混在一个输入框里。

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
