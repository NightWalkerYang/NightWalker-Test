# kd.sdk.sit.sitcs

**社保个税计算服务** · app=`sitcs` cloud=`sit` isv=`kingdee`

Class HTML path rule: `javadoc/<package-with-slashes>/<ClassName>.html`
Example: package `kd.bos.algo`, class `Algo` → `javadoc/kd/bos/algo/Algo.html`

Each class HTML contains a `cm={...}` JSON object on line 2 with full Javadoc:
`comment`, `declare`, `methods[]` (name/modifiers/returnType/paramNames/paramTypes/comment/tags/throwExceptions/annotations), `fields[]`, `interfaces`, `allInterfaces`, `isDeprecated`, `isPlugin`, `isService`.

## Packages

### `kd.sdk.sit.sitcs`

Path prefix: `javadoc/kd/sdk/sit/sitcs/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `SdkSitcsModule` | class |  | `kd.sdk.module.Module` | 0 | 0 |  |

### `kd.sdk.sit.sitcs.business.extpoint.sinsurcal`

Path prefix: `javadoc/kd/sdk/sit/sitcs/business/extpoint/sinsurcal/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `IBeforeSocialCalDataSaveExtService` | interface |  |  | 1 | 0 |  |
| `ISocialCalDataSave` | interface |  |  | 1 | 0 |  |

### `kd.sdk.sit.sitcs.business.extpoint.sinsurdcl`

Path prefix: `javadoc/kd/sdk/sit/sitcs/business/extpoint/sinsurdcl/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `IDclPersonDataSaveBeforeExtService` | interface |  |  | 1 | 0 |  |

### `kd.sdk.sit.sitcs.common.events.sinsurcal`

Path prefix: `javadoc/kd/sdk/sit/sitcs/common/events/sinsurcal/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `AfterSocialCalDataSaveEvent` | class |  | `java.io.Serializable` | 6 | 0 |  |
| `BeforeSocialCalDataSaveEvent` | class |  | `java.io.Serializable` | 4 | 0 |  |

### `kd.sdk.sit.sitcs.common.events.sinsurdcl`

Path prefix: `javadoc/kd/sdk/sit/sitcs/common/events/sinsurdcl/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `DclPersonDataSaveBeforeEvent` | class |  | `java.io.Serializable` | 4 | 0 |  |
