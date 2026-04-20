# kd.sdk.hr.hpfs

**核心人力基础服务** · app=`hpfs` cloud=`hr` isv=`kingdee`

Class HTML path rule: `javadoc/<package-with-slashes>/<ClassName>.html`
Example: package `kd.bos.algo`, class `Algo` → `javadoc/kd/bos/algo/Algo.html`

Each class HTML contains a `cm={...}` JSON object on line 2 with full Javadoc:
`comment`, `declare`, `methods[]` (name/modifiers/returnType/paramNames/paramTypes/comment/tags/throwExceptions/annotations), `fields[]`, `interfaces`, `allInterfaces`, `isDeprecated`, `isPlugin`, `isService`.

## Packages

### `kd.sdk.hr.hpfs`

Path prefix: `javadoc/kd/sdk/hr/hpfs/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `SdkHRHpfsModule` | class |  | `kd.sdk.module.Module` | 0 | 0 |  |

### `kd.sdk.hr.hpfs.business.file`

Path prefix: `javadoc/kd/sdk/hr/hpfs/business/file/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `MultiViewTempService` | class |  |  | 18 | 0 | yes |

### `kd.sdk.hr.hpfs.business.mservice.helper`

Path prefix: `javadoc/kd/sdk/hr/hpfs/business/mservice/helper/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `HPFSPersonChgServiceHelper` | class |  |  | 9 | 0 |  |
| `HPFSPersonFlowServiceHelper` | class |  |  | 1 | 0 |  |

### `kd.sdk.hr.hpfs.business.perchg.bizentity`

Path prefix: `javadoc/kd/sdk/hr/hpfs/business/perchg/bizentity/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `PerChgAttachment` | class |  | `java.io.Serializable` | 24 | 0 |  |
| `PerChgBizInfo` | class |  | `java.io.Serializable` | 76 | 0 | yes |
| `PerChgBizResult` | class |  | `java.io.Serializable` | 29 | 0 |  |

### `kd.sdk.hr.hpfs.business.perchg.executor.enums`

Path prefix: `javadoc/kd/sdk/hr/hpfs/business/perchg/executor/enums/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `ChgFlowTypeEnum` | enum |  |  | 1 | 3 |  |
| `ChgLogEntryStatusEnum` | enum |  |  | 2 | 3 |  |
| `ChgModeEnum` | enum |  |  | 1 | 5 |  |

### `kd.sdk.hr.hpfs.business.perchg.executor.model`

Path prefix: `javadoc/kd/sdk/hr/hpfs/business/perchg/executor/model/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `ChgExternalDataEntryDto` | class | `kd.sdk.hr.hpfs.business.perchg.executor.model.ChgRecordEntryDto` |  | 2 | 0 |  |
| `ChgLogEntryDto` | class |  |  | 13 | 0 |  |
| `ChgRecordEntryDto` | class |  |  | 20 | 0 | yes |

### `kd.sdk.hr.hpfs.formplugin.file`

Path prefix: `javadoc/kd/sdk/hr/hpfs/formplugin/file/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `DynFilePagePlugin` | class | `AbstractFormPlugin` |  | 5 | 0 |  |
| `MultiViewTemplatePlugin` | class | `AbstractFormPlugin` |  | 5 | 0 |  |
