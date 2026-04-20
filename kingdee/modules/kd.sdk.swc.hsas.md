# kd.sdk.swc.hsas

**薪资核算** · app=`hsas` cloud=`swc` isv=`kingdee`

Class HTML path rule: `javadoc/<package-with-slashes>/<ClassName>.html`
Example: package `kd.bos.algo`, class `Algo` → `javadoc/kd/bos/algo/Algo.html`

Each class HTML contains a `cm={...}` JSON object on line 2 with full Javadoc:
`comment`, `declare`, `methods[]` (name/modifiers/returnType/paramNames/paramTypes/comment/tags/throwExceptions/annotations), `fields[]`, `interfaces`, `allInterfaces`, `isDeprecated`, `isPlugin`, `isService`.

## Packages

### `kd.sdk.swc.hsas`

Path prefix: `javadoc/kd/sdk/swc/hsas/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `SdkHsasModule` | class |  | `kd.sdk.module.Module` | 0 | 0 |  |

### `kd.sdk.swc.hsas.business.extpoint.approve`

Path prefix: `javadoc/kd/sdk/swc/hsas/business/extpoint/approve/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `IApproveBillExtService` | interface |  |  | 1 | 0 |  |

### `kd.sdk.swc.hsas.business.extpoint.attinteg`

Path prefix: `javadoc/kd/sdk/swc/hsas/business/extpoint/attinteg/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `IAttIntegrateExtPlugin` | interface |  |  | 1 | 0 |  |

### `kd.sdk.swc.hsas.business.extpoint.bizdata`

Path prefix: `javadoc/kd/sdk/swc/hsas/business/extpoint/bizdata/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `IBizDataSynExtService` | interface |  |  | 1 | 0 |  |

### `kd.sdk.swc.hsas.business.extpoint.insurancedata`

Path prefix: `javadoc/kd/sdk/swc/hsas/business/extpoint/insurancedata/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `ISaveInsuranceDataSynExtService` | interface |  |  | 1 | 0 | yes |

### `kd.sdk.swc.hsas.business.extpoint.paydetail`

Path prefix: `javadoc/kd/sdk/swc/hsas/business/extpoint/paydetail/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `IBankAccountService` | interface |  |  | 1 | 0 |  |
| `IBankOfferExtService` | interface |  |  | 1 | 0 |  |

### `kd.sdk.swc.hsas.business.extpoint.person`

Path prefix: `javadoc/kd/sdk/swc/hsas/business/extpoint/person/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `IPersonExtService` | interface |  |  | 1 | 0 |  |
| `ISyncPersonExtService` | interface |  |  | 2 | 0 |  |

### `kd.sdk.swc.hsas.business.extpoint.salaryfile`

Path prefix: `javadoc/kd/sdk/swc/hsas/business/extpoint/salaryfile/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `ISalaryFileExportExtService` | interface |  |  | 3 | 0 |  |
| `ISalaryFileImportExtService` | interface |  |  | 3 | 0 |  |

### `kd.sdk.swc.hsas.business.mservice.helper`

Path prefix: `javadoc/kd/sdk/swc/hsas/business/mservice/helper/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `CalPayrollTaskServiceHelper` | class |  |  | 3 | 0 |  |
| `OnHoldServiceHelper` | class |  |  | 2 | 0 |  |
| `PayDetailServiceHelper` | class |  |  | 1 | 0 |  |
| `PaySettingServiceHelper` | class |  |  | 1 | 0 |  |
| `PersonServiceHelper` | class |  |  | 1 | 0 |  |
| `SalaryCalculationServiceHelper` | class |  |  | 1 | 0 |  |
| `SalaryFileServiceHelper` | class |  |  | 3 | 0 |  |

### `kd.sdk.swc.hsas.common.entity`

Path prefix: `javadoc/kd/sdk/swc/hsas/common/entity/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `ItemTreeNode` | class |  | `java.io.Serializable` | 9 | 0 | yes |

### `kd.sdk.swc.hsas.common.events.approve`

Path prefix: `javadoc/kd/sdk/swc/hsas/common/events/approve/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `ApproveInvokeReportFormEvent` | class |  | `java.io.Serializable` | 11 | 0 | yes |
| `ApproveOverViewDealEvent` | class |  | `java.io.Serializable` | 9 | 0 | yes |

### `kd.sdk.swc.hsas.common.events.bizdata`

Path prefix: `javadoc/kd/sdk/swc/hsas/common/events/bizdata/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `AfterBizDataListEvent` | class |  |  | 5 | 0 | yes |

### `kd.sdk.swc.hsas.common.events.formula`

Path prefix: `javadoc/kd/sdk/swc/hsas/common/events/formula/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `BeforeBuildItemTreeEvent` | class |  |  | 2 | 0 | yes |

### `kd.sdk.swc.hsas.common.events.insurancedata`

Path prefix: `javadoc/kd/sdk/swc/hsas/common/events/insurancedata/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `BeforeSaveInsuranceDataListEvent` | class |  |  | 5 | 0 | yes |

### `kd.sdk.swc.hsas.common.events.salarydetailresultexport`

Path prefix: `javadoc/kd/sdk/swc/hsas/common/events/salarydetailresultexport/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `AfterBuildHeadEvent` | class |  |  | 12 | 0 | yes |

### `kd.sdk.swc.hsas.common.events.salaryfile`

Path prefix: `javadoc/kd/sdk/swc/hsas/common/events/salaryfile/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `AfterEmbedChildPageEvent` | class |  |  | 9 | 0 | yes |
| `InitEmbedChildPageEvent` | class |  |  | 9 | 0 | yes |
| `SalaryFileExportEvent` | class |  |  | 3 | 0 | yes |
| `SalaryFileImportEvent` | class |  |  | 3 | 0 | yes |

### `kd.sdk.swc.hsas.formplugin.calperson`

Path prefix: `javadoc/kd/sdk/swc/hsas/formplugin/calperson/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `ICalPersonListAutoSumPlugin` | interface |  |  | 2 | 0 | yes |

### `kd.sdk.swc.hsas.formplugin.extpoint.approve`

Path prefix: `javadoc/kd/sdk/swc/hsas/formplugin/extpoint/approve/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `IApproveInvokeReportFormExtService` | interface |  |  | 3 | 0 |  |
| `IApproveOverViewDealExtService` | interface |  |  | 1 | 0 |  |
| `IApproveSpecialRuleVerifyExtPlugin` | interface |  |  | 1 | 0 |  |
| `ICreateApproveBillExtService` | interface |  |  | 2 | 0 |  |

### `kd.sdk.swc.hsas.formplugin.extpoint.formula`

Path prefix: `javadoc/kd/sdk/swc/hsas/formplugin/extpoint/formula/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `IFormulaItemTreeExtPlugin` | interface |  |  | 1 | 0 |  |

### `kd.sdk.swc.hsas.formplugin.extpoint.paydetail`

Path prefix: `javadoc/kd/sdk/swc/hsas/formplugin/extpoint/paydetail/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `IBankOfferExtPlugin` | interface |  |  | 1 | 0 |  |

### `kd.sdk.swc.hsas.formplugin.extpoint.salarydetailresult`

Path prefix: `javadoc/kd/sdk/swc/hsas/formplugin/extpoint/salarydetailresult/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `ISalaryDetailResultExportExtPlugin` | interface |  |  | 1 | 0 |  |

### `kd.sdk.swc.hsas.formplugin.extpoint.salaryfile`

Path prefix: `javadoc/kd/sdk/swc/hsas/formplugin/extpoint/salaryfile/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `ISalaryFileEditExtPlugin` | interface |  |  | 2 | 0 |  |

### `kd.sdk.swc.hsas.formplugin.extpoint.salaryrpt`

Path prefix: `javadoc/kd/sdk/swc/hsas/formplugin/extpoint/salaryrpt/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `ISalaryDisplaySchemeExtPlugin` | interface |  |  | 1 | 0 |  |

### `kd.sdk.swc.hsas.service.spi`

Path prefix: `javadoc/kd/sdk/swc/hsas/service/spi/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `CalPersonListService` | interface |  |  | 2 | 0 |  |
| `CalResultQueryService` | interface |  |  | 13 | 0 |  |
