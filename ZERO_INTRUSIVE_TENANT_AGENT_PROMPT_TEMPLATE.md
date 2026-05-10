# 零侵入租户项目提示词模板

这份模板用于后续给 AI 下发任务。

目的：

- 先触发项目内 `zero-intrusive-tenant` skill
- 让 AI 先读总览和清单，再按模块精确读文档
- 减少每次都全量阅读长文档的成本

## 推荐模板

```text
你现在在协助我维护 OpenClaw 的零侵入改造项目。先使用项目内 skill `zero-intrusive-tenant`；如果当前环境不支持 skill，再按以下顺序自行阅读：

1. `ZERO_INTRUSIVE_TENANT_SYSTEM_PLAN.md`
2. `ZERO_INTRUSIVE_ECHARTS_ADDITIONS.md`
3. 只读取与当前任务直接相关的模块文档

请严格遵守以下规则：

1. 只能修改零侵入文件；如果新增零侵入文件，必须同步更新 `ZERO_INTRUSIVE_ECHARTS_ADDITIONS.md`。
2. 如果实际实现与文档不一致，以当前可运行方案为准，并直接更新对应文档。
3. 工作流固定为：本机修改和测试 -> 推 Gitee -> 目标服务器拉取验证并部署；不可以直接上服务器修改文件，也不可以在服务器上添加文件夹等编辑操作，除测试外。
4. 功能完成标准必须同时满足：本地针对性验证通过，并且目标服务器拉取同一分支最新代码、按标准部署脚本部署后验证也通过；如果本地能跑但服务器不能跑，这个功能不能算完成，必须继续把缺失的配置、脚本、数据库准备、路由、构建或部署链补齐到仓库里，而不是在服务器上手工热修。
5. 如果已经完成针对性验证，`git commit message` 必须中文。
6. 开始实质性工作后，立即创建一个专门负责本机残留治理的 cleanup 子 Agent 并行运行；如果环境不支持子 Agent，主 Agent 必须自行执行同等清理流程。
7. 在启动任何可能产生资源残留的本地命令、脚本、浏览器自动化、开发服务器、构建任务、端口转发、代理、SSH 隧道、文件监听器或临时服务前，先记录本次任务预计新建的进程、端口、临时目录、临时文件和日志路径，并交给 cleanup 子 Agent 跟踪。
8. cleanup 子 Agent 需要在运行过程中持续增量清理“已经完成且不再被当前步骤依赖”的资源，但不要误杀我原本就在使用的程序。
9. 任务结束前，cleanup 子 Agent 必须再做一次最终 sweep；最终汇报必须单独包含“本机残留清除结果”，明确写出清掉了什么、保留了什么、为什么保留、当前是否确认无任务残留；如果仍有残留，必须列出 PID、命令行、端口和原因。

本次任务：
<>

部署目标与凭证由操作者临时提供，不写入仓库。需要时请使用占位字段向我索取：

- Git remote / branch
- Deployment host
- SSH account
- Deployment entry
- Docker compose path
```

## 使用建议

如果当前任务已经明确属于某一模块，prompt 里可以直接加一句：

- 登录、路由、成员聊天问题优先读 `ZERO_INTRUSIVE_TENANT_RUNTIME_AND_ROUTING.md`
- Docker、proxy、token、origin、部署问题优先读 `ZERO_INTRUSIVE_TENANT_DEPLOYMENT_AND_OPERATIONS.md`
- 表结构、分配关系、流水问题优先读 `ZERO_INTRUSIVE_TENANT_DATA_MODEL.md`
- 钱包、支付、授权问题优先读 `ZERO_INTRUSIVE_TENANT_BILLING_AND_LICENSE.md`
- 不确定当前实现到底做到哪，优先读 `ZERO_INTRUSIVE_TENANT_IMPLEMENTATION_STATUS.md`

## 明确不写入仓库的内容

不要把这些真实值写入仓库文档、skill、prompt 模板：

- 服务器 IP / 域名 / SSH 密码
- 支付密钥与公私钥
- 真实授权文件
- 生产 token
- 任何其它敏感连接信息
