# kd.sdk.wtc.wtte

**考勤核算** · app=`wtte` cloud=`wtc` isv=`kingdee`

Class HTML path rule: `javadoc/<package-with-slashes>/<ClassName>.html`
Example: package `kd.bos.algo`, class `Algo` → `javadoc/kd/bos/algo/Algo.html`

Each class HTML contains a `cm={...}` JSON object on line 2 with full Javadoc:
`comment`, `declare`, `methods[]` (name/modifiers/returnType/paramNames/paramTypes/comment/tags/throwExceptions/annotations), `fields[]`, `interfaces`, `allInterfaces`, `isDeprecated`, `isPlugin`, `isService`.

## Packages

### `kd.sdk.wtc.wtte`

Path prefix: `javadoc/kd/sdk/wtc/wtte/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `SdkWtcWtteModule` | class |  | `kd.sdk.module.Module` | 0 | 0 |  |

### `kd.sdk.wtc.wtte.business.attrecord`

Path prefix: `javadoc/kd/sdk/wtc/wtte/business/attrecord/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `WTTEAttRecordHelper` | class |  |  | 1 | 0 |  |

### `kd.sdk.wtc.wtte.business.exrecord`

Path prefix: `javadoc/kd/sdk/wtc/wtte/business/exrecord/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `WTTEExRecordHelper` | class |  |  | 1 | 0 |  |

### `kd.sdk.wtc.wtte.business.qttask`

Path prefix: `javadoc/kd/sdk/wtc/wtte/business/qttask/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `QTTaskHelper` | class |  |  | 2 | 0 |  |
| `QTTaskReq` | class |  | `java.io.Serializable` | 14 | 0 | yes |
| `QTTaskStartReq` | class |  | `java.io.Serializable` | 19 | 0 |  |
| `QTTaskStartRes` | class |  | `java.io.Serializable` | 9 | 0 |  |

### `kd.sdk.wtc.wtte.business.tietask`

Path prefix: `javadoc/kd/sdk/wtc/wtte/business/tietask/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `TieTaskHelper` | class |  |  | 1 | 0 |  |
| `TieTaskReq` | class |  | `java.io.Serializable` | 14 | 0 | yes |
| `TieTaskResp` | interface |  |  | 4 | 0 |  |
