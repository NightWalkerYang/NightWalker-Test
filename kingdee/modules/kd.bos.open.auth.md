# kd.bos.open.auth

**OpenAPI Auth Service** · app=`bos` cloud=`bos` isv=`kingdee`

Class HTML path rule: `javadoc/<package-with-slashes>/<ClassName>.html`
Example: package `kd.bos.algo`, class `Algo` → `javadoc/kd/bos/algo/Algo.html`

Each class HTML contains a `cm={...}` JSON object on line 2 with full Javadoc:
`comment`, `declare`, `methods[]` (name/modifiers/returnType/paramNames/paramTypes/comment/tags/throwExceptions/annotations), `fields[]`, `interfaces`, `allInterfaces`, `isDeprecated`, `isPlugin`, `isService`.

## Packages

### `kd.bos.open.auth`

Path prefix: `javadoc/kd/bos/open/auth/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `OpenAuthModule` | class |  | `kd.sdk.module.Module` | 0 | 0 |  |

### `kd.bos.openapi.security.model`

Path prefix: `javadoc/kd/bos/openapi/security/model/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `CommDataDto` | class |  | `java.io.Serializable` | 16 | 0 |  |
| `CommonSecurityDto` | class | `kd.bos.openapi.security.model.CommDataDto` | `java.io.Serializable` | 12 | 0 |  |
| `EncryptInfo` | class |  | `java.io.Serializable` | 6 | 0 |  |
| `EncryptionEnum` | enum |  |  | 3 | 4 |  |
| `RequestSecurityDto` | class | `kd.bos.openapi.security.model.CommonSecurityDto` | `java.io.Serializable` | 4 | 0 |  |
| `ResponseSecurityDto` | class | `kd.bos.openapi.security.model.CommonSecurityDto` | `java.io.Serializable` | 7 | 0 | yes |
| `SignInfoDto` | class | `kd.bos.openapi.security.model.CommDataDto` | `java.io.Serializable` | 10 | 0 |  |
