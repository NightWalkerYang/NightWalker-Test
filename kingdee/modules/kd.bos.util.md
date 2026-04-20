# kd.bos.util

**多用途实用性工具** · app=`sys` cloud=`bos` isv=`kingdee`

Class HTML path rule: `javadoc/<package-with-slashes>/<ClassName>.html`
Example: package `kd.bos.algo`, class `Algo` → `javadoc/kd/bos/algo/Algo.html`

Each class HTML contains a `cm={...}` JSON object on line 2 with full Javadoc:
`comment`, `declare`, `methods[]` (name/modifiers/returnType/paramNames/paramTypes/comment/tags/throwExceptions/annotations), `fields[]`, `interfaces`, `allInterfaces`, `isDeprecated`, `isPlugin`, `isService`.

## Packages

### `kd.bos.util`

Path prefix: `javadoc/kd/bos/util/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `CollectionUtils` | class |  |  | 2 | 0 |  |
| `DisCardUtil` | class |  |  | 1 | 0 |  |
| `ExceptionUtils` | class |  |  | 2 | 0 |  |
| `FileNameUtils` | class |  |  | 9 | 8 |  |
| `HttpUtils` | class |  |  | 11 | 0 |  |
| `JSONUtils` | class |  |  | 9 | 0 |  |
| `NetAddressUtils` | class |  |  | 7 | 0 |  |
| `RevProxyUtil` | class |  |  | 6 | 10 |  |
| `StringUtils` | class |  |  | 18 | 0 |  |
| `ThreadLocals` | class |  |  | 5 | 0 |  |
| `UtilsModule` | class |  | `kd.sdk.module.Module` | 0 | 0 |  |

### `kd.bos.util.dbhint`

Path prefix: `javadoc/kd/bos/util/dbhint/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `DBHintContext` | class |  | `java.lang.AutoCloseable` | 7 | 0 |  |
