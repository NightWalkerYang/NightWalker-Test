# kd.bos.svc.print

**打印模块** · app=`sys` cloud=`bos` isv=`kingdee`

Class HTML path rule: `javadoc/<package-with-slashes>/<ClassName>.html`
Example: package `kd.bos.algo`, class `Algo` → `javadoc/kd/bos/algo/Algo.html`

Each class HTML contains a `cm={...}` JSON object on line 2 with full Javadoc:
`comment`, `declare`, `methods[]` (name/modifiers/returnType/paramNames/paramTypes/comment/tags/throwExceptions/annotations), `fields[]`, `interfaces`, `allInterfaces`, `isDeprecated`, `isPlugin`, `isService`.

## Packages

### `kd.bos.print.api`

Path prefix: `javadoc/kd/bos/print/api/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `FileStorageType` | enum |  |  | 0 | 2 |  |
| `IPrintWorkExt` | interface |  | `java.io.Serializable` | 0 | 0 |  |
| `PrintTask` | class |  | `java.io.Serializable` | 12 | 0 | yes |
| `PrintWork` | class |  | `kd.bos.print.api.IPrintWorkExt` | 27 | 0 |  |
| `PrintWork.EXP_TYPE` | enum |  |  | 1 | 11 | yes |

### `kd.bos.print.core.data`

Path prefix: `javadoc/kd/bos/print/core/data/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `DataRowSet` | class |  |  | 7 | 0 |  |

### `kd.bos.print.core.data.datasource`

Path prefix: `javadoc/kd/bos/print/core/data/datasource/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `CustomDataSource` | class | `kd.bos.print.core.data.datasource.PrtDataSource` |  | 6 | 0 |  |
| `DsType` | enum |  |  | 1 | 13 |  |
| `FormDataSource` | class | `kd.bos.print.core.data.datasource.PrtDataSource` |  | 5 | 0 |  |
| `MainDataSource` | class | `kd.bos.print.core.data.datasource.FormDataSource` |  | 6 | 0 | yes |
| `PrtDataSource` | class |  |  | 5 | 6 |  |
| `RefDataSource` | class | `kd.bos.print.core.data.datasource.FormDataSource` |  | 0 | 0 |  |
| `WorkflowDataSource` | class | `kd.bos.print.core.data.datasource.PrtDataSource` |  | 3 | 0 |  |

### `kd.bos.print.core.data.datasource.prop`

Path prefix: `javadoc/kd/bos/print/core/data/datasource/prop/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `SortField` | class |  |  | 8 | 0 |  |

### `kd.bos.print.core.data.field`

Path prefix: `javadoc/kd/bos/print/core/data/field/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `CollectionField` | class | `kd.bos.print.core.data.field.Field` |  | 11 | 1 |  |
| `DateField` | class | `kd.bos.print.core.data.field.Field` |  | 4 | 0 |  |
| `DateTimeField` | class | `kd.bos.print.core.data.field.Field` |  | 4 | 0 |  |
| `DecimalField` | class | `kd.bos.print.core.data.field.NumberField` |  | 16 | 0 |  |
| `Field` | class |  | `java.io.Serializable` | 11 | 4 |  |
| `ImageField` | class | `kd.bos.print.core.data.field.TextField` |  | 10 | 0 |  |
| `IntegerField` | class | `kd.bos.print.core.data.field.NumberField` |  | 9 | 0 |  |
| `LongField` | class | `kd.bos.print.core.data.field.NumberField` |  | 9 | 0 |  |
| `NullField` | class | `kd.bos.print.core.data.field.TextField` |  | 1 | 0 |  |
| `NumberField` | class | `kd.bos.print.core.data.field.Field` | `java.lang.Comparable` | 10 | 0 |  |
| `TextField` | class | `kd.bos.print.core.data.field.Field` |  | 5 | 0 |  |
| `TimeField` | class | `kd.bos.print.core.data.field.TextField` |  | 5 | 0 |  |

### `kd.bos.print.core.execute`

Path prefix: `javadoc/kd/bos/print/core/execute/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `PFileStorageType` | class |  |  | 5 | 0 |  |

### `kd.bos.print.core.execute.render.common.linewrap.param`

Path prefix: `javadoc/kd/bos/print/core/execute/render/common/linewrap/param/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `LineWrapRule` | enum |  |  | 0 | 3 |  |

### `kd.bos.print.core.model`

Path prefix: `javadoc/kd/bos/print/core/model/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `CurrencyFormat` | class |  | `java.io.Serializable` | 12 | 0 |  |
| `UppercaseType` | enum |  |  | 4 | 5 | yes |

### `kd.bos.print.core.model.designer.grid`

Path prefix: `javadoc/kd/bos/print/core/model/designer/grid/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `MergeBlock` | class |  | `java.lang.Cloneable` | 9 | 0 |  |

### `kd.bos.print.core.model.widget`

Path prefix: `javadoc/kd/bos/print/core/model/widget/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `StyleKey` | enum |  |  | 2 | 36 |  |

### `kd.bos.print.core.plugin`

Path prefix: `javadoc/kd/bos/print/core/plugin/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `AbstractPrintPlugin` | class |  | `kd.bos.print.core.plugin.IPrintPlugin` | 19 | 0 |  |
| `IPrintPlugin` | interface |  |  | 11 | 0 |  |

### `kd.bos.print.core.plugin.event`

Path prefix: `javadoc/kd/bos/print/core/plugin/event/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `AfterLoadDataEvent` | class |  | `java.io.Serializable` | 4 | 0 |  |
| `AfterOutputGridEvent` | class | `kd.bos.print.core.plugin.event.AfterOutputWidgetEvent` |  | 8 | 0 |  |
| `AfterOutputRowEvent` | class |  | `java.io.Serializable` | 4 | 0 |  |
| `AfterOutputWidgetEvent` | class |  | `java.io.Serializable` | 7 | 0 |  |
| `BeforeExportEvent` | class |  |  | 2 | 0 |  |
| `BeforeInitWidgetEvent` | class |  | `java.io.Serializable` | 2 | 0 |  |
| `BeforeLoadDataEvent` | class |  | `java.io.Serializable` | 5 | 0 |  |
| `BeforeOutputGridEvent` | class | `kd.bos.print.core.plugin.event.BeforeOutputWidgetEvent` |  | 22 | 0 |  |
| `BeforeOutputRowEvent` | class |  | `java.io.Serializable` | 8 | 0 |  |
| `BeforeOutputTextEvent` | class | `kd.bos.print.core.plugin.event.BeforeOutputWidgetEvent` |  | 1 | 0 |  |
| `BeforeOutputWidgetEvent` | class |  | `java.io.Serializable` | 10 | 0 |  |
| `CustomDataLoadEvent` | class |  | `java.io.Serializable` | 2 | 0 |  |
| `EndExportEvent` | class |  | `java.io.Serializable` | 2 | 0 |  |
| `ExpFileEvent` | class |  |  | 3 | 0 |  |

### `kd.bos.print.core.plugin.event.bo`

Path prefix: `javadoc/kd/bos/print/core/plugin/event/bo/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `IPrintEventBo` | interface |  |  | 1 | 0 |  |
| `PWGridBo` | class |  | `kd.bos.print.core.plugin.event.bo.IPrintEventBo` | 17 | 0 |  |
| `PWGridCellBo` | class |  | `kd.bos.print.core.plugin.event.bo.IPrintEventBo` | 32 | 0 |  |
| `PWGridColumnBo` | class |  | `kd.bos.print.core.plugin.event.bo.IPrintEventBo` | 3 | 0 |  |
| `PWGridRowBo` | class |  | `kd.bos.print.core.plugin.event.bo.IPrintEventBo` | 12 | 3 |  |
| `PWTextBo` | class |  | `kd.bos.print.core.plugin.event.bo.IPrintEventBo` | 30 | 0 |  |
| `PluginDataVisitorBo` | class |  | `kd.bos.print.core.plugin.event.bo.IPrintEventBo` | 6 | 0 |  |

### `kd.bos.print.core.plugin.event.bo.propenum`

Path prefix: `javadoc/kd/bos/print/core/plugin/event/bo/propenum/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `NegativeTypeEnum` | enum |  |  | 1 | 3 |  |
| `TextFormatEnum` | enum |  |  | 1 | 5 |  |

### `kd.bos.print.core.plugin.tpl`

Path prefix: `javadoc/kd/bos/print/core/plugin/tpl/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `TplInfo` | class |  | `java.io.Serializable` | 4 | 0 |  |

### `kd.bos.print.core.service`

Path prefix: `javadoc/kd/bos/print/core/service/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `PrtAttach` | class |  | `java.io.Serializable` | 24 | 0 |  |
| `PrtAttach.AttachDetail` | class |  | `java.io.Serializable` | 13 | 0 |  |

### `kd.bos.print.matchtpl`

Path prefix: `javadoc/kd/bos/print/matchtpl/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `MatcherResult` | class |  |  | 8 | 0 |  |
| `MatcherTpl` | class |  |  | 4 | 0 |  |
| `TplMatcherParam` | class |  |  | 16 | 0 |  |
| `TplMatcherUtil` | class |  |  | 12 | 0 | yes |
| `ViewType` | enum |  |  | 0 | 6 |  |

### `kd.bos.print.service`

Path prefix: `javadoc/kd/bos/print/service/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `BosPrintServiceHelper` | class |  |  | 12 | 0 |  |
| `BosPrintServiceHelper.TplInfo` | class |  |  | 7 | 0 |  |

### `kd.bos.svc.print`

Path prefix: `javadoc/kd/bos/svc/print/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `PrintModule` | class |  | `kd.sdk.module.Module` | 0 | 0 |  |
