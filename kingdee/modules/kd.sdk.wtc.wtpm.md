# kd.sdk.wtc.wtpm

**打卡管理** · app=`wtpm` cloud=`wtc` isv=`kingdee`

Class HTML path rule: `javadoc/<package-with-slashes>/<ClassName>.html`
Example: package `kd.bos.algo`, class `Algo` → `javadoc/kd/bos/algo/Algo.html`

Each class HTML contains a `cm={...}` JSON object on line 2 with full Javadoc:
`comment`, `declare`, `methods[]` (name/modifiers/returnType/paramNames/paramTypes/comment/tags/throwExceptions/annotations), `fields[]`, `interfaces`, `allInterfaces`, `isDeprecated`, `isPlugin`, `isService`.

## Packages

### `kd.sdk.wtc.wtpm`

Path prefix: `javadoc/kd/sdk/wtc/wtpm/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `SdkWtcWtpmModule` | class |  | `kd.sdk.module.Module` | 0 | 0 |  |

### `kd.sdk.wtc.wtpm.business`

Path prefix: `javadoc/kd/sdk/wtc/wtpm/business/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `WTPMSignCardHelper` | class |  |  | 2 | 0 |  |

### `kd.sdk.wtc.wtpm.business.cardmatch`

Path prefix: `javadoc/kd/sdk/wtc/wtpm/business/cardmatch/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `AfterCardMatchEvent` | class |  |  | 3 | 0 | yes |
| `AfterCardMatchExtPlugin` | interface |  |  | 1 | 0 |  |
| `CardMatchOffShiftExtPlugin` | interface |  |  | 1 | 0 |  |
| `CardMatchTaskParam` | class |  | `java.io.Serializable` | 15 | 0 | yes |
| `OffShiftTakeCardRangeEvent` | class |  |  | 13 | 0 | yes |

### `kd.sdk.wtc.wtpm.business.punchcard`

Path prefix: `javadoc/kd/sdk/wtc/wtpm/business/punchcard/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `WTPMPunchCardHelper` | class |  |  | 1 | 0 |  |

### `kd.sdk.wtc.wtpm.model.cardmatch`

Path prefix: `javadoc/kd/sdk/wtc/wtpm/model/cardmatch/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `CardMatchTaskVoExt` | interface |  |  | 15 | 0 |  |
| `MultiCardEntryExt` | class |  | `java.io.Serializable` | 32 | 0 |  |
| `MultiCardEntryExtStd` | interface |  |  | 15 | 0 |  |
| `MultiCardExt` | class |  |  | 28 | 0 |  |
| `MultiCardExtStd` | interface |  |  | 13 | 0 |  |
