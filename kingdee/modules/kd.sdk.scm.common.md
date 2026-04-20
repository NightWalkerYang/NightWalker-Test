# kd.sdk.scm.common

**供应商协同公共服务** · app=`common` cloud=`scm` isv=`kingdee`

Class HTML path rule: `javadoc/<package-with-slashes>/<ClassName>.html`
Example: package `kd.bos.algo`, class `Algo` → `javadoc/kd/bos/algo/Algo.html`

Each class HTML contains a `cm={...}` JSON object on line 2 with full Javadoc:
`comment`, `declare`, `methods[]` (name/modifiers/returnType/paramNames/paramTypes/comment/tags/throwExceptions/annotations), `fields[]`, `interfaces`, `allInterfaces`, `isDeprecated`, `isPlugin`, `isService`.

## Packages

### `kd.sdk.scm.common`

Path prefix: `javadoc/kd/sdk/scm/common/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `SdkScmCommonModule` | class |  | `kd.sdk.module.Module` | 0 | 0 |  |

### `kd.sdk.scm.common.extpoint`

Path prefix: `javadoc/kd/sdk/scm/common/extpoint/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `ICreateUserNumberSupport` | interface |  |  | 3 | 0 |  |
| `IMaterialGroupStandardService` | interface |  |  | 1 | 0 |  |
| `IPurInstockCheckMappingService` | interface |  |  | 18 | 3 | yes |
| `ISrmSupChgInfoTypeInter` | interface |  |  | 3 | 0 |  |
| `ISupChgFilterService` | interface |  |  | 1 | 0 |  |
| `ISupplierGroupStandardService` | interface |  |  | 1 | 0 |  |
| `ITransferDataSupport` | interface |  |  | 2 | 0 |  |
