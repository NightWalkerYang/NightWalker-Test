# kd.sdk.wtc.wtp

**工时假勤规则** · app=`wtp` cloud=`wtc` isv=`kingdee`

Class HTML path rule: `javadoc/<package-with-slashes>/<ClassName>.html`
Example: package `kd.bos.algo`, class `Algo` → `javadoc/kd/bos/algo/Algo.html`

Each class HTML contains a `cm={...}` JSON object on line 2 with full Javadoc:
`comment`, `declare`, `methods[]` (name/modifiers/returnType/paramNames/paramTypes/comment/tags/throwExceptions/annotations), `fields[]`, `interfaces`, `allInterfaces`, `isDeprecated`, `isPlugin`, `isService`.

## Packages

### `kd.sdk.wtc.wtp`

Path prefix: `javadoc/kd/sdk/wtc/wtp/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `SdkWtcWtpModule` | class |  | `kd.sdk.module.Module` | 0 | 0 |  |

### `kd.sdk.wtc.wtp.business.adplan`

Path prefix: `javadoc/kd/sdk/wtc/wtp/business/adplan/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `AdPlanHelper` | class |  |  | 1 | 0 |  |
| `AdPlanRuleQuery` | class |  | `java.io.Serializable` | 5 | 0 | yes |
| `AdPlanRuleResp` | class |  | `java.io.Serializable` | 4 | 0 | yes |

### `kd.sdk.wtc.wtp.business.attfile`

Path prefix: `javadoc/kd/sdk/wtc/wtp/business/attfile/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `AttFileVersion` | class |  | `java.io.Serializable` | 58 | 0 |  |
| `AttMode` | enum |  |  | 2 | 4 | yes |
| `IAttFileDiscardExpandService` | interface |  |  | 1 | 0 |  |
| `WTPAttFileHelper` | class |  |  | 1 | 0 |  |

### `kd.sdk.wtc.wtp.business.attperiod`

Path prefix: `javadoc/kd/sdk/wtc/wtp/business/attperiod/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `PerAttPeriod` | class |  |  | 14 | 0 |  |
| `PerAttPeriodQueryParam` | class |  |  | 7 | 0 | yes |
| `WTPPerAttPeriodHelper` | class |  |  | 2 | 0 |  |

### `kd.sdk.wtc.wtp.business.attperson`

Path prefix: `javadoc/kd/sdk/wtc/wtp/business/attperson/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `AttPerson` | class |  | `java.io.Serializable` | 47 | 0 |  |
| `WTPAttPersonHelper` | class |  |  | 1 | 0 |  |

### `kd.sdk.wtc.wtp.business.coordination`

Path prefix: `javadoc/kd/sdk/wtc/wtp/business/coordination/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `AfterCoordinationEvent` | class |  |  | 5 | 0 | yes |
| `BeforeCoordinationEvent` | class |  |  | 6 | 0 | yes |
| `CoordinationExecuteExtPlugin` | interface |  |  | 3 | 0 |  |
| `CoordinationExpandParam` | class |  |  | 5 | 0 |  |
| `CoordinationExpandService` | interface |  |  | 1 | 0 |  |
| `CoreCoordinationParam` | class |  |  | 6 | 0 | yes |
| `ExecutingCoordinationEvent` | class |  |  | 10 | 0 | yes |

### `kd.sdk.wtc.wtp.business.formula`

Path prefix: `javadoc/kd/sdk/wtc/wtp/business/formula/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `FormulaDataProvideExtPlugin` | interface |  |  | 1 | 0 |  |
| `OnDataProvideEvent` | class |  |  | 5 | 0 | yes |

### `kd.sdk.wtc.wtp.business.quota`

Path prefix: `javadoc/kd/sdk/wtc/wtp/business/quota/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `QuotaQueryParam` | class |  |  | 11 | 0 |  |
| `WTPQuotaHelper` | class |  |  | 1 | 0 |  |

### `kd.sdk.wtc.wtp.business.quota.summary`

Path prefix: `javadoc/kd/sdk/wtc/wtp/business/quota/summary/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `QTSummaryExpService` | interface |  |  | 1 | 0 |  |
| `QTSummaryServiceDefault` | class |  | `kd.sdk.wtc.wtp.business.quota.summary.QTSummaryExpService` | 11 | 0 | yes |

### `kd.sdk.wtc.wtp.business.ruleengine`

Path prefix: `javadoc/kd/sdk/wtc/wtp/business/ruleengine/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `OnGenRuleEngineInputParamEvent` | class |  |  | 18 | 0 | yes |
| `RuleEngineInputParamExtPlugin` | interface |  |  | 1 | 0 |  |

### `kd.sdk.wtc.wtp.business.tripplan`

Path prefix: `javadoc/kd/sdk/wtc/wtp/business/tripplan/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `TripPlanRuleQuery` | class |  | `java.io.Serializable` | 11 | 0 | yes |
