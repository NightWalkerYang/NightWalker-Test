# kd.bos.svc.import

**单据导入模块** · app=`sys` cloud=`bos` isv=`kingdee`

Class HTML path rule: `javadoc/<package-with-slashes>/<ClassName>.html`
Example: package `kd.bos.algo`, class `Algo` → `javadoc/kd/bos/algo/Algo.html`

Each class HTML contains a `cm={...}` JSON object on line 2 with full Javadoc:
`comment`, `declare`, `methods[]` (name/modifiers/returnType/paramNames/paramTypes/comment/tags/throwExceptions/annotations), `fields[]`, `interfaces`, `allInterfaces`, `isDeprecated`, `isPlugin`, `isService`.

## Packages

### `kd.bos.form.operate.imptapi`

Path prefix: `javadoc/kd/bos/form/operate/imptapi/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `RowMapper` | class | `kd.bos.form.operate.webapi.RowMapper` |  | 6 | 0 |  |

### `kd.bos.form.plugin.impt`

Path prefix: `javadoc/kd/bos/form/plugin/impt/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `BatchImportPlugin` | class |  | `java.util.concurrent.Callable`, `kd.bos.form.plugin.impt.IImportDataPluginSupportKS`, `kd.sdk.plugin.Plugin` | 11 | 0 | yes |
| `ImportBillData` | class |  |  | 7 | 0 |  |
| `ImportContext` | class |  |  | 7 | 3 | yes |

### `kd.bos.impt`

Path prefix: `javadoc/kd/bos/impt/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `ExcelReader` | class |  |  | 1 | 0 |  |
| `ImportModel` | class |  | `kd.sdk.module.Module` | 0 | 0 |  |
| `SheetHandler` | class | `org.xml.sax.helpers.DefaultHandler` |  | 1 | 0 |  |
| `SheetHandler.ParsedRow` | class |  |  | 4 | 0 |  |
