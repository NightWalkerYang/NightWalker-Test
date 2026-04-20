# kd.bos.mutex

**网络控制** · app=`bos` cloud=`bos` isv=`kingdee`

Class HTML path rule: `javadoc/<package-with-slashes>/<ClassName>.html`
Example: package `kd.bos.algo`, class `Algo` → `javadoc/kd/bos/algo/Algo.html`

Each class HTML contains a `cm={...}` JSON object on line 2 with full Javadoc:
`comment`, `declare`, `methods[]` (name/modifiers/returnType/paramNames/paramTypes/comment/tags/throwExceptions/annotations), `fields[]`, `interfaces`, `allInterfaces`, `isDeprecated`, `isPlugin`, `isService`.

## Packages

### `kd.bos.mutex`

Path prefix: `javadoc/kd/bos/mutex/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `DataMutex` | interface |  | `java.io.Closeable` | 11 | 16 |  |
| `FunctionMutex` | interface |  | `java.io.Closeable` | 2 | 0 |  |
| `LockType` | enum |  |  | 1 | 3 |  |
| `MutexFactory` | class |  |  | 4 | 0 |  |
| `MutexModule` | class |  | `kd.sdk.module.Module` | 0 | 0 |  |
| `ShareLock` | interface |  |  | 7 | 0 |  |

### `kd.bos.mutex.impl`

Path prefix: `javadoc/kd/bos/mutex/impl/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `IntentLockInfo` | class |  |  | 10 | 0 |  |
| `MutexBaseInfo` | class |  | `java.io.Serializable` | 8 | 0 |  |
| `MutexLockDataInfo` | class | `kd.bos.mutex.impl.MutexBaseInfo` | `java.io.Serializable` | 20 | 0 |  |
| `MutexLockInfo` | class | `kd.bos.mutex.impl.MutexBaseInfo` |  | 16 | 0 |  |
