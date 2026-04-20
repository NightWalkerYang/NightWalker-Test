# kd.bos.kddm.botp

**业务对象转换平台(BOTP)** · app=`bos` cloud=`bos` isv=`kingdee`

Class HTML path rule: `javadoc/<package-with-slashes>/<ClassName>.html`
Example: package `kd.bos.algo`, class `Algo` → `javadoc/kd/bos/algo/Algo.html`

Each class HTML contains a `cm={...}` JSON object on line 2 with full Javadoc:
`comment`, `declare`, `methods[]` (name/modifiers/returnType/paramNames/paramTypes/comment/tags/throwExceptions/annotations), `fields[]`, `interfaces`, `allInterfaces`, `isDeprecated`, `isPlugin`, `isService`.

## Packages

### `kd.bos.botp`

Path prefix: `javadoc/kd/bos/botp/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `ConvertDataService` | class |  |  | 6 | 0 |  |

### `kd.bos.entity.botp`

Path prefix: `javadoc/kd/bos/entity/botp/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `AttachmentPanelMapItem` | class |  |  | 12 | 0 |  |
| `AttachmentPanelMapPolicy` | class |  |  | 3 | 0 |  |
| `BillCloseType` | enum |  |  | 1 | 2 |  |
| `BillTypeMapItem` | class |  |  | 12 | 7 |  |
| `BillTypeMapPolicy` | class |  |  | 2 | 0 |  |
| `BizRulePolicy` | class |  |  | 2 | 0 |  |
| `BotpModule` | class |  | `kd.sdk.module.Module` | 0 | 0 |  |
| `CRBizRuleElement` | class |  |  | 19 | 0 |  |
| `CRCondition` | class | `CRFormula` |  | 18 | 0 |  |
| `CRValByCondition` | class |  |  | 10 | 0 |  |
| `CRValByConditionType` | enum |  |  | 1 | 2 |  |
| `CRValByConditions` | class |  |  | 3 | 0 |  |
| `ConvertOpType` | enum |  |  | 0 | 5 |  |
| `ConvertPath` | class |  |  | 14 | 0 |  |
| `ConvertRuleCache` | class |  |  | 7 | 0 |  |
| `ConvertRuleElement` | class |  |  | 53 | 0 |  |
| `DistributeType` | enum |  |  | 1 | 2 |  |
| `ExcessCheckType` | enum |  |  | 1 | 4 |  |
| `FieldConvertType` | enum |  |  | 0 | 4 |  |
| `FieldMapItem` | class |  |  | 25 | 0 |  |
| `FieldMapPolicy` | class |  |  | 7 | 0 |  |
| `FieldSumType` | enum |  |  | 0 | 9 |  |
| `FilterPolicy` | class |  |  | 5 | 0 |  |
| `GroupByMode` | enum |  |  | 0 | 3 |  |
| `GroupByPolicy` | class |  |  | 21 | 0 | yes |
| `LinkEntityPolicy` | class |  |  | 21 | 0 |  |
| `LinkRecordType` | enum |  |  | 0 | 2 |  |
| `OptionPolicy` | class |  |  | 18 | 0 |  |
| `PlugInPolicy` | class |  |  | 3 | 0 |  |
| `WriteBackBizRule` | class |  |  | 15 | 0 |  |
| `WriteBackFormula` | class |  |  | 19 | 0 |  |
| `WriteBackOpType` | enum |  |  | 0 | 2 |  |
| `WriteBackRuleElement` | class |  |  | 54 | 0 |  |
| `WriteBackType` | enum |  |  | 0 | 3 |  |

### `kd.bos.entity.botp.plugin`

Path prefix: `javadoc/kd/bos/entity/botp/plugin/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `AbstractConvertPlugIn` | class |  | `kd.bos.entity.botp.plugin.IConvertPlugIn` | 7 | 0 |  |
| `AbstractWriteBackPlugIn` | class |  | `kd.bos.entity.botp.plugin.IWriteBackPlugIn` | 20 | 0 |  |
| `IConvertPlugIn` | interface |  |  | 22 | 0 |  |
| `IWriteBackPlugIn` | interface |  |  | 22 | 0 |  |

### `kd.bos.entity.botp.plugin.args`

Path prefix: `javadoc/kd/bos/entity/botp/plugin/args/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `AfterBizRuleEventArgs` | class | `kd.bos.entity.botp.plugin.args.ConvertPluginEventArgs` |  | 4 | 0 |  |
| `AfterBuildDrawFilterEventArgs` | class | `kd.bos.entity.botp.plugin.args.ConvertPluginEventArgs` |  | 6 | 0 |  |
| `AfterBuildQueryParemeterEventArgs` | class | `kd.bos.entity.botp.plugin.args.ConvertPluginEventArgs` |  | 4 | 0 |  |
| `AfterBuildRowConditionEventArgs` | class | `kd.bos.entity.botp.plugin.args.ConvertPluginEventArgs` |  | 2 | 0 |  |
| `AfterBuildSourceBillIdsEventArgs` | class | `kd.bos.entity.botp.plugin.args.WriteBackEventArgs` |  | 6 | 0 |  |
| `AfterCalcWriteValueEventArgs` | class | `kd.bos.entity.botp.plugin.args.WriteBackEventArgs` |  | 8 | 0 |  |
| `AfterCloseRowEventArgs` | class | `kd.bos.entity.botp.plugin.args.WriteBackEventArgs` |  | 9 | 0 |  |
| `AfterCommitAmountEventArgs` | class | `kd.bos.entity.botp.plugin.args.WriteBackEventArgs` |  | 14 | 0 |  |
| `AfterConvertEventArgs` | class | `kd.bos.entity.botp.plugin.args.ConvertPluginEventArgs` |  | 4 | 0 |  |
| `AfterCreateLinkEventArgs` | class | `kd.bos.entity.botp.plugin.args.ConvertPluginEventArgs` |  | 4 | 0 |  |
| `AfterCreateTargetEventArgs` | class | `kd.bos.entity.botp.plugin.args.ConvertPluginEventArgs` |  | 4 | 0 |  |
| `AfterExcessCheckEventArgs` | class |  |  | 10 | 0 |  |
| `AfterFieldMappingEventArgs` | class | `kd.bos.entity.botp.plugin.args.ConvertPluginEventArgs` |  | 4 | 0 |  |
| `AfterGetSourceDataEventArgs` | class | `kd.bos.entity.botp.plugin.args.ConvertPluginEventArgs` |  | 3 | 0 |  |
| `AfterReadSourceBillEventArgs` | class | `kd.bos.entity.botp.plugin.args.WriteBackEventArgs` |  | 3 | 0 |  |
| `AfterSaveSourceBillEventArgs` | class | `kd.bos.entity.botp.plugin.args.WriteBackEventArgs` |  | 5 | 0 |  |
| `BeforeBuildGroupModeEventArgs` | class | `kd.bos.entity.botp.plugin.args.ConvertPluginEventArgs` |  | 7 | 0 |  |
| `BeforeBuildRowConditionEventArgs` | class | `kd.bos.entity.botp.plugin.args.ConvertPluginEventArgs` |  | 12 | 0 |  |
| `BeforeCloseRowEventArgs` | class | `kd.bos.entity.botp.plugin.args.WriteBackEventArgs` |  | 9 | 0 |  |
| `BeforeCreateArticulationRowEventArgs` | class | `kd.bos.entity.botp.plugin.args.WriteBackEventArgs` |  | 8 | 0 |  |
| `BeforeCreateLinkEventArgs` | class | `kd.bos.entity.botp.plugin.args.ConvertPluginEventArgs` |  | 6 | 0 |  |
| `BeforeCreateTargetEventArgs` | class |  |  | 0 | 0 |  |
| `BeforeExcessCheckEventArgs` | class | `kd.bos.entity.botp.plugin.args.WriteBackEventArgs` |  | 9 | 0 |  |
| `BeforeExecWriteBackRuleEventArgs` | class | `kd.bos.entity.botp.plugin.args.WriteBackEventArgs` |  | 6 | 0 |  |
| `BeforeGetSourceDataEventArgs` | class | `kd.bos.entity.botp.plugin.args.ConvertPluginEventArgs` |  | 4 | 0 |  |
| `BeforeReadSourceBillEventArgs` | class | `kd.bos.entity.botp.plugin.args.WriteBackEventArgs` |  | 6 | 0 |  |
| `BeforeSaveSourceBillEventArgs` | class | `kd.bos.entity.botp.plugin.args.WriteBackEventArgs` |  | 4 | 0 |  |
| `BeforeSaveTransEventArgs` | class | `kd.bos.entity.botp.plugin.args.WriteBackEventArgs` |  | 0 | 0 |  |
| `BeforeTrackEventArgs` | class | `kd.bos.entity.botp.plugin.args.WriteBackEventArgs` |  | 4 | 0 |  |
| `ConvertPluginEventArgs` | class |  |  | 0 | 0 |  |
| `FinishWriteBackEventArgs` | class | `kd.bos.entity.botp.plugin.args.WriteBackEventArgs` |  | 0 | 0 |  |
| `InitVariableEventArgs` | class | `kd.bos.entity.botp.plugin.args.ConvertPluginEventArgs` |  | 2 | 0 |  |
| `PreparePropertysEventArgs` | class | `kd.bos.entity.botp.plugin.args.WriteBackEventArgs` |  | 3 | 0 |  |
| `RollbackSaveEventArgs` | class | `kd.bos.entity.botp.plugin.args.WriteBackEventArgs` |  | 0 | 0 |  |
| `WriteBackEventArgs` | class |  |  | 0 | 0 |  |

### `kd.bos.entity.botp.runtime`

Path prefix: `javadoc/kd/bos/entity/botp/runtime/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `AbstractConvertServiceArgs` | class |  |  | 17 | 0 |  |
| `BFRow` | class |  | `java.io.Serializable` | 4 | 0 |  |
| `BFRowId` | class |  | `java.io.Serializable` | 9 | 0 |  |
| `BFRowLinkDownNode` | class |  | `java.io.Serializable` | 8 | 0 |  |
| `BFRowLinkUpNode` | class |  | `java.io.Serializable` | 7 | 0 |  |
| `BeforeDrawArgs` | class | `kd.bos.entity.botp.runtime.AbstractConvertServiceArgs` |  | 9 | 0 |  |
| `BeforeDrawOpResult` | class | `kd.bos.entity.botp.runtime.ConvertOperationResult` |  | 9 | 0 |  |
| `ConvertConst` | class |  |  | 0 | 34 |  |
| `ConvertOpRule` | class |  |  | 16 | 0 |  |
| `ConvertOperationResult` | class |  |  | 43 | 0 | yes |
| `DrawArgs` | class | `kd.bos.entity.botp.runtime.AbstractConvertServiceArgs` |  | 7 | 0 |  |
| `GetTargetOptionalOrgsArgs` | class | `kd.bos.entity.botp.runtime.PushArgs` |  | 0 | 0 |  |
| `GetTargetOptionalOrgsResult` | class |  |  | 12 | 0 |  |
| `PushArgs` | class | `kd.bos.entity.botp.runtime.AbstractConvertServiceArgs` |  | 13 | 0 |  |
| `SourceBillReport` | class |  | `java.io.Serializable` | 35 | 0 |  |
| `SourceRowReport` | class |  | `java.io.Serializable` | 12 | 0 |  |
| `TableDefine` | class |  |  | 6 | 0 |  |

### `kd.bos.metadata.botp`

Path prefix: `javadoc/kd/bos/metadata/botp/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `WriteBackRuleReader` | class |  |  | 9 | 0 | yes |

### `kd.bos.servicehelper.botp`

Path prefix: `javadoc/kd/bos/servicehelper/botp/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `BFTrackerServiceHelper` | class |  |  | 25 | 0 |  |
| `ConvertMetaServiceHelper` | class |  |  | 14 | 0 |  |
| `ConvertServiceHelper` | class |  |  | 4 | 0 |  |
