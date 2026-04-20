# kd.bos.open.customapi

**OpenAPI custom api service** · app=`bos` cloud=`bos` isv=`kingdee`

Class HTML path rule: `javadoc/<package-with-slashes>/<ClassName>.html`
Example: package `kd.bos.algo`, class `Algo` → `javadoc/kd/bos/algo/Algo.html`

Each class HTML contains a `cm={...}` JSON object on line 2 with full Javadoc:
`comment`, `declare`, `methods[]` (name/modifiers/returnType/paramNames/paramTypes/comment/tags/throwExceptions/annotations), `fields[]`, `interfaces`, `allInterfaces`, `isDeprecated`, `isPlugin`, `isService`.

## Packages

### `kd.bos.open.customapi`

Path prefix: `javadoc/kd/bos/open/customapi/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `OpenCustomModule` | class |  | `kd.sdk.module.Module` | 0 | 0 |  |

### `kd.bos.openapi.common.custom.annotation`

Path prefix: `javadoc/kd/bos/openapi/common/custom/annotation/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `ApiController` | interface |  | `java.lang.annotation.Annotation` | 2 | 0 |  |
| `ApiErrorCode` | interface |  | `java.lang.annotation.Annotation` | 2 | 0 |  |
| `ApiErrorCodes` | interface |  | `java.lang.annotation.Annotation` | 1 | 0 |  |
| `ApiGetMapping` | interface |  | `java.lang.annotation.Annotation` | 3 | 0 |  |
| `ApiHeader` | interface |  | `java.lang.annotation.Annotation` | 3 | 0 |  |
| `ApiHeaders` | interface |  | `java.lang.annotation.Annotation` | 1 | 0 |  |
| `ApiMapping` | interface |  | `java.lang.annotation.Annotation` | 1 | 0 |  |
| `ApiModel` | interface |  | `java.lang.annotation.Annotation` | 0 | 0 |  |
| `ApiParam` | interface |  | `java.lang.annotation.Annotation` | 8 | 0 |  |
| `ApiPostMapping` | interface |  | `java.lang.annotation.Annotation` | 3 | 0 |  |
| `ApiRequestBody` | interface |  | `java.lang.annotation.Annotation` | 5 | 0 |  |
| `ApiResponseBody` | interface |  | `java.lang.annotation.Annotation` | 2 | 0 |  |

### `kd.bos.openapi.common.custom.model`

Path prefix: `javadoc/kd/bos/openapi/common/custom/model/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `CustomApiBaseModel` | class |  | `java.io.Serializable` | 0 | 0 |  |

### `kd.bos.openapi.common.result`

Path prefix: `javadoc/kd/bos/openapi/common/result/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `CustomApiResult` | class |  | `java.io.Serializable` | 10 | 0 |  |
| `OpenApiResult` | class |  | `java.io.Serializable` | 19 | 0 | yes |
