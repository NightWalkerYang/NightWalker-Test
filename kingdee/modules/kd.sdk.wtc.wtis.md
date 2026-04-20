# kd.sdk.wtc.wtis

**工时假勤集成服务** · app=`wtis` cloud=`wtc` isv=`kingdee`

Class HTML path rule: `javadoc/<package-with-slashes>/<ClassName>.html`
Example: package `kd.bos.algo`, class `Algo` → `javadoc/kd/bos/algo/Algo.html`

Each class HTML contains a `cm={...}` JSON object on line 2 with full Javadoc:
`comment`, `declare`, `methods[]` (name/modifiers/returnType/paramNames/paramTypes/comment/tags/throwExceptions/annotations), `fields[]`, `interfaces`, `allInterfaces`, `isDeprecated`, `isPlugin`, `isService`.

## Packages

### `kd.sdk.wtc.wtis`

Path prefix: `javadoc/kd/sdk/wtc/wtis/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `SdkWtcWtisModule` | class |  | `kd.sdk.module.Module` | 0 | 0 |  |

### `kd.sdk.wtc.wtis.business.attdata`

Path prefix: `javadoc/kd/sdk/wtc/wtis/business/attdata/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `BeforeSavePayAttDataInfoEvent` | class |  |  | 8 | 0 | yes |
| `DoSetExtFieldEvent` | class |  |  | 3 | 0 |  |
| `PayAttDataInfoExtPlugin` | interface |  |  | 3 | 0 |  |
| `PayAttDataInfoExtPluginDemo` | class |  | `kd.sdk.wtc.wtis.business.attdata.PayAttDataInfoExtPlugin` | 3 | 0 |  |

### `kd.sdk.wtc.wtis.business.coordination`

Path prefix: `javadoc/kd/sdk/wtc/wtis/business/coordination/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `AttFileSchemeDto` | class |  |  | 27 | 0 | yes |
| `EntryCoordinationParam` | class |  |  | 7 | 0 |  |
| `NewAttFileCoordinationExpService` | interface |  |  | 1 | 0 |  |
