# kd.bos.svc.ca

**CA认证模块** · app=`sys` cloud=`bos` isv=`kingdee`

Class HTML path rule: `javadoc/<package-with-slashes>/<ClassName>.html`
Example: package `kd.bos.algo`, class `Algo` → `javadoc/kd/bos/algo/Algo.html`

Each class HTML contains a `cm={...}` JSON object on line 2 with full Javadoc:
`comment`, `declare`, `methods[]` (name/modifiers/returnType/paramNames/paramTypes/comment/tags/throwExceptions/annotations), `fields[]`, `interfaces`, `allInterfaces`, `isDeprecated`, `isPlugin`, `isService`.

## Packages

### `kd.bos.ca`

Path prefix: `javadoc/kd/bos/ca/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `AbstractCAService` | class |  | `kd.bos.ca.ICAService` | 1 | 0 |  |
| `ICAService` | interface |  |  | 1 | 0 |  |

### `kd.bos.ca.bean`

Path prefix: `javadoc/kd/bos/ca/bean/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `VerifySignResult` | class |  |  | 4 | 0 |  |

### `kd.bos.servicehelper.ca`

Path prefix: `javadoc/kd/bos/servicehelper/ca/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `SignCommandParam` | class |  | `java.io.Serializable` | 8 | 0 |  |
| `SignCommandResult` | class |  | `java.io.Serializable` | 6 | 0 |  |
| `SignServiceHelper` | class |  |  | 6 | 0 |  |

### `kd.bos.svc.ca`

Path prefix: `javadoc/kd/bos/svc/ca/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `CAModule` | class |  | `kd.sdk.module.Module` | 1 | 0 |  |
