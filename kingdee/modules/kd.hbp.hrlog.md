# kd.hbp.hrlog

**HR日志** · app=`hbp` cloud=`hrmp` isv=`kingdee`

Class HTML path rule: `javadoc/<package-with-slashes>/<ClassName>.html`
Example: package `kd.bos.algo`, class `Algo` → `javadoc/kd/bos/algo/Algo.html`

Each class HTML contains a `cm={...}` JSON object on line 2 with full Javadoc:
`comment`, `declare`, `methods[]` (name/modifiers/returnType/paramNames/paramTypes/comment/tags/throwExceptions/annotations), `fields[]`, `interfaces`, `allInterfaces`, `isDeprecated`, `isPlugin`, `isService`.

## Packages

### `kd.hr.hbp.common.log`

Path prefix: `javadoc/kd/hr/hbp/common/log/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `HRLog` | interface |  |  | 22 | 12 | yes |
| `HRLogFactory` | class |  |  | 2 | 0 |  |
| `HRLogLevel` | class |  | `java.io.Serializable` | 2 | 9 |  |
| `HRLogModule` | class |  | `kd.sdk.module.Module` | 0 | 0 |  |

### `kd.hr.hbp.common.log.impl`

Path prefix: `javadoc/kd/hr/hbp/common/log/impl/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `HRLogORMImpl` | class |  | `kd.hr.hbp.common.log.HRLog` | 23 | 0 |  |
