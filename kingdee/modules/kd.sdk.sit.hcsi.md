# kd.sdk.sit.hcsi

**中国社保** · app=`hcsi` cloud=`sit` isv=`kingdee`

Class HTML path rule: `javadoc/<package-with-slashes>/<ClassName>.html`
Example: package `kd.bos.algo`, class `Algo` → `javadoc/kd/bos/algo/Algo.html`

Each class HTML contains a `cm={...}` JSON object on line 2 with full Javadoc:
`comment`, `declare`, `methods[]` (name/modifiers/returnType/paramNames/paramTypes/comment/tags/throwExceptions/annotations), `fields[]`, `interfaces`, `allInterfaces`, `isDeprecated`, `isPlugin`, `isService`.

## Packages

### `kd.sdk.sit.hcsi`

Path prefix: `javadoc/kd/sdk/sit/hcsi/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `SdkHcsiModule` | class |  | `kd.sdk.module.Module` | 0 | 0 |  |

### `kd.sdk.sit.hcsi.business.cal`

Path prefix: `javadoc/kd/sdk/sit/hcsi/business/cal/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `IBeforeExportCalPersonExtService` | interface |  |  | 1 | 0 |  |

### `kd.sdk.sit.hcsi.business.extpoint`

Path prefix: `javadoc/kd/sdk/sit/hcsi/business/extpoint/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `IInsuranceDataSynExtService` | interface |  |  | 2 | 0 | yes |
| `ITruncationDealExtService` | interface |  |  | 1 | 0 |  |

### `kd.sdk.sit.hcsi.business.mservice.helper`

Path prefix: `javadoc/kd/sdk/sit/hcsi/business/mservice/helper/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `CalResultServiceHelper` | class |  |  | 4 | 0 |  |

### `kd.sdk.sit.hcsi.common.events.cal`

Path prefix: `javadoc/kd/sdk/sit/hcsi/common/events/cal/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `ItemDataEvent` | class |  | `java.io.Serializable` | 5 | 0 | yes |

### `kd.sdk.sit.hcsi.common.events.insurancedata`

Path prefix: `javadoc/kd/sdk/sit/hcsi/common/events/insurancedata/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `AfterInsuranceDataListEvent` | class |  |  | 7 | 0 | yes |

### `kd.sdk.sit.hcsi.common.events.sinsurfilebase`

Path prefix: `javadoc/kd/sdk/sit/hcsi/common/events/sinsurfilebase/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `SinSurFileBaseAddAttributeEvent` | class |  | `java.io.Serializable` | 9 | 0 |  |
| `SinSurFileBaseAddPageAttributeEvent` | class |  | `java.io.Serializable` | 7 | 0 |  |
| `SinSurFileBaseHisChangeEvent` | class |  | `java.io.Serializable` | 7 | 0 |  |
| `SinSurFileBaseImportAddExcelColumnEvent` | class |  | `java.io.Serializable` | 3 | 0 | yes |

### `kd.sdk.sit.hcsi.formplugin.cal.detail`

Path prefix: `javadoc/kd/sdk/sit/hcsi/formplugin/cal/detail/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `ICalPersonListAutoSumPlugin` | interface |  |  | 1 | 0 |  |
| `ICalPersonListDisplayPlugin` | interface |  |  | 3 | 0 |  |

### `kd.sdk.sit.hcsi.formplugin.sinsurfilebase`

Path prefix: `javadoc/kd/sdk/sit/hcsi/formplugin/sinsurfilebase/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `ISinSurFileBaseAddAttributePlugin` | interface |  |  | 1 | 0 |  |
| `ISinSurFileBaseImportAddExcelColumnPlugin` | interface |  |  | 1 | 0 |  |

### `kd.sdk.sit.hcsi.oppplugin.sinsurfile`

Path prefix: `javadoc/kd/sdk/sit/hcsi/oppplugin/sinsurfile/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `ISinSurFileBsedValidatorPlugin` | interface |  |  | 1 | 0 |  |

### `kd.sdk.sit.hcsi.oppplugin.sinsurfilebase`

Path prefix: `javadoc/kd/sdk/sit/hcsi/oppplugin/sinsurfilebase/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `ISinSurFileBaseAddAttributeService` | interface |  |  | 1 | 0 |  |
| `ISinSurFileBaseHisChangeService` | interface |  |  | 1 | 0 |  |

### `kd.sdk.sit.hcsi.service.sinsurfile`

Path prefix: `javadoc/kd/sdk/sit/hcsi/service/sinsurfile/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `SinSurFileHelper` | class |  |  | 2 | 0 |  |

### `kd.sdk.sit.hcsi.service.sinsurfilebase`

Path prefix: `javadoc/kd/sdk/sit/hcsi/service/sinsurfilebase/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `ISinSurFileBaseImportAddAttributeService` | interface |  |  | 1 | 0 |  |
| `SinSurFileBaseHelper` | class |  |  | 4 | 0 |  |
