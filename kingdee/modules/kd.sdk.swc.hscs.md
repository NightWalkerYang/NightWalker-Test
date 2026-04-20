# kd.sdk.swc.hscs

**薪资计算服务** · app=`hscs` cloud=`swc` isv=`kingdee`

Class HTML path rule: `javadoc/<package-with-slashes>/<ClassName>.html`
Example: package `kd.bos.algo`, class `Algo` → `javadoc/kd/bos/algo/Algo.html`

Each class HTML contains a `cm={...}` JSON object on line 2 with full Javadoc:
`comment`, `declare`, `methods[]` (name/modifiers/returnType/paramNames/paramTypes/comment/tags/throwExceptions/annotations), `fields[]`, `interfaces`, `allInterfaces`, `isDeprecated`, `isPlugin`, `isService`.

## Packages

### `kd.sdk.swc.hscs`

Path prefix: `javadoc/kd/sdk/swc/hscs/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `SdkHscsModule` | class |  | `kd.sdk.module.Module` | 0 | 0 |  |

### `kd.sdk.swc.hscs.business.extpoint`

Path prefix: `javadoc/kd/sdk/swc/hscs/business/extpoint/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `ICalRollBackExtService` | interface |  |  | 1 | 0 |  |
| `IFetchResultCoverDataExtService` | interface |  |  | 1 | 0 |  |
| `IHisDataCheckExtService` | interface |  |  | 1 | 0 |  |
| `IQueryInsuranceDataExtService` | interface |  |  | 1 | 0 | yes |
| `ISalaryCalExtService` | interface |  |  | 1 | 0 |  |

### `kd.sdk.swc.hscs.business.mservice.helper`

Path prefix: `javadoc/kd/sdk/swc/hscs/business/mservice/helper/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `HSCSCostAllotDetailServiceHelper` | class |  |  | 1 | 0 |  |

### `kd.sdk.swc.hscs.common.events`

Path prefix: `javadoc/kd/sdk/swc/hscs/common/events/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `AfterSalaryCalEvent` | class |  |  | 16 | 0 | yes |
| `CalRollBackEvent` | class |  |  | 9 | 0 | yes |
| `CostAllotDetailArgs` | class |  |  | 4 | 0 | yes |
| `FetchResultCoverEvent` | class |  |  | 11 | 0 | yes |
| `HisDataTaskCheckEvent` | class |  |  | 5 | 0 | yes |

### `kd.sdk.swc.hscs.common.hisdatacheck`

Path prefix: `javadoc/kd/sdk/swc/hscs/common/hisdatacheck/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `DataCheckFailDTO` | class |  |  | 6 | 0 | yes |

### `kd.sdk.swc.hscs.service.api`

Path prefix: `javadoc/kd/sdk/swc/hscs/service/api/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `ICostAllotDetailService` | interface |  |  | 1 | 0 |  |
| `ICustFetchService` | interface |  |  | 2 | 0 |  |
