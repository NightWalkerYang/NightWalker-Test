# kd.bos.svc.coderule

**编码规则** · app=`sys` cloud=`bos` isv=`kingdee`

Class HTML path rule: `javadoc/<package-with-slashes>/<ClassName>.html`
Example: package `kd.bos.algo`, class `Algo` → `javadoc/kd/bos/algo/Algo.html`

Each class HTML contains a `cm={...}` JSON object on line 2 with full Javadoc:
`comment`, `declare`, `methods[]` (name/modifiers/returnType/paramNames/paramTypes/comment/tags/throwExceptions/annotations), `fields[]`, `interfaces`, `allInterfaces`, `isDeprecated`, `isPlugin`, `isService`.

## Packages

### `kd.bos.coderule.api`

Path prefix: `javadoc/kd/bos/coderule/api/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `CodeRuleEntryInfo` | class |  |  | 32 | 0 |  |
| `CodeRuleInfo` | class |  |  | 18 | 0 |  |
| `ICodeRuleService` | interface |  |  | 8 | 0 |  |
| `OrgEntryInfo` | class |  |  | 4 | 0 |  |

### `kd.bos.svc.coderule`

Path prefix: `javadoc/kd/bos/svc/coderule/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `CodeRuleModule` | class |  | `kd.sdk.module.Module` | 0 | 0 |  |
