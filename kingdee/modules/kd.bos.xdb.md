# kd.bos.xdb

**水平分表** · app=`sys` cloud=`bos` isv=`kingdee`

Class HTML path rule: `javadoc/<package-with-slashes>/<ClassName>.html`
Example: package `kd.bos.algo`, class `Algo` → `javadoc/kd/bos/algo/Algo.html`

Each class HTML contains a `cm={...}` JSON object on line 2 with full Javadoc:
`comment`, `declare`, `methods[]` (name/modifiers/returnType/paramNames/paramTypes/comment/tags/throwExceptions/annotations), `fields[]`, `interfaces`, `allInterfaces`, `isDeprecated`, `isPlugin`, `isService`.

## Packages

### `kd.bos.xdb`

Path prefix: `javadoc/kd/bos/xdb/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `QueryTimeout` | interface |  | `java.lang.AutoCloseable` | 1 | 0 |  |
| `ShardingModule` | class |  | `kd.sdk.module.Module` | 0 | 0 |  |

### `kd.bos.xdb.hint`

Path prefix: `javadoc/kd/bos/xdb/hint/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `ShardingHintContext` | class |  | `java.lang.AutoCloseable` | 11 | 0 |  |

### `kd.bos.xdb.mservice`

Path prefix: `javadoc/kd/bos/xdb/mservice/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `ShardingMetadataService` | interface |  |  | 5 | 0 |  |
