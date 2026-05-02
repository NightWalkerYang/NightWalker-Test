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
   - `tools/openclaw-control-ui-echarts/generated/control-ui/index.html` 里会通过零侵入 auto-token bootstrap 嵌入 `OPENCLAW_GATEWAY_TOKEN`；因此跨机器部署时，不能直接复用另一台机器上已经构建好的 `generated/control-ui/` 成品，必须在目标机器上用该机器当前容器/配置里的 `OPENCLAW_GATEWAY_TOKEN` 重新生成，或至少定向重写嵌入 token。否则浏览器会落回原生 Control UI 连接门，并报 `unauthorized: gateway token mismatch`。
   - 这条部署路径产出的 `generated/control-ui/assets/vendor/` 必须同步零侵入层完整 vendor 目录，而不只是离线 userscript 内嵌的 `echarts.min.js/json5.min.js`；否则 AI 生成的大屏一旦引用 `ECharts-GL`、`GSAP`、`tsParticles`、`PixiJS`、`Babylon.js`、`Three.js` 就会在正式环境直接 `404`。
   - 这条部署路径生成完 `docker-compose.override.yml` 后，还必须默认执行一次定向 `docker compose up -d --force-recreate openclaw-gateway openclaw-tenant-platform openclaw-gateway-proxy`；否则浏览器侧即使已经能拿到最新 HTML，gateway/proxy 也可能仍然跑在旧容器配置上，导致刷新后 `workspace-agent-downloads/.../__openclaw_echarts_view__-*` 这类重写脚本资源继续 `404`。
   - 本地 Docker 部署必须通过部署层追加同源反向代理容器，对浏览器暴露的 `18789` 端口不再直接映射原始 gateway；代理层负责把 `/tenant-platform-api/` 转发到 tenant sidecar，把其它 HTTP/WebSocket 流量转发回 gateway，从而避免修改 gateway 源码，同时避开浏览器对 `18801` 跨端口请求的 CSP 限制。
   - 浏览器侧租户 runtime 默认只允许走同源 `/tenant-platform-api/v1`；不能再因为页面端口是 `18789` 就优先猜测 `http://<host>:18801/tenant-platform-api/v1`、`127.0.0.1:18801`、`localhost:18801` 这类跨端口地址。实测在 `172.30.31.203` 这类 cloud bundle 部署下，这些候选会先被 Control UI 的 `connect-src 'self' ws: wss:` CSP 拦截，造成成员页首屏卡顿甚至“页面进不去”的假死现象。
   - 如果旧版本浏览器本地状态里已经持久化过 `openclaw:tenant-platform:api-base:v1=http://<host>:18801/tenant-platform-api/v1` 这类跨端口覆盖值，新的零侵入 runtime 也必须在读取时自动清除该脏值，避免用户必须手工清 localStorage 或强制清缓存后才能恢复。
   - 如果旧版本浏览器本地状态里还持久化了 `openclaw.control.settings.v1:*` 下的 `sessionKey/lastActiveSessionKey`，但当前成员已经回到 `/?ocTenantView=tenant-agent-selector` 或聊天地址缺少 `tenantAgentId`，新的零侵入 runtime 也必须自动清掉这类原生 Control UI 会话恢复值，避免成员退出后切到管理员、再切回成员时，在 `/chat?...session=...` 与 `/?ocTenantView=tenant-agent-selector` 之间循环跳转。
   - 成员聊天零侵入层原先还带有一个“发送后固定 75 秒绝对超时”的前端 failsafe。实测当成员让 AI 连续写入 Echarts HTML、落地文件并伴随多次工具调用时，这个绝对超时会在后端任务仍在继续时提前把前端流状态清空，表现为页面看起来“卡死”，用户刷新后再发“继续”才会接着做。实际可运行方案已经调整为“更长的空闲超时 + 进展续期”：只要文本流、消息列表或工具流仍在推进，就持续续期；只有长时间完全没有进展时才判定为超时失败。
   - 同一条部署路径还必须同步 `gateway.controlUi.allowedOrigins`，至少覆盖 proxy-facing 的 `http://127.0.0.1:${OPENCLAW_GATEWAY_PORT}` 与 `http://localhost:${OPENCLAW_GATEWAY_PORT}`，并明确关闭 `gateway.controlUi.dangerouslyAllowHostHeaderOriginFallback`；原因是前置代理会让 Host-header fallback 在端口处理上变得脆弱，显式 Origin allowlist 才是稳定路径。
   - 本地 Docker 的 proxy-fronted 部署还必须在配置层同步 `gateway.controlUi.dangerouslyDisableDeviceAuth=true`；因为浏览器现在是经由前置代理进入 gateway，本地 loopback 自动配对不再稳定命中，否则用户会先卡在原生 `pairing required` 页面。这个 break-glass 开关不再只绑定 `local edition`，而是绑定“本地前置代理部署”本身。

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

用户进入系统后，不再使用原生网关连接页，而是通过 Control UI 原生单入口承接统一登录视图：

- 统一登录路由：`./?ocTenantView=login`（仍兼容直接访问 `/login` 路径别名，但退出登录和守卫跳转统一使用查询参数形式，以避免原生 Control UI 路由无法识别 `/login` pathname 时回弹到控制台导致的循环重定向）
- 平台管理员与租户账号共用同一登录入口
- 平台管理员工作视图：`./?ocTenantView=platform-tenants`
- 平台管理员工作视图：`./?ocTenantView=platform-agent-assignment`

当前登录页设计要求：

- 不再把独立静态 HTML 登录页作为长期主入口
- 登录页优先复用 OpenClaw 原生 `login-gate`、`field`、`btn`、`callout` 和主题变量
- 登录页只保留一个核心卡片
- 卡片顶部只保留品牌标识和登录标题

第一阶段登录方式先采用：

- 账号密码登录

登录成功后按入口和角色进入不同页面：

- 平台管理员入口 -> 原生 Control UI 根入口
- 租户登录入口 + 租户管理员账号 -> 统计总览工作台
- 租户登录入口 + 租户成员账号 -> 成员使用工作台

平台管理员进入原生根入口后：

- 未登录不可进入原生控制台
- 未登录时直接跳转到统一登录视图（`./?ocTenantView=login`）
- 登录后在原生侧边栏中新增与“聊天 / 控制 / 代理 / 设置”平级的“管理”分组
- “管理”分组置顶显示
- “管理”分组下第一阶段至少包含：
  - 租户管理
  - Agent 分配

平台管理员账号规则：

- 支持多个平台管理员账号

### 2. 平台管理员页

我们开发和运营侧使用的平台页需要能做这些事：

- 创建租户
- 为租户创建管理员账号和初始密码
- 给租户分配已有 Agent
- 撤回租户已接收的 Agent
- 给租户设置人数上限
- 给租户下的 Agent 设置计费倍率
- 查看租户钱包、Agent 预算、使用情况
- 查看租户审计和关键数据
- 查看各租户成员列表
- 管理平台管理员账号

当前页面定位：

- 以当前 OpenClaw 原生控制台为主入口
- 通过零侵入方式向原生侧边栏注入“管理”分组和管理子菜单
- 平台管理内容直接渲染在原生控制台内容区，不再跳转到旧的独立平台管理页
- 页面风格参考主流后台管理系统，采用侧边导航 + 顶部状态栏 + 指标卡片 + 表格 + 表单区的结构
- 平台管理员只做平台级管理，不进入租户代操作

### 2.1 平台级品牌管理

平台管理员还需要有一套“单机全局品牌管理”能力。

这里的“品牌”不是租户维度，也不是用户维度，而是**当前部署机器对应实例的全局品牌**。

当前要求明确为：

- 一台部署机器只允许一套全局品牌配置
- 这套品牌同时作用于：
  - 登录页
  - 平台管理员页
  - 租户管理员页
  - 租户成员页
  - 聊天页中的固定品牌位
  - 浏览器标题
  - favicon
- 品牌配置与品牌图片不允许进入 Git，也不允许存放在项目目录中
- 品牌配置与品牌图片必须落在部署机器本地，由零侵入 sidecar 承接读写

平台管理员入口要求调整为：

- 原生左下角原有 `知识图谱` 入口对平台管理员不再作为默认入口
- 平台管理员登录后，左下角默认显示 `更改品牌`
- 点击后进入零侵入品牌设置面板，而不是跳转到源码页面

品牌设置项第一阶段固定为：

- 品牌名称
- 页面标题
- Logo 类型
  - 文字 Logo
  - 图片 Logo

Logo 规则固定为：

- `品牌名称` 始终是文本，可独立配置
- `页面标题` 始终是文本，可独立配置
- `Logo` 只能在：
  - 文字 Logo
  - 图片 Logo
    中二选一
- 选择文字 Logo 时：
  - 只允许填写 Logo 文本
  - 不允许同时启用图片 Logo
- 选择图片 Logo 时：
  - 只允许上传图片 Logo
  - 不允许同时启用文字 Logo

品牌配置保存后的行为要求为：

- 当前页面立即生效
- 同浏览器其它已打开标签页自动同步
- 新打开页面直接读取最新品牌
- 当前已是图片 Logo 时，只改品牌名称或页面标题不强制重新上传图片
- 默认不要求重启容器
- 默认不要求重打镜像

品牌配置缺失或删除后的回退要求为：

- 完全回退到当前零侵入默认品牌表现
- 也就是维持当前默认的：
  - 品牌名称
  - `SPTC` 文字 Logo
  - 当前标题与 favicon 行为

### 2.2 平台级更新日志中心

当前还需要补一套“更新日志中心”，用于说明每次零侵入改造到底更新了什么。

实际实现约束明确为：

- 不新起单独服务
- 不新接外部数据库
- 直接复用 tenant sidecar 现有 SQLite 底座
- 在 sidecar SQLite 内新增一张专用更新日志表来存放：
  - 版本号
  - 标题
  - 更新内容
  - 发布人
  - 发布时间
  - 更新时间

登录后展示规则明确为：

- 平台管理员登录后：
  - 进入工作视图后自动弹出最新更新日志
  - 右下角点击 `版本` 后可查看历史更新
- 租户管理员登录后：
  - 进入工作视图后自动弹出最新更新日志
  - 右下角点击 `版本` 后可查看历史更新
- 租户成员登录后：
  - 进入工作视图后自动弹出最新更新日志
  - 右下角点击 `版本` 后可查看历史更新

当前自动弹窗的实际实现不做服务端“全局已读表”，而是按“浏览器 + 当前登录用户”本地记住最近一次已读的 `更新日志 id + updatedAt` 签名：

- 同一用户同一浏览器重复进入时，不会一直重复弹同一条
- 如果平台管理员新建了新的更新日志，则下次登录会弹出新条目
- 如果平台管理员改动了当前最新那条更新日志内容，则会按新的 `updatedAt` 再次弹出

平台管理员右下角 `版本` 弹窗需要额外具备：

- `新建更新`
  - 打开新增更新日志弹窗
  - 填写版本号、标题、更新内容
  - 保存后直接写入 sidecar SQLite
- `修改`
  - 打开历史更新日志管理弹窗
  - 弹窗里必须有搜索框和列表
  - 平台管理员点击某一条历史更新后进入编辑弹窗
- `删除`
  - 在历史更新日志管理弹窗里提供删除入口
  - 删除后租户侧历史记录同步消失

租户侧要求明确为：

- 只读查看，不允许新建、修改、删除
- 登录后自动弹出的就是当前最新发布的一条
- 右下角 `版本` 可以回看历史

零侵入运行时落点固定为：

- `runtime/tenant/update-log-dialog.js`
- `runtime/tenant/update-log-dialog.css`

sidecar 落点固定为：

- `sidecar/tenant-platform/routes.mjs`
- `sidecar/tenant-platform/db.mjs`
- `sidecar/tenant-platform/migrations/001_init.sql`

### 3. 租户管理员页

租户管理员进入后，需要能做这些事：

- 登录后默认先进入 `统计总览`
- `统计总览` 中的 `已用积分` 需要展示累计消耗积分而不是钱包余额，并固定显示到小数点后 2 位，便于和其它积分类汇总保持一致

- 查看本租户基础信息
- 查看当前成员数和成员上限
- 在人数上限内添加成员
- 删除成员
- 给成员分配平台已下发到本租户的 Agent
- 在侧边栏 `Agent -> 已有Agent` 中以卡片查看本租户已有 Agent，并可打开详情弹窗查看名称、标识、说明、状态、倍率和时间
- 查看租户钱包余额
- 从租户钱包划转积分到某个 Agent
- 查看每个 Agent 的预算、消耗和计费倍率
- 查看扣费流水和充值记录
- 重置本租户成员账号密码
- 查看耗量明细列表

当前约束：

- 一个租户只允许一个管理员
- 租户成员账号第一阶段只保留账号和密码
- 成员停用后禁止登录，但保留历史
- 成员删除采用“物理删除成员账号 + 保留历史耗量快照”的方式：
  - 物理删除 `users` 中该成员账号
  - 依赖外键级联物理删除该成员对应的 `tenant_memberships`
  - 物理删除该成员对应的 `user_agent_assignments`
  - 物理删除该成员对应的 `tenant_agent_sessions`
  - 同步清理该成员派生出来的专属 Agent 工作空间目录，包括 `workspace-agents/<derivedAgentId>` 与 `workspace-<derivedAgentId>`
  - `tenant_usage_records` 不删除；删除成员前会把历史耗量固化为成员快照字段，后续仍可按原成员名称查看耗量统计
  - `tenant_wallet_ledger`、`audit_logs` 等历史记录默认保留；其中用户外键引用按数据库约束自动置空
  - 后续在同一租户内用相同账号重新创建成员时，直接创建一条新的成员账号记录，不再复用旧 `users` 行

当前实现还需要明确一条部署前提：

- 只要部署把 `OPENCLAW_CONFIG_DIR` 和基准 Agent workspace 拆成两个宿主路径，tenant sidecar 也必须看到同一份基准 workspace
  - 推荐做法是让 sidecar 额外挂载或解析到 `/home/node/.openclaw/workspace`
  - 不能只让 gateway 容器看到 `workspace/`，而 sidecar 只挂 `.openclaw`
  - 否则租户管理员给成员分配 Agent 时虽然会创建 `workspace-agents/<derivedAgentId>`，但派生目录只会留下 `.tenant-derived-agent.json` 空壳，无法继承原 Agent 的 `MEMORY.md` / `memory/` / `skills/`

### 4. 租户成员入口与聊天页

租户成员进入后，只需要做使用相关的事情：

- 只看到被分配给自己的 Agent
- 可以在已分配的多个 Agent 之间自主切换
- 选择某个 Agent 后直接进入聊天页
- 聊天页继续复用原生 `/chat`
- 成员 Agent 选择视图只允许挂在原生根入口 `./?ocTenantView=tenant-agent-selector`，不再允许停留在 `/chat?ocTenantView=tenant-agent-selector`
- 如果浏览器历史或旧本地状态把 `ocTenantView=login` 错挂到 `/chat` 上，运行时必须先自愈回干净的成员聊天路由或成员 Agent 选择页，不能让登录壳继续接管 `/chat`
- 聊天页顶部需要提供当前 Agent 信息和 `Agent选择` 返回入口
- 聊天页侧边栏只负责成员自己的会话管理，包括：
  - 新建会话
  - 当前 Agent 下的会话列表
- 成员点击 `新建会话` 后，草稿态路由不强行写入 `session`；要等首条消息把会话真正落到 gateway / sidecar 后，再把稳定 `session` 补回地址栏
- 当前实际可运行方案已调整：对草稿态或空历史会话，零侵入 runtime 直接保持原生聊天消息数组为空，并显式结束 loading，让原生 `/chat` 自己渲染欢迎页；不再注入“空 assistant 占位消息”。这次调整是为了解决成员点击 `新建会话` 后页面落成“空的聊天 Agent”而不是欢迎页的问题。现阶段本机验证下，这条路径比旧的占位消息兜底更稳定，也更符合用户预期。
- 只看到当前 Agent 剩余积分提示

当前限制：

- 租户成员不能看到自己的消费明细
- 租户成员不能看到租户总钱包余额
- 租户成员页面结构只保留：
  - Agent 选择页
  - 某个 Agent 对应的聊天页

### 4.1 可视化展示公共页

租户成员侧边栏额外增加一个 `可视化展示` 下拉菜单，菜单项只来自当前登录成员已分配 Agent 工作空间下的 `Echarts/*_index.html` 文件。点击后进入公开路由 `./echarts-view/?token=...`，该路由由独立静态入口页承载，页面本身只负责加载可视化桥接脚本并通过签名 token 请求对应 workspace HTML，再将其挂载到全页 iframe 中；在装载前，服务端会把 workspace HTML 里的内联 `<script>` 外提成同源的生成脚本文件（放到对应 Agent 的 `Echarts/__openclaw_echarts_view__/...` 下），并把相对资源路径重写成绝对的同源 workspace 地址；其中带中文、空格、括号等不安全文件名的相对资源，还必须同步复制成 `__openclaw_echarts_view__` 目录下的 ASCII/hash 别名资源，再把 HTML / 外提脚本里的引用改到这些别名上，避免浏览器编码后的静态文件请求命中 `404`。外提脚本里凡是 `fetch`、`open`、`href/src` 之类的相对 URL 也会被改写，`*_index.html` 之间的跳转则回到对应的公开 `/echarts-view/?token=...` 路由，从而绕开 `srcdoc` 与 `base-uri 'none'` 对相对资源解析的 CSP 限制，避免外层控制台壳干扰可视化脚本。同浏览器如果 query token 丢失，则回退到最近一次点击记住的 token（sessionStorage 和 localStorage 双保险），避免跳转后白屏。

实际实现还需要补一条：凡是大屏内部再跳到另一个 `*_index.html` 的场景，不论是 `<a href>`、内联 `onclick`，还是 `window.location.*` 这类脚本跳转，都必须在重写时改成“顶层窗口跳转”。也就是 `<a>` 改成指向公开 `/echarts-view/?token=...` 且带 `_top`，脚本里的 `location.assign/replace/href` 改写到 `window.top.location.*`。原因是可视化正文本身运行在 `srcdoc iframe` 里，如果继续在 iframe 内部打开 `/echarts-view/`，就会触发该公开页自身的防嵌入响应头，出现“拒绝连接”。

`/echarts-view/` 的独立入口页必须落在 `echarts-view/index.html`，这样控制台网关会直接返回这份静态页而不是回落到主壳；`/echarts-view` 这个旧式裸路径仍可以作为兼容性别名继续保留在路由归一化里，但分享链接和成员菜单都应统一使用带 trailing slash 的 token 化链接。

大屏可视化 HTML 自身需要直接引用同源静态资产，不允许再写 `https://cdn.jsdelivr.net/npm/echarts...` 这类外链。当前零侵入运行时已经预装并可直接使用这些公开路径：`/assets/vendor/echarts.min.js`、`/assets/vendor/echarts-gl.min.js`、`/assets/vendor/gsap.min.js`、`/assets/vendor/pixi.min.js`、`/assets/vendor/babylon.js`、`/assets/vendor/tsparticles.bundle.min.js`、`/assets/vendor/three.module.min.js`，以及浏览器可直接加载的 `Three.js` addon 路径 `/assets/vendor/three/examples/jsm/**`；其落盘位置对应 `tools/openclaw-control-ui-echarts/generated/control-ui/assets/vendor/`。如需兼容旧产物，ECharts 仍可回退到 `/assets/runtime/echarts/echarts.min.js`。后续如果继续新增可视化库，也必须按同样原则落为同源静态资源或预打包 bundle，不允许依赖公网 CDN。生成出的 HTML 只应告知用户“已生成什么可视化内容，并可在侧边栏 `可视化展示` 中查看”，不要暴露文件名；同时不要依赖 `base` 标签来解决相对路径，必须把相对资源改写成绝对同源路径。

当前桥接层的实际稳定边界还需要明确为：

- `可视化展示` 菜单当前只扫描工作区 `Echarts/` 根目录下的 `*_index.html`，因此每张大屏都必须保留一个位于 `Echarts/` 根目录的静态入口页
- 当前桥接层会重写普通 `src/href/data/poster` 资源引用，并会把内联脚本外提成同源生成脚本，但它不是 bundler，不会自动接管整个 ESM 模块图
- 当前桥接层默认会改写内联脚本中的 `fetch`、`open`、`location.*`、`.href=`、`.src=` 等相对 URL；但 `import ... from "./x.js"`、`dynamic import("./x.js")`、`new Worker("./x.js")`、`new URL("./x", import.meta.url)` 这类模式不在默认重写名单内
- 因此 3D / 粒子大屏的推荐交付形态不是“未打包源码工程”，而是“单 HTML 入口 + 单 bundle 或少量稳定同源脚本 + 本地静态资源”
- 如果 AI 先产出 React / Vue / Three.js / Babylon.js 工程，最终落盘到工作区时也必须先预打包成静态可部署产物，再放进 `Echarts/` 目录，不允许把 dev server、裸模块导入、动态分包、service worker 直接带进成员公开页链路

3D / 粒子 / 高级可视化大屏的完整交付规范以 `ZERO_INTRUSIVE_3D_VISUALIZATION_RUNTIME_SPEC.md` 为准。

当前要求：

- 这个路由不要求登录
- 复制链接后可以直接分享给别人访问
- 页面内容只显示目标工作空间中的 HTML 内容，不再保留占位卡片或额外外层壳

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

- 通联 H5 收银台
- 租户管理员侧可选择：
  - 通联收银台
  - 微信支付
  - 支付宝支付

当前实际实现不是前端直接拿二维码 JSON，而是：

- sidecar 创建充值订单
- 钱包页在创建订单后直接显示二维码
- 二维码内容不是原始支付参数，而是同源零侵入支付跳转链接
- 手机扫码后会打开同源零侵入支付跳转页
- 跳转页自动提交通联 H5 收银台表单
- 支付结果优先靠通联异步回调确认
- 租户管理员也可以在钱包页手动查询订单状态补确认

### 5.1 公有云部署下的钱包模式

公有云部署下：

- 租户通过在线支付充值
- 创建订单后进入通联 H5 收银台
- 支付成功后订单先保持待处理，再由回调或主动查询确认
- 订单确认后，钱包按 `1 元 = 1 积分` 增加积分
- 租户管理员再把积分划转到 Agent
- 成员使用 Agent 时按规则扣减

### 5.2 客户本地部署下的授权与用量模式

客户本地部署下，不走在线充值，这一点仍然成立。

但按当前代码现实，必须先把“本地版”重新定义清楚：

- 当前仓库里已经跑通的 `local edition`，本质上是“单机 standalone 本地运行包”
- 它不是“受平台统一管控的远端节点”
- 因此旧设计里“线上版本直接连通所有本地版本、统一下发授权和 Agent”的说法，和当前真实实现不一致，不能继续沿用

这个边界已经被当前零侵入实现写死在几处关键位置：

- `tools/openclaw-control-ui-echarts/sidecar/tenant-platform/config.mjs`
  - 当前只区分 `cloud` / `local` 两种版型
- `tools/openclaw-control-ui-echarts/sidecar/tenant-platform/license.mjs`
  - 当前只读取“本机”的 `local-license.json` 与本地公钥
- `tools/openclaw-control-ui-echarts/sidecar/tenant-platform/routes.mjs`
  - 当前 `local` 路径走 `/setup/local-tenant-admin`
  - 不再启用平台管理员初始化
- `tools/openclaw-control-ui-echarts/sidecar/tenant-platform/db.mjs`
  - 当前 Agent 目录来自当前机器的 `openclaw.json`
  - 成员分配后的派生工作区也直接落到当前机器 `OPENCLAW_CONFIG_DIR/workspace-agents`

所以，这一段现在要分成两种场景来看：

- `standalone local`
  - 完全离线或不接平台控制面的客户单机版
  - 客户公司自行管理大模型厂商 API Key 或 coding plan
  - 我们不介入客户本地模型凭证管理
  - 不走在线支付
  - 不做积分扣费
  - 只做使用期限控制、权限控制、统计和审计
- `managed node`
  - 仍然部署在客户本地或私有环境
  - 但它不是独立后台
  - 而是由平台控制面统一下发“租户/成员/Agent/授权期限”的受管节点

也就是说，客户本地部署不是单一概念，而是两条产品线：

- 一条是“离线单机版”
- 一条是“受管节点版”

当前已经落地的是前者，不是后者。

### 5.3 公有云模式与本地部署模式共存

最终产品形态不应该再只分“公有云版”和“本地版”，而应该拆成三类角色：

- `control-plane edition`
  - 只给平台管理员使用
  - 负责租户、成员、授权期限、节点绑定、Agent 下发策略、审计
- `managed-node edition`
  - 跑在 `10.20.30.31` 这类线上租户节点或客户本地节点
  - 负责真正的 OpenClaw gateway、成员聊天、派生 Agent 工作区、usage 同步
  - 自己不做平台最终主数据源
- `standalone-local edition`
  - 对应当前已经落地的 `local edition`
  - 只适合完全离线或不接平台控制面的单机交付

换句话说：

- 当前代码里的 `cloud edition`
  - 更接近“单机集中式租户平台”
  - 不是最终意义上的平台控制面
- 当前代码里的 `local edition`
  - 更接近“离线单机版”
  - 不是最终意义上的受管节点版

这三类角色应该长期共存，但页面文案、权限结构和部署方式必须明确区分：

- `control-plane edition`
  - 解决“平台级集中管理”
- `managed-node edition`
  - 解决“线上节点或客户本地节点的受管运行”
- `standalone-local edition`
  - 解决“完全离线交付”

页面层至少要区分：

- 当前节点角色
- 是否启用平台管理员入口
- 钱包与充值文案是否出现
- 授权状态来自本机缓存还是平台控制面
- Agent 分配是本机自管还是平台下发

### 5.4 客户本地部署下如何保证系统控制权限

要实现你现在真正想要的能力，最核心的问题已经不是“本地版怎么做控制权”，而是“平台控制面和受管节点怎么分层”。

推荐把最终系统拆成下面这条主线。

#### 5.4.1 服务器角色重新划分

结合你当前两台服务器的目标定位，推荐改成：

- `172.30.31.203`
  - 平台控制台版
  - 只承接平台管理员、授权中心、节点管理、租户与成员主数据
- `10.20.30.31`
  - 受管节点版
  - 继续承接线上租户实际使用流量
  - 同时作为第一台“样板受管节点”
- 后续客户本地版
  - 也统一使用受管节点版
  - 不再让每台本地机都长成一套“独立线上版后台”

也就是说：

- `172.30.31.203` 不应该再和 `10.20.30.31` 保持“两个同级线上版本”
- 它们应该变成“一个控制平面 + 一个受管节点”

#### 5.4.2 控制平面与受管节点的连通方式

真正要解决的问题不是“线上版本能不能主动连进本地版本”，而是“本地版本如何稳定、可审计地向平台报到”。

第一阶段正确方向应当是：

- 受管节点主动向控制平面发起出站连接
- 控制平面不依赖反向直连、VPN、SSH 隧道或人工端口映射
- 节点通过 HTTPS 轮询或 WebSocket 长连做三件事：
  - 节点注册
  - 心跳上报
  - 期望状态拉取

这样才能覆盖：

- 客户本地节点在 NAT 或内网后面
- 平台不能直接入站访问客户机器
- 某些节点只允许出站访问平台域名

所以最终设计里，不能再把“平台管理员版直接访问每台本地 sidecar”当主链路；主链路必须改成“节点主动出站同步”。

#### 5.4.3 授权与期限控制的新边界

授权不再是“平台把一份本地 License 文件手工扔到每台机器”，而是两层边界：

- 控制平面主授权
  - 记录客户、节点、有效期、允许成员上限、允许 Agent 范围、是否允许离线宽限
- 节点本地缓存授权
  - 节点只缓存最近一次平台签发并签名的授权快照
  - 断网时按快照继续运行到宽限期结束
  - 超期后自动切只读或锁定写操作

第一阶段推荐字段至少包含：

- `nodeId`
- `tenantId`
- `customerName`
- `validFrom`
- `expiresAt`
- `memberLimit`
- `allowedAgentIds`
- `offlineGraceUntil`
- `signature`

这样做的原因是：

- 当前 `license.mjs` 已经有签名校验能力，可以复用“签名快照”思路
- 但它现在只适合“读取本机 `local-license.json`”
- 还不具备“平台签发 -> 节点拉取 -> 本地缓存 -> 到期收敛”的控制面闭环

#### 5.4.4 Agent、成员和数据源的正确分层

要实现“平台分配 / 回收 Agent，调整成员”，必须先把主数据与运行数据分开。

控制平面保存主数据：

- 平台管理员
- 节点清单
- 租户
- 成员
- 节点绑定关系
- Agent 下发策略
- 授权状态
- 平台审计日志

受管节点保存运行态副本：

- 当前节点被分配到的租户/成员镜像
- 当前节点可用 Agent 清单
- 当前节点的 `tenant_agents` / `user_agent_assignments`
- 当前节点派生工作区
- 当前节点会话、用量、缓存和本地日志

第一阶段 Agent 分发不要直接做“平台下发任意 Agent 包”，而应先做最小可行版：

- 节点启动后上报自己当前 `openclaw.json` 可见 Agent 目录
- 平台管理员只能从“该节点已上报的 Agent”里分配
- 节点收到变更后再把分配结果落到本地 SQLite，并继续复用现有派生工作区逻辑

原因很直接：

- 当前 `readOpenClawAgentCatalog()` 读取的是“当前机器上的 `openclaw.json`”
- 当前成员派生 Agent 也是直接操作“当前机器上的 `workspace-agents/`”
- 所以在没有 Agent 包同步链路前，平台只能调度“节点本机已经存在的 Agent”，不能假设所有节点共享同一份 Agent 文件树

#### 5.4.5 第一阶段最小可行实现

为了最小改动、最快验证，第一阶段不要碰这些重活：

- 不做远程文件浏览
- 不做远程 Workspace 双向同步
- 不做平台代理执行 OpenClaw 命令
- 不做统一 SSO 替换本地登录
- 不做跨节点会话迁移

第一阶段只做：

1. 新增平台控制台版
2. 新增受管节点注册与心跳
3. 新增节点期望状态拉取接口
4. 新增“租户/成员/Agent 分配/授权快照”同步到本地 SQLite
5. 本地继续复用现有聊天、派生 Agent、usage 同步、只读收敛逻辑

这样可以最大化复用当前零侵入代码，而不需要改 OpenClaw 核心源码。

#### 5.4.6 standalone local 的保留定位

当前已经跑通的 `local edition` 仍然保留，但定位要明确改成：

- 完全离线客户
- 不接平台控制平面
- 只需要单机授权、单机租户管理员、单机统计
- 由客户本机自行维护模型凭证

它不再承担“平台统一管控所有本地节点”的主路线角色。

### 6. Agent 分配规则

系统里需要有两层分配关系：

- 平台管理员把已有 Agent 分配给租户
- 租户管理员再把该租户已拥有的 Agent 分配给具体成员

成员只能看到自己被分配到的 Agent。
成员可以同时被分配多个 Agent。
成员在某个 Agent 下的会话数量第一阶段不做限制。

当平台管理员把某个 Agent 从租户上撤销后：

- 该租户下所有成员立即看不到这个 Agent
- 该租户下相关成员分配立即统一失效，但不删除历史记录
- 当前实际实现已补齐“剩余积分退回租户钱包”：
  - 平台撤回租户 Agent 时，会把该租户 Agent 剩余积分回退到租户钱包
  - 同时写入独立钱包流水分类 `agent_revoke_refund`
  - 被撤回的租户 Agent 余额会清零，避免重复回退
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

- 平台层负责登记“会话可用列表”并记录隐藏状态，避免基于 LocalStorage 带来的跨设备易失问题
- 每次会话在使用或新建时，前端将生成的明确会话标识发送给平台层进行登记
- 聊天页始终带着这个明确会话标识去调用 OpenClaw
- 出于零侵入限制，无法轻易代理原生 WebSocket，因此前端采用**联合聚合展示**策略：拉取会话时联合平台层 DB 的“非隐藏会话清单”与原生 `sessions.list` 返回的动态状态，配合严密的前缀校验呈现会话列表

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

也就是说，未来页面上的会话状态和所有权必须由平台层数据库接管和收口，彻底弃用纯前端 LocalStorage 隐藏方案。

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

- OpenClaw 原生的 session 机制继续负责“实际聊天上下文、最新 tokens 和动态 title”
- 我们新增的平台数据库负责“租户视角下的会话归属和有效性（是否被隐藏），与原生列表合并展现”

### 8. UI 界面净化

为了确保系统在生产环境（尤其是租户化部署）下的界面整洁性与专业感，通过零侵入方式对原生 UI 中的冗余噪声进行处理：

- **隐藏原生更新提醒**：由于租户环境下的版本稳定性由运维侧统一管理，界面上默认隐藏原生的“Update available”横幅，避免对最终用户造成误导或焦虑。
- **平台管理员左下角入口品牌化治理**：平台管理员登录后的左下角入口不再默认保留 `知识图谱`，而是改为 `更改品牌`，用于承接单机全局品牌管理；知识图谱能力如果后续仍需保留，应作为独立业务入口处理，而不是继续占用默认平台级入口。

## 三、第一阶段只做什么

第一阶段只做控制面，不碰 OpenClaw 核心源码。

当前实施顺序调整为：

- 先完成本地部署授权版
- 先把本地版做成“可部署、可到期、可续期、可只读”
- 再补公有云钱包、通联支付和回调确认闭环

第一阶段目标：

- 有平台管理员登录页
- 有租户登录页
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

先做双入口身份页。

目标：

- 平台管理员有独立登录入口
- 租户管理员和租户成员共用租户登录入口
- 平台入口只允许平台管理员登录
- 租户入口禁止平台管理员登录
- 租户成员登录后先进入 Agent 选择页
- 再从 Agent 选择页进入具体聊天页面
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
- 给租户下发已有 Agent
- 设置人数上限
- 设置计费倍率
- 页面结构接近主流管理后台

### 步骤 4

做租户管理员页。

目标：

- 添加成员
- 给成员分配租户已拥有的 Agent
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

- 最终结算币种固定为人民币 `CNY`，`1 积分 = 1 人民币`
- sidecar 以零侵入本地静态模型单价表和本地静态汇率表作为租户计费真值，不依赖供应商在线价格查询
- 对已配置本地静态单价的 provider/model，优先按 usage token 直接换算 `tenant_usage_records.total_cost`，先按供应商币种计算，再按本地汇率折算为 `CNY`
- 未命中本地静态单价时，云端扣费阶段继续优先复用 OpenClaw usage 明细里已经带出的 `cost.total`
- 当 `tenant_usage_records` 对应消息只有 token、缺少 per-record `cost.total` 时，sidecar 允许回退读取同一 `openclaw_session_key` 在 `sessions.json` 中的 `estimatedCostUsd`
- 回退命中后，必须先按本地 `USD -> CNY` 汇率折算 `estimatedCostUsd`，再按同一会话内各条 usage 记录的 `total_tokens` 占比分摊，最后按 1:1 成本口径记账和扣减积分
- 如果 session 级 `estimatedCostUsd` 仍然不可用，则允许继续按 usage token 与本地静态单价或 runtime 模型价格估算 `total_cost`；当前先覆盖 `cleannetworkspace/gpt-5.4` 与 `ollama` 这类零价环境，避免云端租户积分统计长期停留在 0

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

说明：

- 第一阶段需要支持真实支付
- 第一阶段支付渠道由通联 H5 收银台承接，并在租户管理员页提供通联收银台 / 微信 / 支付宝三种选项
- 第一阶段不需要平台管理员手动续费、补单、退款
- 支付成功后先进入待确认订单，再入账
- 支付接入确认走通联聚合
- 支付宝和微信支付由通联聚合承接
- `provider_payload` 当前同时保存支付渠道、创建人和最近一次通联返回报文，不再额外拆 `payment_channel` / `created_by` / `confirmed_at` 字段

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
  - 数据库连接、迁移、租户、成员、钱包、订单、会话映射和扣费聚合逻辑
- `tools/openclaw-control-ui-echarts/sidecar/tenant-platform/allinpay.mjs`
  - 通联签名、验签、H5 收银台跳转表单和交易查询
- `tools/openclaw-control-ui-echarts/sidecar/tenant-platform/routes.mjs`
  - 路由聚合、登录守卫、支付跳转页、支付回调和公开解析接口
- `tools/openclaw-control-ui-echarts/sidecar/tenant-platform/migrations/001_init.sql`
  - 初始化表结构

### 2. 前端运行时

- `tools/openclaw-control-ui-echarts/runtime/tenant/tenant-context.js`
  - 当前用户、当前租户、当前角色上下文
- `tools/openclaw-control-ui-echarts/runtime/tenant/api-client.js`
  - 前端统一 API 调用层
- `tools/openclaw-control-ui-echarts/runtime/tenant/auth-surface.css`
  - 原生单入口登录视图的最小样式覆盖
- `tools/openclaw-control-ui-echarts/runtime/tenant/auth-surface.js`
  - 在原生 `index.html` 上接管平台/租户登录视图
- `tools/openclaw-control-ui-echarts/runtime/tenant/topbar-meta.css`
  - 平台管理员全局顶栏状态样式
- `tools/openclaw-control-ui-echarts/runtime/tenant/platform-access-guard.js`
  - 在原生控制台根入口执行平台管理员会话守卫
- `tools/openclaw-control-ui-echarts/runtime/tenant/entry.js`
  - 在原生侧边栏中注入“管理”分组和租户入口快捷项
- `tools/openclaw-control-ui-echarts/runtime/tenant/feedback-toast.js`
  - 共享的自动消失浮窗反馈提示 helper
- `tools/openclaw-control-ui-echarts/runtime/tenant/platform-surface.css`
  - 原生内容区内的平台管理页布局样式
- `tools/openclaw-control-ui-echarts/runtime/tenant/platform-surface.js`
  - 在原生控制台内容区挂载平台管理视图
- `tools/openclaw-control-ui-echarts/runtime/tenant/tenant-surface.css`
  - 原生内容区内的租户管理员管理页布局样式
- `tools/openclaw-control-ui-echarts/runtime/tenant/tenant-surface.js`
  - 在原生控制台内容区挂载租户管理员管理视图
- `tools/openclaw-control-ui-echarts/runtime/tenant/platform-login-page.js`
  - 平台管理员登录页逻辑
- `tools/openclaw-control-ui-echarts/runtime/tenant/login-page.js`
  - 租户登录页逻辑
- `tools/openclaw-control-ui-echarts/runtime/tenant/member-console-page.js`
  - 租户成员原生控制台 `Agent选择` 视图逻辑
- `tools/openclaw-control-ui-echarts/runtime/tenant/member-surface.js`
  - 将租户成员的 `Agent选择` 视图嵌入原生控制台内容区
- `tools/openclaw-control-ui-echarts/runtime/tenant/member-surface.css`
  - 租户成员原生控制台卡片视图样式
- `tools/openclaw-control-ui-echarts/runtime/tenant/member-chat-surface.js`
  - 成员在原生 `/chat` 路由下固定已选择 Agent 会话的壳层逻辑
- `tools/openclaw-control-ui-echarts/runtime/tenant/tenant-console-page.js`
  - 租户管理员列表与分配视图逻辑
- `tools/openclaw-control-ui-echarts/runtime/tenant/tenant-usage-stats-page.js`
  - 租户管理员耗量统计列表视图逻辑（搜索 + 服务端分页）
- `tools/openclaw-control-ui-echarts/runtime/tenant/platform-console-page.js`
  - 平台管理员页逻辑

### 3. 静态页面

- 当前不再保留租户成员独立静态页面
- 租户成员改为直接复用原生控制台单入口

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
   - 最终统一按人民币 `CNY` 结算，`1 积分 = 1 人民币`

3. 登录账号唯一性
   - 租户内唯一账号

4. 第一阶段扣费口径
   - 对已配置本地静态单价的 provider/model，优先按 usage token 本地结算，并统一折算为 `CNY`
   - 未命中本地静态单价时，继续使用正常大模型 API 调用返回的 usage 与 `cost.total`
   - 如果 usage 明细没有 `cost.total`，则回退使用同会话 `sessions.json` 里的 `estimatedCostUsd`，并先按本地 `USD -> CNY` 汇率折算，再按 `total_tokens` 占比分摊到明细记录
   - 如果 session 级 `estimatedCostUsd` 也缺失或为 0，则允许 sidecar 按 usage token 与本地静态单价或 runtime 模型价格估算 `total_cost`
   - sidecar 只做同步、记账、积分扣减，不依赖在线价格查询；本地静态单价表与本地静态汇率表是第一阶段租户计费真值
   - 暂不把 coding plan 当作主计费口径

5. 客户本地部署
   - 不走在线充值
   - 客户公司自行管理大模型厂商 API Key 或 coding plan
   - 我们不介入客户本地模型凭证管理
   - 页面上要与公有云模式显式区分

- 本地租户管理员只能在 License 允许范围内管理系统
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

- 可以看耗量明细列表

29. 租户管理员明细列表默认状态

- 默认第一页明细列表，不额外加时间范围筛选

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
   - 撤回租户已接收的 Agent
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
   - 查看耗量明细列表

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

8. 公有云模式支付与扣费已落地
   - 账号密码登录
    - 最终统一按 `CNY` 结算并按 `1 积分 = 1 人民币` 扣积分；命中本地静态单价的模型优先按 token 本地计费，未命中时再复用源系统 `cost.total`
    - 租户管理员原生侧边栏已新增 `钱包 -> 钱包充值 / 充值订单 / 模型耗用 / 钱包流水`
    - `模型耗用` 页面当前只展示 `usage_charge` 模型扣费记录，`钱包流水` 页面当前只展示充值入账、Agent 划转扣减和 Agent 撤回回退，并统一补上搜索框与分页
    - `划转到 Agent` 当前已从钱包页移到 `Agent -> 已有Agent` 卡片按钮，并统一更名为 `划转积分`
    - `划转积分` 当前改为点击卡片按钮后弹出弹窗办理，不再在卡片内直接展开输入表单
    - `已有Agent` 卡片当前不再直接展示 `计费倍率`
    - 顶栏当前已按 `积分余额 / 当前角色 / 当前登录 / 退出登录` 的顺序展示租户管理员状态
    - `统计总览` 已增加钱包余额卡片和 `立即充值` 入口
    - 当前在线支付实际接法为通联 `4.1 H5收银台`
    - 当前闭环为：
      - 创建充值订单
      - 钱包页直接展示可扫码二维码
     - 手机扫码后打开同源跳转页并自动提交到通联收银台
     - 通联异步回调自动确认
     - 钱包页手动查询订单状态补确认
     - 支付成功后钱包入账
     - 租户管理员把钱包积分划转到 Agent
   - 部署侧必须把 `OPENCLAW_TENANT_PLATFORM_PUBLIC_BASE_URL` 与通联相关 `OPENCLAW_TENANT_PAYMENT_ALLINPAY_*` 变量显式透传到 `openclaw-tenant-platform` 容器；公网支付场景要求这里使用真实可访问的 `https://...` 地址，不能只停留在宿主机 `.env`
   - 通联协议细节按官方文档落地：H5 下单默认生产地址为 `https://syb.allinpay.com/apiweb/h5unionpay/unionorder`，交易查询默认地址为 `https://vsp.allinpay.com/apiweb/tranx/query`，签名字段名使用 `signtype`
   - 通联同步回跳页不能带查询参数，所以当前零侵入实现改为 sidecar 公共返回页 `/tenant-platform-api/v1/public/payment/allinpay/return`，再由该页跳回 `/?ocTenantView=tenant-wallet`
   - 通联 `notify_url` 若走 `https` 需要默认 `443` 端口；当前部署若暂时没有 `443` 入口，需要用显式 `OPENCLAW_TENANT_PAYMENT_ALLINPAY_NOTIFY_URL` 单独指定一个可被通联访问的地址
   - 每次模型回复完成后同步 usage；若明细缺少 `cost.total`，则回退使用 session 级 `estimatedCostUsd`，并先折算为 `CNY` 后再分摊；若两者都不可用，则按 token 与本地静态单价或 runtime 模型价格估算
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

11. 第一阶段必须新增的零侵入页面与入口

- 原生单入口统一登录视图：`./?ocTenantView=login`
- 原生根控制台平台管理员守卫：`./`
- 原生侧边栏“管理”分组
- 原生单入口平台管理视图：`./?ocTenantView=platform-tenants`
- 原生单入口平台管理视图：`./?ocTenantView=platform-agent-assignment`
- 原生单入口租户钱包视图：`./?ocTenantView=tenant-wallet`
- 成员原生单入口 Agent 选择视图：`./?ocTenantView=tenant-agent-selector`

12. 第一阶段必须新增的零侵入运行时文件

- `runtime/tenant/tenant-context.js`
- `runtime/tenant/api-client.js`
- `runtime/tenant/auth-surface.css`
- `runtime/tenant/auth-surface.js`
- `runtime/tenant/topbar-meta.css`
- `runtime/tenant/platform-access-guard.js`
- `runtime/tenant/entry.js`
- `runtime/tenant/platform-surface.css`
- `runtime/tenant/platform-surface.js`
- `runtime/tenant/platform-login-page.js`
- `runtime/tenant/login-page.js`
- `runtime/tenant/member-console-page.js`
- `runtime/tenant/member-surface.js`
- `runtime/tenant/member-surface.css`
- `runtime/tenant/member-chat-surface.js`
- `runtime/tenant/tenant-console-page.js`
- `runtime/tenant/tenant-wallet-page.js`
- `runtime/tenant/platform-console-page.js`

13. 第一阶段必须新增的 sidecar 文件

- `sidecar/tenant-platform/server.mjs`
- `sidecar/tenant-platform/config.mjs`
- `sidecar/tenant-platform/db.mjs`
- `sidecar/tenant-platform/auth.mjs`
- `sidecar/tenant-platform/allinpay.mjs`
- `sidecar/tenant-platform/license.mjs`
- `sidecar/tenant-platform/routes.mjs`
- `sidecar/tenant-platform/migrations/001_init.sql`

当前实际实现没有继续拆出 `membership.mjs / wallet.mjs / billing.mjs / payments.mjs / agent-assignment.mjs / sessions.mjs / audit.mjs` 这些子模块：

- 租户、成员、钱包、订单、扣费和会话映射当前主要集中在 `sidecar/tenant-platform/db.mjs`
- 路由、登录、支付回调和公开可视化解析集中在 `sidecar/tenant-platform/routes.mjs`
- 通联签名、验签、H5 收银台跳转和订单查询集中在 `sidecar/tenant-platform/allinpay.mjs`

14. 第一阶段上线后的页面结果

- 平台管理员：
  - OpenClaw 内嵌“租户管理页”
- 租户管理员：
  - 成员管理页
  - Agent 分配页
  - 原生控制台内嵌管理视图
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

## 十一、当前已完成进度

截至当前版本，第一阶段底座中已经实际完成并验证通过的部分如下：

1. 原生单入口登录视图已落地
   - 统一登录路由：`./?ocTenantView=login`（仍兼容直接访问 `/login` 路径别名，但退出登录和守卫跳转统一使用查询参数形式，以避免原生 Control UI 路由无法识别 `/login` pathname 时回弹到控制台导致的循环重定向）
   - 平台管理员、租户管理员、租户成员已合并到同一登录入口
   - 登录页已经改为基于原生 Control UI 单入口运行时接管，而不是长期依赖独立静态登录页
   - 统一登录页已增加会话有效性校验：仅在会话可用时自动跳转，过期/无效会话会先清理后停留登录页
   - 退出登录已统一清理平台与租户两套本地会话，避免登录页与控制台之间循环跳转
   - 成员已登录时如果命中 `/chat?ocTenantView=login...` 这类脏路由，运行时会先改写回干净的成员聊天路由或成员 Agent 选择页，再继续后续 surface 装配，避免页面卡在只剩抬头的半登录壳
   - 成员聊天路由修正已前移到原生 Control UI 主 bundle 之前：零侵入构建现在会在 `index-*.js` 前注入 `runtime/tenant/preboot.js`，优先复用本地缓存的安全成员 session；如果本地还没有缓存，则允许在同源 `/tenant-platform-api/v1/member/sessions` 上同步读取最近一次非草稿成员会话来预种 Control UI 本地 settings；只有这两条都拿不到时才保持无 `session` 路由，等成员聊天 surface 在页面起来后再以内存草稿态接管，避免 `172.30.31.203` 这类环境把全新的随机 session 直接拿去做原生首轮 `chat.history` 后卡死
   - 零侵入构建链路已修正 `/login` 入口产物生成：现在会稳定生成 `login/index.html` 与 `login.html`，避免重建或部署后因登录静态入口损坏而出现 `Not Found`
   - 零侵入部署脚本已改为“保留生成目录、仅替换目录内容”，避免 Docker 仍绑定到被删除的旧空目录，从而在重建后出现控制台根入口与 `/login` 的 `Not Found`

2. 原生根控制台平台管理员守卫已落地
   - 未登录访问根入口时，会先进入统一登录视图（`./?ocTenantView=login`）
   - 平台管理员登录成功后，回到原生根控制台继续工作

3. 原生侧边栏“管理”分组已落地
   - “管理”与“聊天 / 控制 / 代理 / 设置”平级
   - “管理”分组已经置顶显示
   - 当前子项包含：
     - `租户管理`
     - `Agent 分配`

4. 原生控制台内容区平台管理视图已落地
   - `./?ocTenantView=platform-tenants`
   - `./?ocTenantView=platform-agent-assignment`
   - 平台管理内容已经直接在原生控制台内容区渲染，不再把主入口跳转到旧的独立平台页
   - 平台管理视图已拆成独立的“租户管理”和“Agent 分配”内容区
   - 平台管理视图顶部概览卡片和统计块已移除，内容区只保留实际业务区域
   - `租户管理` 已收敛为列表/表格形态：
     - 顶部仅保留搜索框和“创建租户”
     - 表格最右侧提供“人数调整”
     - 底部提供分页

- `Agent 分配` 已收敛为列表/表格形态：
  - 顶部仅保留搜索框
  - 表格最右侧提供“分配Agent”“撤回分配”和“倍率调整”
  - 每行“分配Agent”会先弹出目标租户的 Agent 下发弹窗，交互已对齐租户管理员分配流程：
    - 先加载该租户当前已拥有的 Agent
    - 自动过滤已下发过的 Agent，避免重复选择
    - 支持单选、多选和全选
    - 支持一次批量下发多个 Agent
    - 描述、计费倍率、初始积分作为本次批量下发的共享参数统一提交
  - 每行“撤回分配”会先弹出该租户当前已下发 Agent 的选择弹窗，支持单选、多选和全选；点击“下一步”后会再打开页面内确认弹窗，确认后才执行撤回
  - 平台撤回租户 Agent 后，会同步把该租户成员上关联的 Agent 分配标记为失效，避免成员旧标签页继续使用已撤回 Agent
  - 底部提供分页

5. 平台管理员全局顶栏状态已落地
   - 原生顶栏搜索位已被平台管理员状态条接管
   - 全局显示：
     - 当前角色
     - 当前登录
     - 退出登录
   - 不再只在“租户管理”和“Agent 分配”内局部显示

6. 平台管理员基础能力已落地
   - 平台管理员初始化
   - 平台管理员登录
   - 平台管理员退出
   - 租户创建
   - 租户列表展示
   - 平台管理员向租户下发 Agent
   - 平台管理员撤回租户已接收的 Agent，并同步失效相关成员分配

6.1 平台级更新日志中心已落地

- sidecar SQLite 已新增专用更新日志表
- 平台管理员现在可以在右下角 `版本` 弹窗中：
  - 查看历史更新
  - 新建更新
  - 通过“修改”入口打开带搜索的历史列表
  - 对历史更新进行修改与删除
- 租户管理员和租户成员现在可以在右下角 `版本` 弹窗中查看历史更新
- 平台管理员、租户管理员和租户成员登录进入工作视图后，会自动弹出当前最新更新日志
- 当前自动弹窗按浏览器本地已读签名控制，不额外引入服务端已读状态表

7. 租户管理员基础能力已落地
   - 租户管理员登录
   - 租户管理员已切换为原生控制台内容区视图，不再依赖独立租户管理员页
   - 原生侧边栏当前分组与子项为：
     - `管理`
       - `成员管理`
       - `Agent 分配`
     - `Agent`
       - `已有Agent`
     - `统计`
       - `统计总览`
       - `耗量统计`
   - 原生侧边栏会按租户管理员角色裁剪，只保留：
     - `管理`
     - `成员管理`
     - `Agent 分配`
     - `Agent`
     - `已有Agent`
     - `统计`
     - `统计总览`
     - `耗量统计`
     - 版本信息
   - 耗量统计页当前以零侵入 usage 同步记录为主数据源：租户成员聊天页会优先从 `sessions.usage.timeseries` 提取 assistant usage，必要时回退 `chat.history`，并幂等写入 `tenant_usage_records`
  - 当前真实计费链路已改为本地静态单价优先并统一按 `CNY` 结算：命中本地静态单价的 provider/model 会直接按 usage token 计算 `tenant_usage_records.total_cost`；若 usage 明细缺少 per-record `cost.total`，sidecar 会再读取同一会话 `sessions.json` 中的 `estimatedCostUsd`，先按本地汇率折算到 `CNY`，再按各条记录 `total_tokens` 占比分摊；如果 session 级估算也不可用，则继续按 token 与本地静态单价或 runtime 模型价格估算后写回 `tenant_usage_records.total_cost` 与 `tenant_wallet_ledger`
   - 当前已接通服务端分页记录视图，可查看成员、Agent、总 token、输入、输出、耗用积分与时间；更细的聚合报表保留给 sidecar 数据层
   - 租户管理员底部入口已进一步收紧为仅保留版本块，不再显示文档、知识图谱、租户登录等平台入口
   - 租户管理员原生壳层当前会额外挂一个角色上下文标记，并用全局注入样式强制隐藏所有非 `管理` / `Agent` / `统计` 的原生侧边导航分组（依赖 `data-oc-role-nav` 白名单），避免原生控制台延迟重渲染后又把平台菜单露出来
   - 原生顶栏搜索位已被租户管理员状态条接管，全局显示：
   - 当前角色
   - 当前登录
   - 退出登录
   - 租户成员创建
   - 租户管理员给成员分配已下发到本租户的 Agent
   - 租户管理员撤回成员已接收的 Agent 分配
     - 实际运行方案要求与成员删除保持同一清理语义：撤回时除了把 `user_agent_assignments.status` 置为失效，还要同步清理该 assignment 对应的派生工作区 `workspace-agents/<derivedAgentId>`、运行时别名 `workspace-<derivedAgentId>`，并清掉 `exec-approvals.json` 里的派生授权桶；否则成员再次分配前会长期残留无主 workspace
   - 租户管理员原生壳层已补齐 `已有Agent` 视图：
     - 通过侧边栏 `Agent -> 已有Agent` 进入
     - 页面以卡片展示当前租户已拥有的 Agent
     - 每张卡片提供 `详情` 按钮
     - 点击后弹出页面内详情弹窗，展示 Agent 关键信息
   - 租户管理员原生壳层已补齐 `耗量统计` 视图：
     - 默认按搜索空串展示分页明细列表
     - 支持搜索成员、Agent 或模型
     - 支持服务端分页查看成员、Agent、总 token、输入、输出、耗用积分与时间
   - 列表页底部提示已统一改成自动消失的浮窗，租户管理员、平台管理员和成员 Agent 选择页的成功/错误反馈都走同一套 toast
   - 租户 sidecar 已新增成员聊天耗量明细落库：
     - 成员聊天页会优先从 `sessions.usage.timeseries` 提取 assistant usage；旧环境或异常情况下回退 `chat.history`，并兼容 `input_tokens` / `output_tokens` / `prompt_tokens` / `completion_tokens` 等常见命名
     - sidecar 会按 `session + message fingerprint` 幂等写入，避免重复统计
   - 当平台管理员会话与租户管理员会话同时存在时，租户管理员视图优先使用租户会话，不再被平台管理员侧边栏覆盖
   - 原生壳层即使延迟重渲染，租户入口仍会重新接管顶栏与侧边栏角色裁剪

8. 租户成员基础能力已落地
   - 租户成员已切换为原生控制台内容区视图，不再依赖独立 `tenant-agent-selector.html / tenant-chat.html`
   - Agent 选择页的原生侧边栏当前已收成仅保留 `Agent选择` 入口
   - 租户成员底部入口已收紧为仅保留版本块，不再显示文档、知识图谱等原生入口
   - 原生顶栏搜索位已被租户成员状态条接管，全局显示：
     - 当前角色
     - 当前登录
     - 退出登录
   - 租户成员原生内容区当前以卡片方式显示已分配 Agent
   - 租户成员从卡片进入聊天后，已改为复用原生 `/chat`
   - 当前 Agent 会使用成员专属会话 key，而不再固定到单一会话
   - 聊天页顶部的原生 breadcrumb 区现在承接 `Agent选择` 返回入口与当前 Agent 信息
   - 原生聊天内容保持不变，会话管理改为零侵入侧边栏承接：
     - 新建会话
     - 当前 Agent 下的会话列表
     - 会话标题优先取成员首条消息前 20 个字
     - 旧的时间戳占位标题会在后续读取 `chat.history` 时自动回填修正
     - 已发送过的历史会话当前走 sidecar 隐藏删除，不物理删除底层统计与历史数据；未发送首条消息的草稿会话切走时会直接删除对应 `tenant_agent_sessions` 草稿记录
     - 删除前需要二次确认
     - 删除确认已统一收敛为复用顶栏标准弹窗样式，弹窗文案为“删除后不可恢复，确认删除?”
     - 当前成员会话列表仍复用原生 `sessions.list` 与前端路由 key，但零侵入层已经通过 `/member/sessions` 把 `tenant_agent_sessions` 表真正接入了会话创建、标题回填、隐藏删除链路
     - 未发送首条消息的草稿新会话不再把随机 session key 持久化进浏览器路由；页面内部仍可立即切到该草稿会话，但只有等会话真正变成可用成员会话后才回写 `?session=`，避免用户点击“新建会话”后刷新又反复重进坏 session
     - 如果当前已经处于一个未发送的新会话，再次点击“新建会话”只提示“已经是新的会话了”，不会继续生成新的空会话 key
     - 如果浏览器本地残留了旧的已选 Agent 元信息，或只剩 `tenantAgentId` 但没有完整 `agentId/baseAgentId`，聊天页需要先按 `tenantAgentId` 重新向 sidecar 解析当前成员可用 Agent，再继续接管原生 `/chat`；解析失败时直接回退 `Agent选择`，不能继续卡在原生聊天页
     - 当底层模型运行期长时间无返回或连接异常导致原生聊天页持续 loading 时，零侵入层需要主动收敛到失败态，停止无限转圈并提示成员重试

9. 租户 sidecar 与数据库底座已落地
   - SQLite 持久化已打通
   - 平台初始化、登录、租户创建、成员管理、Agent 下发等第一阶段基础接口已打通
   - 服务器侧 `openclaw-tenant-platform` 已并入部署链路

10. 当前暂时保留但不再作为主路线的兼容页面

- 原生控制台内嵌“租户管理页”
- 这些兼容页后续可以逐步降级或移除，但当前主入口已经切换到原生单入口视图

11. 当前实际已落地为三种 `nodeRole`，不再是“再复制一套线上版”

- `control-plane`
  - 仍然是平台管理员入口和最终主数据源
  - 当前已经落地：
    - 受管节点注册表
    - 节点租约表
    - 租户到节点的绑定表
    - 节点心跳与同步状态表
    - 平台节点管理接口
    - 平台节点管理页
- `managed-node`
  - 当前已经不是“第二个平台管理员版”，而是执行节点
  - 当前已经落地：
    - 节点出站注册
    - 节点出站心跳
    - 节点上报本机 Agent inventory
    - 节点拉取控制面 desired state
    - 节点把租户/成员/租户Agent/成员分配应用到本机 SQLite
    - 节点登录链路按节点租约控制成员可登录、管理员只读
    - 节点本地管理写操作统一返回 `managed_node_controlled`
- `standalone-local`
  - 继续保留签名授权的单机交付版
  - 当前已经落地：
    - 本地授权文件校验
    - 导入授权文件
    - 输入续期码
    - 授权状态透出到登录页和本地授权入口
    - 根入口走租户链路而不是平台管理员链路
    - 授权失效/到期时的登录与只读写拦截
    - 本地版页面移除积分/倍率主语义

11.1 当前真实边界

- `control-plane -> managed-node` 现在同步的是“租户控制面快照”，不是整机镜像复制
  - 控制面下发：
    - 租户
    - 用户
    - 租户成员关系
    - 租户 Agent
    - 成员 Agent 分配
    - 节点租约状态
- `managed-node -> control-plane` 现在上报的是：
  - 节点注册
  - 节点心跳
  - 本机 Agent catalog 摘要
  - 最近一次应用 revision / lastError
- 当前没有做的事情：
  - 不同步成员会话历史
  - 不同步用量账单历史
  - 不把整个 workspace 目录做远程双向镜像
  - 不在受管节点开放平台管理员登录
- 因此现在正确的产品模型是：
  - `10.20.30.31` 适合作为 `control-plane`
  - `172.30.31.203` 适合作为 `managed-node`
  - 客户离线交付机继续走 `standalone-local`

12. standalone local 非 Docker 运行包路径已落地

- 新增本地运行包脚本：`tools/openclaw-control-ui-echarts/package-local-runtime.mjs`
- 当前可以把本地部署版打包成“预装运行时 + tenant sidecar + 零侵入 Control UI + 本地授权模板”的交付目录
- 运行包内已提供：
  - `runtime.env.example`
  - `openclaw.local.example.json5`
  - `start-gateway`
  - `start-tenant-platform`
  - `start-local-runtime`
- 运行包启动前会自动：
  - 把 Gateway token 同步写入 Control UI 预启动脚本
  - 建立 `workspace-downloads` 和 `workspace-agent-downloads` 指向本地数据目录
  - 强制本地版 sidecar 使用 `local` 版型
- 本地版 tenant API 启动链路已增加：
  - bootstrap 重试
  - `localhost / 127.0.0.1 / 当前主机名` 多基址回退
  - 用于降低本机启动初期出现 `API 暂不可用：Failed to fetch` 的概率
- 这条路径的目标不是交付源码仓库，而是交付可运行目录
- 当前交付形态默认面向：
  - 不允许 Docker 的客户机器
  - 只需要运行、不参与构建的客户环境
- 当前本地运行包前提：
  - 客户机器安装 Node.js `22.12+`
  - 客户自行提供模型 API Key 或 coding plan
  - 客户导入本地授权文件或输入续期码
- 当前已补充面向客户交付的部署说明文档：
  - 运行包内会附带客户部署说明
  - 说明文件覆盖启动、授权、公钥放置、续期与到期行为
- 当前已补充可直接填写的本地模板：
  - `runtime.env.example` 已补充模型凭证占位项
  - `openclaw.local.example.json5` 已补充可移植基线配置
  - 客户现场人员可以直接按模板替换实际 provider 和 model
  - 基线会保留模型、工具、默认 Agent 和基础策略，同时排除 auth profiles、已创建 Agent、已保存 API key 等运行态数据
- 当前运行包默认已直接附带：
  - `runtime.env`
  - `data/.openclaw/openclaw.json`
- direct-docker setup 现在会把这份可移植基线同步进现有 `openclaw.json`，再单独补 `gateway.controlUi.root`
- 当前默认 `OPENCLAW_GATEWAY_BIND=loopback`，本机开箱即可启动，不需要额外配置 Control UI origin
- 即使客户误删 `data/.openclaw/openclaw.json`，启动准备层也会按包内模板自动补回
- 当前已补齐非 Docker 运行包兼容层：
  - 打包脚本会额外把运行时缺失的依赖一起装进运行包
  - 运行包内会为 `file-type/core.js` 自动生成兼容入口
  - 本地版默认 `OPENCLAW_GATEWAY_BIND` 已收敛为 `loopback`
  - 目标是避免 Windows 测试机出现缺包启动失败和非法 bind 值启动失败
- direct-docker 本地部署链路已补齐同源前置代理：
  - `docker-compose.override.yml` 现在会额外挂出 `openclaw-gateway-proxy`
  - 浏览器访问的 `18789` 先到代理层
  - `/tenant-platform-api/` 被代理到 `openclaw-tenant-platform:18801`
  - 其它请求与 WebSocket 再转发到 `openclaw-gateway:18789`
  - 这样租户登录页不再依赖浏览器直连 `18801`，也不会再把 `/tenant-platform-api/v1/*` 错误落回 Control UI HTML
- direct-docker 本地部署链路也已补齐 Control UI Origin 固化：
  - 部署脚本会合并 `gateway.controlUi.allowedOrigins`
  - 至少保留 proxy-facing 的 `http://127.0.0.1:${OPENCLAW_GATEWAY_PORT}` 与 `http://localhost:${OPENCLAW_GATEWAY_PORT}`
  - 部署脚本会显式同步 `gateway.controlUi.dangerouslyAllowHostHeaderOriginFallback=false`
  - 目标是让 proxy-fronted 的本地浏览器会话在后续 redeploy 中继续稳定通过 WebSocket Origin 校验，而不是依赖旧的 break-glass Host 回退
- direct-docker 本地部署链路也已补齐本地配对绕过：
  - 只要走 direct-docker 的本地前置代理链路，部署脚本就会同步 `gateway.controlUi.dangerouslyDisableDeviceAuth=true`
  - 目标是让 proxy-fronted 的本地浏览器会话不再卡在原生 `pairing required`
  - 这个值现在不再跟随 tenant edition 来回切换；因为真正触发配对失效的是“本地前置代理 + 非直连 loopback”的链路形态，而不是 tenant edition 本身

13. 成员级 Agent 隔离（方案 A + 部分模板继承）已落地

- 租户管理员执行“成员分配 Agent”时，sidecar 会为该 `成员-租户Agent` 生成稳定的派生 `agentId`
- 该派生 `agentId` 会写入 `user_agent_assignments.derived_agent_id`，并通过列表接口返回给租户成员聊天页
- sidecar 会为派生 `agentId` 初始化独立工作区：
  - 目标目录：`workspace-agents/<derived-agent-id>`
  - 运行时别名：`workspace-<derived-agent-id>`
- 工作区初始化采用“部分模板继承”：
  - 从被分配的基础 Agent 工作区复制 `AGENTS.md / SOUL.md / IDENTITY.md / USER.md / TOOLS.md / HEARTBEAT.md / BOOTSTRAP.md / MEMORY.md / memory.md / memory/ / skills/`
  - 只复制这批白名单内容，不继承旧会话、日志或其他运行时产物
  - 仅在派生工作区缺失对应文件时复制，不覆盖成员后续个性化修改，因此成员派生工作区与母 Agent 是“一次性派生”而不是持续跟随更新
- sidecar 现在还会对派生 Agent 做一层持久授权桶同步：
  - 当成员分配 Agent，或读取旧的成员分配列表时，会把 `<OPENCLAW_CONFIG_DIR>/exec-approvals.json` 里基础 Agent 的 `agents.<baseAgentId>` 授权桶合并到 `agents.<derivedAgentId>`
  - 合并时保留派生桶自己已有的 allowlist 条目，同时用基础 Agent 的 `security / ask / askFallback / autoAllowSkills` 覆盖派生桶对应策略位
  - 成员删除时会同步清理该成员派生 `agentId` 对应的授权桶，避免 `exec-approvals.json` 残留无主派生 Agent 记录
- 当前实际可运行方案已经补了一层 sidecar 级自动批准：
  - tenant sidecar 启动时会在共享的 `OPENCLAW_CONFIG_DIR` 下自愈一份“专用 operator 设备”：
    - 生成或复用 `tenant-platform/identity/tenant-platform-gateway-client.json`
    - 直接把该设备写入 `<OPENCLAW_CONFIG_DIR>/devices/paired.json`
    - 同步写入 sidecar 私有的 `tenant-platform/identity/tenant-platform-device-auth.json`
    - 授权范围固定为最小必需的 `operator.approvals`
  - 之后 sidecar 会用这份已配对设备身份建立 `operator.approvals` gateway WebSocket 客户端，而不是继续依赖前端人工点击授权弹窗
  - 当收到 `exec.approval.requested` 事件时，只要请求命中租户派生上下文，就会自动回写 `allow-once`：
    - `agentId` 以 `tenant-` 开头
    - 或 `systemRunPlan.agentId` 以 `tenant-` 开头
    - 或 `cwd / resolvedPath / command / commandPreview` 命中 `workspace-agents/tenant-*`、`workspace-tenant-*`
    - 或 `sessionKey / systemRunPlan.sessionKey` 命中租户成员会话标记（如 `agent:...:tenant:...:tenant-agent:...`）
  - 这里要明确一个当前真实边界：这套 sidecar 自动批准是“异步 follow-up 审批”，不是把 gateway 当前这次 `exec` 同步改成无审批
    - `gateway` 执行路径仍会先把当前工具调用返回成 `approval-pending`
    - sidecar 自动客户端随后才会监听 `exec.approval.requested` 并回写 `allow-once`
    - 底层命令最终可以继续跑完，但当前这一轮模型仍可能先看到“执行策略拦住了”之类的文案
  - 因此它解决的是“租户成员不需要手点批准”，不是“当前轮永远看不到 approval-pending”
  - 像 `python skills/...` 这类技能脚本执行，如果要在当前轮彻底不出现 `approval-pending`，仍然要走更前面的静态 allowlist / 可执行白名单链路，而不能只依赖这个 sidecar 自动批准器
  - 默认部署通过零侵入 sidecar 环境变量开启：`OPENCLAW_TENANT_PLATFORM_EXEC_AUTO_APPROVE=1`
  - Docker 零侵入部署下建议显式让 sidecar 走容器内网地址：`OPENCLAW_TENANT_PLATFORM_GATEWAY_URL=ws://openclaw-gateway:18789`
- 这样同一个租户下不同成员使用同一租户 Agent 时，不再共享同一份记忆/灵魂工作区状态

14. Kingdee analytics 宿主桥接已补齐零侵入写库链路

- 当前 `kingdee-cloud` 类工作区不再只保留只读查询桥
- 零侵入部署链路现在会把一套 workspace overlay 同步到：
  - 基础工作区 `workspace-agents/kingdee-cloud`
  - 现有派生成员工作区 `workspace-agents/tenant-*-kingdee-cloud-*`
- 同步内容只落在零侵入 overlay 文件，不触碰 OpenClaw 核心源码目录
- 宿主侧原有 forced-command SSH 入口仍复用同一把 key，但桥接脚本已扩成三种模式：
  - `query`
    - 继续承接只读 `select/with/explain`
  - `write_sql`
    - 受控承接 `insert/update/create/alter` 等单语句写库
    - `delete/drop` 这类 destructive 动作要求显式允许
  - `cli`
    - 受控转发宿主 `kingdee_analytics.cli`
    - 当前白名单包含：
      - `init-db`
      - `sync-object`
      - `sync-sales-module`
- 因此当前真实可运行方案已经支持：
  - AI 建表
  - AI 插入/更新 analytics PostgreSQL 数据
  - AI 通过宿主工程执行 `init-db`、单对象同步、销售模块同步
- 这里的真实边界也要明确：
  - 这条桥只解决 `kingdee-cloud` 宿主 analytics 工程与 PostgreSQL 的受控写入
  - 它不是对所有任意数据库默认放开无限制写权限
  - DDL/DML 仍要求用户有明确写入意图，且建议写后立即回查验证

15. AI 结尾动作建议选择块协议已确定为零侵入 fenced block

- 当前真实可运行方案不走“通用表单 DSL”，而是新增两类窄协议：
  - `single-select { ... }`
  - `multi-select { ... }`
- 这两类块都通过零侵入 fenced-block runtime 渲染，不修改 OpenClaw 原生聊天源码
- 当前协议固定为对象 payload，至少包含：
  - `options: []`
- 每个 `options[]` 项当前至少支持：
  - `value`
  - `label`
  - 可选 `description`
  - 可选 `prompt`
  - 可选 `disabled`
- `single-select` 当前额外支持：
  - `title`
  - `description`
  - `submitLabel`
  - `defaultValue`
- `multi-select` 当前额外支持：
  - `title`
  - `description`
  - `submitLabel`
  - `defaultValues`
  - `minSelected`
  - `maxSelected`
- 当前零侵入交互约束明确为：
  - 选项序号不写入 JSON，由前端按顺序决定展示
  - `label` / `description` 按纯文本处理，不支持 HTML
  - 当用户点击“发送至聊天框”时：
    - 单选优先插入该项 `prompt`，没有则回退 `label`
    - 多选会把多个已选项拼成编号列表后插入聊天框
  - 当用户点击“按所选继续”时：
    - 直接把上述拼装结果发送回聊天流
- 这条方案的目标不是构建完整表单引擎，而是稳定承接 AI 在回复结尾输出的“下一步建议动作”选择交互

## 十二、当前还需要继续确认的事项

1. 通联聚合接入材料
   - 你已说明可以提供 `appid`、商户号、交易密码、RSA 私钥、RSA 通联公钥
   - 后续进入实施阶段时，还需要对应 API 文档、回调约定和测试环境说明
