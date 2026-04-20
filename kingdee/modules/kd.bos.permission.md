# kd.bos.permission

**权限** · app=`sys` cloud=`bos` isv=`kingdee`

Class HTML path rule: `javadoc/<package-with-slashes>/<ClassName>.html`
Example: package `kd.bos.algo`, class `Algo` → `javadoc/kd/bos/algo/Algo.html`

Each class HTML contains a `cm={...}` JSON object on line 2 with full Javadoc:
`comment`, `declare`, `methods[]` (name/modifiers/returnType/paramNames/paramTypes/comment/tags/throwExceptions/annotations), `fields[]`, `interfaces`, `allInterfaces`, `isDeprecated`, `isPlugin`, `isService`.

## Packages

### `kd.bos.permission`

Path prefix: `javadoc/kd/bos/permission/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `PermissionModule` | class |  | `kd.sdk.module.Module` | 0 | 0 |  |

### `kd.bos.permission.api`

Path prefix: `javadoc/kd/bos/permission/api/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `AdminAppResult` | class |  | `java.io.Serializable` | 7 | 0 |  |
| `BizRoleInfo` | class |  | `java.io.Serializable` | 14 | 0 |  |
| `BizRoleInfo.BizRoleDisPerm` | class |  | `java.io.Serializable` | 6 | 0 |  |
| `BizRoleInfo.BizRoleOrg` | class |  | `java.io.Serializable` | 6 | 0 |  |
| `BizRoleInfo.BizRolePerm` | class |  | `java.io.Serializable` | 6 | 0 |  |
| `BizRoleInfo.CommonRole` | class |  | `java.io.Serializable` | 4 | 0 |  |
| `DimensionPermOrgResult` | class |  | `java.io.Serializable` | 4 | 0 |  |
| `FieldControlRule` | class |  | `java.io.Serializable` | 7 | 0 |  |
| `FieldControlRuleDto` | class |  | `java.io.Serializable` | 10 | 0 |  |
| `FieldControlRules` | class |  | `java.io.Serializable` | 2 | 0 |  |
| `RoleInfo` | class |  | `java.io.Serializable` | 22 | 0 |  |
| `UserScopeResult` | interface |  |  | 2 | 0 |  |

### `kd.bos.permission.enums`

Path prefix: `javadoc/kd/bos/permission/enums/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `AssignModEnum` | enum |  |  | 2 | 3 |  |
| `EnumsDataChangeType` | enum |  |  | 3 | 4 |  |
| `GrpUsrFromTypeEnum` | enum |  |  | 6 | 5 |  |

### `kd.bos.permission.model`

Path prefix: `javadoc/kd/bos/permission/model/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `AdminType` | enum |  |  | 2 | 6 |  |
| `DataRuleInfo` | class |  | `java.io.Serializable` | 28 | 4 |  |
| `DataRulesInfo` | class |  | `java.io.Serializable` | 14 | 0 |  |
| `EntDataRuleInfo` | class |  | `java.io.Serializable` | 10 | 0 |  |
| `EntDataRuleInfo.BdPropsDataRule` | class |  | `java.io.Serializable` | 8 | 0 |  |
| `EntDataRuleInfo.PermItemsDataRule` | class |  | `java.io.Serializable` | 6 | 0 |  |
| `PermRes` | class |  | `java.io.Serializable` | 14 | 0 |  |
| `PermResult` | class |  | `java.io.Serializable` | 15 | 0 |  |
| `PersonQueryParam` | class |  |  | 16 | 0 |  |
| `PersonQueryType` | enum |  |  | 1 | 10 |  |

### `kd.bos.permission.model.perm.req`

Path prefix: `javadoc/kd/bos/permission/model/perm/req/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `CheckPermissionReq` | class |  | `java.io.Serializable` | 12 | 0 |  |
| `DimFuncPermReq` | class | `kd.bos.permission.model.perm.PermItem` | `java.io.Serializable` | 6 | 0 |  |
| `DimRoleReq` | class |  | `java.io.Serializable` | 12 | 0 |  |
| `PermLogReq` | class |  | `java.io.Serializable` | 47 | 0 |  |
| `RoleAssignUserDimReq` | class |  | `java.io.Serializable` | 8 | 0 |  |
| `UserAssignDimRoleReq` | class |  | `java.io.Serializable` | 8 | 0 |  |
| `UserAssignUserGroupReq` | class |  | `java.io.Serializable` | 9 | 0 |  |
| `UserDimReq` | class |  | `java.io.Serializable` | 12 | 0 |  |
| `UserGroupAssignUserReq` | class |  | `java.io.Serializable` | 9 | 0 |  |

### `kd.bos.permission.model.perm.req.admin`

Path prefix: `javadoc/kd/bos/permission/model/perm/req/admin/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `GetAdminChargeUserReq` | class |  | `java.io.Serializable` | 8 | 0 |  |

### `kd.bos.permission.model.perm.req.field`

Path prefix: `javadoc/kd/bos/permission/model/perm/req/field/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `FieldControlRules2RuleReq` | class |  | `java.io.Serializable` | 12 | 0 |  |
| `GetFieldControlRulesReq` | class |  | `java.io.Serializable` | 13 | 0 |  |

### `kd.bos.permission.model.perm.req.user`

Path prefix: `javadoc/kd/bos/permission/model/perm/req/user/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `CheckUserBizAppReq` | class |  | `java.io.Serializable` | 6 | 0 |  |
| `GetUsableEntitiesInfoReq` | class |  | `java.io.Serializable` | 10 | 0 |  |
| `UserDirectAssignPermReq` | class |  | `java.io.Serializable` | 8 | 0 |  |
| `UserDirectAssignReq` | class |  | `java.io.Serializable` | 8 | 0 |  |
