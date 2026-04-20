# kd.bos.formula

**公式运算** · app=`bos` cloud=`bos` isv=`kingdee`

Class HTML path rule: `javadoc/<package-with-slashes>/<ClassName>.html`
Example: package `kd.bos.algo`, class `Algo` → `javadoc/kd/bos/algo/Algo.html`

Each class HTML contains a `cm={...}` JSON object on line 2 with full Javadoc:
`comment`, `declare`, `methods[]` (name/modifiers/returnType/paramNames/paramTypes/comment/tags/throwExceptions/annotations), `fields[]`, `interfaces`, `allInterfaces`, `isDeprecated`, `isPlugin`, `isService`.

## Packages

### `kd.bos.formula`

Path prefix: `javadoc/kd/bos/formula/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `FormulaEngine` | class |  |  | 8 | 0 |  |
| `FormulaModule` | class |  | `kd.sdk.module.Module` | 0 | 0 |  |

### `kd.bos.formula.excel`

Path prefix: `javadoc/kd/bos/formula/excel/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `BinaryExpr` | class | `kd.bos.formula.excel.ExprBase` |  | 6 | 0 |  |
| `CompoundId` | class | `kd.bos.formula.excel.ExprBase` |  | 10 | 0 |  |
| `ExecuteContext` | interface |  |  | 3 | 0 |  |
| `Expr` | interface |  |  | 5 | 0 |  |
| `ExprBase` | class |  | `kd.bos.formula.excel.Expr` | 3 | 0 |  |
| `ExprList` | class | `kd.bos.formula.excel.ExprBase` |  | 4 | 1 |  |
| `ExprParser` | class |  |  | 1 | 0 |  |
| `FormulaException` | class | `java.lang.RuntimeException` |  | 4 | 0 |  |
| `FunCall` | class | `kd.bos.formula.excel.ExprBase` |  | 6 | 3 |  |
| `FunDef` | class |  | `kd.bos.formula.excel.FunCallExecutable` | 10 | 0 |  |
| `Literal` | class | `kd.bos.formula.excel.ExprBase` |  | 12 | 11 |  |
| `MapExecuteContext` | class |  | `kd.bos.formula.excel.ExecuteContext` | 8 | 0 |  |
| `NamedExpr` | class | `kd.bos.formula.excel.ExprBase` |  | 7 | 0 |  |
| `Operator` | class |  |  | 3 | 22 |  |
| `Paren` | class | `kd.bos.formula.excel.ExprBase` |  | 4 | 0 |  |
| `UDFunction` | interface |  |  | 2 | 0 |  |
| `VerifyVisitor` | class |  | `kd.bos.formula.excel.Visitor` | 4 | 0 |  |
| `Visitor` | interface |  |  | 1 | 0 |  |

### `kd.bos.formula.functions`

Path prefix: `javadoc/kd/bos/formula/functions/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `Avg` | class |  | `kd.bos.formula.excel.UDFunction` | 2 | 0 |  |
| `Count` | class |  | `kd.bos.formula.excel.UDFunction` | 2 | 0 |  |
| `If` | class |  | `kd.bos.formula.excel.UDFunction` | 2 | 0 |  |
| `Max` | class |  | `kd.bos.formula.excel.UDFunction` | 2 | 0 |  |
| `Min` | class |  | `kd.bos.formula.excel.UDFunction` | 2 | 0 |  |
| `Sum` | class |  | `kd.bos.formula.excel.UDFunction` | 2 | 0 |  |
