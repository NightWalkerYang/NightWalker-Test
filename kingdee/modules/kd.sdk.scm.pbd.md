# kd.sdk.scm.pbd

**供应商协同基础服务** · app=`pbd` cloud=`scm` isv=`kingdee`

Class HTML path rule: `javadoc/<package-with-slashes>/<ClassName>.html`
Example: package `kd.bos.algo`, class `Algo` → `javadoc/kd/bos/algo/Algo.html`

Each class HTML contains a `cm={...}` JSON object on line 2 with full Javadoc:
`comment`, `declare`, `methods[]` (name/modifiers/returnType/paramNames/paramTypes/comment/tags/throwExceptions/annotations), `fields[]`, `interfaces`, `allInterfaces`, `isDeprecated`, `isPlugin`, `isService`.

## Packages

### `kd.sdk.scm.pbd`

Path prefix: `javadoc/kd/sdk/scm/pbd/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `SdkScmPbdModule` | class |  | `kd.sdk.module.Module` | 0 | 0 |  |

### `kd.sdk.scm.pbd.extpoint`

Path prefix: `javadoc/kd/sdk/scm/pbd/extpoint/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `IBusinessRulesCallBackService` | interface |  |  | 3 | 0 |  |
| `IBusinessRulesCheckParseService` | interface |  | `kd.sdk.scm.pbd.extpoint.IBusinessRulesRequestParseService` | 1 | 0 |  |
| `IBusinessRulesFillParseService` | interface |  | `kd.sdk.scm.pbd.extpoint.IBusinessRulesRequestParseService` | 1 | 0 |  |
| `IBusinessRulesRequestParseService` | interface |  |  | 1 | 0 |  |
