# kd.sdk.swc.hcdm

**薪酬管理** · app=`hcdm` cloud=`swc` isv=`kingdee`

Class HTML path rule: `javadoc/<package-with-slashes>/<ClassName>.html`
Example: package `kd.bos.algo`, class `Algo` → `javadoc/kd/bos/algo/Algo.html`

Each class HTML contains a `cm={...}` JSON object on line 2 with full Javadoc:
`comment`, `declare`, `methods[]` (name/modifiers/returnType/paramNames/paramTypes/comment/tags/throwExceptions/annotations), `fields[]`, `interfaces`, `allInterfaces`, `isDeprecated`, `isPlugin`, `isService`.

## Packages

### `kd.sdk.swc.hcdm`

Path prefix: `javadoc/kd/sdk/swc/hcdm/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `SdkHcdmModule` | class |  | `kd.sdk.module.Module` | 0 | 0 |  |

### `kd.sdk.swc.hcdm.business.extpoint.adjapprbill`

Path prefix: `javadoc/kd/sdk/swc/hcdm/business/extpoint/adjapprbill/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `IAdjConfirmPrintExtPlugin` | interface |  |  | 1 | 0 |  |
| `IAdjConfirmPrintExtService` | interface |  |  | 2 | 0 |  |
| `IDecAdjApprExtPlugin` | interface |  |  | 7 | 0 |  |
| `IDecAdjApprSyncAdjFileExtPlugin` | interface |  |  | 1 | 0 | yes |

### `kd.sdk.swc.hcdm.business.extpoint.adjapprbill.business.mservice.helper`

Path prefix: `javadoc/kd/sdk/swc/hcdm/business/extpoint/adjapprbill/business/mservice/helper/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `AdjConfirmBillServiceHelper` | class |  |  | 2 | 0 |  |
| `AdjConfirmTplServiceHelper` | class |  |  | 1 | 0 |  |

### `kd.sdk.swc.hcdm.business.extpoint.adjapprbill.event`

Path prefix: `javadoc/kd/sdk/swc/hcdm/business/extpoint/adjapprbill/event/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `AdjConfirmPrintEvent` | class | `java.util.EventObject` |  | 9 | 0 |  |
| `AfterBuildEntryGridEvent` | class |  | `java.io.Serializable` | 2 | 0 | yes |
| `BeforeSynDecRecordEvent` | class |  | `java.io.Serializable` | 5 | 0 | yes |
| `DecAdjPropertyChangeEvent` | class | `java.util.EventObject` |  | 3 | 0 | yes |

### `kd.sdk.swc.hcdm.business.extpoint.adjsalsyn`

Path prefix: `javadoc/kd/sdk/swc/hcdm/business/extpoint/adjsalsyn/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `IAdjSalSynExtService` | interface |  |  | 2 | 0 |  |
| `IAdjSalSynRecordExtService` | interface |  |  | 1 | 0 |  |
| `IAdjSalSynTmplSetExtService` | interface |  |  | 1 | 0 | yes |

### `kd.sdk.swc.hcdm.business.extpoint.adjsalsyn.event`

Path prefix: `javadoc/kd/sdk/swc/hcdm/business/extpoint/adjsalsyn/event/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `BeforeSalaryAdjSyncDeleteEvent` | class |  |  | 6 | 0 | yes |
| `BeforeUpdateSyncDetailStatusEvent` | class |  |  | 4 | 0 | yes |

### `kd.sdk.swc.hcdm.business.extpoint.candsetsalapply`

Path prefix: `javadoc/kd/sdk/swc/hcdm/business/extpoint/candsetsalapply/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `ICandSetSalApplySyncFileExtPlugin` | interface |  |  | 1 | 0 |  |
| `IHcdmCandidateSetSalApplExtPlugin` | interface |  |  | 1 | 0 |  |

### `kd.sdk.swc.hcdm.business.extpoint.candsetsalapply.event`

Path prefix: `javadoc/kd/sdk/swc/hcdm/business/extpoint/candsetsalapply/event/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `AddSyncFieldsEvent` | class |  |  | 5 | 0 | yes |

### `kd.sdk.swc.hcdm.business.extpoint.person`

Path prefix: `javadoc/kd/sdk/swc/hcdm/business/extpoint/person/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `IHCDMPersonExtService` | interface |  |  | 1 | 0 |  |

### `kd.sdk.swc.hcdm.business.extpoint.salarystd`

Path prefix: `javadoc/kd/sdk/swc/hcdm/business/extpoint/salarystd/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `IHcdmContrastPropExtPlugin` | interface |  |  | 3 | 0 |  |
| `IHcdmContrastPropForCandExtPlugin` | interface |  |  | 1 | 0 |  |
| `IStdTableExtPlugin` | interface |  |  | 15 | 0 |  |

### `kd.sdk.swc.hcdm.business.extpoint.salarystd.event`

Path prefix: `javadoc/kd/sdk/swc/hcdm/business/extpoint/salarystd/event/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `CandContrastPropLoadEvent` | class | `java.util.EventObject` |  | 10 | 0 | yes |
| `ContrastPropLoadEvent` | class | `java.util.EventObject` |  | 11 | 0 | yes |
| `OnGetCustomerQFilterEvent` | class | `java.util.EventObject` |  | 7 | 0 | yes |
| `OnGetDefaultDisplayParamEvent` | class | `java.util.EventObject` |  | 5 | 0 | yes |
| `OnGetFieldColumnWidthEvent` | class | `java.util.EventObject` |  | 13 | 0 | yes |
| `OnGetFieldLockStatusEvent` | class | `java.util.EventObject` |  | 15 | 0 | yes |
| `OnGetFieldParamEvent` | class | `java.util.EventObject` |  | 13 | 0 | yes |
| `OnGetIntervalPropEvent` | class | `java.util.EventObject` |  | 13 | 0 | yes |
| `OnGetItemRankEvent` | class | `java.util.EventObject` |  | 11 | 0 | yes |
| `OnGetItemTipsEvent` | class | `java.util.EventObject` |  | 7 | 0 | yes |
| `OnGetNumberConstraintEvent` | class | `java.util.EventObject` |  | 15 | 0 | yes |
| `OnGetOnlySalaryCountEvent` | class | `java.util.EventObject` |  | 7 | 0 | yes |
| `OnGetPreviewStyleEvent` | class | `java.util.EventObject` |  | 7 | 0 | yes |
| `OnGetSpecialRankEvent` | class | `java.util.EventObject` |  | 9 | 0 | yes |
| `OnGetVarPredictItemEvent` | class | `java.util.EventObject` |  | 7 | 0 | yes |
| `StdTableCalculateEvent` | class | `java.util.EventObject` |  | 5 | 0 | yes |

### `kd.sdk.swc.hcdm.business.mservice.helper`

Path prefix: `javadoc/kd/sdk/swc/hcdm/business/mservice/helper/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `AdjFileInfoServiceHelper` | class |  |  | 9 | 0 |  |
| `SalaryStdServiceHelper` | class |  |  | 2 | 0 |  |

### `kd.sdk.swc.hcdm.common.stdtab`

Path prefix: `javadoc/kd/sdk/swc/hcdm/common/stdtab/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `SimpleStdRangeMatchParam` | class |  | `java.io.Serializable` | 8 | 0 | yes |
| `SimpleStdRangeMatchResult` | class |  |  | 8 | 0 | yes |
| `StdRangeNameFormatParam` | class |  | `java.io.Serializable` | 10 | 0 | yes |
| `StdTableDataQueryParam` | class |  | `java.io.Serializable` | 16 | 0 | yes |

### `kd.sdk.swc.hcdm.service.spi`

Path prefix: `javadoc/kd/sdk/swc/hcdm/service/spi/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `AdjFileInfoService` | interface |  |  | 12 | 0 | yes |
| `SalaryStdQueryService` | interface |  |  | 12 | 0 | yes |
