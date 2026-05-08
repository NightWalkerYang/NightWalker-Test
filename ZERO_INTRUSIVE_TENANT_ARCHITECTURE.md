# 零侵入租户系统架构

这份文档只回答系统形态与职责边界：

- 哪些模块属于零侵入租户层
- 哪些角色和节点已经落地
- 哪些能力由 sidecar、runtime、部署层分别承接

## 总体分层

当前零侵入租户系统由四层组成：

1. Control UI 覆盖层
   - 目录主入口：`tools/openclaw-control-ui-echarts/`
   - 负责零侵入接管登录、平台页、租户页、成员页、公共视图和前端路由修正

2. Tenant sidecar
   - 目录主入口：`tools/openclaw-control-ui-echarts/sidecar/tenant-platform/`
   - 负责租户、用户、钱包、授权、订单、使用量同步、更新日志、节点同步等服务端能力

3. 部署与打包层
   - 构建入口：`tools/openclaw-control-ui-echarts/build-custom-control-ui.mjs`
   - direct-docker 入口：`tools/openclaw-control-ui-echarts/setup-direct-docker-compose-up.sh`
   - 负责把零侵入运行时、sidecar、proxy、vendor、token 预启动脚本装配到最终部署产物

4. 工作区覆盖层
   - 目录主入口：`tools/openclaw-control-ui-echarts/workspace-overlays/`
   - 负责派生 Agent 工作区中的 hook、skill、宿主桥接脚本等零侵入覆盖内容

## 零侵入边界

这套改造的核心原则是：

- 不直接修改 OpenClaw 核心源码
- 不把租户逻辑硬编码进 `src/`、`ui/`、`apps/`、`extensions/`
- 通过 runtime 注入、sidecar、部署脚本、workspace overlay 达成产品行为

当前允许的主要实现手段：

- 新增零侵入脚本
- 修改已有零侵入脚本
- 增加 sidecar 路由和 SQLite 表
- 增加 Control UI 预启动脚本与运行时覆盖
- 增加 workspace hook 与 skill
- 增加部署层 proxy、compose override、打包逻辑

## 三种 nodeRole

当前真实实现已经收敛为三种节点角色，而不是“复制两套平台”：

### `control-plane`

作用：

- 平台管理员主入口
- 主数据源
- 租户控制面

当前已落地：

- 受管节点注册表
- 节点租约表
- 租户到节点绑定表
- 节点心跳与同步状态表
- 平台节点管理接口
- 平台节点管理页

### `managed-node`

作用：

- 执行节点
- 接收控制面快照并在本机应用

当前已落地：

- 节点出站注册
- 节点出站心跳
- 本机 Agent inventory 上报
- desired state 拉取
- 租户、成员、租户Agent、成员分配快照应用
- 节点登录链路按租约控制成员可登录、管理员只读
- 本地管理写操作统一返回 `managed_node_controlled`

### `standalone-local`

作用：

- 本地授权单机交付版
- 不依赖 control-plane

当前已落地：

- 本地授权文件校验
- 导入授权文件
- 输入续期码
- 授权状态接入登录页和本地授权入口
- 根入口走租户链路而不是平台管理员链路
- 到期后的登录与只读写控制
- 本地版页面移除积分/倍率主语义

## 数据与同步边界

当前 `control-plane -> managed-node` 同步的是租户控制面快照，不是整机镜像复制。

控制面下发内容：

- 租户
- 用户
- 租户成员关系
- 租户 Agent
- 成员 Agent 分配
- 节点租约状态

受管节点上报内容：

- 节点注册
- 节点心跳
- 本机 Agent catalog 摘要
- 最近一次应用 revision
- `lastError`

当前明确不做：

- 不同步成员会话历史
- 不同步用量账单历史
- 不对整个 workspace 做远程双向镜像
- 不在受管节点开放平台管理员登录

## Control UI 运行时职责

前端零侵入运行时主要负责：

- 统一登录壳
- 平台管理员守卫
- 平台管理员侧边栏和内容区注入
- 租户管理员侧边栏和内容区注入
- 租户成员 Agent 选择与聊天壳层
- 顶栏状态条、反馈 toast、更新日志弹窗
- 成员聊天会话路由接管
- 公共可视化页和其他专题 runtime

## Tenant sidecar 职责

tenant sidecar 主要负责：

- 平台管理员、租户管理员、租户成员鉴权
- SQLite 持久化
- 租户、成员、Agent 分配、钱包、订单、更新日志接口
- 本地授权和续期校验
- 支付回调、订单确认
- 使用量同步与记账
- managed-node 同步
- 派生 Agent 工作区与运行时别名同步
- 自动批准辅助链路

## 工作区覆盖层职责

workspace overlay 主要承接“不能落到核心源码里，但又必须进入成员派生工作区”的内容：

- `tenant-member-bootstrap-filter`
- 业务 skill
- 宿主数据库桥接脚本
- 未来租户专题定制覆盖

这里的关键原则是：

- 成员派生工作区尽量继承母 Agent 的文件面
- 真正影响成员聊天行为的过滤逻辑，尽量通过 hook 和运行时控制完成
- 不靠删母 Agent 文件来规避串台

## 架构上的关键定论

1. inventory 真值在 `ZERO_INTRUSIVE_ECHARTS_ADDITIONS.md`
   - skill 只做导航，不替代清单真值

2. 计划文档不再承载全部细节
   - 细节下沉到模块文档

3. 实施现状要单独维护
   - 未来 AI 处理问题时，应优先确认真实实现，而不是先相信旧方案
