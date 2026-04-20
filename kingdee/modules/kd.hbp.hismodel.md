# kd.hbp.hismodel

**HR历史模型** · app=`hbp` cloud=`hrmp` isv=`kingdee`

Class HTML path rule: `javadoc/<package-with-slashes>/<ClassName>.html`
Example: package `kd.bos.algo`, class `Algo` → `javadoc/kd/bos/algo/Algo.html`

Each class HTML contains a `cm={...}` JSON object on line 2 with full Javadoc:
`comment`, `declare`, `methods[]` (name/modifiers/returnType/paramNames/paramTypes/comment/tags/throwExceptions/annotations), `fields[]`, `interfaces`, `allInterfaces`, `isDeprecated`, `isPlugin`, `isService`.

## Packages

### `kd.hr.hbp.business.application.impl.common`

Path prefix: `javadoc/kd/hr/hbp/business/application/impl/common/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `AbstractSortingArrayService` | class |  | `kd.hr.hbp.business.application.common.ISortingArrayService` | 2 | 0 |  |
| `CompareDiffController` | class |  | `kd.hr.hbp.business.application.common.ICompareDiffController` | 2 | 0 |  |
| `DynamicObjectCommonService` | class |  | `kd.hr.hbp.business.application.common.IDynamicObjectCommonService` | 8 | 0 |  |

### `kd.hr.hbp.business.application.impl.newhismodel`

Path prefix: `javadoc/kd/hr/hbp/business/application/impl/newhismodel/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `HRHisModelModule` | class |  | `kd.sdk.module.Module` | 0 | 0 |  |
| `HisModelAttachController` | class |  | `kd.hr.hbp.business.application.newhismodel.IHisModelAttachController` | 3 | 0 |  |
| `HisModelController` | class |  | `kd.hr.hbp.business.application.newhismodel.IHisModelController` | 17 | 0 |  |
| `HisModelInitController` | class |  | `kd.hr.hbp.business.application.newhismodel.IHisModelInitController` | 6 | 0 |  |

### `kd.hr.hbp.business.domain.model.newhismodel`

Path prefix: `javadoc/kd/hr/hbp/business/domain/model/newhismodel/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `BatchVersionChangeRespData` | class |  |  | 4 | 0 |  |
| `HisBaseBo` | class |  |  | 6 | 0 |  |
| `HisImportBo` | class |  |  | 4 | 0 |  |
| `HisInitReturnBo` | class |  |  | 6 | 0 |  |
| `HisResponse` | class |  |  | 6 | 0 |  |
| `HisTransRevocationBo` | class |  |  | 6 | 0 |  |
| `HisTransRevocationListBo` | class |  |  | 10 | 0 |  |
| `HisVersionParamBo` | class |  |  | 28 | 0 |  |
| `HisVersionParamListBo` | class |  |  | 12 | 0 |  |
| `HisVersionReviseParamBo` | class |  |  | 10 | 0 |  |
| `HisVersionReviseReturnDataBo` | class |  |  | 6 | 0 |  |
| `ImportRespData` | class | `kd.hr.hbp.business.domain.model.newhismodel.VersionChangeRespData` |  | 4 | 0 |  |
| `VersionChangeRespData` | class |  |  | 6 | 0 |  |

### `kd.hr.hbp.business.domain.model.newhismodel.api`

Path prefix: `javadoc/kd/hr/hbp/business/domain/model/newhismodel/api/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `HisBatchDiscardApiBo` | class |  |  | 4 | 0 |  |
| `HisDiscardApiBo` | class |  |  | 6 | 0 |  |

### `kd.hr.hbp.business.domain.model.newhismodel.api.attachment`

Path prefix: `javadoc/kd/hr/hbp/business/domain/model/newhismodel/api/attachment/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `HisAttachmentDataBo` | class |  |  | 4 | 0 | yes |
| `HisAttachmentParamBo` | class |  |  | 4 | 0 | yes |

### `kd.hr.hbp.business.domain.model.newhismodel.api.comparediff`

Path prefix: `javadoc/kd/hr/hbp/business/domain/model/newhismodel/api/comparediff/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `CompareDiffApiBatchInputParam` | class |  |  | 2 | 0 |  |
| `CompareDiffApiInputParam` | class |  |  | 10 | 0 |  |
| `CompareDiffApiOutPutParam` | class |  |  | 6 | 0 |  |

### `kd.hr.hbp.business.domain.model.newhismodel.enable`

Path prefix: `javadoc/kd/hr/hbp/business/domain/model/newhismodel/enable/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `HisEnableParamBo` | class |  |  | 12 | 0 |  |
