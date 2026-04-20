# kd.bos.formula.platform

**公式平台（独立平台，支持脚本运算）** · app=`bos` cloud=`bos` isv=`kingdee`

Class HTML path rule: `javadoc/<package-with-slashes>/<ClassName>.html`
Example: package `kd.bos.algo`, class `Algo` → `javadoc/kd/bos/algo/Algo.html`

Each class HTML contains a `cm={...}` JSON object on line 2 with full Javadoc:
`comment`, `declare`, `methods[]` (name/modifiers/returnType/paramNames/paramTypes/comment/tags/throwExceptions/annotations), `fields[]`, `interfaces`, `allInterfaces`, `isDeprecated`, `isPlugin`, `isService`.

## Packages

### `kd.bos.formula.platform`

Path prefix: `javadoc/kd/bos/formula/platform/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `FormulaPlatformModule` | class |  | `kd.sdk.module.Module` | 0 | 0 |  |

### `kd.bos.formula.platform.api`

Path prefix: `javadoc/kd/bos/formula/platform/api/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `FuncInfo` | class |  | `kd.bos.formula.platform.api.IFuncInfo` | 17 | 7 |  |
| `IFormulaFunctions` | interface |  |  | 8 | 0 |  |
| `IFormulaGrammarVerifier` | interface |  |  | 4 | 0 |  |
| `IFormulaVarInfos` | interface |  |  | 4 | 0 |  |
| `IFuncInfo` | interface |  |  | 12 | 0 |  |
| `IVarInfo` | interface |  |  | 9 | 11 |  |
| `InvokeFunctionException` | class | `java.lang.Exception` |  | 5 | 3 |  |
| `VarInfo` | class |  | `kd.bos.formula.platform.api.IVarInfo` | 14 | 0 |  |

### `kd.bos.formula.platform.api.funcpara`

Path prefix: `javadoc/kd/bos/formula/platform/api/funcpara/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `IFuncParamInputFormPlugin` | interface |  |  | 2 | 1 |  |

### `kd.bos.formula.platform.builder`

Path prefix: `javadoc/kd/bos/formula/platform/builder/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `FormulaDesigner` | class |  |  | 3 | 0 |  |
| `FormulaDesignerParameter` | class |  |  | 19 | 4 |  |
| `FormulaDesignerResult` | class |  |  | 4 | 0 |  |

### `kd.bos.formula.platform.engine`

Path prefix: `javadoc/kd/bos/formula/platform/engine/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `FormulaEngine` | class |  |  | 13 | 0 |  |
| `FormulaException` | class | `java.lang.RuntimeException` |  | 4 | 0 |  |
| `RunFormulaException` | class | `java.lang.Exception` |  | 2 | 0 |  |
