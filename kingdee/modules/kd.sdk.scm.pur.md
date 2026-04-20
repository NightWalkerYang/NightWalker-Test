# kd.sdk.scm.pur

**采购协同** · app=`pur` cloud=`scm` isv=`kingdee`

Class HTML path rule: `javadoc/<package-with-slashes>/<ClassName>.html`
Example: package `kd.bos.algo`, class `Algo` → `javadoc/kd/bos/algo/Algo.html`

Each class HTML contains a `cm={...}` JSON object on line 2 with full Javadoc:
`comment`, `declare`, `methods[]` (name/modifiers/returnType/paramNames/paramTypes/comment/tags/throwExceptions/annotations), `fields[]`, `interfaces`, `allInterfaces`, `isDeprecated`, `isPlugin`, `isService`.

## Packages

### `kd.sdk.scm.pur`

Path prefix: `javadoc/kd/sdk/scm/pur/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `SdkScmPurModule` | class |  | `kd.sdk.module.Module` | 0 | 0 |  |

### `kd.sdk.scm.pur.extpoint`

Path prefix: `javadoc/kd/sdk/scm/pur/extpoint/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `IBatchStockSupport` | interface |  | `kd.sdk.scm.common.extpoint.ITransferDataSupport` | 2 | 1 |  |
| `ICreateAPBillSupport` | interface |  | `kd.sdk.scm.common.extpoint.ITransferDataSupport` | 3 | 1 |  |
| `ICreateOrderSupport` | interface |  | `kd.sdk.scm.common.extpoint.ITransferDataSupport` | 1 | 1 |  |
| `IPurHandCheckSupport` | interface |  |  | 9 | 1 |  |
| `IPurOrderChangeSupport` | interface |  |  | 2 | 1 |  |
