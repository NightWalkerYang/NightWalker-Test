# kd.sdk.scmc.im

**库存管理** · app=`im` cloud=`scmc` isv=`kingdee`

Class HTML path rule: `javadoc/<package-with-slashes>/<ClassName>.html`
Example: package `kd.bos.algo`, class `Algo` → `javadoc/kd/bos/algo/Algo.html`

Each class HTML contains a `cm={...}` JSON object on line 2 with full Javadoc:
`comment`, `declare`, `methods[]` (name/modifiers/returnType/paramNames/paramTypes/comment/tags/throwExceptions/annotations), `fields[]`, `interfaces`, `allInterfaces`, `isDeprecated`, `isPlugin`, `isService`.

## Packages

### `kd.sdk.scmc.im`

Path prefix: `javadoc/kd/sdk/scmc/im/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `SdkScmcImModule` | class |  | `kd.sdk.module.Module` | 0 | 0 |  |

### `kd.sdk.scmc.im.acct`

Path prefix: `javadoc/kd/sdk/scmc/im/acct/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `AuxQtyAndUnitHelper` | class |  |  | 4 | 0 |  |
| `BillQtyAndUnitHelper` | class |  |  | 4 | 0 |  |
| `BillUnitAndQtytHelper` | class |  |  | 2 | 0 | yes |
| `DateHelper` | class |  |  | 3 | 0 |  |
| `InvBillCalcHelper` | class |  |  | 1 | 0 |  |
| `InvSchemeHelper` | class |  |  | 10 | 0 |  |
| `InverseBillHelper` | class |  |  | 4 | 0 |  |
| `SdkAppParameterHelper` | class |  |  | 4 | 0 |  |
| `SettleBillHelper` | class |  |  | 1 | 0 | yes |

### `kd.sdk.scmc.im.extpoint`

Path prefix: `javadoc/kd/sdk/scmc/im/extpoint/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `IInvBatchFillExpand` | interface |  |  | 1 | 0 |  |
| `IInvCountSchemeAuditExpand` | interface |  |  | 1 | 0 |  |
| `IInvEntrustExpand` | interface |  |  | 3 | 0 |  |
| `IInvMatchruleoutExpand` | interface |  |  | 3 | 5 |  |
| `IInvQueryExpand` | interface |  |  | 6 | 1 |  |
| `ImExpandCaseCodes` | class |  |  | 0 | 6 |  |

### `kd.sdk.scmc.im.service`

Path prefix: `javadoc/kd/sdk/scmc/im/service/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `LotnumService` | interface |  |  | 2 | 2 |  |
| `MatchingRuleOutService` | interface |  |  | 5 | 1 |  |
