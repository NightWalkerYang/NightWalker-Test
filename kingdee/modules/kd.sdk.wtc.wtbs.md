# kd.sdk.wtc.wtbs

**工时假勤基础服务** · app=`wtbs` cloud=`wtc` isv=`kingdee`

Class HTML path rule: `javadoc/<package-with-slashes>/<ClassName>.html`
Example: package `kd.bos.algo`, class `Algo` → `javadoc/kd/bos/algo/Algo.html`

Each class HTML contains a `cm={...}` JSON object on line 2 with full Javadoc:
`comment`, `declare`, `methods[]` (name/modifiers/returnType/paramNames/paramTypes/comment/tags/throwExceptions/annotations), `fields[]`, `interfaces`, `allInterfaces`, `isDeprecated`, `isPlugin`, `isService`.

## Packages

### `kd.sdk.wtc.wtbs`

Path prefix: `javadoc/kd/sdk/wtc/wtbs/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `SdkWtcWtbsModule` | class |  | `kd.sdk.module.Module` | 0 | 0 |  |

### `kd.sdk.wtc.wtbs.business.bill.dutydate`

Path prefix: `javadoc/kd/sdk/wtc/wtbs/business/bill/dutydate/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `BillDutyDateExtPlugin` | interface |  |  | 1 | 0 |  |
| `OnMatchBillDutyDateEvent` | class |  |  | 7 | 0 | yes |

### `kd.sdk.wtc.wtbs.business.datarange`

Path prefix: `javadoc/kd/sdk/wtc/wtbs/business/datarange/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `DateRangeRuleExpPlugin` | interface |  |  | 1 | 0 |  |
| `OnResolveDateRangeEvent` | class |  |  | 7 | 0 | yes |

### `kd.sdk.wtc.wtbs.business.limitcond`

Path prefix: `javadoc/kd/sdk/wtc/wtbs/business/limitcond/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `OnLimitConditionEvent` | class |  |  | 7 | 0 | yes |
| `OnLimitConditionExpPlugin` | interface |  |  | 1 | 0 |  |

### `kd.sdk.wtc.wtbs.business.mobilescheme`

Path prefix: `javadoc/kd/sdk/wtc/wtbs/business/mobilescheme/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `ISchemeMatchPlugin` | interface |  |  | 2 | 0 |  |
| `SchemeMatchEvent` | class |  |  | 6 | 0 | yes |

### `kd.sdk.wtc.wtbs.common.access`

Path prefix: `javadoc/kd/sdk/wtc/wtbs/common/access/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `ConditionDtoExt` | interface |  | `java.io.Serializable` | 15 | 0 |  |

### `kd.sdk.wtc.wtbs.common.constants`

Path prefix: `javadoc/kd/sdk/wtc/wtbs/common/constants/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `WTCCommonConstants` | interface |  |  | 0 | 9 |  |
| `WTCRuleEngineConstants` | interface |  |  | 0 | 4 |  |

### `kd.sdk.wtc.wtbs.common.enums`

Path prefix: `javadoc/kd/sdk/wtc/wtbs/common/enums/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `RefDateType` | enum |  |  | 1 | 5 | yes |
| `UserModelType` | enum |  | `java.io.Serializable` | 0 | 4 |  |
| `WTCDateRangeSource` | enum |  |  | 0 | 5 |  |

### `kd.sdk.wtc.wtbs.common.model`

Path prefix: `javadoc/kd/sdk/wtc/wtbs/common/model/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `AbstractExtendableObj` | class |  | `kd.sdk.wtc.wtbs.common.model.Extendable` | 3 | 0 |  |
| `Extendable` | interface |  |  | 3 | 0 |  |

### `kd.sdk.wtc.wtbs.task`

Path prefix: `javadoc/kd/sdk/wtc/wtbs/task/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `AfterSubTaskEndEvent` | class |  |  | 4 | 0 | yes |
| `AfterTaskEndEvent` | class |  |  | 3 | 0 | yes |
| `WTCSubTaskEndExtPlugin` | interface |  |  | 1 | 0 |  |
| `WTCTaskEndExtPlugin` | interface |  |  | 1 | 0 |  |
