# 零侵入租户系统改造总方案

这份文档现在只保留总览、边界和导航，不再承载全部实现细节。

目标：

- 让 AI 先快速理解零侵入租户项目的整体边界
- 让 AI 按模块精确读取相关文档，而不是每次全量扫长文
- 当实际实现已经变化时，优先去读“实施现状”而不是继续依赖旧计划

## 零侵入协作硬规则

1. 只能修改零侵入文件。
   - 现有 OpenClaw 核心源码文件默认指 `src/`、`ui/`、`apps/`、`extensions/` 下已存在文件。
   - 允许新增零侵入文件，或修改此前已经新增的零侵入文件。

2. 零侵入文件清单以 `ZERO_INTRUSIVE_ECHARTS_ADDITIONS.md` 为准。
   - 以后新增零侵入文件时，必须同步维护这份清单。

3. 如果实际实现与文档不一致，以当前可运行方案为准。
   - 需要直接回写对应文档，而不是继续保留失效描述。

4. 固定工作流：
   - 本机修改和测试
   - 推 Gitee
   - `10.20.30.31` 拉取验证并部署
   - 不可以直接上服务器修改文件
   - 不可以在服务器上新增文件夹或编辑文件，除测试外

5. 如果已经完成针对性验证，`git commit message` 必须中文。

6. 服务器连接信息、密码、支付密钥、授权文件等敏感信息不写入仓库文档。
   - 真实连接信息和凭证由运营侧单独保管。
   - 仓库文档和 skill 只保留占位说明，不落真实值。

## 推荐入口

后续在支持项目内 skill 的环境里，优先使用：

- `.agents/skills/zero-intrusive-tenant/SKILL.md`

这个 skill 的职责不是替代方案文档，而是：

- 先给 AI 一张零侵入项目导航图
- 先做任务分流
- 再决定只读哪些模块文档

如果当前环境不支持 skill，再按下面顺序自己读：

1. `ZERO_INTRUSIVE_TENANT_SYSTEM_PLAN.md`
2. `ZERO_INTRUSIVE_ECHARTS_ADDITIONS.md`
3. 当前任务直接相关的模块文档

## 文档地图

### 总览与规则

- `ZERO_INTRUSIVE_TENANT_SYSTEM_PLAN.md`
  - 总览、边界、阶段目标、阅读路径
- `ZERO_INTRUSIVE_ECHARTS_ADDITIONS.md`
  - 零侵入文件清单真值
- `ZERO_INTRUSIVE_TENANT_AGENT_PROMPT_TEMPLATE.md`
  - 推荐给 AI 使用的项目提示词模板

### 设计与实施模块

- `ZERO_INTRUSIVE_TENANT_ARCHITECTURE.md`
  - 系统形态、节点角色、sidecar 边界、模块归属
- `ZERO_INTRUSIVE_TENANT_RUNTIME_AND_ROUTING.md`
  - 登录、路由、成员聊天、会话、preboot、draft route lock
- `ZERO_INTRUSIVE_TENANT_DEPLOYMENT_AND_OPERATIONS.md`
  - direct-docker 部署链路、proxy、镜像重建、token 注入、运维约束
- `ZERO_INTRUSIVE_TENANT_DATA_MODEL.md`
  - SQLite 表、字段、业务约束
- `ZERO_INTRUSIVE_TENANT_BILLING_AND_LICENSE.md`
  - 钱包、积分、支付、授权、本地版与公有云差异
- `ZERO_INTRUSIVE_TENANT_IMPLEMENTATION_STATUS.md`
  - 当前已经真实落地且验证通过的能力
- `ZERO_INTRUSIVE_TENANT_OPEN_DECISIONS.md`
  - 还需要拍板或补材料的事项

## 设计前提

当前 OpenClaw 原始设计不是成熟多租户系统，至少有三个前提限制：

1. 当前默认是单一可信操作者边界。
   - 参考 `src/wizard/setup.ts`

2. `sessionKey` 只是路由和上下文，不是用户边界或租户边界。
   - 参考 `docs/gateway/security/index.md`

3. 多 agent、workspace、agentDir 能复用，但它们本身不是租户系统。
   - 参考 `docs/concepts/multi-agent.md`

因此当前零侵入路线固定为：

- 不改 OpenClaw 核心源码
- 在 OpenClaw 外侧增加租户控制面
- 用 sidecar 承接租户、用户、钱包、授权、分配、计费、审计
- 用零侵入 Control UI runtime 承接登录页、管理员页、成员页、钱包页

## 最终目标摘要

最终系统目标不是“强改 OpenClaw 内核”，而是“在零侵入边界内拼出可运维的租户控制面”。

第一层目标：

- 统一登录入口
- 平台管理员入口
- 租户管理员入口
- 租户成员入口

第二层目标：

- 平台管理员可以创建租户、分配 Agent、看全局统计
- 租户管理员可以管成员、管本租户 Agent、看统计、管钱包或授权
- 租户成员只能看到自己被分配的 Agent，并进入对应聊天

第三层目标：

- 公有云模式支持钱包、扣费、支付、订单回调
- 本地部署模式支持授权、续期、只读到期控制
- managed-node 场景支持控制面与执行节点分离

## 第一阶段范围

第一阶段只做控制面，不碰 OpenClaw 核心源码。

当前已经落地并进入零侵入主线的扩展范围还包括：

- 平台管理员原生壳内入口新增 `创建数据源`，支持平台级数据源创建、编辑、租户绑定
- 租户管理员成员管理新增“组织范围 / 沙盒模拟”控制，成员权限以租户绑定数据源为前提
- 成员侧新增 sandbox 公开路由与 sandbox 列表入口，使用独立 `sandbox-view` 公共页加载运行结果
- direct-docker / package-local-runtime 已同步引入 sandbox 运行时依赖与 Python starter 挂载契约
- 构建链现在同时校验 fingerprinted `sandbox-view/preboot.js`、`sandbox-view/index.html` 与 build manifest marker

这些能力仍然遵守零侵入边界：

- 平台数据源、成员组织范围、sandbox 运行状态都落在 `tools/openclaw-control-ui-echarts/**` 的 runtime/sidecar/doc/test 层
- 不修改 OpenClaw 核心 `src/`、`ui/`、`apps/`、`extensions/` 既有源码

### 第一阶段要完成

- 平台管理员登录与平台管理页
- 租户管理员登录与租户控制台
- 租户成员登录、Agent 选择页、聊天页
- sidecar SQLite 持久化
- Agent 分配关系
- 钱包或授权基础链路
- 审计与使用量同步底座

### 第一阶段不做

- 不做强隔离多租户
- 不做每租户独立 OpenClaw 核心进程
- 不做每租户独立 node host
- 不做极度精确的模型成本核算引擎
- 不做大型产品化重构

## 实施时的读取建议

遇到不同类型任务，优先读这些文档：

- 登录、路由、成员聊天、会话串台、页面挂载问题：
  - `ZERO_INTRUSIVE_TENANT_RUNTIME_AND_ROUTING.md`

- Docker、本地部署、proxy、镜像、token、origin、容器重建：
  - `ZERO_INTRUSIVE_TENANT_DEPLOYMENT_AND_OPERATIONS.md`

- 表结构、成员关系、Agent 分配、钱包流水、订单字段：
  - `ZERO_INTRUSIVE_TENANT_DATA_MODEL.md`

- 积分扣减、静态单价、Allinpay、本地授权、到期只读：
  - `ZERO_INTRUSIVE_TENANT_BILLING_AND_LICENSE.md`

- 不确定“现在到底做到了哪一步”：
  - `ZERO_INTRUSIVE_TENANT_IMPLEMENTATION_STATUS.md`

- 当前需要拍板或补材料：
  - `ZERO_INTRUSIVE_TENANT_OPEN_DECISIONS.md`

## 与其它零侵入主题的关系

- `ZERO_INTRUSIVE_KNOWLEDGE_GRAPH_TENANT_PLAN.md`
  - 仍然是独立专题，不是当前租户主线总方案
- `ZERO_INTRUSIVE_3D_VISUALIZATION_RUNTIME_SPEC.md`
  - 仍然是独立专题，不承载租户系统总览

## 维护约定

以后修改这套方案时，优先遵守下面三条：

1. 总览留在这里，细节放进对应模块文档。
2. 当前实现一旦变化，优先更新模块文档和实施现状。
3. 零侵入文件边界始终以 `ZERO_INTRUSIVE_ECHARTS_ADDITIONS.md` 为准。
