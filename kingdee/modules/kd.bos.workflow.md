# kd.bos.workflow

**流程服务** · app=`sys` cloud=`bos` isv=`kingdee`

Class HTML path rule: `javadoc/<package-with-slashes>/<ClassName>.html`
Example: package `kd.bos.algo`, class `Algo` → `javadoc/kd/bos/algo/Algo.html`

Each class HTML contains a `cm={...}` JSON object on line 2 with full Javadoc:
`comment`, `declare`, `methods[]` (name/modifiers/returnType/paramNames/paramTypes/comment/tags/throwExceptions/annotations), `fields[]`, `interfaces`, `allInterfaces`, `isDeprecated`, `isPlugin`, `isService`.

## Packages

### `kd.bos.message.api`

Path prefix: `javadoc/kd/bos/message/api/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `AbstractMessageInfo` | class |  |  | 16 | 8 |  |
| `DingdingMessageInfo` | class | `kd.bos.message.api.AbstractMessageInfo` |  | 5 | 0 |  |
| `DingdingTodoInfo` | class |  |  | 39 | 0 |  |
| `EmailInfo` | class |  | `java.io.Serializable` | 20 | 0 |  |
| `IMessageService` | interface |  |  | 12 | 0 |  |
| `IMsgEventListener` | interface |  |  | 8 | 0 |  |
| `ShortMessageInfo` | class |  | `java.io.Serializable` | 20 | 0 |  |
| `WeixinqyMessageInfo` | class | `kd.bos.message.api.AbstractMessageInfo` |  | 4 | 0 |  |
| `YzjMessageInfo` | class |  | `java.io.Serializable` | 10 | 0 |  |

### `kd.bos.workflow`

Path prefix: `javadoc/kd/bos/workflow/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `WorkflowModule` | class |  | `kd.sdk.module.Module` | 0 | 0 |  |

### `kd.bos.workflow.api`

Path prefix: `javadoc/kd/bos/workflow/api/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `AgentExecution` | interface |  |  | 19 | 0 |  |
| `AgentTask` | interface |  |  | 26 | 0 |  |
| `BatchResult` | class |  | `java.io.Serializable` | 15 | 0 | yes |
| `BatchResult.ItemResult` | class |  | `java.io.Serializable` | 9 | 0 | yes |
| `BizProcessStatus` | class |  | `java.io.Serializable` | 12 | 0 |  |
| `ExecutionListener` | interface |  | `java.io.Serializable` | 2 | 8 | yes |
| `IConditionalRuleParser` | interface |  |  | 1 | 0 | yes |
| `INoCodeWorkflowService` | interface |  |  | 38 | 0 |  |
| `IRelationService` | interface |  |  | 3 | 0 | yes |
| `IWorkflowService` | interface |  |  | 228 | 0 | yes |
| `MessageRequestInfo` | class |  | `java.io.Serializable` | 20 | 0 |  |
| `ModelModifyLogInfo` | class |  |  | 30 | 0 | yes |
| `NodeTemplate` | class |  | `java.io.Serializable` | 30 | 0 | yes |
| `ProcessInstanceMainOrgView` | class |  | `java.io.Serializable` | 10 | 0 | yes |
| `WorkflowElement` | interface |  |  | 9 | 0 |  |

### `kd.bos.workflow.api.constants`

Path prefix: `javadoc/kd/bos/workflow/api/constants/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `WFAuditResultTypeEnum` | enum |  |  | 1 | 3 | yes |
| `WFTaskResultEnum` | enum |  |  | 1 | 4 | yes |

### `kd.bos.workflow.api.model`

Path prefix: `javadoc/kd/bos/workflow/api/model/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `CompleteTaskParam` | class |  |  | 17 | 0 |  |
| `MacroItem` | class |  | `java.io.Serializable` | 6 | 0 | yes |
| `NodeMacro` | class |  | `java.io.Serializable` | 8 | 0 | yes |
| `NodeProperty` | class |  | `java.io.Serializable` | 12 | 0 |  |
| `ProcPublishResult` | class |  | `java.io.Serializable` | 6 | 0 | yes |
| `ProcessDefinitionInfo` | class |  | `java.io.Serializable` | 30 | 0 |  |
| `ProcessInitiator` | class |  | `java.io.Serializable` | 6 | 0 | yes |
| `ProcessModel` | class |  | `java.io.Serializable` | 26 | 0 |  |
| `ProcessNode` | class |  | `java.io.Serializable` | 12 | 0 |  |
| `ProcessTemplate` | class |  | `java.io.Serializable` | 12 | 0 | yes |
| `ValidateResultItem` | class |  | `java.io.Serializable` | 8 | 0 | yes |

### `kd.bos.workflow.bpmn.model`

Path prefix: `javadoc/kd/bos/workflow/bpmn/model/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `BillSetting` | class | `kd.bos.workflow.bpmn.model.BaseElement` | `kd.bos.workflow.bpmn.model.dynamicpartial.IDynamicPartial` | 28 | 1 | yes |
| `DecisionOption` | class | `kd.bos.workflow.bpmn.model.BaseElement` |  | 14 | 15 | yes |
| `FlowElement` | class | `kd.bos.workflow.bpmn.model.BaseElement` | `kd.bos.workflow.bpmn.model.HasExecutionListeners` | 28 | 9 | yes |
| `FlowElementsContainer` | interface |  |  | 10 | 0 | yes |
| `Variable` | class | `kd.bos.workflow.bpmn.model.BaseElement` |  | 13 | 0 | yes |

### `kd.bos.workflow.component`

Path prefix: `javadoc/kd/bos/workflow/component/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `WorkflowDesigner` | class | `TipsSupport` |  | 50 | 2 | yes |
| `IApprovalRecord` | interface |  |  | 7 | 0 | yes |

### `kd.bos.workflow.component.approvalrecord`

Path prefix: `javadoc/kd/bos/workflow/component/approvalrecord/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `CustomizeLink` | class |  | `java.io.Serializable` | 12 | 0 |  |
| `IApprovalRecordGroup` | interface |  | `java.io.Serializable` | 12 | 0 |  |
| `IApprovalRecordItem` | interface |  | `java.io.Serializable` | 95 | 0 |  |

### `kd.bos.workflow.design.plugin`

Path prefix: `javadoc/kd/bos/workflow/design/plugin/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `IWorkflowDesigner` | interface |  |  | 17 | 2 | yes |

### `kd.bos.workflow.engine.dynprocess`

Path prefix: `javadoc/kd/bos/workflow/engine/dynprocess/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `AddSignInfo` | class |  | `java.io.Serializable` | 26 | 0 | yes |
| `CustomizedAuditResult` | class |  | `java.io.Serializable` | 6 | 0 | yes |

### `kd.bos.workflow.engine.dynprocess.freeflow`

Path prefix: `javadoc/kd/bos/workflow/engine/dynprocess/freeflow/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `WFAuditTask` | class | `kd.bos.workflow.engine.dynprocess.freeflow.WFUserTask` |  | 9 | 3 | yes |
| `WFAutoTask` | class | `kd.bos.workflow.engine.dynprocess.freeflow.WFFlowNode` |  | 5 | 1 | yes |
| `WFAutoTaskExtItf` | class | `kd.bos.workflow.engine.dynprocess.freeflow.WFBaseElement` |  | 2 | 0 | yes |
| `WFBillSetting` | class | `kd.bos.workflow.engine.dynprocess.freeflow.WFBaseElement` |  | 4 | 0 | yes |
| `WFCustomParam` | class | `kd.bos.workflow.engine.dynprocess.freeflow.WFBaseElement` |  | 6 | 0 | yes |
| `WFDecisionOption` | class | `kd.bos.workflow.engine.dynprocess.freeflow.WFBaseElement` |  | 8 | 7 | yes |
| `WFFlowElement` | class | `kd.bos.workflow.engine.dynprocess.freeflow.WFBaseElement` |  | 7 | 3 | yes |
| `WFFlowNode` | class | `kd.bos.workflow.engine.dynprocess.freeflow.WFFlowElement` | `java.io.Serializable` | 19 | 5 | yes |
| `WFJointAuditTask` | class | `kd.bos.workflow.engine.dynprocess.freeflow.WFAuditTask` |  | 15 | 6 | yes |
| `WFParticipantEntity` | class | `kd.bos.workflow.engine.dynprocess.freeflow.WFBaseElement` |  | 20 | 0 | yes |
| `WFParticipantModel` | class | `kd.bos.workflow.engine.dynprocess.freeflow.WFBaseElement` |  | 8 | 0 | yes |
| `WFProcess` | class | `kd.bos.workflow.engine.dynprocess.freeflow.WFFlowElement` |  | 25 | 1 | yes |
| `WFRejectNodesModel` | class | `kd.bos.workflow.engine.dynprocess.freeflow.WFBaseElement` |  | 4 | 0 | yes |
| `WFUserTask` | class | `kd.bos.workflow.engine.dynprocess.freeflow.WFFlowNode` |  | 23 | 9 | yes |
| `WFValidationError` | class |  | `java.io.Serializable` | 12 | 0 | yes |

### `kd.bos.workflow.engine.extitf`

Path prefix: `javadoc/kd/bos/workflow/engine/extitf/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `WorkflowPlugin` | class |  |  | 17 | 0 | yes |
| `AggregateInfo` | class |  | `java.io.Serializable` | 3 | 0 | yes |
| `AggregateResult` | class |  | `java.io.Serializable` | 8 | 0 | yes |
| `ITaskPlugin` | interface |  |  | 3 | 11 | yes |
| `IWorkflowModelPlugin` | interface |  |  | 8 | 0 |  |
| `IWorkflowPlugin` | interface |  | `kd.bos.workflow.engine.extitf.ITaskPlugin` | 33 | 3 | yes |
| `WFCallActivityMultiInstDimensionItem` | class |  | `java.io.Serializable` | 7 | 0 | yes |

### `kd.bos.workflow.engine.history`

Path prefix: `javadoc/kd/bos/workflow/engine/history/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `HistoricData` | interface |  |  | 1 | 0 |  |

### `kd.bos.workflow.engine.impl.persistence.entity.design`

Path prefix: `javadoc/kd/bos/workflow/engine/impl/persistence/entity/design/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `ModelType` | enum |  |  | 1 | 3 | yes |

### `kd.bos.workflow.engine.impl.persistence.entity.task`

Path prefix: `javadoc/kd/bos/workflow/engine/impl/persistence/entity/task/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `TaskCenterNavigationEntity` | interface |  |  | 28 | 0 | yes |

### `kd.bos.workflow.engine.impl.persistence.entity.task.component`

Path prefix: `javadoc/kd/bos/workflow/engine/impl/persistence/entity/task/component/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `ApprovalRecordGroup` | class |  |  | 21 | 0 | yes |
| `ApprovalRecordItem` | class |  |  | 118 | 0 | yes |

### `kd.bos.workflow.engine.msg`

Path prefix: `javadoc/kd/bos/workflow/engine/msg/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `MessageServiceConfig` | class |  | `java.io.Serializable` | 28 | 4 | yes |

### `kd.bos.workflow.engine.msg.ctx`

Path prefix: `javadoc/kd/bos/workflow/engine/msg/ctx/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `MessageContext` | class |  | `java.io.Serializable` | 29 | 0 | yes |

### `kd.bos.workflow.engine.msg.info`

Path prefix: `javadoc/kd/bos/workflow/engine/msg/info/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `ITaskMsg` | interface |  |  | 10 | 0 |  |
| `MessageAttachment` | class |  | `java.io.Serializable` | 6 | 0 | yes |
| `MessageInfo` | class |  | `java.io.Serializable` | 83 | 8 | yes |
| `ParticipantInfo` | class |  | `java.io.Serializable` | 7 | 0 |  |
| `TaskEntityInfo` | class |  | `java.io.Serializable`, `kd.bos.workflow.engine.task.operation.TaskOperationInfo` | 63 | 0 |  |

### `kd.bos.workflow.engine.process`

Path prefix: `javadoc/kd/bos/workflow/engine/process/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `NodeData` | class |  | `java.io.Serializable` | 40 | 0 | yes |
| `ProcessApiResult` | class |  | `java.io.Serializable` | 8 | 2 | yes |
| `ProcessInstData` | class |  | `java.io.Serializable` | 22 | 0 | yes |
| `ProcessVariableData` | class |  | `java.io.Serializable` | 4 | 0 | yes |

### `kd.bos.workflow.engine.rule.ext`

Path prefix: `javadoc/kd/bos/workflow/engine/rule/ext/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `IExtExpressionParse` | interface |  |  | 1 | 0 | yes |

### `kd.bos.workflow.engine.task`

Path prefix: `javadoc/kd/bos/workflow/engine/task/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `BatchOperateResult` | class |  | `java.io.Serializable`, `kd.bos.workflow.engine.task.TaskOperateResult` | 12 | 0 | yes |
| `BizType` | class |  | `java.io.Serializable` | 4 | 0 |  |
| `BusinessKeyQueryParams` | class |  | `java.io.Serializable` | 6 | 0 |  |
| `Comment` | interface |  | `kd.bos.workflow.engine.history.HistoricData` | 34 | 0 |  |
| `MessageCenterParams` | class |  | `java.io.Serializable` | 16 | 0 |  |
| `OperateResult` | class |  | `java.io.Serializable` | 14 | 4 | yes |
| `TaskAndParticipantBatchUpdateParams` | class |  |  | 6 | 0 | yes |
| `TaskAndParticipantBatchUpdateResult` | class |  |  | 10 | 0 |  |
| `TaskInfo` | interface |  | `kd.bos.workflow.engine.task.TaskOperateResult` | 57 | 0 |  |
| `TaskOperateResult` | interface |  |  | 0 | 0 |  |
| `ThirdCommentInfo` | class |  | `java.io.Serializable` | 44 | 0 |  |

### `kd.bos.workflow.engine.task.operation`

Path prefix: `javadoc/kd/bos/workflow/engine/task/operation/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `CirculateOperationParam` | class | `kd.bos.workflow.engine.task.operation.TaskOperationParam` | `kd.bos.workflow.engine.task.operation.TaskOperationInfo` | 4 | 0 |  |
| `CompleteOperationParam` | class | `kd.bos.workflow.engine.task.operation.TaskOperationParam` | `kd.bos.workflow.engine.task.operation.TaskOperationInfo` | 6 | 0 |  |
| `DeleteOperationParam` | class | `kd.bos.workflow.engine.task.operation.TaskOperationParam` | `kd.bos.workflow.engine.task.operation.TaskOperationInfo` | 2 | 0 |  |
| `TaskOperationInfo` | interface |  |  | 0 | 0 |  |
| `TaskOperationParam` | class |  |  | 4 | 0 |  |
| `TransferOperationParam` | class | `kd.bos.workflow.engine.task.operation.TaskOperationParam` | `kd.bos.workflow.engine.task.operation.TaskOperationInfo` | 6 | 0 |  |
| `UpdateParticipantParam` | class | `kd.bos.workflow.engine.task.operation.TransferOperationParam` |  | 4 | 0 |  |

### `kd.bos.workflow.management.plugin`

Path prefix: `javadoc/kd/bos/workflow/management/plugin/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `ApprovalPageTpl` | class | `AbstractFormPlugin` | `kd.bos.workflow.taskcenter.plugin.udlayout.entity.IApproverPageEventListener` | 94 | 84 | yes |

### `kd.bos.workflow.message.api`

Path prefix: `javadoc/kd/bos/workflow/message/api/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `IMessageCenterService` | interface |  |  | 67 | 0 | yes |
| `MsgTypeEnum` | enum |  |  | 2 | 4 | yes |
| `SmsUsingQuantities` | class |  | `java.io.Serializable` | 8 | 0 | yes |

### `kd.bos.workflow.service`

Path prefix: `javadoc/kd/bos/workflow/service/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `GraphModelParseHelper` | class |  |  | 5 | 0 |  |
| `WorkFlowFormServiceHelper` | class |  |  | 13 | 0 | yes |

### `kd.bos.workflow.taskcenter.plugin.validate`

Path prefix: `javadoc/kd/bos/workflow/taskcenter/plugin/validate/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `BeforeSubmitCustomEventArgs` | class | `CustomEventArgs` |  | 25 | 1 | yes |
| `BeforeSubmitCustomEventArgsClosedCallBack` | class | `CustomEventArgs` |  | 12 | 0 | yes |
| `NextUserTaskNode` | class |  | `java.io.Serializable` | 18 | 0 | yes |
