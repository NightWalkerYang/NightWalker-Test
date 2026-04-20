# kd.sdk.scm.srm

**供应商管理** · app=`srm` cloud=`scm` isv=`kingdee`

Class HTML path rule: `javadoc/<package-with-slashes>/<ClassName>.html`
Example: package `kd.bos.algo`, class `Algo` → `javadoc/kd/bos/algo/Algo.html`

Each class HTML contains a `cm={...}` JSON object on line 2 with full Javadoc:
`comment`, `declare`, `methods[]` (name/modifiers/returnType/paramNames/paramTypes/comment/tags/throwExceptions/annotations), `fields[]`, `interfaces`, `allInterfaces`, `isDeprecated`, `isPlugin`, `isService`.

## Packages

### `kd.sdk.scm.srm`

Path prefix: `javadoc/kd/sdk/scm/srm/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `SdkScmSrmModule` | class |  | `kd.sdk.module.Module` | 0 | 0 |  |

### `kd.sdk.scm.srm.extpoint`

Path prefix: `javadoc/kd/sdk/scm/srm/extpoint/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `IMainPage1NoticeService` | interface |  |  | 7 | 0 |  |
| `ISrmAccessNodeService` | interface |  |  | 5 | 0 |  |
| `ISrmAllScorerScoredService` | interface |  |  | 1 | 0 |  |
| `ISrmAssignUserRoleService` | interface |  |  | 2 | 0 |  |
| `ISrmAutoCalGroupOrgService` | interface |  |  | 2 | 0 |  |
| `ISrmAutoCalPluginService` | interface |  |  | 1 | 0 |  |
| `ISrmCalEvaGradeService` | interface |  |  | 1 | 0 |  |
| `ISrmEvaplanWritebackScoredService` | interface |  |  | 1 | 0 |  |
| `ISrmRegisterSendMessageService` | interface |  |  | 1 | 0 |  |
| `ISrmSupChgInfoEffect` | interface |  |  | 1 | 0 |  |
| `ISrmSupChgPurUserAdminModifyService` | interface |  |  | 2 | 0 |  |
| `ISrmSynBdSupplierService` | interface |  |  | 1 | 0 |  |
| `ISupplierRegSetDefValueService` | interface |  |  | 1 | 0 |  |

### `kd.sdk.scm.srm.extpoint.dto`

Path prefix: `javadoc/kd/sdk/scm/srm/extpoint/dto/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `SrmAutoScoreReq` | class |  | `java.io.Serializable` | 13 | 0 |  |
| `SrmAutoScoreResp` | class |  | `java.io.Serializable` | 17 | 1 | yes |

### `kd.sdk.scm.srm.extpoint.dto.indicator`

Path prefix: `javadoc/kd/sdk/scm/srm/extpoint/dto/indicator/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `SrmPortraitContext` | class |  | `java.io.Serializable` | 17 | 0 | yes |
| `SrmPortraitStatisticInfo` | class |  |  | 25 | 0 | yes |

### `kd.sdk.scm.srm.extpoint.portait`

Path prefix: `javadoc/kd/sdk/scm/srm/extpoint/portait/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `AbstractSrmPortraitDataSetStatistic` | class |  | `kd.sdk.scm.srm.extpoint.portait.ISrmPortraitStatistic` | 11 | 0 | yes |
