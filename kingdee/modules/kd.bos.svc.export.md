# kd.bos.svc.export

**单据导出模块** · app=`sys` cloud=`bos` isv=`kingdee`

Class HTML path rule: `javadoc/<package-with-slashes>/<ClassName>.html`
Example: package `kd.bos.algo`, class `Algo` → `javadoc/kd/bos/algo/Algo.html`

Each class HTML contains a `cm={...}` JSON object on line 2 with full Javadoc:
`comment`, `declare`, `methods[]` (name/modifiers/returnType/paramNames/paramTypes/comment/tags/throwExceptions/annotations), `fields[]`, `interfaces`, `allInterfaces`, `isDeprecated`, `isPlugin`, `isService`.

## Packages

### `kd.bos.form.plugin`

Path prefix: `javadoc/kd/bos/form/plugin/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `AfterExportEntryEvent` | class | `java.util.EventObject` |  | 4 | 0 |  |
| `BeforeDownloadImportTemplateEvent` | class | `java.util.EventObject` |  | 2 | 0 |  |
| `BeforeExportEntryEvent` | class | `java.util.EventObject` |  | 1 | 0 |  |
| `ExportModule` | class |  | `kd.sdk.module.Module` | 0 | 0 |  |
| `IExportEntryPlugin` | interface |  |  | 2 | 0 |  |
| `ImportTemplateListener` | interface |  |  | 2 | 0 |  |
| `IWaterMarkPlugin` | interface |  |  | 1 | 0 |  |

### `kd.bos.form.plugin.importentry.strategy`

Path prefix: `javadoc/kd/bos/form/plugin/importentry/strategy/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `BeforeDownloadImportEntryTemplateEvent` | class | `java.util.EventObject` |  | 2 | 0 |  |
| `ImportEntryTemplateListener` | interface |  |  | 1 | 0 |  |

### `kd.bos.form.plugin.list`

Path prefix: `javadoc/kd/bos/form/plugin/list/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `AbstractMobF7Plugin` | class | `AbstractMobListPlugin` |  | 7 | 0 |  |

### `kd.bos.form.plugin.tools`

Path prefix: `javadoc/kd/bos/form/plugin/tools/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `Column` | class |  |  | 4 | 0 |  |
