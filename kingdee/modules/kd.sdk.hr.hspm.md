# kd.sdk.hr.hspm

**人员信息** · app=`hspm` cloud=`hr` isv=`kingdee`

Class HTML path rule: `javadoc/<package-with-slashes>/<ClassName>.html`
Example: package `kd.bos.algo`, class `Algo` → `javadoc/kd/bos/algo/Algo.html`

Each class HTML contains a `cm={...}` JSON object on line 2 with full Javadoc:
`comment`, `declare`, `methods[]` (name/modifiers/returnType/paramNames/paramTypes/comment/tags/throwExceptions/annotations), `fields[]`, `interfaces`, `allInterfaces`, `isDeprecated`, `isPlugin`, `isService`.

## Packages

### `kd.sdk.hr.hspm`

Path prefix: `javadoc/kd/sdk/hr/hspm/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `SdkHRHspmModule` | class |  | `kd.sdk.module.Module` | 0 | 0 |  |

### `kd.sdk.hr.hspm.business.helper`

Path prefix: `javadoc/kd/sdk/hr/hspm/business/helper/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `ApprovalHelper` | class |  |  | 27 | 3 | yes |
| `BasedataHelper` | class |  |  | 5 | 0 |  |
| `CommonQFilterHelper` | class |  |  | 8 | 0 |  |
| `HSPMBusinessDataServiceHelper` | class |  |  | 3 | 0 | yes |
| `HpfsChgexternalrecordQueueHelper` | class |  |  | 14 | 0 |  |
| `InfoGroupHelper` | class |  |  | 22 | 0 |  |

### `kd.sdk.hr.hspm.business.mservice.helper`

Path prefix: `javadoc/kd/sdk/hr/hspm/business/mservice/helper/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `HSPMServiceHelper` | class |  |  | 12 | 0 |  |

### `kd.sdk.hr.hspm.business.repository`

Path prefix: `javadoc/kd/sdk/hr/hspm/business/repository/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `ErmanFileRepository` | class |  |  | 22 | 1 | yes |

### `kd.sdk.hr.hspm.business.service`

Path prefix: `javadoc/kd/sdk/hr/hspm/business/service/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `AttacheHandlerService` | class |  |  | 47 | 0 | yes |
| `ErManFileQfilter` | class |  |  | 5 | 0 |  |
| `MultiViewTemplateService` | class |  |  | 6 | 0 | yes |
| `PageRegConfigService` | class |  |  | 4 | 0 | yes |

### `kd.sdk.hr.hspm.common.constants`

Path prefix: `javadoc/kd/sdk/hr/hspm/common/constants/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `ApprovalConstants` | interface |  |  | 0 | 28 |  |
| `AttachConstants` | interface |  |  | 0 | 173 | yes |
| `DynConfigConstants` | interface |  |  | 0 | 63 | yes |
| `HSPMFieldConstants` | interface |  |  | 0 | 113 | yes |
| `HspmCommonConstants` | interface |  |  | 0 | 328 | yes |
| `ImportTypeConstant` | interface |  |  | 0 | 10 |  |
| `InfoClassifyCommonConstant` | interface |  |  | 0 | 52 |  |
| `MobileDrawConstants` | interface |  |  | 0 | 36 | yes |
| `MultiViewConfigConstants` | interface |  |  | 0 | 99 |  |
| `MyErManFileConstants` | interface |  |  | 0 | 2 |  |
| `ReportDisplayPageConstants` | interface |  |  | 0 | 12 |  |
| `ScheduleDrawConstants` | interface |  |  | 0 | 4 |  |

### `kd.sdk.hr.hspm.common.dto`

Path prefix: `javadoc/kd/sdk/hr/hspm/common/dto/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `ChangeDto` | class |  |  | 13 | 0 | yes |
| `DrawFormFieldDto` | class |  | `java.lang.Cloneable` | 49 | 0 | yes |
| `HpfsChgexternalrecordQueueDto` | class |  | `java.io.Serializable` | 13 | 0 | yes |
| `PereduexpcertDynDto` | class |  |  | 4 | 0 | yes |
| `PersonModelDto` | class |  |  | 6 | 0 | yes |

### `kd.sdk.hr.hspm.common.entity`

Path prefix: `javadoc/kd/sdk/hr/hspm/common/entity/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `InfoclassifyPercreField` | class | `kd.sdk.hr.hspm.common.entity.PercreField` |  | 1 | 0 | yes |
| `PercreField` | class |  |  | 7 | 0 | yes |

### `kd.sdk.hr.hspm.common.enums`

Path prefix: `javadoc/kd/sdk/hr/hspm/common/enums/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `BaseRefEnum` | enum |  |  | 9 | 1 | yes |
| `BusinessTypeEnum` | enum |  |  | 2 | 3 | yes |
| `ClientTypeEnum` | enum |  |  | 1 | 3 | yes |
| `ConfigAreaEnum` | enum |  |  | 2 | 3 | yes |
| `FieldTypeEnum` | enum |  |  | 9 | 33 | yes |
| `InfoClassifyEntityKeyEnum` | enum |  |  | 10 | 19 | yes |
| `InfoClassifyFormOperateEnum` | enum |  |  | 5 | 13 | yes |
| `InfoClassifyImportOperateEnum` | enum |  |  | 6 | 19 | yes |
| `InfoClassifyListOperateEnum` | enum |  |  | 5 | 11 | yes |
| `InfoGroupFieldCategroyEnum` | enum |  |  | 3 | 3 | yes |
| `PereduexpcerttypeFieldEnum` | enum |  |  | 4 | 6 | yes |
| `PereduexpinfoFieldEnum` | enum |  |  | 3 | 2 | yes |
| `PersonModelClassificationEnum` | enum |  |  | 6 | 5 | yes |
| `PersoninfoFieldEnum` | enum |  |  | 3 | 6 | yes |
| `ReportTypeEnum` | enum |  |  | 5 | 4 |  |

### `kd.sdk.hr.hspm.common.ext.file`

Path prefix: `javadoc/kd/sdk/hr/hspm/common/ext/file/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `CardBindDataDTO` | class |  |  | 30 | 0 | yes |
| `DialogBindDataDTO` | class |  |  | 25 | 0 | yes |
| `EmpReportExtCalculateDTO` | class |  |  | 7 | 0 | yes |
| `EmpReportExtColumnDTO` | class |  |  | 7 | 0 | yes |
| `EmpReportExtQueryFieldsDTO` | class |  |  | 4 | 0 | yes |
| `EmpReportExtQueryFilterDTO` | class |  |  | 5 | 0 | yes |
| `EmpReportExtReletionFilterDTO` | class |  |  | 5 | 0 | yes |
| `EmpSupRelDTO` | class |  |  | 5 | 0 | yes |
| `MobileHomeVectorDTO` | class |  |  | 10 | 0 | yes |
| `QuitEmpReportExtCalculateDTO` | class | `kd.sdk.hr.hspm.common.ext.file.EmpReportExtCalculateDTO` |  | 2 | 0 | yes |
| `QuitEmpReportExtColumnDTO` | class | `kd.sdk.hr.hspm.common.ext.file.EmpReportExtColumnDTO` |  | 2 | 0 | yes |
| `QuitEmpReportExtHisQueryDateDTO` | class |  |  | 4 | 0 | yes |
| `QuitEmpReportExtQueryFieldsDTO` | class | `kd.sdk.hr.hspm.common.ext.file.EmpReportExtQueryFieldsDTO` |  | 2 | 0 | yes |
| `QuitEmpReportExtQueryFilterDTO` | class | `kd.sdk.hr.hspm.common.ext.file.EmpReportExtQueryFilterDTO` |  | 2 | 0 | yes |
| `QuitEmpReportExtReletionFilterDTO` | class | `kd.sdk.hr.hspm.common.ext.file.EmpReportExtReletionFilterDTO` |  | 2 | 0 | yes |
| `SideBarDataDTO` | class |  |  | 7 | 0 | yes |

### `kd.sdk.hr.hspm.common.model`

Path prefix: `javadoc/kd/sdk/hr/hspm/common/model/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `FileRelationModel` | class |  |  | 6 | 0 | yes |

### `kd.sdk.hr.hspm.common.result`

Path prefix: `javadoc/kd/sdk/hr/hspm/common/result/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `HisResponseParse` | class |  |  | 5 | 0 | yes |
| `HrpiServiceOperateResult` | class |  |  | 28 | 0 | yes |
| `PerChgSend` | class |  |  | 1 | 1 |  |

### `kd.sdk.hr.hspm.common.utils`

Path prefix: `javadoc/kd/sdk/hr/hspm/common/utils/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `ApprovalEntityUtils` | class |  |  | 2 | 0 |  |
| `BusinessUtils` | class |  |  | 52 | 0 | yes |
| `ComboItemUtil` | class |  |  | 3 | 0 |  |
| `CommonUtil` | class |  |  | 23 | 0 |  |
| `DynamicPropUtil` | class |  |  | 5 | 0 |  |
| `DynamicPropValidateUtil` | class |  |  | 5 | 0 |  |
| `DynamicTransformUtil` | class |  |  | 4 | 0 |  |
| `HrpiServiceOperateParam` | class |  |  | 4 | 0 |  |
| `HspmDateUtils` | class | `HRDateTimeUtils` |  | 6 | 0 |  |
| `IDCardUtils` | class |  |  | 3 | 0 |  |
| `InfoClassifyOpenWindowUtil` | class |  |  | 3 | 0 |  |
| `InfoClassifyPercreFieldUtil` | class |  |  | 2 | 3 |  |
| `InfoGroupApprovalUtil` | class |  |  | 4 | 0 |  |
| `PageCacheUtils` | class |  |  | 4 | 0 |  |
| `ParamAnalysisUtil` | class |  |  | 13 | 0 | yes |
| `PermUtil` | class |  |  | 3 | 0 |  |
| `PersonModelUtil` | class |  |  | 4 | 0 |  |
| `PropertyHelper` | class |  |  | 6 | 0 |  |

### `kd.sdk.hr.hspm.common.vo`

Path prefix: `javadoc/kd/sdk/hr/hspm/common/vo/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `AfterCreatVo` | class |  |  | 16 | 0 | yes |
| `BeforeCreatVo` | class |  |  | 15 | 0 | yes |
| `CardViewCompareVo` | class |  |  | 14 | 0 | yes |
| `CardViewVo` | class |  |  | 12 | 0 | yes |
| `ContentApVo` | class |  |  | 17 | 0 | yes |
| `DefineSpecialVo` | class |  |  | 19 | 0 | yes |
| `FieldTransVo` | class |  |  | 6 | 0 | yes |
| `PreBindDataVo` | class |  |  | 8 | 0 | yes |
| `QueryDbVo` | class |  |  | 14 | 0 | yes |
| `TextColorVo` | class |  |  | 12 | 0 | yes |
| `TimeApVo` | class |  |  | 11 | 0 | yes |

### `kd.sdk.hr.hspm.formplugin.web.file.ermanfile.base`

Path prefix: `javadoc/kd/sdk/hr/hspm/formplugin/web/file/ermanfile/base/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `AbstractCardDrawEdit` | class | `AbstractFormPlugin` | `kd.sdk.hr.hspm.common.constants.AttachConstants` | 53 | 0 | yes |
| `AbstractEntryEntityDrawEdit` | class | `HRDataBaseEdit` |  | 4 | 1 | yes |
| `AbstractFormDrawEdit` | class | `HRDataBaseEdit` | `kd.sdk.hr.hspm.common.constants.DynConfigConstants`, `kd.sdk.hr.hspm.common.constants.ScheduleDrawConstants` | 77 | 3 | yes |
| `CommonSingleFormDrawEdit` | class | `kd.sdk.hr.hspm.formplugin.web.file.ermanfile.base.AbstractFormDrawEdit` |  | 4 | 0 |  |

### `kd.sdk.hr.hspm.formplugin.web.file.ermanfile.drawutil`

Path prefix: `javadoc/kd/sdk/hr/hspm/formplugin/web/file/ermanfile/drawutil/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `ApControlService` | class |  |  | 2 | 0 |  |
| `ApCreateUtils` | class |  |  | 8 | 1 | yes |
| `CustomDrawUtils` | class |  |  | 4 | 0 |  |
| `DynamicPanelUtils` | class |  |  | 2 | 0 |  |
| `FieldContainerViewService` | class |  |  | 8 | 4 | yes |
| `TemplateEditUtils` | class |  |  | 27 | 1 | yes |

### `kd.sdk.hr.hspm.formplugin.web.file.ermanfile.ext.template`

Path prefix: `javadoc/kd/sdk/hr/hspm/formplugin/web/file/ermanfile/ext/template/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `ManagePCFullFormDrawEdit` | class | `kd.sdk.hr.hspm.formplugin.web.file.ermanfile.base.AbstractFormDrawEdit` |  | 5 | 0 |  |
