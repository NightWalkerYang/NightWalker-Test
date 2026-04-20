# kd.sdk.scm.scp

**供应协同** · app=`scp` cloud=`scm` isv=`kingdee`

Class HTML path rule: `javadoc/<package-with-slashes>/<ClassName>.html`
Example: package `kd.bos.algo`, class `Algo` → `javadoc/kd/bos/algo/Algo.html`

Each class HTML contains a `cm={...}` JSON object on line 2 with full Javadoc:
`comment`, `declare`, `methods[]` (name/modifiers/returnType/paramNames/paramTypes/comment/tags/throwExceptions/annotations), `fields[]`, `interfaces`, `allInterfaces`, `isDeprecated`, `isPlugin`, `isService`.

## Packages

### `kd.sdk.scm.scp`

Path prefix: `javadoc/kd/sdk/scm/scp/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `SdkScmScpModule` | class |  | `kd.sdk.module.Module` | 0 | 0 |  |

### `kd.sdk.scm.scp.extpoint`

Path prefix: `javadoc/kd/sdk/scm/scp/extpoint/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `IAutoStockSupport` | interface |  | `kd.sdk.scm.common.extpoint.ITransferDataSupport` | 1 | 1 |  |
| `IScpHandCheckSupport` | interface |  |  | 9 | 1 |  |
| `IScpInvoiceCloudSupport` | interface |  |  | 1 | 0 | yes |
| `IScpOrderChangeSupport` | interface |  |  | 2 | 1 |  |
