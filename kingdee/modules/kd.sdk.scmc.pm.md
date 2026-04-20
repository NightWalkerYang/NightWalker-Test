# kd.sdk.scmc.pm

**采购管理模块** · app=`pm` cloud=`scmc` isv=`kingdee`

Class HTML path rule: `javadoc/<package-with-slashes>/<ClassName>.html`
Example: package `kd.bos.algo`, class `Algo` → `javadoc/kd/bos/algo/Algo.html`

Each class HTML contains a `cm={...}` JSON object on line 2 with full Javadoc:
`comment`, `declare`, `methods[]` (name/modifiers/returnType/paramNames/paramTypes/comment/tags/throwExceptions/annotations), `fields[]`, `interfaces`, `allInterfaces`, `isDeprecated`, `isPlugin`, `isService`.

## Packages

### `kd.sdk.scmc.pm`

Path prefix: `javadoc/kd/sdk/scmc/pm/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `SdkScmcPmModule` | class |  | `kd.sdk.module.Module` | 0 | 0 |  |

### `kd.sdk.scmc.pm.extpoint`

Path prefix: `javadoc/kd/sdk/scmc/pm/extpoint/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `IForecastPlanCasePlugin` | interface |  |  | 1 | 0 |  |
| `IPurBatChangeCasePlugin` | interface |  |  | 2 | 0 |  |
| `IPurQuotaCasePlugin` | interface |  |  | 1 | 0 |  |
| `IVMISettleCasePlugin` | interface |  |  | 1 | 0 |  |
| `IXPurApplyCasePlugin` | interface |  |  | 1 | 0 |  |
| `IXPurOrderCasePlugin` | interface |  |  | 3 | 2 |  |
| `PmExpandCaseCodes` | class |  |  | 0 | 9 |  |

### `kd.sdk.scmc.pm.helper`

Path prefix: `javadoc/kd/sdk/scmc/pm/helper/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `PmCommonHelper` | class |  |  | 3 | 0 |  |
| `PurApplyHelper` | class |  |  | 2 | 0 |  |
| `PurOrderHelper` | class |  |  | 4 | 0 |  |
