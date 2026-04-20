# kd.sdk.wtc.wtabm

**休假管理** · app=`wtabm` cloud=`wtc` isv=`kingdee`

Class HTML path rule: `javadoc/<package-with-slashes>/<ClassName>.html`
Example: package `kd.bos.algo`, class `Algo` → `javadoc/kd/bos/algo/Algo.html`

Each class HTML contains a `cm={...}` JSON object on line 2 with full Javadoc:
`comment`, `declare`, `methods[]` (name/modifiers/returnType/paramNames/paramTypes/comment/tags/throwExceptions/annotations), `fields[]`, `interfaces`, `allInterfaces`, `isDeprecated`, `isPlugin`, `isService`.

## Packages

### `kd.sdk.wtc.wtabm`

Path prefix: `javadoc/kd/sdk/wtc/wtabm/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `SdkWtcWtabmModule` | class |  | `kd.sdk.module.Module` | 0 | 0 |  |

### `kd.sdk.wtc.wtabm.business.helper`

Path prefix: `javadoc/kd/sdk/wtc/wtabm/business/helper/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `VaBillDto` | class |  | `java.io.Serializable` | 16 | 0 |  |
| `VaBillEntryEntityDto` | class |  | `java.io.Serializable` | 28 | 0 | yes |
| `VaBillSubEntryDto` | class |  | `java.io.Serializable` | 8 | 0 | yes |
| `VaBillsWithTimeInfoParam` | class |  | `java.io.Serializable` | 8 | 0 |  |
| `WTABMHelper` | class |  |  | 1 | 0 |  |
| `WtabmVaBillHelper` | class |  |  | 1 | 0 |  |

### `kd.sdk.wtc.wtabm.business.helper.vaplan`

Path prefix: `javadoc/kd/sdk/wtc/wtabm/business/helper/vaplan/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `VaPlanRuleQuery` | class |  | `java.io.Serializable` | 6 | 0 |  |
| `VaPlanRuleResp` | class |  | `java.io.Serializable` | 4 | 0 |  |

### `kd.sdk.wtc.wtabm.business.model`

Path prefix: `javadoc/kd/sdk/wtc/wtabm/business/model/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `ShiftParseVoExt` | interface |  |  | 5 | 0 |  |
| `VaBillEntryEntityValidVoExt` | interface |  |  | 14 | 0 |  |
| `VaBillWithTimeVoExt` | interface |  |  | 7 | 0 |  |
| `VaEntryValidTimeVoExt` | interface |  |  | 4 | 0 |  |

### `kd.sdk.wtc.wtabm.business.quota`

Path prefix: `javadoc/kd/sdk/wtc/wtabm/business/quota/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `OnRenameVaTypeEvent` | class |  |  | 12 | 0 | yes |
| `VaTypeRenamePlugin` | interface |  |  | 1 | 0 |  |

### `kd.sdk.wtc.wtabm.business.spva`

Path prefix: `javadoc/kd/sdk/wtc/wtabm/business/spva/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `SpecialVaExpService` | interface |  |  | 2 | 0 |  |
| `SpecialVaTimeDto` | class |  |  | 4 | 0 |  |
| `SpecialVaTimeParam` | class |  |  | 14 | 0 |  |

### `kd.sdk.wtc.wtabm.business.va`

Path prefix: `javadoc/kd/sdk/wtc/wtabm/business/va/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `OnCalVaApplyTimeEvent` | interface |  |  | 8 | 0 |  |
| `OnCheckVaApplyOverlapEvent` | class |  |  | 3 | 0 |  |
| `VaApplyOverlapCheckExtPlugin` | interface |  |  | 1 | 0 |  |
| `VaApplyTimeCalExtPlugin` | interface |  |  | 1 | 0 |  |
| `VaInfoCallBackParam` | class |  |  | 8 | 0 | yes |
| `VaInfoExpService` | interface |  |  | 1 | 0 |  |
| `VaTimeResult` | class |  |  | 7 | 0 |  |
