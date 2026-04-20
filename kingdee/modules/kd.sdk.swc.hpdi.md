# kd.sdk.swc.hpdi

**薪资前端集成** · app=`hpdi` cloud=`swc` isv=`kingdee`

Class HTML path rule: `javadoc/<package-with-slashes>/<ClassName>.html`
Example: package `kd.bos.algo`, class `Algo` → `javadoc/kd/bos/algo/Algo.html`

Each class HTML contains a `cm={...}` JSON object on line 2 with full Javadoc:
`comment`, `declare`, `methods[]` (name/modifiers/returnType/paramNames/paramTypes/comment/tags/throwExceptions/annotations), `fields[]`, `interfaces`, `allInterfaces`, `isDeprecated`, `isPlugin`, `isService`.

## Packages

### `kd.sdk.swc.hpdi`

Path prefix: `javadoc/kd/sdk/swc/hpdi/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `SdkHpdiModule` | class |  | `kd.sdk.module.Module` | 0 | 0 |  |

### `kd.sdk.swc.hpdi.business.extpoint.bizdatabill`

Path prefix: `javadoc/kd/sdk/swc/hpdi/business/extpoint/bizdatabill/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `IBizDataBillEntryExtService` | interface |  |  | 2 | 0 |  |

### `kd.sdk.swc.hpdi.business.extpoint.msgreceive`

Path prefix: `javadoc/kd/sdk/swc/hpdi/business/extpoint/msgreceive/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `ICollaReviseMsgExtService` | interface |  |  | 1 | 0 |  |

### `kd.sdk.swc.hpdi.business.mservice.helper`

Path prefix: `javadoc/kd/sdk/swc/hpdi/business/mservice/helper/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `BizDataServiceHelper` | class |  |  | 2 | 0 |  |

### `kd.sdk.swc.hpdi.business.msgreceive`

Path prefix: `javadoc/kd/sdk/swc/hpdi/business/msgreceive/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `ICollaMsgReceiveExtService` | interface |  |  | 2 | 0 |  |

### `kd.sdk.swc.hpdi.common.events.bizdata`

Path prefix: `javadoc/kd/sdk/swc/hpdi/common/events/bizdata/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `BizDataBillEntryImportArgs` | class |  |  | 12 | 0 | yes |
| `BizDataHyperLinkClickArgs` | class |  |  | 4 | 0 | yes |
| `BizDataMatchSalaryFileArgs` | class |  |  | 4 | 0 | yes |
| `BizDataTransSalaryArgs` | class |  |  | 6 | 0 | yes |

### `kd.sdk.swc.hpdi.common.events.bizdatabill`

Path prefix: `javadoc/kd/sdk/swc/hpdi/common/events/bizdatabill/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `AfterAddFieldContainerEvent` | class |  |  | 16 | 0 | yes |

### `kd.sdk.swc.hpdi.common.events.msgreceive`

Path prefix: `javadoc/kd/sdk/swc/hpdi/common/events/msgreceive/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `AfterParseMsgContentEvent` | class |  |  | 5 | 0 |  |
| `AfterReviseMsgEvent` | class |  |  | 5 | 0 | yes |
| `AfterSaveReceiveMsgEvent` | class |  |  | 5 | 0 |  |

### `kd.sdk.swc.hpdi.formplugin.extpoint.bizdata`

Path prefix: `javadoc/kd/sdk/swc/hpdi/formplugin/extpoint/bizdata/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `IBizDataBillEntryImportExtPlugin` | interface |  |  | 3 | 0 |  |
| `IBizDataListExtPlugin` | interface |  |  | 1 | 0 |  |
| `IBizDataMatchSalaryFileExtPlugin` | interface |  |  | 1 | 0 |  |
| `IBizDataTransSalaryExtPlugin` | interface |  |  | 1 | 0 |  |
