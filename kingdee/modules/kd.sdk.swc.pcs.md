# kd.sdk.swc.pcs

**薪酬成本服务** · app=`pcs` cloud=`swc` isv=`kingdee`

Class HTML path rule: `javadoc/<package-with-slashes>/<ClassName>.html`
Example: package `kd.bos.algo`, class `Algo` → `javadoc/kd/bos/algo/Algo.html`

Each class HTML contains a `cm={...}` JSON object on line 2 with full Javadoc:
`comment`, `declare`, `methods[]` (name/modifiers/returnType/paramNames/paramTypes/comment/tags/throwExceptions/annotations), `fields[]`, `interfaces`, `allInterfaces`, `isDeprecated`, `isPlugin`, `isService`.

## Packages

### `kd.sdk.swc.pcs`

Path prefix: `javadoc/kd/sdk/swc/pcs/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `SdkPcsModule` | class |  | `kd.sdk.module.Module` | 0 | 0 |  |

### `kd.sdk.swc.pcs.business.extpoint.costcfg`

Path prefix: `javadoc/kd/sdk/swc/pcs/business/extpoint/costcfg/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `ICostCfgExportExtService` | interface |  |  | 1 | 0 |  |
| `ICostCfgImportExtService` | interface |  |  | 2 | 0 |  |

### `kd.sdk.swc.pcs.business.mservice.helper`

Path prefix: `javadoc/kd/sdk/swc/pcs/business/mservice/helper/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `PCSCostAllotBillServiceHelper` | class |  |  | 1 | 0 |  |
| `PCSCostCfgServiceHelper` | class |  |  | 1 | 0 |  |

### `kd.sdk.swc.pcs.common.events`

Path prefix: `javadoc/kd/sdk/swc/pcs/common/events/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `CostAllotBillArgs` | class |  |  | 4 | 0 | yes |
| `CostCfgEvent` | class |  |  | 13 | 0 | yes |

### `kd.sdk.swc.pcs.service.api`

Path prefix: `javadoc/kd/sdk/swc/pcs/service/api/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `ICostAllotBillService` | interface |  |  | 1 | 0 |  |
