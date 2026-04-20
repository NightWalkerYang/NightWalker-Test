# kd.sdk.scm.pssc

**采购需求管理** · app=`pssc` cloud=`scm` isv=`kingdee`

Class HTML path rule: `javadoc/<package-with-slashes>/<ClassName>.html`
Example: package `kd.bos.algo`, class `Algo` → `javadoc/kd/bos/algo/Algo.html`

Each class HTML contains a `cm={...}` JSON object on line 2 with full Javadoc:
`comment`, `declare`, `methods[]` (name/modifiers/returnType/paramNames/paramTypes/comment/tags/throwExceptions/annotations), `fields[]`, `interfaces`, `allInterfaces`, `isDeprecated`, `isPlugin`, `isService`.

## Packages

### `kd.sdk.scm.pssc`

Path prefix: `javadoc/kd/sdk/scm/pssc/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `SdkScmPsscModule` | class |  | `kd.sdk.module.Module` | 0 | 0 |  |

### `kd.sdk.scm.pssc.packagegroup`

Path prefix: `javadoc/kd/sdk/scm/pssc/packagegroup/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `IPsscPackageGroupPrepareExecutor` | interface |  |  | 1 | 0 |  |

### `kd.sdk.scm.pssc.packagegroup.pojo`

Path prefix: `javadoc/kd/sdk/scm/pssc/packagegroup/pojo/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `PsscMaterialGroupInfo` | class |  |  | 7 | 0 | yes |
| `PsscPackageGroupContext` | class |  |  | 28 | 0 | yes |
| `PsscTagGroupRuleOrderInfo` | class |  | `java.lang.Comparable` | 8 | 0 | yes |

### `kd.sdk.scm.pssc.task`

Path prefix: `javadoc/kd/sdk/scm/pssc/task/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `IPsscTaskSplitBillBasis` | interface |  |  | 1 | 0 |  |
| `IReqContactOrderHandler` | interface |  |  | 7 | 0 | yes |
