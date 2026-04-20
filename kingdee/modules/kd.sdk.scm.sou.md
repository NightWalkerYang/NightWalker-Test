# kd.sdk.scm.sou

**询价与竞价** · app=`sou` cloud=`scm` isv=`kingdee`

Class HTML path rule: `javadoc/<package-with-slashes>/<ClassName>.html`
Example: package `kd.bos.algo`, class `Algo` → `javadoc/kd/bos/algo/Algo.html`

Each class HTML contains a `cm={...}` JSON object on line 2 with full Javadoc:
`comment`, `declare`, `methods[]` (name/modifiers/returnType/paramNames/paramTypes/comment/tags/throwExceptions/annotations), `fields[]`, `interfaces`, `allInterfaces`, `isDeprecated`, `isPlugin`, `isService`.

## Packages

### `kd.sdk.scm.sou`

Path prefix: `javadoc/kd/sdk/scm/sou/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `SdkScmSouModule` | class |  | `kd.sdk.module.Module` | 0 | 0 |  |

### `kd.sdk.scm.sou.entity`

Path prefix: `javadoc/kd/sdk/scm/sou/entity/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `AdoptionRule` | class |  |  | 13 | 0 |  |
| `SouCompareAssiRecentPriceArgs` | class |  |  | 11 | 0 | yes |
| `SouCompareAssistantDoingArgs` | class |  |  | 14 | 0 |  |

### `kd.sdk.scm.sou.extpoint`

Path prefix: `javadoc/kd/sdk/scm/sou/extpoint/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `ISouBidBillToEasXKOrder` | interface |  |  | 2 | 0 |  |
| `ISouCompareAssistantDataSource` | interface |  |  | 1 | 0 |  |
| `ISouCompareAssistantRecentPriceSource` | interface |  |  | 1 | 0 |  |
| `ISouComparePushNoticeVerify` | interface |  |  | 1 | 0 |  |
| `ISouCompareToEasXKOrder` | interface |  |  | 2 | 0 |  |
| `ISouCompareToolAdopt` | interface |  |  | 1 | 0 |  |
| `ISouCompareToolSupColumn` | interface |  |  | 2 | 0 |  |
