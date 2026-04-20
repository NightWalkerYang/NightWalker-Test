# kd.sdk.wtc.wtom

**加班管理** · app=`wtom` cloud=`wtc` isv=`kingdee`

Class HTML path rule: `javadoc/<package-with-slashes>/<ClassName>.html`
Example: package `kd.bos.algo`, class `Algo` → `javadoc/kd/bos/algo/Algo.html`

Each class HTML contains a `cm={...}` JSON object on line 2 with full Javadoc:
`comment`, `declare`, `methods[]` (name/modifiers/returnType/paramNames/paramTypes/comment/tags/throwExceptions/annotations), `fields[]`, `interfaces`, `allInterfaces`, `isDeprecated`, `isPlugin`, `isService`.

## Packages

### `kd.sdk.wtc.wtom`

Path prefix: `javadoc/kd/sdk/wtc/wtom/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `OnMatchOtDutyDateEvent` | class |  |  | 2 | 0 | yes |
| `OtDutyDateParam` | class |  |  | 7 | 0 | yes |
| `SdkWtcWtomModule` | class |  | `kd.sdk.module.Module` | 0 | 0 |  |

### `kd.sdk.wtc.wtom.business`

Path prefix: `javadoc/kd/sdk/wtc/wtom/business/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `OtDutyDateExtPlugin` | interface |  |  | 1 | 0 |  |
| `WtomHelper` | class |  |  | 3 | 0 |  |

### `kd.sdk.wtc.wtom.business.applytime`

Path prefix: `javadoc/kd/sdk/wtc/wtom/business/applytime/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `OnCalOtApplyTimeEvent` | class |  |  | 4 | 0 | yes |
| `OnSetOtApplyTimeQuery` | class |  |  | 8 | 0 | yes |
| `OtApplyTimeExtPlugin` | interface |  |  | 1 | 0 |  |
