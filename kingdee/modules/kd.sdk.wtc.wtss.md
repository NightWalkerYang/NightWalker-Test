# kd.sdk.wtc.wtss

**假勤自助服务** · app=`wtss` cloud=`wtc` isv=`kingdee`

Class HTML path rule: `javadoc/<package-with-slashes>/<ClassName>.html`
Example: package `kd.bos.algo`, class `Algo` → `javadoc/kd/bos/algo/Algo.html`

Each class HTML contains a `cm={...}` JSON object on line 2 with full Javadoc:
`comment`, `declare`, `methods[]` (name/modifiers/returnType/paramNames/paramTypes/comment/tags/throwExceptions/annotations), `fields[]`, `interfaces`, `allInterfaces`, `isDeprecated`, `isPlugin`, `isService`.

## Packages

### `kd.sdk.wtc.wtss`

Path prefix: `javadoc/kd/sdk/wtc/wtss/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `SdkWtcWtssModule` | class |  | `kd.sdk.module.Module` | 0 | 0 |  |

### `kd.sdk.wtc.wtss.business.homepage`

Path prefix: `javadoc/kd/sdk/wtc/wtss/business/homepage/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `BeforeChooseApplyTypeEvent` | class |  |  | 4 | 0 | yes |
| `BeforeShowApplyPageEvent` | class |  |  | 4 | 0 |  |
| `BeforeShowDetailPageEvent` | class | `kd.sdk.wtc.wtss.business.homepage.BeforeShowApplyPageEvent` |  | 1 | 0 |  |
| `BillReplaceExtPlugin` | interface |  |  | 5 | 0 |  |
| `ISignAddressReplacePlugin` | interface |  |  | 1 | 0 |  |
| `MobileBillListDto` | class |  |  | 22 | 0 | yes |
| `OnFilterMobileBillListEvent` | class |  |  | 2 | 0 |  |
| `OnQueryMobileBillListEvent` | class |  |  | 15 | 0 | yes |
| `SignAddressChooseEvent` | class |  |  | 2 | 0 | yes |
| `WtssHomepageServiceHelper` | class |  |  | 1 | 0 |  |

### `kd.sdk.wtc.wtss.business.spi.homepage`

Path prefix: `javadoc/kd/sdk/wtc/wtss/business/spi/homepage/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `WtssHomepageService` | interface |  |  | 2 | 0 |  |

### `kd.sdk.wtc.wtss.business.teamhome`

Path prefix: `javadoc/kd/sdk/wtc/wtss/business/teamhome/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `AttStatisticTargetQueryParam` | class |  |  | 15 | 0 |  |
| `AttTargetQueryExpandService` | interface |  |  | 3 | 0 |  |
