# kd.bos.orm

**ORM引擎** · app=`sys` cloud=`bos` isv=`kingdee`

Class HTML path rule: `javadoc/<package-with-slashes>/<ClassName>.html`
Example: package `kd.bos.algo`, class `Algo` → `javadoc/kd/bos/algo/Algo.html`

Each class HTML contains a `cm={...}` JSON object on line 2 with full Javadoc:
`comment`, `declare`, `methods[]` (name/modifiers/returnType/paramNames/paramTypes/comment/tags/throwExceptions/annotations), `fields[]`, `interfaces`, `allInterfaces`, `isDeprecated`, `isPlugin`, `isService`.

## Packages

### `kd.bos.orm`

Path prefix: `javadoc/kd/bos/orm/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `ORMHint.JoinHint` | enum |  |  | 0 | 3 |  |
| `ORMHint.JoinHinter` | interface |  |  | 1 | 0 |  |
| `ORMModule` | class |  | `kd.sdk.module.Module` | 0 | 0 |  |

### `kd.bos.orm.datasync`

Path prefix: `javadoc/kd/bos/orm/datasync/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `DtsAccountPower` | class |  |  | 1 | 0 |  |

### `kd.bos.orm.query`

Path prefix: `javadoc/kd/bos/orm/query/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `Distinctable` | interface |  |  | 0 | 0 |  |
| `EntityNotExistsException` | class | `java.lang.RuntimeException` |  | 2 | 0 |  |
| `NoSuchPropertyException` | class | `java.lang.RuntimeException` |  | 1 | 0 |  |
| `ORMException` | class | `KDException` |  | 3 | 11 | yes |
| `QCP` | interface |  | `java.io.Serializable` | 0 | 9 |  |
| `QFilter` | class |  | `kd.bos.orm.query.QCP`, `java.io.Serializable` | 42 | 0 |  |
| `QFilter.QFilterNest` | class |  | `java.io.Serializable` | 7 | 0 |  |
| `QFilterHint` | interface |  | `java.io.Serializable` | 1 | 6 | yes |
| `WithEntityEntryDistinctable` | class |  | `kd.bos.orm.query.Distinctable` | 1 | 0 |  |
