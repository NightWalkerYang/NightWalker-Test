# kd.sdk.wtc.wtam

**日常考勤** · app=`wtam` cloud=`wtc` isv=`kingdee`

Class HTML path rule: `javadoc/<package-with-slashes>/<ClassName>.html`
Example: package `kd.bos.algo`, class `Algo` → `javadoc/kd/bos/algo/Algo.html`

Each class HTML contains a `cm={...}` JSON object on line 2 with full Javadoc:
`comment`, `declare`, `methods[]` (name/modifiers/returnType/paramNames/paramTypes/comment/tags/throwExceptions/annotations), `fields[]`, `interfaces`, `allInterfaces`, `isDeprecated`, `isPlugin`, `isService`.

## Packages

### `kd.sdk.wtc.wtam`

Path prefix: `javadoc/kd/sdk/wtc/wtam/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `SdkWtcWtamModule` | class |  | `kd.sdk.module.Module` | 0 | 0 |  |

### `kd.sdk.wtc.wtam.business.applytime`

Path prefix: `javadoc/kd/sdk/wtc/wtam/business/applytime/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `TpApplyTimeCalculateEvent` | class |  |  | 5 | 0 | yes |
| `TpApplyTimeCalculateExtPlugin` | interface |  |  | 1 | 0 |  |

### `kd.sdk.wtc.wtam.business.tp`

Path prefix: `javadoc/kd/sdk/wtc/wtam/business/tp/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `TpInfoExpService` | interface |  |  | 3 | 0 |  |
| `TpInfoParameterParam` | class |  |  | 12 | 0 | yes |
| `WtamHelper` | class |  |  | 1 | 2 |  |
