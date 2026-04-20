# kd.hbp.odc

**组织发展** · app=`hbp` cloud=`hrmp` isv=`kingdee`

Class HTML path rule: `javadoc/<package-with-slashes>/<ClassName>.html`
Example: package `kd.bos.algo`, class `Algo` → `javadoc/kd/bos/algo/Algo.html`

Each class HTML contains a `cm={...}` JSON object on line 2 with full Javadoc:
`comment`, `declare`, `methods[]` (name/modifiers/returnType/paramNames/paramTypes/comment/tags/throwExceptions/annotations), `fields[]`, `interfaces`, `allInterfaces`, `isDeprecated`, `isPlugin`, `isService`.

## Packages

### `kd.hr.hbp.business.openservicehelper.odc`

Path prefix: `javadoc/kd/hr/hbp/business/openservicehelper/odc/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `AdminOrgServiceHelper` | class |  |  | 10 | 0 |  |
| `HROdcModule` | class |  | `kd.sdk.module.Module` | 0 | 0 |  |
| `PositionServiceHelper` | class |  |  | 4 | 0 |  |

### `kd.sdk.hr.hrmp.haos.extpoint`

Path prefix: `javadoc/kd/sdk/hr/hrmp/haos/extpoint/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `HROdcModule` | class |  | `kd.sdk.module.Module` | 0 | 0 |  |
| `IStaffRuleConfigExtend` | interface |  |  | 1 | 0 |  |

### `kd.sdk.hr.hrmp.hbjm.extpoint`

Path prefix: `javadoc/kd/sdk/hr/hrmp/hbjm/extpoint/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `HROdcModule` | class |  | `kd.sdk.module.Module` | 0 | 0 |  |
| `IJobTreeSortConditionExtend` | interface |  |  | 1 | 0 |  |

### `kd.sdk.hr.hrmp.hbpm.extpoint`

Path prefix: `javadoc/kd/sdk/hr/hrmp/hbpm/extpoint/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `HROdcModule` | class |  | `kd.sdk.module.Module` | 0 | 0 |  |
| `IPositionCompareEntryServiceExtend` | interface |  |  | 1 | 0 |  |
| `IPositionF7OrgTreeOrgIdsServiceExtend` | interface |  |  | 1 | 0 |  |
| `IPositionSkipValidateServiceExtend` | interface |  |  | 1 | 0 |  |
| `IValidatorExtend` | interface |  |  | 1 | 0 | yes |
