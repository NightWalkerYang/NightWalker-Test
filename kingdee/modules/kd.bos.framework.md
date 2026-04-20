# kd.bos.framework

**系统框架** · app=`sys` cloud=`bos` isv=`kingdee`

Class HTML path rule: `javadoc/<package-with-slashes>/<ClassName>.html`
Example: package `kd.bos.algo`, class `Algo` → `javadoc/kd/bos/algo/Algo.html`

Each class HTML contains a `cm={...}` JSON object on line 2 with full Javadoc:
`comment`, `declare`, `methods[]` (name/modifiers/returnType/paramNames/paramTypes/comment/tags/throwExceptions/annotations), `fields[]`, `interfaces`, `allInterfaces`, `isDeprecated`, `isPlugin`, `isService`.

## Packages

### `kd.bos.context`

Path prefix: `javadoc/kd/bos/context/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `KdtxRequestContext` | class |  | `java.io.Serializable` | 2 | 0 |  |
| `OperationContext` | class |  |  | 16 | 6 | yes |
| `RequestContext` | class |  | `java.io.Serializable` | 63 | 15 |  |
| `RequestContextCreator` | class |  |  | 14 | 0 |  |

### `kd.bos.framework`

Path prefix: `javadoc/kd/bos/framework/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `FrameworkModule` | class |  | `kd.sdk.module.Module` | 0 | 0 |  |

### `kd.bos.framework.lifecycle`

Path prefix: `javadoc/kd/bos/framework/lifecycle/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `Service` | interface |  |  | 4 | 0 |  |

### `kd.bos.framework.lifecycle.appstart`

Path prefix: `javadoc/kd/bos/framework/lifecycle/appstart/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `AppStarter` | interface |  |  | 1 | 0 |  |

### `kd.bos.lang`

Path prefix: `javadoc/kd/bos/lang/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `HZPinyin` | class |  |  | 7 | 0 | yes |
| `Lang` | enum |  |  | 7 | 55 |  |
