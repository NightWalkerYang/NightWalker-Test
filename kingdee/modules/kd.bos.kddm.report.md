# kd.bos.kddm.report

**报表** · app=`bos` cloud=`bos` isv=`kingdee`

Class HTML path rule: `javadoc/<package-with-slashes>/<ClassName>.html`
Example: package `kd.bos.algo`, class `Algo` → `javadoc/kd/bos/algo/Algo.html`

Each class HTML contains a `cm={...}` JSON object on line 2 with full Javadoc:
`comment`, `declare`, `methods[]` (name/modifiers/returnType/paramNames/paramTypes/comment/tags/throwExceptions/annotations), `fields[]`, `interfaces`, `allInterfaces`, `isDeprecated`, `isPlugin`, `isService`.

## Packages

### `kd.bos.entity.report`

Path prefix: `javadoc/kd/bos/entity/report/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `AbstractReportListDataPlugin` | class |  | `kd.bos.entity.report.IReportListDataPlugin` | 9 | 0 |  |
| `AbstractReportListDataPluginExt` | class |  | `kd.bos.entity.report.IReportListDataServiceExt` | 2 | 0 |  |
| `AbstractReportTreeDataPlugin` | class |  |  | 2 | 0 |  |
| `DynamicReportColumnEvent` | class |  | `java.io.Serializable` | 4 | 0 | yes |
| `IReportListDataPlugin` | interface |  |  | 6 | 0 |  |
| `IReportListDataServiceExt` | interface |  | `java.io.Serializable` | 2 | 0 |  |
| `IReportQueryExtPlugin` | interface |  |  | 1 | 0 |  |
| `IReportTreeModel` | interface |  |  | 2 | 0 |  |
| `ReportModule` | class |  | `kd.sdk.module.Module` | 0 | 0 |  |
| `ReportTaskParam` | class |  | `java.io.Serializable` | 33 | 0 | yes |
| `AbstractReportColumn` | class |  | `kd.bos.entity.IBaseColumn`, `java.io.Serializable` | 12 | 0 |  |
| `CellStyle` | class | `kd.bos.entity.report.ColumnStyle` |  | 6 | 0 |  |
| `ColumnStyle` | class |  | `java.io.Serializable` | 10 | 0 |  |
| `ComboReportColumn` | class | `kd.bos.entity.report.ReportColumn` |  | 6 | 0 |  |
| `DateEnum` | enum |  |  | 1 | 4 |  |
| `DateTimeReportColumn` | class | `kd.bos.entity.report.ReportColumn` |  | 3 | 0 |  |
| `DecimalReportColumn` | class | `kd.bos.entity.report.ReportColumn` |  | 5 | 0 |  |
| `FastFilter` | class |  | `java.io.Serializable` | 4 | 0 |  |
| `FilterInfo` | class |  | `java.io.Serializable` | 40 | 0 |  |
| `FilterItemInfo` | class |  | `java.io.Serializable` | 17 | 0 |  |
| `FlexReportColumn` | class | `kd.bos.entity.report.ReportColumn` |  | 6 | 0 |  |
| `IReportBatchQueryInfo` | interface |  |  | 6 | 0 |  |
| `IReportListModel` | interface |  |  | 8 | 0 |  |
| `MulBasedataReportColumn` | class | `kd.bos.entity.report.ReportColumn` |  | 1 | 0 |  |
| `MulComboReportColumn` | class | `kd.bos.entity.report.ComboReportColumn` |  | 1 | 0 |  |
| `ReportBatchQueryInfo` | class |  | `java.io.Serializable`, `kd.bos.entity.report.IReportBatchQueryInfo` | 15 | 0 |  |
| `ReportColumn` | class | `kd.bos.entity.report.AbstractReportColumn` | `kd.bos.entity.IColumn` | 63 | 22 |  |
| `ReportColumnGroup` | class | `kd.bos.entity.report.AbstractReportColumn` | `kd.bos.entity.IColumnGroup`, `java.io.Serializable` | 12 | 2 |  |
| `ReportFilterDefaultField` | class |  | `java.io.Serializable` | 6 | 0 |  |
| `ReportQueryParam` | class |  | `java.io.Serializable` | 19 | 0 |  |
| `TextReportColumn` | class | `kd.bos.entity.report.ReportColumn` |  | 5 | 1 |  |
| `TimeReportColumn` | class | `kd.bos.entity.report.ReportColumn` |  | 3 | 0 |  |

### `kd.bos.entity.report.queryds`

Path prefix: `javadoc/kd/bos/entity/report/queryds/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `ReportFilterField` | class |  | `java.io.Serializable` | 19 | 0 |  |

### `kd.bos.report`

Path prefix: `javadoc/kd/bos/report/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `AbstractReportListModel` | class | `kd.bos.report.AbstractReportModel` |  | 9 | 0 |  |
| `AbstractReportModel` | class |  |  | 25 | 0 |  |
| `IReportView` | interface |  |  | 9 | 0 |  |
| `ReportForm` | class | `FormRoot` |  | 4 | 9 |  |
| `ReportList` | class | `AbstractGrid` |  | 85 | 1 | yes |
| `ReportOperationColumn` | class | `AbstractReportColumn` |  | 11 | 0 |  |
| `ReportSelectedRow` | class |  | `java.io.Serializable` | 6 | 0 |  |
| `ReportShowParameter` | class | `FormShowParameter` |  | 8 | 0 |  |
| `ReportTree` | class | `TreeView` |  | 11 | 0 |  |

### `kd.bos.report.events`

Path prefix: `javadoc/kd/bos/report/events/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `CellStyleRule` | class |  |  | 10 | 0 |  |
| `CreateColumnEvent` | class | `java.util.EventObject` |  | 4 | 0 |  |
| `CreateFilterInfoEvent` | class | `java.util.EventObject` |  | 7 | 0 |  |
| `FlexEvent` | class |  |  | 2 | 0 |  |
| `FormatShowFilterEvent` | class | `java.util.EventObject` |  | 4 | 0 |  |
| `MergeColumnRule` | class |  | `java.io.Serializable` | 7 | 0 |  |
| `QueryEvent` | class |  |  | 4 | 0 |  |
| `ReportExportInitializeEvent` | class |  | `java.io.Serializable` | 7 | 0 |  |
| `SearchEvent` | class | `java.util.EventObject` |  | 3 | 0 |  |
| `SortAndFilterEvent` | class |  | `java.io.Serializable` | 13 | 0 |  |
| `SummaryEvent` | class |  | `java.io.Serializable` | 6 | 0 |  |
| `TreeReportListEvent` | class |  |  | 4 | 0 |  |

### `kd.bos.report.filter`

Path prefix: `javadoc/kd/bos/report/filter/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `ReportFilter` | class | `Container` |  | 18 | 0 |  |
| `ReportFilterShowParameter` | class | `FormShowParameter` |  | 3 | 0 |  |
| `SearchListener` | interface |  |  | 1 | 0 |  |

### `kd.bos.report.plugin`

Path prefix: `javadoc/kd/bos/report/plugin/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `AbstractReportFormPlugin` | class | `AbstractFormPlugin` | `kd.bos.report.plugin.IReportFormPlugin` | 30 | 0 |  |
| `GroupReportFormPlugin` | class | `kd.bos.report.plugin.AbstractReportFormPlugin` |  | 3 | 0 |  |
| `IReportFormPlugin` | interface |  | `kd.bos.report.plugin.ReportExportListener` | 27 | 0 |  |
