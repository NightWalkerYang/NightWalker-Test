# kd.bos.exception

**系统异常** · app=`sys` cloud=`bos` isv=`kingdee`

Class HTML path rule: `javadoc/<package-with-slashes>/<ClassName>.html`
Example: package `kd.bos.algo`, class `Algo` → `javadoc/kd/bos/algo/Algo.html`

Each class HTML contains a `cm={...}` JSON object on line 2 with full Javadoc:
`comment`, `declare`, `methods[]` (name/modifiers/returnType/paramNames/paramTypes/comment/tags/throwExceptions/annotations), `fields[]`, `interfaces`, `allInterfaces`, `isDeprecated`, `isPlugin`, `isService`.

## Packages

### `kd.bos.exception`

Path prefix: `javadoc/kd/bos/exception/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `ErrorCode` | class |  | `java.io.Serializable` | 5 | 0 |  |
| `ErrorCode.LangMessage` | class |  | `java.io.Serializable` | 3 | 0 |  |
| `ExceptionModule` | class |  | `kd.sdk.module.Module` | 0 | 0 |  |
| `KDException` | class | `java.lang.RuntimeException` |  | 7 | 2 |  |
