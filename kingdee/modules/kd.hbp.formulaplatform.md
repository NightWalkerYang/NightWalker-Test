# kd.hbp.formulaplatform

**HR公式平台** · app=`hbp` cloud=`hrmp` isv=`kingdee`

Class HTML path rule: `javadoc/<package-with-slashes>/<ClassName>.html`
Example: package `kd.bos.algo`, class `Algo` → `javadoc/kd/bos/algo/Algo.html`

Each class HTML contains a `cm={...}` JSON object on line 2 with full Javadoc:
`comment`, `declare`, `methods[]` (name/modifiers/returnType/paramNames/paramTypes/comment/tags/throwExceptions/annotations), `fields[]`, `interfaces`, `allInterfaces`, `isDeprecated`, `isPlugin`, `isService`.

## Packages

### `kd.hr.hbp.business.service.formula`

Path prefix: `javadoc/kd/hr/hbp/business/service/formula/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `FormulaParseService` | class |  |  | 8 | 0 |  |
| `HRFormulaPlatformModule` | class |  | `kd.sdk.module.Module` | 0 | 0 |  |

### `kd.hr.hbp.business.service.formula.cal.service`

Path prefix: `javadoc/kd/hr/hbp/business/service/formula/cal/service/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `AbsHRMPCalcService` | class |  | `kd.hr.hbp.business.service.formula.cal.service.IHRMPCalcService` | 9 | 0 | yes |

### `kd.hr.hbp.formplugin.web.formula`

Path prefix: `javadoc/kd/hr/hbp/formplugin/web/formula/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `FormulaSettingEdit` | class | `kd.hr.hbp.formplugin.web.HRDataBaseEdit` |  | 31 | 0 | yes |
