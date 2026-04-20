# kd.sdk.wtc.wts

**排班管理** · app=`wts` cloud=`wtc` isv=`kingdee`

Class HTML path rule: `javadoc/<package-with-slashes>/<ClassName>.html`
Example: package `kd.bos.algo`, class `Algo` → `javadoc/kd/bos/algo/Algo.html`

Each class HTML contains a `cm={...}` JSON object on line 2 with full Javadoc:
`comment`, `declare`, `methods[]` (name/modifiers/returnType/paramNames/paramTypes/comment/tags/throwExceptions/annotations), `fields[]`, `interfaces`, `allInterfaces`, `isDeprecated`, `isPlugin`, `isService`.

## Packages

### `kd.sdk.wtc.wts`

Path prefix: `javadoc/kd/sdk/wtc/wts/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `SdkWtcWtsModule` | class |  | `kd.sdk.module.Module` | 0 | 0 |  |

### `kd.sdk.wtc.wts.business.roster`

Path prefix: `javadoc/kd/sdk/wtc/wts/business/roster/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `OnRosterValidatorEvent` | class |  |  | 14 | 0 | yes |
| `RosterValidatorExt` | interface |  |  | 1 | 2 |  |
| `RosterValidatorExtPlugin` | interface |  |  | 1 | 3 |  |
| `WTSRosterHelper` | class |  |  | 4 | 0 |  |
