# kd.bos.db

**DB引擎** · app=`sys` cloud=`bos` isv=`kingdee`

Class HTML path rule: `javadoc/<package-with-slashes>/<ClassName>.html`
Example: package `kd.bos.algo`, class `Algo` → `javadoc/kd/bos/algo/Algo.html`

Each class HTML contains a `cm={...}` JSON object on line 2 with full Javadoc:
`comment`, `declare`, `methods[]` (name/modifiers/returnType/paramNames/paramTypes/comment/tags/throwExceptions/annotations), `fields[]`, `interfaces`, `allInterfaces`, `isDeprecated`, `isPlugin`, `isService`.

## Packages

### `kd.bos.db`

Path prefix: `javadoc/kd/bos/db/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `DB` | class |  |  | 3 | 0 |  |
| `DBModule` | class |  | `kd.sdk.module.Module` | 0 | 0 |  |

### `kd.bos.db.splittingread`

Path prefix: `javadoc/kd/bos/db/splittingread/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `RW` | interface |  |  | 3 | 0 |  |
| `RWContext` | interface |  | `java.lang.AutoCloseable` | 1 | 0 |  |

### `kd.bos.db.tx`

Path prefix: `javadoc/kd/bos/db/tx/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `Propagation` | enum |  |  | 0 | 5 |  |
| `TX` | class |  |  | 6 | 0 |  |
| `TXHandle` | class |  | `java.lang.AutoCloseable` | 7 | 0 |  |
