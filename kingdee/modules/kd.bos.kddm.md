# kd.bos.kddm

**动态领域模型** · app=`bos` cloud=`bos` isv=`kingdee`

Class HTML path rule: `javadoc/<package-with-slashes>/<ClassName>.html`
Example: package `kd.bos.algo`, class `Algo` → `javadoc/kd/bos/algo/Algo.html`

Each class HTML contains a `cm={...}` JSON object on line 2 with full Javadoc:
`comment`, `declare`, `methods[]` (name/modifiers/returnType/paramNames/paramTypes/comment/tags/throwExceptions/annotations), `fields[]`, `interfaces`, `allInterfaces`, `isDeprecated`, `isPlugin`, `isService`.

## Packages

### `kd.bos.base`

Path prefix: `javadoc/kd/bos/base/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `AbstractBasePlugIn` | class | `kd.bos.bill.AbstractBillPlugIn` |  | 0 | 0 |  |
| `AbstractBasedataController` | class |  |  | 2 | 0 |  |
| `AbstractMobBasePlugIn` | class | `kd.bos.bill.AbstractMobBillPlugIn` |  | 0 | 0 |  |
| `BaseShowParameter` | class | `kd.bos.bill.BillShowParameter` |  | 4 | 0 |  |
| `BasedataHelper` | class |  |  | 1 | 0 |  |
| `IBasedataController` | interface |  | `java.io.Serializable` | 2 | 0 |  |
| `MobileBaseShowParameter` | class | `kd.bos.bill.MobileBillShowParameter` |  | 0 | 0 |  |

### `kd.bos.bill`

Path prefix: `javadoc/kd/bos/bill/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `AbstractBillPlugIn` | class | `AbstractFormPlugin` | `kd.bos.bill.IBillPlugin` | 1 | 0 |  |
| `AbstractBillWebApiPlugin` | class |  | `kd.bos.bill.IBillWebApiPlugin` | 5 | 0 |  |
| `AbstractMobBillPlugIn` | class | `kd.bos.bill.AbstractBillPlugIn` |  | 2 | 0 |  |
| `IBillPlugin` | interface |  |  | 1 | 0 |  |
| `IBillWebApiPlugin` | interface |  |  | 8 | 0 |  |
| `IMobileBillView` | interface |  |  | 0 | 0 |  |
| `BillOperationStatus` | enum |  |  | 2 | 5 |  |
| `BillShowParameter` | class | `kd.bos.form.FormShowParameter` |  | 26 | 0 |  |
| `CtsyBillShowParameter` | class | `kd.bos.bill.BillShowParameter` | `kd.bos.form.ICtsyShowParameter` | 10 | 0 |  |
| `IBillView` | interface |  | `kd.bos.form.IFormView` | 1 | 0 |  |
| `MobileBillShowParameter` | class | `kd.bos.bill.BillShowParameter` |  | 3 | 0 |  |
| `MobileFormPosition` | enum |  |  | 0 | 4 |  |
| `OperationStatus` | enum |  |  | 2 | 3 |  |

### `kd.bos.bill.events`

Path prefix: `javadoc/kd/bos/bill/events/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `AICommandEvent` | class |  |  | 4 | 0 |  |
| `ConvertPkEvent` | class | `java.util.EventObject` |  | 5 | 0 |  |
| `LocateEvent` | class | `java.util.EventObject` |  | 2 | 0 |  |

### `kd.bos.devportal.common.util`

Path prefix: `javadoc/kd/bos/devportal/common/util/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `SubSysTreeBuilder` | class |  |  | 21 | 0 |  |
| `TreeLeafType` | enum |  |  | 1 | 4 | yes |

### `kd.bos.entity`

Path prefix: `javadoc/kd/bos/entity/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `AnchorItems` | class |  | `java.io.Serializable` | 11 | 0 |  |
| `DBVersion` | class |  |  | 3 | 0 |  |
| `KDDMModule` | class |  | `kd.sdk.module.Module` | 0 | 0 |  |
| `ListboxItem` | class |  | `java.io.Serializable` | 9 | 0 |  |
| `MarkdownLinkData` | class |  | `java.io.Serializable` | 6 | 0 |  |
| `TileItem` | class |  | `java.io.Serializable` | 11 | 0 |  |
| `ValueTextItem` | class |  | `java.io.Serializable` | 5 | 0 |  |
| `AppInfo` | class |  | `kd.bos.entity.NodeInfo`, `java.io.Serializable` | 48 | 5 |  |
| `AppMenuInfo` | class |  | `kd.bos.entity.NodeInfo`, `java.io.Serializable` | 38 | 4 |  |
| `AppMetadataCache` | class |  |  | 16 | 0 |  |
| `BadgeInfo` | class |  | `java.io.Serializable` | 14 | 0 |  |
| `BasedataEntityType` | class | `kd.bos.entity.BillEntityType` |  | 32 | 3 |  |
| `BillEntityType` | class | `kd.bos.entity.MainEntityType` |  | 33 | 1 |  |
| `BillTypeControlInfo` | class |  | `java.io.Serializable` | 27 | 0 |  |
| `ComboPropShowStyle` | enum |  |  | 1 | 2 |  |
| `CompareTypeConfig` | class |  |  | 3 | 0 |  |
| `CompareTypeField` | class |  | `java.io.Serializable` | 13 | 0 |  |
| `CtLinkEntryType` | class | `kd.bos.entity.EntryType` |  | 8 | 0 |  |
| `EntityItemTypes` | class |  |  | 10 | 0 |  |
| `EntityMetadataCache` | class |  |  | 33 | 0 |  |
| `EntityType` | class | `DynamicObjectType` |  | 21 | 2 |  |
| `EntryType` | class | `kd.bos.entity.EntityType` |  | 15 | 0 |  |
| `ExtendedDataEntity` | class |  |  | 22 | 0 |  |
| `ExtendedDataEntitySet` | class |  |  | 6 | 0 |  |
| `FeatureOption` | enum |  |  | 1 | 13 |  |
| `FlexEntityType` | class | `kd.bos.entity.MainEntityType` |  | 9 | 0 |  |
| `IColumn` | interface |  | `kd.bos.entity.IBaseColumn` | 6 | 0 |  |
| `IFrameMessage` | class |  | `java.io.Serializable` | 8 | 0 |  |
| `ISVInfo` | class |  | `java.io.Serializable` | 12 | 0 |  |
| `LinkEntryType` | class | `kd.bos.entity.EntryType` |  | 6 | 0 |  |
| `LinkSetElement` | class |  |  | 10 | 0 |  |
| `LinkSetItemElement` | class |  |  | 9 | 0 |  |
| `MainEntityType` | class | `kd.bos.entity.EntityType` |  | 37 | 2 | yes |
| `MobLocation` | class |  |  | 11 | 0 |  |
| `NumberFormatProvider` | class |  |  | 20 | 10 |  |
| `PermissionControlType` | class |  | `java.io.Serializable` | 23 | 1 |  |
| `QueryEntityType` | class | `kd.bos.entity.BasedataEntityType` |  | 33 | 0 |  |
| `RefEntityType` | class | `kd.bos.entity.BasedataEntityType` |  | 6 | 1 |  |
| `RefPropType` | class |  | `java.io.Serializable` | 7 | 0 |  |
| `ReportQueryEntityType` | class | `kd.bos.entity.QueryEntityType` |  | 0 | 0 |  |
| `SelectedDisplayField` | class |  | `java.io.Serializable` | 6 | 0 |  |
| `SubEntryType` | class | `kd.bos.entity.EntryType` |  | 0 | 0 |  |
| `SummaryToField` | class |  | `java.io.Serializable` | 8 | 0 |  |
| `Tips` | class |  | `java.io.Serializable` | 35 | 4 |  |
| `TipsLink` | class |  | `java.io.Serializable` | 8 | 0 |  |
| `TreeEntryType` | class | `kd.bos.entity.EntryType` | `kd.bos.entity.ITreeEntryType` | 2 | 1 |  |
| `ValueMapItem` | class |  | `java.io.Serializable` | 12 | 0 |  |

### `kd.bos.entity.api`

Path prefix: `javadoc/kd/bos/entity/api/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `AICommand` | class |  |  | 12 | 0 |  |
| `ApiResult` | class |  |  | 19 | 0 |  |

### `kd.bos.entity.basedata`

Path prefix: `javadoc/kd/bos/entity/basedata/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `BaseDataResponse` | class |  | `java.io.Serializable` | 8 | 0 |  |

### `kd.bos.entity.ca`

Path prefix: `javadoc/kd/bos/entity/ca/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `SignScheme` | class |  |  | 14 | 0 |  |
| `VerifySignInfo` | class |  | `java.io.Serializable` | 7 | 0 |  |

### `kd.bos.entity.cache`

Path prefix: `javadoc/kd/bos/entity/cache/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `AppCache` | class |  |  | 1 | 0 |  |
| `IAppCache` | interface |  |  | 5 | 0 |  |
| `IBusinessAppCache` | interface |  |  | 5 | 0 |  |

### `kd.bos.entity.datamodel`

Path prefix: `javadoc/kd/bos/entity/datamodel/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `AbstractFormDataModel` | class |  |  | 142 | 6 | yes |
| `IParameterModel` | interface |  |  | 11 | 0 |  |
| `TableValueSetter` | class |  |  | 4 | 0 |  |
| `ApproverListField` | class | `kd.bos.entity.datamodel.ListField` |  | 6 | 0 |  |
| `BasedataItem` | class |  |  | 24 | 0 |  |
| `DynamicTextListField` | class | `kd.bos.entity.datamodel.ListField` |  | 7 | 0 |  |
| `FmtField` | class |  |  | 8 | 3 |  |
| `FmtInfoUtils` | class |  |  | 10 | 11 |  |
| `IBillModel` | interface |  | `kd.bos.entity.datamodel.IDataModel` | 5 | 0 |  |
| `IDataModel` | interface |  | `kd.bos.entity.datamodel.IEntryOperate`, `kd.bos.entity.datamodel.IDataProvider`, `kd.bos.entity.cache.TableCache`, `kd.bos.entity.datamodel.IEntryFilter` | 30 | 0 |  |
| `IDefValueProvider` | interface |  |  | 6 | 0 |  |
| `IEntryFilter` | interface |  |  | 9 | 0 |  |
| `IEntryOperate` | interface |  |  | 33 | 0 |  |
| `IFilterModel` | interface |  |  | 41 | 0 |  |
| `IListModel` | interface |  | `kd.bos.entity.datamodel.IListModelContext`, `kd.bos.entity.datamodel.IListModelListener` | 8 | 0 |  |
| `IListModelContext` | interface |  |  | 10 | 0 |  |
| `IListModelListener` | interface |  |  | 2 | 0 |  |
| `IRefrencedataProvider` | interface |  |  | 1 | 0 |  |
| `ITreeModel` | interface |  |  | 20 | 0 |  |
| `ListField` | class |  | `java.io.Serializable` | 53 | 14 |  |
| `ListSelectedRow` | class |  | `java.io.Serializable` | 28 | 0 | yes |
| `ListSelectedRowCollection` | class | `java.util.ArrayList` |  | 8 | 0 | yes |
| `NumberPrecision` | class |  | `java.io.Serializable` | 23 | 0 | yes |
| `ORMUtil` | class |  |  | 13 | 0 |  |
| `RowDataEntity` | class |  |  | 5 | 0 |  |
| `VoucherNoListField` | class | `kd.bos.entity.datamodel.ListField` |  | 6 | 0 |  |

### `kd.bos.entity.datamodel.events`

Path prefix: `javadoc/kd/bos/entity/datamodel/events/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `AfterAddRowEventArgs` | class |  | `kd.bos.entity.plugin.manager.IConditionEvent` | 7 | 0 |  |
| `AfterDeleteEntryEventArgs` | class |  | `kd.bos.entity.plugin.manager.IConditionEvent` | 2 | 0 |  |
| `AfterDeleteRowEventArgs` | class |  | `kd.bos.entity.plugin.manager.IConditionEvent` | 6 | 0 |  |
| `AfterMoveEntryEventArgs` | class |  | `kd.bos.entity.plugin.manager.IConditionEvent` | 5 | 0 |  |
| `AfterTogetherMoveEntryRowEventArgs` | class |  | `kd.bos.entity.plugin.manager.IConditionEvent` | 8 | 0 |  |
| `BeforeAddRowEventArgs` | class |  |  | 0 | 0 |  |
| `BeforeDeleteEntryEventArgs` | class |  | `kd.bos.entity.plugin.manager.IConditionEvent` | 3 | 0 |  |
| `BeforeDeleteRowEventArgs` | class |  | `kd.bos.entity.plugin.manager.IConditionEvent` | 6 | 0 |  |
| `BeforeImportDataEventArgs` | class | `kd.bos.entity.datamodel.events.ImportDataEventArgs` |  | 9 | 0 |  |
| `BeforeImportEntryEventArgs` | class | `java.util.EventObject` |  | 2 | 0 |  |
| `BeforePackageDataEvent` | class | `java.util.EventObject` |  | 4 | 0 |  |
| `BeforeSetItemValueEventArgs` | class |  |  | 13 | 0 |  |
| `BeforeTogetherMoveEntryRowEventArgs` | class |  | `kd.bos.entity.plugin.manager.IConditionEvent` | 8 | 0 |  |
| `BizDataEventArgs` | class |  |  | 6 | 0 |  |
| `ChangeData` | class | `kd.bos.entity.datamodel.RowDataEntity` |  | 3 | 0 |  |
| `GetEntityTypeEventArgs` | class |  |  | 4 | 0 |  |
| `IDataModelChangeListener` | interface |  |  | 20 | 0 |  |
| `IDataModelListener` | interface |  |  | 10 | 0 |  |
| `ImportDataEventArgs` | class | `java.util.EventObject` |  | 12 | 0 |  |
| `InitImportDataEventArgs` | class | `java.util.EventObject` |  | 10 | 0 |  |
| `LoadDataEventArgs` | class | `java.util.EventObject` |  | 4 | 0 |  |
| `PackageDataEvent` | class | `java.util.EventObject` |  | 23 | 0 |  |
| `PropertyChangedArgs` | class |  | `kd.bos.entity.plugin.manager.IConditionEvent` | 3 | 0 |  |
| `QueryImportBasedataEventArgs` | class | `java.util.EventObject` |  | 2 | 0 |  |

### `kd.bos.entity.earlywarn.warn.plugin`

Path prefix: `javadoc/kd/bos/entity/earlywarn/warn/plugin/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `IEarlyWarnConditionForm` | interface |  |  | 2 | 0 |  |
| `IEarlyWarnMessageHandler` | interface |  |  | 3 | 0 |  |

### `kd.bos.entity.earlywarn.warnschedule`

Path prefix: `javadoc/kd/bos/entity/earlywarn/warnschedule/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `WarnSchedule` | class |  | `java.io.Serializable` | 28 | 0 |  |

### `kd.bos.entity.earlywarn.warnschedule.messageconfig`

Path prefix: `javadoc/kd/bos/entity/earlywarn/warnschedule/messageconfig/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `WarnMessageReceiver` | class |  | `java.io.Serializable` | 21 | 0 |  |

### `kd.bos.entity.filter`

Path prefix: `javadoc/kd/bos/entity/filter/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `AbstractFilterContantParser` | class |  | `kd.bos.entity.filter.IConditionVariableAnalysis` | 4 | 0 |  |
| `CompareType` | class |  | `java.io.Serializable`, `java.lang.Cloneable` | 36 | 0 |  |
| `CompareTypeEnum` | enum |  |  | 2 | 83 |  |
| `CompareTypeValue` | class |  | `java.io.Serializable`, `java.lang.Cloneable` | 7 | 0 |  |
| `ConditionVariableContext` | class |  |  | 24 | 0 |  |
| `ControlFilter` | class |  |  | 6 | 0 |  |
| `ControlFilters` | class |  |  | 9 | 0 |  |
| `FilterBuilder` | class |  |  | 33 | 0 |  |
| `FilterBuilderParameter` | class |  |  | 15 | 0 |  |
| `FilterContantParserArgs` | class |  |  | 7 | 0 |  |
| `FilterField` | class |  |  | 69 | 4 |  |
| `FilterKeyValue` | class |  |  | 5 | 0 |  |
| `FilterKeyValueCollection` | class |  |  | 3 | 0 |  |
| `FilterKeyValueCollections` | class |  |  | 4 | 0 |  |
| `FilterObject` | class |  |  | 23 | 4 |  |
| `FilterParameter` | class |  | `java.io.Serializable` | 29 | 0 |  |
| `FilterResult` | class |  |  | 7 | 0 |  |
| `FilterRow` | class |  |  | 20 | 1 |  |
| `FilterScheme` | class |  |  | 35 | 0 |  |
| `FilterScriptBuilder` | class |  |  | 6 | 0 |  |
| `IConditionVariableAnalysis` | interface |  |  | 2 | 0 |  |
| `IFilterValueSetter` | interface |  |  | 2 | 0 |  |
| `LogicOperate` | enum |  |  | 2 | 2 |  |

### `kd.bos.entity.flex`

Path prefix: `javadoc/kd/bos/entity/flex/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `FlexBDValueCondition` | class |  |  | 7 | 0 |  |
| `FlexEntireData` | class |  |  | 10 | 0 |  |
| `FlexEntityMetaUtils` | class |  |  | 12 | 0 |  |
| `FlexProperty` | class |  | `java.io.Serializable` | 46 | 0 |  |
| `FlexType` | class | `ClrDataEntity` |  | 21 | 0 |  |

### `kd.bos.entity.formula`

Path prefix: `javadoc/kd/bos/entity/formula/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `BOSExpression` | class |  |  | 8 | 0 |  |
| `ExpressionContext` | interface |  |  | 3 | 0 |  |
| `RowDataModel` | class |  |  | 17 | 0 |  |

### `kd.bos.entity.list`

Path prefix: `javadoc/kd/bos/entity/list/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `FormatFieldData` | class |  |  | 4 | 0 |  |
| `FormatRowData` | class | `java.util.ArrayList` |  | 6 | 0 |  |
| `IListDataProvider` | interface |  | `kd.bos.entity.list.IListDataProviderContext` | 8 | 0 |  |
| `IQuery` | interface |  |  | 7 | 0 |  |
| `JoinEntity` | class |  | `java.io.Serializable` | 10 | 0 |  |
| `JoinProperty` | class | `kd.bos.entity.property.BasedataProp` |  | 6 | 0 |  |
| `QueryBuilder` | class | `kd.bos.entity.AbstractQueryBuilder` |  | 27 | 0 | yes |
| `QueryResult` | class |  |  | 12 | 0 |  |
| `SummaryResult` | class |  | `java.io.Serializable` | 11 | 0 |  |

### `kd.bos.entity.list.column`

Path prefix: `javadoc/kd/bos/entity/list/column/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `AbstractColumnDesc` | class |  | `java.io.Serializable` | 15 | 2 |  |
| `AdminDivisionColumnDesc` | class | `kd.bos.entity.list.column.ColumnDesc` |  | 4 | 0 |  |
| `AmountColumnDesc` | class | `kd.bos.entity.list.column.NumberColumnDesc` |  | 8 | 0 |  |
| `ApproverColumnDesc` | class | `kd.bos.entity.list.column.AbstractColumnDesc` |  | 6 | 0 |  |
| `BaseDataColumnDesc` | class | `kd.bos.entity.list.column.ColumnDesc` |  | 4 | 0 |  |
| `BaseDataRefColumnDesc` | class | `kd.bos.entity.list.column.BaseDataColumnDesc` |  | 2 | 0 |  |
| `BigIntColumnDesc` | class | `kd.bos.entity.list.column.IntegerColumnDesc` |  | 2 | 0 |  |
| `BooleanColumnDesc` | class | `kd.bos.entity.list.column.ColumnDesc` |  | 8 | 0 |  |
| `ColumnDesc` | class | `kd.bos.entity.list.column.AbstractColumnDesc` |  | 9 | 4 |  |
| `ComboColumnDesc` | class | `kd.bos.entity.list.column.ColumnDesc` |  | 5 | 0 | yes |
| `ControlColumnDesc` | class | `kd.bos.entity.list.column.ColumnDesc` |  | 2 | 0 |  |
| `DateColumnDesc` | class | `kd.bos.entity.list.column.DateTimeColumnDesc` |  | 6 | 0 |  |
| `DateTimeColumnDesc` | class | `kd.bos.entity.list.column.ColumnDesc` |  | 4 | 0 |  |
| `DecimalColumnDesc` | class | `kd.bos.entity.list.column.NumberColumnDesc` |  | 7 | 0 |  |
| `DynamicTextColumnDesc` | class | `kd.bos.entity.list.column.AbstractColumnDesc` |  | 4 | 0 |  |
| `ExchangeRateColumnDesc` | class | `kd.bos.entity.list.column.DecimalColumnDesc` |  | 2 | 0 |  |
| `FlexColumnDesc` | class | `kd.bos.entity.list.column.ColumnDesc` |  | 3 | 0 |  |
| `IntegerColumnDesc` | class | `kd.bos.entity.list.column.NumberColumnDesc` |  | 5 | 0 |  |
| `ItemClassColumnDesc` | class | `kd.bos.entity.list.column.ColumnDesc` |  | 2 | 0 |  |
| `MulBaseDataColumnDesc` | class | `kd.bos.entity.list.column.BaseDataColumnDesc` |  | 2 | 0 |  |
| `MuliLangTextColumnDesc` | class | `kd.bos.entity.list.column.ColumnDesc` |  | 2 | 0 |  |
| `NumberColumnDesc` | class | `kd.bos.entity.list.column.ColumnDesc` |  | 7 | 1 |  |
| `PKColumnDesc` | class | `kd.bos.entity.list.column.ColumnDesc` |  | 2 | 0 |  |
| `QtyColumnDesc` | class | `kd.bos.entity.list.column.DecimalColumnDesc` |  | 3 | 0 |  |
| `RefBillColumnDesc` | class | `kd.bos.entity.list.column.ColumnDesc` |  | 4 | 0 |  |
| `TextColumnDesc` | class | `kd.bos.entity.list.column.ColumnDesc` |  | 2 | 0 |  |
| `TimeColumnDesc` | class | `kd.bos.entity.list.column.ColumnDesc` |  | 6 | 0 |  |

### `kd.bos.entity.list.events`

Path prefix: `javadoc/kd/bos/entity/list/events/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `BeforePackageDataListener` | interface |  |  | 1 | 0 |  |
| `CreateListOperationColumnEvent` | class | `java.util.EventObject` |  | 4 | 0 |  |
| `CreateListTemplateTextColumnEvent` | class | `java.util.EventObject` |  | 4 | 0 |  |

### `kd.bos.entity.operate`

Path prefix: `javadoc/kd/bos/entity/operate/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `EnumBillStatus` | enum |  |  | 0 | 5 |  |
| `IEntityOperate` | interface |  |  | 4 | 0 |  |
| `KDOpAsynExecutorException` | class | `KDInteractionException` |  | 1 | 0 |  |
| `OperationException` | class | `java.lang.RuntimeException` | `java.io.Serializable` | 6 | 5 |  |
| `AbstractOperationResult` | class |  | `kd.bos.entity.operate.IOperationResult`, `java.io.Serializable` | 33 | 1 |  |
| `IOperationResult` | interface |  |  | 9 | 0 |  |
| `OperateOptionConst` | class |  |  | 0 | 52 |  |
| `OperationContext` | class |  |  | 12 | 1 |  |
| `OperationParameterNames` | class |  |  | 0 | 59 |  |
| `Operations` | class |  |  | 14 | 0 |  |

### `kd.bos.entity.operate.bizrule`

Path prefix: `javadoc/kd/bos/entity/operate/bizrule/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `AbstractOpBizRuleAction` | class | `kd.bos.entity.plugin.AbstractOperationServicePlugIn` |  | 2 | 0 |  |
| `OpBizRule` | class |  |  | 13 | 0 |  |

### `kd.bos.entity.operate.bizrule.asyncbizrule`

Path prefix: `javadoc/kd/bos/entity/operate/bizrule/asyncbizrule/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `AbstractAsyncMService` | class |  | `kd.bos.entity.operate.bizrule.asyncbizrule.IAsyncMService` | 6 | 0 |  |
| `AbstractAsyncOpBizRuleAction` | class | `kd.bos.entity.operate.bizrule.AbstractOpBizRuleAction` |  | 5 | 0 |  |

### `kd.bos.entity.operate.interaction`

Path prefix: `javadoc/kd/bos/entity/operate/interaction/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `InteractionConfirmResult` | class |  |  | 4 | 0 |  |
| `InteractionContext` | class |  | `java.io.Serializable` | 10 | 0 |  |
| `KDInteractionException` | class | `KDBizException` |  | 3 | 0 |  |

### `kd.bos.entity.operate.result`

Path prefix: `javadoc/kd/bos/entity/operate/result/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `IOperateInfo` | interface |  |  | 3 | 0 |  |
| `OperateErrorInfo` | class | `kd.bos.entity.operate.result.OperateInfo` | `java.io.Serializable` | 12 | 3 |  |
| `OperateInfo` | class |  | `kd.bos.entity.operate.result.IOperateInfo`, `java.io.Serializable` | 21 | 11 |  |
| `OperateResultInfo` | class | `kd.bos.entity.operate.result.OperateInfo` | `java.io.Serializable` | 11 | 0 |  |
| `OperationResult` | class | `kd.bos.entity.operate.AbstractOperationResult` | `kd.bos.entity.operate.interaction.IInteractionRequest`, `java.io.Serializable` | 20 | 0 |  |

### `kd.bos.entity.param`

Path prefix: `javadoc/kd/bos/entity/param/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `AppCustomParam` | class |  | `java.io.Serializable` | 8 | 0 |  |
| `AppParam` | class |  |  | 28 | 0 |  |
| `BillParam` | class |  | `java.io.Serializable` | 7 | 0 |  |
| `CustomParam` | class |  | `java.io.Serializable` | 6 | 0 |  |
| `FuzzySearch` | class |  |  | 13 | 1 | yes |
| `MobileListF7Config` | class |  |  | 10 | 0 |  |
| `OverallParam` | class |  |  | 3 | 0 |  |
| `ParamKey` | class |  |  | 6 | 0 |  |
| `ParamOperationResult` | class |  |  | 7 | 0 |  |
| `ParamPublishObject` | class |  |  | 16 | 0 |  |
| `ParamRow` | class |  |  | 11 | 0 |  |
| `ShowColumn` | class |  | `java.io.Serializable` | 13 | 0 |  |

### `kd.bos.entity.plugin`

Path prefix: `javadoc/kd/bos/entity/plugin/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `AbstractDataModelPlugin` | class |  | `kd.bos.entity.datamodel.events.IDataModelListener`, `kd.bos.entity.datamodel.events.IDataModelChangeListener` | 0 | 0 |  |
| `AbstractOperationServicePlugIn` | class |  | `kd.bos.entity.plugin.IOperationServicePlugIn`, `kd.bos.entity.plugin.IOperationService` | 11 | 7 |  |
| `AddValidatorsEventArgs` | class |  |  | 4 | 0 |  |
| `IAuditLogFieldExtPlugin` | interface |  |  | 2 | 0 |  |
| `IOperationService` | interface |  |  | 6 | 0 |  |
| `IOperationServicePlugIn` | interface |  |  | 19 | 0 |  |
| `Plugin` | class |  | `java.io.Serializable` | 29 | 5 |  |
| `PreparePropertysEventArgs` | class |  |  | 3 | 0 |  |

### `kd.bos.entity.plugin.args`

Path prefix: `javadoc/kd/bos/entity/plugin/args/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `AfterOperationArgs` | class | `kd.bos.entity.plugin.args.OperationArgs` |  | 3 | 0 |  |
| `BeforeOperationArgs` | class | `kd.bos.entity.plugin.args.OperationArgs` |  | 5 | 0 |  |
| `BeforeSaveAuditLogArg` | class |  |  | 2 | 0 |  |
| `BeforeSaveAuditLogEvent` | class | `kd.bos.entity.plugin.args.OperationArgs` |  | 6 | 0 | yes |
| `BeginOperationTransactionArgs` | class | `kd.bos.entity.plugin.args.OperationArgs` |  | 5 | 0 |  |
| `EndOperationTransactionArgs` | class | `kd.bos.entity.plugin.args.OperationArgs` |  | 2 | 0 |  |
| `GetMonitorAppIdArgs` | class |  |  | 2 | 0 | yes |
| `InitOperationArgs` | class |  |  | 0 | 0 |  |
| `OperationArgs` | class |  |  | 2 | 0 |  |
| `ReturnOperationArgs` | class |  |  | 2 | 0 |  |
| `RollbackOperationArgs` | class |  |  | 2 | 0 |  |
| `SensitiveArgs` | class | `java.util.EventObject` |  | 11 | 0 |  |
| `ValidatePrefixArgs` | class |  |  | 2 | 0 |  |

### `kd.bos.entity.property`

Path prefix: `javadoc/kd/bos/entity/property/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `AttachmentCountProp` | class | `IntegerProp` |  | 0 | 0 |  |
| `AttachmentProp` | class | `MulBasedataProp` |  | 12 | 0 |  |
| `IconProp` | class | `FieldProp` |  | 1 | 0 |  |
| `PictureProp` | class | `FieldProp` |  | 9 | 0 |  |
| `PrintTimeProp` | class | `DateTimeProp` |  | 0 | 0 |  |
| `PrintUserProp` | class | `UserProp` |  | 0 | 0 |  |

### `kd.bos.entity.property.org`

Path prefix: `javadoc/kd/bos/entity/property/org/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `OrgRelationConfig` | class |  | `java.io.Serializable` | 10 | 0 |  |
| `OrgRelationItem` | class |  | `java.io.Serializable` | 8 | 0 |  |
| `OrgRelationItemDirect` | class |  | `java.io.Serializable` | 4 | 0 |  |
| `OrgRelationItemOrg` | class |  | `java.io.Serializable` | 8 | 0 |  |
| `OrgRelationItemType` | class |  | `java.io.Serializable` | 12 | 0 |  |
| `OrgViewSchemeProp` | class |  | `java.io.Serializable` | 6 | 0 |  |

### `kd.bos.entity.rule`

Path prefix: `javadoc/kd/bos/entity/rule/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `BRErrorCode` | class |  |  | 1 | 5 |  |
| `FormVariable` | class |  | `java.io.Serializable` | 8 | 0 | yes |

### `kd.bos.entity.tree`

Path prefix: `javadoc/kd/bos/entity/tree/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `TreeMenuNode` | class |  | `java.io.Serializable` | 27 | 1 |  |
| `TreeNode` | class |  | `java.io.Serializable` | 61 | 1 |  |
| `TreeNodePartialVariables` | class |  | `java.io.Serializable` | 22 | 0 |  |

### `kd.bos.entity.userconfig`

Path prefix: `javadoc/kd/bos/entity/userconfig/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `UserConfig` | class |  | `java.io.Serializable` | 10 | 0 |  |

### `kd.bos.entity.validate`

Path prefix: `javadoc/kd/bos/entity/validate/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `AbstractValidator` | class |  |  | 50 | 7 |  |
| `BillStatus` | enum |  |  | 1 | 5 |  |
| `ErrorLevel` | enum |  |  | 2 | 4 |  |
| `GroupFieldsUniqueValidateResult` | class | `kd.bos.entity.validate.ValidateResult` | `java.io.Serializable` | 6 | 0 |  |
| `IScopeCheck` | interface |  |  | 3 | 0 |  |
| `IValidatorHanlder` | interface |  |  | 3 | 0 |  |
| `RequiredValidator` | class | `kd.bos.entity.validate.SingleFieldValidator` |  | 6 | 0 |  |
| `ValidateContext` | class |  |  | 38 | 5 |  |
| `ValidatePriority` | enum |  |  | 2 | 3 |  |
| `ValidateResult` | class | `kd.bos.entity.operate.AbstractOperationResult` | `java.io.Serializable` | 4 | 0 |  |
| `ValidateResultCollection` | class |  | `java.io.Serializable` | 13 | 0 |  |
| `ValidationErrorInfo` | class | `kd.bos.entity.operate.result.OperateErrorInfo` | `java.io.Serializable` | 6 | 0 |  |

### `kd.bos.event`

Path prefix: `javadoc/kd/bos/event/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `AfterQueryEvent` | class |  |  | 5 | 0 |  |
| `EventArgs` | class |  |  | 0 | 0 |  |
| `ReportQueryExtEvent` | class |  |  | 6 | 0 |  |

### `kd.bos.export`

Path prefix: `javadoc/kd/bos/export/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `IExportExcelOperate` | interface |  |  | 3 | 0 |  |

### `kd.bos.filter`

Path prefix: `javadoc/kd/bos/filter/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `AbstractFilterGridView` | class | `Container` | `kd.bos.filter.IFilterGridView` | 10 | 1 |  |
| `CommonBaseDataFilterColumn` | class | `kd.bos.filter.CommonFilterColumn` |  | 5 | 0 |  |
| `CommonCheckBoxFilterColumn` | class | `kd.bos.filter.CommonFilterColumn` |  | 3 | 0 |  |
| `CommonCheckBoxGroupFilterColumn` | class | `kd.bos.filter.CommonFilterColumn` |  | 11 | 0 |  |
| `CommonDateFilterColumn` | class | `kd.bos.filter.CommonFilterColumn` |  | 9 | 0 |  |
| `CommonFilterColumn` | class | `kd.bos.filter.FilterColumn` |  | 30 | 0 |  |
| `CustomBaseDataFilterColumn` | class | `kd.bos.filter.CommonFilterColumn` |  | 9 | 0 |  |
| `CustomBaseDataSchemeFilterColumn` | class | `kd.bos.filter.SchemeFilterColumn` |  | 12 | 0 |  |
| `CustomNumberFilterColumn` | class | `kd.bos.filter.SchemeFilterColumn` |  | 1 | 0 |  |
| `CustomOrgFilterColumn` | class | `kd.bos.filter.CustomBaseDataFilterColumn` |  | 6 | 0 |  |
| `CustomOrgSchemeFilterColumn` | class | `kd.bos.filter.CustomBaseDataSchemeFilterColumn` |  | 6 | 0 |  |
| `DependField` | class |  |  | 8 | 0 |  |
| `FastSearchGridView` | class | `kd.bos.filter.AbstractFilterGridView` |  | 2 | 0 |  |
| `FilterColumn` | class | `Container` |  | 31 | 1 |  |
| `FilterContainer` | class | `Container` | `kd.bos.filter.IFilterControlCache` | 52 | 0 |  |
| `FilterGridView` | class | `kd.bos.filter.AbstractFilterGridView` |  | 16 | 0 |  |
| `FilterModel` | class |  |  | 42 | 0 |  |
| `SchemeBaseDataFilterColumn` | class | `kd.bos.filter.SchemeFilterColumn` |  | 5 | 0 |  |
| `SchemeFilterColumn` | class | `kd.bos.filter.FilterColumn` |  | 14 | 0 |  |
| `SchemeFilterView` | class | `kd.bos.filter.AbstractFilterGridView` |  | 3 | 0 |  |
| `FilterContainerFilterValues` | class |  |  | 14 | 0 |  |
| `FilterSchemeService` | class |  |  | 2 | 0 |  |
| `ICustomController` | interface |  |  | 1 | 0 |  |

### `kd.bos.filter.events`

Path prefix: `javadoc/kd/bos/filter/events/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `SetFilterContainerBaseDataSearchClosedEvent` | class | `java.util.EventObject` |  | 3 | 0 |  |

### `kd.bos.filter.helper`

Path prefix: `javadoc/kd/bos/filter/helper/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `BaseDataSearchHelper` | class |  |  | 8 | 1 |  |
| `QueryLookUpdataParameter` | class |  |  | 14 | 0 |  |

### `kd.bos.filter.mcontrol`

Path prefix: `javadoc/kd/bos/filter/mcontrol/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `MobCommonBaseDataFilterColumn` | class | `kd.bos.filter.CommonBaseDataFilterColumn` |  | 4 | 0 |  |
| `MobCommonDateFilterColumn` | class | `kd.bos.filter.CommonDateFilterColumn` |  | 2 | 0 |  |
| `MobCommonFilterColumn` | class | `kd.bos.filter.CommonFilterColumn` |  | 1 | 0 |  |
| `MobFilterSort` | class | `Container` | `kd.bos.filter.IFilterControlCache` | 30 | 0 |  |
| `MobSortColumn` | class | `Control` |  | 17 | 0 |  |

### `kd.bos.flex`

Path prefix: `javadoc/kd/bos/flex/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `FlexService` | class |  |  | 9 | 0 |  |

### `kd.bos.form`

Path prefix: `javadoc/kd/bos/form/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `ShowFormHelper` | class |  |  | 2 | 0 |  |
| `SingleOrgContextHelper` | class |  |  | 14 | 0 | yes |
| `AbstractFormView` | class |  | `kd.bos.form.IFormView` | 88 | 10 |  |
| `AnimationType` | enum |  |  | 0 | 4 |  |
| `BindingContext` | class |  |  | 16 | 0 |  |
| `ClientActions` | class |  |  | 10 | 134 | yes |
| `ClientMethod` | enum |  |  | 1 | 5 |  |
| `ClientMethodResult` | class |  |  | 6 | 0 |  |
| `CloseCallBack` | class |  | `java.io.Serializable` | 9 | 0 |  |
| `CloseCallBackWraper` | class |  | `java.io.Serializable` | 12 | 0 |  |
| `ColorUtils` | class |  |  | 8 | 0 |  |
| `ConfirmCallBackListener` | class |  | `kd.bos.form.IConfirmCallBack`, `java.io.Serializable` | 5 | 0 |  |
| `ConfirmTypes` | enum |  |  | 1 | 5 |  |
| `ControlTypes` | class |  |  | 9 | 0 |  |
| `CoreShowFormHelper` | class |  |  | 2 | 0 |  |
| `CtsyFormShowParameter` | class | `kd.bos.form.FormShowParameter` | `kd.bos.form.ICtsyShowParameter` | 10 | 0 |  |
| `FieldTip` | class |  |  | 15 | 0 |  |
| `FloatingDirection` | enum |  |  | 1 | 12 |  |
| `FormConfig` | class |  | `java.io.Serializable` | 73 | 0 | yes |
| `FormMetadataCache` | class |  |  | 13 | 0 |  |
| `FormShowParameter` | class |  | `java.io.Serializable` | 65 | 7 |  |
| `FormShowParameterNames` | class |  |  | 0 | 7 |  |
| `IClientViewProxy` | interface |  |  | 64 | 2 |  |
| `ICloseCallBack` | interface |  |  | 1 | 0 |  |
| `IConfirmCallBack` | interface |  |  | 3 | 0 |  |
| `ICtsyShowParameter` | interface |  |  | 2 | 0 |  |
| `IFormUserConfig` | interface |  |  | 2 | 0 |  |
| `IFormView` | interface |  |  | 95 | 0 |  |
| `IMobileView` | interface |  | `kd.bos.form.IFormView` | 7 | 0 |  |
| `IPageCache` | interface |  |  | 15 | 0 |  |
| `ITipsSupport` | interface |  |  | 3 | 0 |  |
| `ListVisible` | enum |  |  | 1 | 4 |  |
| `MessageBoxLink` | class |  | `java.io.Serializable` | 8 | 0 |  |
| `MessageBoxOptions` | enum |  |  | 1 | 9 |  |
| `MessageBoxResult` | enum |  |  | 2 | 9 |  |
| `MessageTypes` | enum |  |  | 1 | 7 |  |
| `MobileFormShowParameter` | class | `kd.bos.form.FormShowParameter` |  | 3 | 0 |  |
| `OpenStyle` | class |  | `java.io.Serializable` | 17 | 0 |  |
| `OperateParameter` | class |  |  | 5 | 0 |  |
| `ShowType` | enum |  |  | 2 | 17 |  |
| `SignCallbackLisenter` | interface |  | `java.io.Serializable` | 1 | 0 |  |
| `StyleCss` | class |  | `java.io.Serializable` | 8 | 0 |  |
| `TipsSupport` | class | `kd.bos.form.control.Control` | `kd.bos.form.ITipsSupport` | 3 | 0 |  |

### `kd.bos.form.attachment.util`

Path prefix: `javadoc/kd/bos/form/attachment/util/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `AttachmentControlUtil` | class |  |  | 4 | 0 |  |

### `kd.bos.form.builder`

Path prefix: `javadoc/kd/bos/form/builder/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `ListCellStyleBuilder` | class | `kd.bos.form.builder.StyleActionBuilder` |  | 2 | 0 |  |

### `kd.bos.form.cardentry`

Path prefix: `javadoc/kd/bos/form/cardentry/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `CardEntry` | class | `kd.bos.form.control.EntryGrid` |  | 19 | 0 |  |

### `kd.bos.form.chart`

Path prefix: `javadoc/kd/bos/form/chart/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `Axis` | class |  |  | 18 | 0 |  |
| `AxisType` | enum |  |  | 0 | 3 |  |
| `BarChart` | class | `kd.bos.form.chart.Chart` |  | 4 | 0 |  |
| `BarSeries` | class | `kd.bos.form.chart.Series` |  | 7 | 0 |  |
| `BaseGraphicStyle` | class |  |  | 2 | 0 |  |
| `BaseGraphicType` | class |  |  | 8 | 0 |  |
| `Chart` | class | `kd.bos.form.control.Control` | `kd.bos.form.control.events.ISuportClick` | 44 | 2 |  |
| `ChartData` | class |  |  | 14 | 0 |  |
| `ChartType` | enum |  |  | 0 | 5 |  |
| `CustomChart` | class | `kd.bos.form.chart.Chart` |  | 0 | 0 |  |
| `GaugeChart` | class | `kd.bos.form.chart.Chart` |  | 1 | 0 |  |
| `GaugeSeries` | class | `kd.bos.form.chart.Series` |  | 3 | 0 |  |
| `GradientItem` | class |  |  | 4 | 0 |  |
| `HistogramChart` | class | `kd.bos.form.chart.Chart` |  | 4 | 0 |  |
| `ItemValue` | class |  |  | 9 | 0 |  |
| `Label` | class |  | `java.io.Serializable` | 62 | 0 |  |
| `LineSeries` | class | `kd.bos.form.chart.Series` |  | 12 | 0 |  |
| `PieChart` | class | `kd.bos.form.chart.Chart` |  | 1 | 0 |  |
| `PieSeries` | class | `kd.bos.form.chart.Series` |  | 9 | 0 |  |
| `PointLineChart` | class | `kd.bos.form.chart.Chart` |  | 1 | 0 |  |
| `PolygonGraphicShape` | class |  |  | 2 | 0 |  |
| `PolygonGraphicStyle` | class | `kd.bos.form.chart.BaseGraphicStyle` |  | 12 | 0 |  |
| `PolygonGraphicType` | class | `kd.bos.form.chart.BaseGraphicType` |  | 5 | 0 |  |
| `Position` | enum |  |  | 0 | 13 |  |
| `RoseType` | enum |  |  | 0 | 2 |  |
| `Series` | class |  |  | 21 | 1 |  |
| `TextGraphicStyle` | class | `kd.bos.form.chart.BaseGraphicStyle` |  | 2 | 0 |  |
| `TextGraphicType` | class | `kd.bos.form.chart.BaseGraphicType` |  | 3 | 0 |  |
| `XAlign` | enum |  |  | 0 | 3 |  |
| `YAlign` | enum |  |  | 0 | 3 |  |

### `kd.bos.form.chart.radar`

Path prefix: `javadoc/kd/bos/form/chart/radar/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `RadarAxis` | class |  |  | 21 | 0 |  |
| `RadarChart` | class | `kd.bos.form.chart.Chart` |  | 7 | 1 |  |
| `RadarChartData` | class | `kd.bos.form.chart.ChartData` |  | 8 | 0 |  |
| `RadarData` | class |  |  | 9 | 0 |  |
| `RadarIndicator` | class |  |  | 6 | 0 |  |
| `RadarSeries` | class | `kd.bos.form.chart.Series` |  | 2 | 0 |  |

### `kd.bos.form.container`

Path prefix: `javadoc/kd/bos/form/container/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `AdvContainer` | class | `kd.bos.form.container.Container` |  | 0 | 0 |  |
| `Container` | class | `kd.bos.form.TipsSupport` | `kd.bos.form.control.events.ISuportClick` | 24 | 1 |  |
| `FormRoot` | class | `kd.bos.form.container.Container` |  | 6 | 0 |  |
| `LayoutFlex` | class | `kd.bos.form.container.Container` |  | 0 | 0 |  |
| `Tab` | class | `kd.bos.form.container.Container` |  | 20 | 5 |  |
| `TabPage` | class | `kd.bos.form.container.Container` |  | 3 | 0 |  |
| `Wizard` | class | `kd.bos.form.container.Container` |  | 7 | 0 |  |

### `kd.bos.form.control`

Path prefix: `javadoc/kd/bos/form/control/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `QingAnalysis` | class | `IFrame` | `kd.bos.form.control.IQingAnalysis`, `kd.bos.qing.IQingControl` | 24 | 0 |  |
| `AttachmentPanel` | class | `TipsSupport` |  | 19 | 8 |  |
| `Image` | class | `Button` |  | 1 | 0 |  |
| `ImageList` | class | `Container` |  | 2 | 2 |  |

### `kd.bos.form.control.embedform`

Path prefix: `javadoc/kd/bos/form/control/embedform/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `BeforeShowEmbedFormEvent` | class | `java.util.EventObject` |  | 5 | 0 |  |
| `EmbedForm` | class | `kd.bos.form.container.Container` |  | 34 | 13 |  |
| `EmbedFormListener` | interface |  |  | 1 | 0 |  |
| `EmbedFormShowParamItem` | class |  |  | 6 | 2 |  |

### `kd.bos.form.control.events`

Path prefix: `javadoc/kd/bos/form/control/events/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `BaseDataColumnDependFieldSetEvent` | class | `java.util.EventObject` |  | 3 | 0 |  |
| `BaseDataColumnDependFieldSetListener` | interface |  |  | 1 | 0 |  |
| `FilterContainerInitEvent` | class | `java.util.EventObject` |  | 9 | 0 | yes |
| `FilterContainerInitListener` | interface |  |  | 1 | 0 |  |
| `MobFilterSortInitEvent` | class | `java.util.EventObject` |  | 8 | 0 |  |
| `MobFilterSortInitListener` | interface |  |  | 1 | 0 |  |
| `MobileSearchInitEvent` | class | `java.util.EventObject` |  | 3 | 0 |  |
| `MobileSearchInitListener` | interface |  |  | 1 | 0 |  |
| `BeforeUploadEvent` | class | `java.util.EventObject` |  | 1 | 0 |  |
| `UploadEvent` | class | `java.util.EventObject` |  | 9 | 0 |  |
| `UploadListener` | interface |  |  | 6 | 0 |  |

### `kd.bos.form.control.events.webOffice`

Path prefix: `javadoc/kd/bos/form/control/events/webOffice/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `WebOfficeDataListener` | interface |  |  | 8 | 0 |  |

### `kd.bos.form.control.grid`

Path prefix: `javadoc/kd/bos/form/control/grid/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `DataGrid` | class | `kd.bos.form.container.Container` |  | 17 | 1 |  |
| `DataGridRow` | class |  |  | 3 | 0 |  |
| `DataGridRowBuilder` | class |  |  | 2 | 0 |  |

### `kd.bos.form.control.grid.column`

Path prefix: `javadoc/kd/bos/form/control/grid/column/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `AmountDataGridColumn` | class | `kd.bos.form.control.grid.column.DataGridColumn` |  | 7 | 0 |  |
| `DataGridColumn` | class | `kd.bos.form.control.Control` | `kd.bos.form.control.grid.column.IDataGridColumn` | 17 | 0 |  |
| `DateDataGridColumn` | class | `kd.bos.form.control.grid.column.DataGridColumn` |  | 3 | 0 |  |
| `DecimalDataGridColumn` | class | `kd.bos.form.control.grid.column.DataGridColumn` |  | 7 | 0 |  |
| `IntegerDataGridColumn` | class | `kd.bos.form.control.grid.column.DecimalDataGridColumn` |  | 1 | 0 |  |
| `OperationDataGridColumn` | class | `kd.bos.form.control.grid.column.DataGridColumn` |  | 3 | 0 |  |
| `PictureDataGridColumn` | class | `kd.bos.form.control.grid.column.DataGridColumn` |  | 1 | 0 |  |
| `TextDataGridColumn` | class | `kd.bos.form.control.grid.column.DataGridColumn` |  | 1 | 0 |  |
| `TimeDataGridColumn` | class | `kd.bos.form.control.grid.column.DataGridColumn` |  | 3 | 0 |  |

### `kd.bos.form.control.grid.events`

Path prefix: `javadoc/kd/bos/form/control/grid/events/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `DataGridBindDataEvent` | class | `java.util.EventObject` |  | 7 | 0 |  |
| `DataGridBindDataListener` | interface |  |  | 1 | 0 |  |

### `kd.bos.form.control.qrcode`

Path prefix: `javadoc/kd/bos/form/control/qrcode/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `QRCodeEvent` | class | `java.util.EventObject` |  | 4 | 0 | yes |
| `QRCodeListener` | interface |  |  | 1 | 0 |  |
| `QRCodeOption` | class |  |  | 6 | 0 | yes |
| `QRCodeStatus` | enum |  |  | 3 | 5 | yes |

### `kd.bos.form.events`

Path prefix: `javadoc/kd/bos/form/events/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `BeforeCreateListColumnsArgs` | class | `java.util.EventObject` |  | 17 | 0 |  |
| `FilterColumnSetFilterEvent` | class | `kd.bos.form.events.SetFilterEvent` |  | 2 | 0 |  |
| `FilterContainerInitArgs` | class |  |  | 8 | 0 |  |
| `MobFilterSortInitArgs` | class |  |  | 8 | 0 |  |
| `SetFilterEvent` | class | `java.util.EventObject` |  | 23 | 0 |  |
| `SetFilterListener` | interface |  |  | 1 | 0 |  |
| `AddCustomViewEvent` | class | `java.util.EventObject` |  | 4 | 0 |  |
| `AfterBindDataEvent` | class | `java.util.EventObject` |  | 1 | 0 |  |
| `AfterBindDataListener` | interface |  |  | 1 | 0 |  |
| `AfterDoOperationEventArgs` | class | `java.util.EventObject` |  | 5 | 0 |  |
| `AfterMobileListPushDownRefreshEvent` | class | `java.util.EventObject` |  | 1 | 0 |  |
| `AfterMobileListPushDownRefreshListener` | interface |  |  | 1 | 0 |  |
| `AfterQueryOfExportEvent` | class | `java.util.EventObject` |  | 6 | 0 |  |
| `BeforeBindDataEvent` | class | `java.util.EventObject` |  | 1 | 0 |  |
| `BeforeBindDataListener` | interface |  |  | 1 | 0 |  |
| `BeforeBuildTreeNodeEvent` | class | `java.util.EventObject` |  | 3 | 1 |  |
| `BeforeClosedEvent` | class | `java.util.EventObject` |  | 7 | 0 |  |
| `BeforeCreateListDataProviderArgs` | class | `java.util.EventObject` |  | 3 | 0 |  |
| `BeforeDoCheckDataPermissionArgs` | class | `java.util.EventObject` |  | 15 | 0 |  |
| `BeforeDoOperationEventArgs` | class | `java.util.EventObject` |  | 10 | 1 |  |
| `BeforeExportFileEvent` | class | `java.util.EventObject` |  | 6 | 0 |  |
| `BeforeFieldPostBackEvent` | class | `java.util.EventObject` |  | 10 | 0 |  |
| `BeforeQueryOfExportEvent` | class | `java.util.EventObject` |  | 8 | 0 |  |
| `BeforeTreeNodeClickEvent` | class | `java.util.EventObject` |  | 1 | 1 |  |
| `BillListHyperLinkClickEvent` | class | `kd.bos.form.events.HyperLinkClickEvent` |  | 2 | 0 |  |
| `ClientCallBackEvent` | class | `java.util.EventObject` |  | 4 | 0 |  |
| `ClosedCallBackEvent` | class | `java.util.EventObject` |  | 5 | 0 |  |
| `ContextMenuClickEvent` | class | `java.util.EventObject` |  | 3 | 0 |  |
| `CustomEventArgs` | class | `java.util.EventObject` |  | 4 | 0 |  |
| `EntryHyperLinkClickListener` | interface |  |  | 1 | 0 |  |
| `ExportFileEvent` | class | `kd.bos.form.events.BeforeExportFileEvent` |  | 5 | 0 |  |
| `FilterContainerSearchClickArgs` | class |  |  | 19 | 0 |  |
| `FlexBeforeClosedEvent` | class | `java.util.EventObject` |  | 7 | 0 |  |
| `HyperLinkClickArgs` | class |  |  | 7 | 0 |  |
| `HyperLinkClickEvent` | class | `java.util.EventObject` |  | 8 | 0 |  |
| `HyperLinkClickListener` | interface |  |  | 1 | 0 |  |
| `ListColumnCompareTypesSetEvent` | class | `java.util.EventObject` |  | 8 | 0 |  |
| `ListColumnCompareTypesSetListener` | interface |  |  | 1 | 0 |  |
| `LoadCustomControlMetasArgs` | class | `java.util.EventObject` |  | 7 | 0 |  |
| `MessageBoxClosedEvent` | class | `java.util.EventObject` |  | 6 | 0 |  |
| `MobFilterSortSearchClickArgs` | class |  |  | 14 | 0 |  |
| `OnCreateDynamicUIMetasArgs` | class | `java.util.EventObject` |  | 3 | 0 |  |
| `OnGetControlArgs` | class | `java.util.EventObject` |  | 5 | 0 |  |
| `PagerClickEvent` | class | `java.util.EventObject` |  | 6 | 0 |  |
| `PagerClickListener` | interface |  |  | 1 | 0 |  |
| `PreOpenFormEventArgs` | class | `java.util.EventObject` |  | 8 | 0 |  |
| `SumDataLoadOnFirstSetEvent` | class | `java.util.EventObject` |  | 3 | 0 |  |
| `TimeZoneLocationEvent` | class | `java.util.EventObject` |  | 3 | 0 |  |
| `TimerElapsedArgs` | class | `java.util.EventObject` |  | 1 | 0 |  |

### `kd.bos.form.field`

Path prefix: `javadoc/kd/bos/form/field/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `AttachmentEdit` | class | `MulBasedataEdit` |  | 12 | 6 |  |

### `kd.bos.form.field.events`

Path prefix: `javadoc/kd/bos/form/field/events/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `AddFuzzySearchEvent` | class |  | `java.io.Serializable` | 3 | 0 |  |
| `AfterBindingDataEvent` | class | `java.util.EventObject` |  | 8 | 0 |  |
| `AfterChangeMainOrgEventArgs` | class |  |  | 0 | 0 |  |
| `AfterF7SelectEvent` | class | `java.util.EventObject` |  | 14 | 0 |  |
| `AfterF7SelectListener` | interface |  |  | 1 | 0 |  |
| `BaseDataCustomControllerEvent` | class | `java.util.EventObject` |  | 12 | 0 |  |
| `BasedataControllerSourceEnum` | enum |  |  | 0 | 6 |  |
| `BasedataEditListener` | interface |  |  | 1 | 0 |  |
| `BasedataFuzzySearchEvent` | class | `java.util.EventObject` |  | 5 | 0 |  |
| `BasedataFuzzySearchListener` | interface |  |  | 1 | 0 |  |
| `BeforeBasedataSetValueListener` | interface |  |  | 1 | 0 |  |
| `BeforeChangeMainOrgEventArgs` | class |  |  | 4 | 0 |  |
| `BeforeF7SelectEvent` | class | `java.util.EventObject` |  | 14 | 0 |  |
| `BeforeF7SelectListener` | interface |  |  | 1 | 0 |  |
| `BeforeF7ViewDetailEvent` | class | `java.util.EventObject` |  | 8 | 0 |  |
| `BeforeFilterF7SelectEvent` | class |  |  | 26 | 0 |  |
| `BeforeFilterF7SelectListener` | interface |  |  | 1 | 0 |  |
| `BeforeQuickAddNewEvent` | class | `java.util.EventObject` |  | 6 | 0 |  |
| `BeforeQuickAddNewListener` | interface |  |  | 1 | 0 |  |
| `CellTipsClickEvent` | class | `java.util.EventObject` |  | 5 | 0 |  |
| `CellTipsClickListener` | interface |  |  | 1 | 0 |  |
| `DateClickListener` | interface |  |  | 1 | 0 |  |
| `FlexControlMetaPreRenderListener` | interface |  |  | 1 | 0 |  |
| `ListExpandEvent` | class | `java.util.EventObject` |  | 5 | 0 |  |
| `ListExpandListener` | interface |  |  | 1 | 0 |  |
| `MainOrgChangeListener` | interface |  |  | 2 | 0 |  |
| `ResetDateFilterEvent` | class | `java.util.EventObject` |  | 9 | 0 |  |
| `ShowFlexEditEvent` | class | `java.util.EventObject` |  | 8 | 0 |  |
| `ShowFlexEditListener` | interface |  |  | 1 | 0 |  |

### `kd.bos.form.field.format`

Path prefix: `javadoc/kd/bos/form/field/format/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `FieldFormatContext` | class |  |  | 15 | 0 |  |
| `FlexValueFormatter` | class |  |  | 20 | 0 |  |

### `kd.bos.form.fieldtip`

Path prefix: `javadoc/kd/bos/form/fieldtip/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `DeleteRule` | class |  |  | 4 | 0 |  |

### `kd.bos.form.flex`

Path prefix: `javadoc/kd/bos/form/flex/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `FlexValueFormatUtils` | class |  |  | 4 | 0 |  |

### `kd.bos.form.flex.event`

Path prefix: `javadoc/kd/bos/form/flex/event/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `FlexControlMetaPreRenderEvent` | class | `java.util.EventObject` |  | 6 | 0 | yes |

### `kd.bos.form.func`

Path prefix: `javadoc/kd/bos/form/func/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `AbstractFuncParamPlugIn` | class | `AbstractFormPlugin` |  | 7 | 0 |  |
| `FuncSettingHelper` | class |  |  | 8 | 7 |  |

### `kd.bos.form.mcontrol.mobtable`

Path prefix: `javadoc/kd/bos/form/mcontrol/mobtable/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `IMobTableModel` | interface |  |  | 9 | 0 |  |
| `IMobTablePackageDataHandler` | interface |  |  | 4 | 0 |  |
| `MobTable` | class | `kd.bos.form.control.AbstractGrid` |  | 27 | 0 |  |
| `MobTableData` | class |  |  | 4 | 0 |  |
| `MobTablePackageDataHandler` | class |  | `kd.bos.form.mcontrol.mobtable.IMobTablePackageDataHandler` | 5 | 0 |  |
| `MobTableRowBuilder` | class |  |  | 1 | 0 |  |
| `MobTableRowData` | class |  |  | 9 | 0 |  |

### `kd.bos.form.mcontrol.mobtable.events`

Path prefix: `javadoc/kd/bos/form/mcontrol/mobtable/events/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `BeforeCreateMobTableColumnsEvent` | class | `java.util.EventObject` |  | 6 | 0 |  |
| `IBeforeCreateMobTableColumnsListener` | interface |  |  | 1 | 0 |  |
| `IMobTableDataProviderListener` | interface |  |  | 1 | 0 |  |
| `IMobTableHyperLinkClickListener` | interface |  | `kd.bos.form.mcontrol.mobtable.events.IMobTablePrepareDataListener` | 1 | 0 |  |
| `IMobTablePackageDataHandlerListener` | interface |  |  | 1 | 0 |  |
| `MobTableHandleResult` | class |  |  | 10 | 0 |  |
| `MobTablePackageDataHandlerArgs` | class |  |  | 16 | 0 |  |
| `MobTablePackageDataHandlerEvent` | class | `java.util.EventObject` |  | 3 | 0 |  |

### `kd.bos.form.mcontrol.mobtable.tablecolumn`

Path prefix: `javadoc/kd/bos/form/mcontrol/mobtable/tablecolumn/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `AttachmentMobTableColumn` | class | `MobTableColumn` |  | 3 | 0 |  |

### `kd.bos.form.operate`

Path prefix: `javadoc/kd/bos/form/operate/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `EntityOperate` | class | `FormOperate` |  | 6 | 0 |  |
| `MutexHelper` | class |  |  | 25 | 8 |  |
| `AbstractOperate` | class |  |  | 19 | 0 |  |
| `CoreMutexHelper` | class |  |  | 2 | 8 |  |
| `FormOperate` | class | `kd.bos.form.operate.AbstractOperate` |  | 49 | 1 |  |
| `IFormMutexService` | interface |  |  | 7 | 0 |  |
| `IFormOperate` | interface |  |  | 7 | 0 |  |
| `OpFieldValueReader` | interface |  |  | 4 | 0 |  |

### `kd.bos.form.operate.interaction`

Path prefix: `javadoc/kd/bos/form/operate/interaction/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `InteractionCallBackHandler` | class |  | `kd.bos.form.ICloseCallBack` | 1 | 3 |  |

### `kd.bos.form.operate.webapi`

Path prefix: `javadoc/kd/bos/form/operate/webapi/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `AbstractOperateWebApi` | class |  |  | 7 | 3 |  |

### `kd.bos.form.operatecol`

Path prefix: `javadoc/kd/bos/form/operatecol/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `OperationColItem` | class |  | `java.io.Serializable` | 26 | 0 |  |

### `kd.bos.form.spread`

Path prefix: `javadoc/kd/bos/form/spread/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `LookUpDataArgs` | class |  |  | 18 | 0 |  |
| `Spread` | class | `kd.bos.form.container.Container` |  | 2 | 0 |  |
| `SpreadActionAdapter` | class |  | `kd.bos.form.spread.event.ISpreadAction` | 20 | 1 |  |
| `SpreadPostDataInfo` | class |  |  | 26 | 0 |  |

### `kd.bos.form.spread.event`

Path prefix: `javadoc/kd/bos/form/spread/event/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `ISpreadAction` | interface |  |  | 19 | 0 |  |
| `SpreadEvent` | class | `java.util.EventObject` |  | 2 | 0 |  |

### `kd.bos.form.transfer`

Path prefix: `javadoc/kd/bos/form/transfer/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `TransferNode` | class |  |  | 9 | 0 |  |
| `TransferTreeNode` | class | `kd.bos.form.transfer.TransferNode` |  | 11 | 0 |  |

### `kd.bos.form.upgrade`

Path prefix: `javadoc/kd/bos/form/upgrade/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `AbstractUpgradePlugin` | class |  | `kd.bos.form.upgrade.IUpgradePlugin` | 6 | 0 | yes |
| `UpgradeResult` | class |  | `java.io.Serializable` | 11 | 0 |  |

### `kd.bos.form.userguide`

Path prefix: `javadoc/kd/bos/form/userguide/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `GuideItem` | class | `kd.bos.form.container.Container` |  | 2 | 0 |  |
| `GuidePage` | class | `kd.bos.form.container.Container` |  | 4 | 0 |  |

### `kd.bos.form.widget`

Path prefix: `javadoc/kd/bos/form/widget/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `Widget` | class | `kd.bos.form.control.Control` |  | 7 | 0 |  |
| `WidgetContainer` | class | `kd.bos.form.container.Container` |  | 14 | 1 |  |

### `kd.bos.form.widget.events`

Path prefix: `javadoc/kd/bos/form/widget/events/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `WidgetChangedEvent` | class | `java.util.EventObject` |  | 2 | 0 |  |
| `WidgetContainerDesignerListener` | interface |  |  | 1 | 0 |  |

### `kd.bos.list`

Path prefix: `javadoc/kd/bos/list/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `AbstractList` | class | `Control` |  | 3 | 2 |  |
| `AbstractListContainerColumn` | class | `Container` |  | 61 | 0 |  |
| `AbstractTreeListView` | class |  |  | 13 | 4 |  |
| `BillList` | class | `AbstractGrid` |  | 135 | 2 | yes |
| `CardListColumn` | class | `kd.bos.list.ListColumn` |  | 0 | 0 |  |
| `CheckBoxListColumn` | class | `kd.bos.list.ListColumn` |  | 8 | 0 |  |
| `CityList` | class | `kd.bos.list.AbstractList` |  | 8 | 1 |  |
| `ColorPickerListColumn` | class | `kd.bos.list.ListColumn` |  | 3 | 0 | yes |
| `ComboListColumn` | class | `kd.bos.list.ListColumn` |  | 5 | 0 |  |
| `DateListColumn` | class | `kd.bos.list.ListColumn` |  | 7 | 0 |  |
| `DecimalListColumn` | class | `kd.bos.list.ListColumn` |  | 23 | 0 | yes |
| `DynamicTextListColumn` | class | `AbstractListColumn` |  | 14 | 0 |  |
| `F7SelectedList` | class | `kd.bos.list.AbstractList` |  | 7 | 2 |  |
| `ListCardView` | class | `Container` | `kd.bos.list.IListChild` | 16 | 0 |  |
| `ListColumn` | class | `AbstractListColumn` |  | 37 | 2 |  |
| `ListColumnGroup` | class | `Container` |  | 29 | 0 |  |
| `ListGridView` | class | `Container` | `kd.bos.list.IListChild` | 48 | 1 |  |
| `ListOperationColumn` | class | `kd.bos.list.AbstractListContainerColumn` |  | 13 | 0 |  |
| `MergeListColumn` | class | `kd.bos.list.AbstractListContainerColumn` |  | 13 | 0 |  |
| `MobControlContext` | class | `kd.bos.list.ControlContext` |  | 5 | 0 |  |
| `MobF7SelectedList` | class | `kd.bos.list.AbstractList` |  | 3 | 1 |  |
| `MobileSearch` | class | `Container` |  | 29 | 4 |  |
| `MobileTreeList` | class | `kd.bos.list.MobileList` |  | 14 | 0 |  |
| `OrgList` | class | `kd.bos.list.AbstractList` |  | 6 | 0 |  |
| `TemplateTextListColumn` | class | `kd.bos.list.ListColumn` |  | 6 | 0 |  |
| `TimeListColumn` | class | `kd.bos.list.ListColumn` |  | 4 | 0 |  |
| `UserList` | class | `kd.bos.list.AbstractList` |  | 2 | 0 |  |
| `ViewCommonUtil` | class |  |  | 23 | 0 |  |
| `VoucherNoListColumn` | class | `AbstractListColumn` |  | 14 | 0 |  |
| `AbstractListColumn` | class | `kd.bos.form.control.Control` | `kd.bos.list.IListColumn` | 61 | 0 |  |
| `CtsyListShowParameter` | class | `kd.bos.list.ListShowParameter` | `kd.bos.form.ICtsyShowParameter` | 16 | 9 |  |
| `IListColumn` | interface |  | `kd.bos.list.IListColumnConfig` | 33 | 0 |  |
| `IListView` | interface |  | `kd.bos.form.IFormView` | 21 | 0 |  |
| `IMobileListView` | interface |  | `kd.bos.form.IMobileView`, `kd.bos.list.IListView` | 0 | 0 |  |
| `ITreeListView` | interface |  |  | 9 | 0 |  |
| `LinkQueryPkIdCollection` | class | `java.util.ArrayList` |  | 4 | 0 |  |
| `ListColumnCompareType` | class |  | `java.io.Serializable` | 16 | 0 | yes |
| `ListColumnType` | enum |  |  | 1 | 8 |  |
| `ListFieldMeta` | class |  |  | 7 | 0 |  |
| `ListFilterParameter` | class | `FilterParameter` |  | 3 | 0 |  |
| `ListShowParameter` | class | `kd.bos.form.FormShowParameter` |  | 63 | 6 |  |
| `MobileListShowParameter` | class | `kd.bos.list.ListShowParameter` |  | 16 | 1 |  |
| `PageMode` | enum |  |  | 2 | 2 |  |
| `SeqColumnType` | enum |  |  | 1 | 3 |  |

### `kd.bos.list.column`

Path prefix: `javadoc/kd/bos/list/column/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `ComboSearchValue` | class |  | `java.io.Serializable` | 6 | 0 |  |
| `CompareSearchValue` | class | `kd.bos.list.column.ComboSearchValue` |  | 2 | 0 |  |
| `ListColumnComboItem` | class |  | `java.io.Serializable` | 5 | 3 |  |
| `ListColumnCompare` | class | `kd.bos.list.column.ListColumnComboItem` |  | 7 | 0 |  |
| `ListColumnCompareService` | interface |  |  | 5 | 0 |  |
| `ListColumnCompares` | class |  | `java.io.Serializable` | 2 | 0 |  |
| `ListOperationColumnDesc` | class | `ColumnDesc` |  | 6 | 0 |  |
| `TemplateTextItem` | class |  | `java.io.Serializable` | 4 | 0 |  |

### `kd.bos.list.events`

Path prefix: `javadoc/kd/bos/list/events/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `BackPressedEvent` | class | `java.util.EventObject` |  | 3 | 0 |  |
| `BeforeShowBillFormEvent` | class | `java.util.EventObject` |  | 4 | 0 |  |
| `BillClosedCallBackEvent` | class | `java.util.EventObject` |  | 3 | 0 |  |
| `BillListGetEntityTypeListener` | interface |  |  | 1 | 0 |  |
| `BuildTreeListFilterEvent` | class | `java.util.EventObject` |  | 6 | 0 |  |
| `ChatEvent` | class | `java.util.EventObject` |  | 6 | 0 |  |
| `CreateListColumnsListener` | interface |  |  | 1 | 0 |  |
| `CreateListDataProviderListener` | interface |  |  | 1 | 0 |  |
| `CreateTreeListViewEvent` | class | `java.util.EventObject` |  | 3 | 0 |  |
| `F7SelectedListRemoveEvent` | class | `java.util.EventObject` |  | 4 | 0 |  |
| `F7SelectedListRemoveListener` | interface |  |  | 1 | 0 |  |
| `F7SelectedListSortEvent` | class | `java.util.EventObject` |  | 4 | 0 |  |
| `F7SelectedListSortListener` | interface |  |  | 1 | 0 |  |
| `IndexModeSetEvent` | class | `java.util.EventObject` |  | 3 | 0 |  |
| `ItemSelectEvent` | class | `java.util.EventObject` |  | 3 | 0 |  |
| `ListBeforeBindDataEvent` | class | `BeforeBindDataEvent` |  | 5 | 0 |  |
| `ListColumnFilter` | class |  |  | 13 | 0 |  |
| `ListColumnFilterCollection` | class |  |  | 4 | 0 |  |
| `ListHyperLinkClickEvent` | class | `java.util.EventObject` |  | 7 | 0 |  |
| `ListHyperLinkClickListener` | interface |  |  | 1 | 0 |  |
| `ListRowClickEvent` | class | `RowClickEvent` |  | 10 | 0 |  |
| `ListRowClickListener` | interface |  |  | 2 | 0 |  |
| `ListRowDetailShowEvent` | class | `java.util.EventObject` |  | 4 | 0 |  |
| `ListRowFilterEvent` | class | `java.util.EventObject` |  | 5 | 0 |  |
| `ListSelectedListener` | interface |  |  | 5 | 0 |  |
| `MultiFieldsSortEvent` | class | `java.util.EventObject` |  | 4 | 0 |  |
| `QueryBillDataCountEvent` | class | `java.util.EventObject` |  | 7 | 0 |  |
| `QueryBillDataCountListener` | interface |  |  | 1 | 0 |  |
| `QueryExceedMaxCountEvent` | class | `java.util.EventObject` |  | 10 | 0 |  |
| `QueryExceedMaxCountListener` | interface |  |  | 1 | 0 |  |
| `QueryListEvent` | class | `java.util.EventObject` |  | 3 | 0 |  |
| `QueryRealCountEvent` | class | `java.util.EventObject` |  | 7 | 0 |  |
| `QueryRealCountListener` | interface |  |  | 1 | 0 |  |
| `QuerySumDataEvent` | class | `java.util.EventObject` |  | 1 | 0 |  |
| `QuerySumDataListener` | interface |  |  | 1 | 0 |  |
| `SelectEvent` | class | `java.util.EventObject` |  | 3 | 0 |  |
| `SetCellFieldValueArgs` | class |  |  | 6 | 0 |  |
| `SetCellFieldValueEvent` | class | `java.util.EventObject` |  | 8 | 0 |  |
| `SetCellFieldValueListener` | interface |  |  | 1 | 0 |  |
| `DataSelectEvent` | class | `java.util.EventObject` |  | 8 | 0 |  |
| `EndSelectEvent` | class | `java.util.EventObject` |  | 5 | 0 |  |

### `kd.bos.list.plugin`

Path prefix: `javadoc/kd/bos/list/plugin/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `AbstractListPlugin` | class | `AbstractFormPlugin` | `kd.bos.list.events.ListRowClickListener`, `kd.bos.list.plugin.IPCListPlugin` | 30 | 3 |  |
| `AbstractMobListPlugin` | class | `AbstractMobFormPlugin` | `kd.bos.list.events.ListRowClickListener`, `kd.bos.list.plugin.IMobListPlugin` | 9 | 0 |  |
| `AbstractTreeListPlugin` | class | `kd.bos.list.plugin.AbstractListPlugin` | `kd.bos.list.plugin.ITreeListPlugin` | 18 | 1 |  |
| `IListPlugin` | interface |  |  | 20 | 0 |  |
| `IMobListPlugin` | interface |  | `kd.bos.list.plugin.IListPlugin` | 7 | 0 |  |
| `IPCListPlugin` | interface |  | `kd.bos.list.plugin.IListPlugin` | 18 | 0 |  |
| `ITreeListPlugin` | interface |  |  | 11 | 0 |  |
| `StandardTreeListPlugin` | class | `kd.bos.list.plugin.AbstractTreeListPlugin` |  | 17 | 2 |  |

### `kd.bos.metadata`

Path prefix: `javadoc/kd/bos/metadata/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `AbstractElement` | class |  | `kd.bos.metadata.IInheritFlag`, `java.io.Serializable` | 21 | 0 |  |
| `CreateUIElementArgs` | class |  |  | 6 | 0 |  |
| `ICreateUIElement` | interface |  |  | 1 | 0 |  |

### `kd.bos.metadata.balance`

Path prefix: `javadoc/kd/bos/metadata/balance/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `IBalanceField` | interface |  |  | 2 | 0 |  |

### `kd.bos.metadata.dao`

Path prefix: `javadoc/kd/bos/metadata/dao/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `MetaCategory` | enum |  |  | 0 | 2 |  |

### `kd.bos.metadata.entity`

Path prefix: `javadoc/kd/bos/metadata/entity/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `BaseEntity` | class | `kd.bos.metadata.entity.BillEntity` |  | 20 | 0 |  |
| `BillEntity` | class | `kd.bos.metadata.entity.MainEntity` |  | 33 | 0 |  |
| `Entity` | class | `kd.bos.metadata.entity.EntityItem` |  | 15 | 1 |  |
| `EntityItem` | class | `kd.bos.metadata.AbstractElement` |  | 12 | 2 |  |
| `EntityMetadata` | class | `kd.bos.metadata.AbstractMetadata` | `kd.bos.metadata.lang.ResBundleLocalizable` | 49 | 0 |  |
| `EntryEntity` | class | `kd.bos.metadata.entity.Entity` | `kd.bos.metadata.entity.IChildElement` | 28 | 1 |  |
| `ITreeEntryEntity` | interface |  |  | 1 | 0 |  |
| `JsonSubEntryEntity` | class | `kd.bos.metadata.entity.SubEntryEntity` |  | 4 | 0 |  |
| `LinkEntryEntity` | class | `kd.bos.metadata.entity.EntryEntity` |  | 3 | 0 |  |
| `LogBillEntity` | class | `kd.bos.metadata.entity.BillEntity` |  | 2 | 0 |  |
| `MainEntity` | class | `kd.bos.metadata.entity.Entity` |  | 34 | 0 |  |
| `SubEntryEntity` | class | `kd.bos.metadata.entity.EntryEntity` |  | 7 | 0 |  |
| `TreeEntryEntity` | class | `kd.bos.metadata.entity.EntryEntity` | `kd.bos.metadata.entity.ITreeEntryEntity` | 5 | 0 |  |
| `TreeSubEntryEntity` | class | `kd.bos.metadata.entity.SubEntryEntity` | `kd.bos.metadata.entity.ITreeEntryEntity` | 5 | 0 |  |

### `kd.bos.metadata.entity.businessfield`

Path prefix: `javadoc/kd/bos/metadata/entity/businessfield/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `PrintTimeField` | class | `DateTimeField` |  | 3 | 0 |  |
| `PrintUserField` | class | `UserField` |  | 5 | 0 |  |

### `kd.bos.metadata.entity.businessfield.billstatusfield`

Path prefix: `javadoc/kd/bos/metadata/entity/businessfield/billstatusfield/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `StatusItem` | class |  |  | 18 | 1 |  |

### `kd.bos.metadata.entity.commonfield`

Path prefix: `javadoc/kd/bos/metadata/entity/commonfield/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `AttachmentCountField` | class | `IntegerField` |  | 3 | 0 |  |
| `AttachmentField` | class | `MulBasedataField` |  | 13 | 0 |  |
| `IconField` | class | `<any>` |  | 7 | 0 |  |
| `PictureField` | class | `<any>` |  | 17 | 0 |  |

### `kd.bos.metadata.entity.fielddefvalue`

Path prefix: `javadoc/kd/bos/metadata/entity/fielddefvalue/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `AbstractDefValueParamPlugIn` | class | `AbstractFormPlugin` |  | 4 | 0 |  |
| `DefValueDesign` | class |  |  | 4 | 0 |  |

### `kd.bos.metadata.entity.operation`

Path prefix: `javadoc/kd/bos/metadata/entity/operation/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `AbstractOpBizRuleParameterEdit` | class | `AbstractFormPlugin` | `kd.bos.metadata.entity.operation.IOpBizRuleParameterEdit` | 9 | 0 |  |
| `AbstractOpParameterPlugin` | class | `AbstractFormPlugin` |  | 11 | 0 |  |
| `CustOpParameterPlugin` | class | `kd.bos.metadata.entity.operation.AbstractOpParameterPlugin` |  | 5 | 0 |  |
| `IOpBizRuleParameterEdit` | interface |  |  | 5 | 0 |  |
| `OpBizRuleElement` | class | `kd.bos.metadata.AbstractElement` |  | 15 | 0 |  |
| `Operation` | class | `kd.bos.metadata.AbstractElement` |  | 31 | 0 |  |
| `OperationParameter` | class |  |  | 2 | 0 |  |

### `kd.bos.metadata.entity.report`

Path prefix: `javadoc/kd/bos/metadata/entity/report/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `ReportColumnFactory` | class |  |  | 17 | 0 |  |

### `kd.bos.metadata.entity.rule`

Path prefix: `javadoc/kd/bos/metadata/entity/rule/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `IBizRuleEditor` | interface |  |  | 8 | 6 |  |

### `kd.bos.metadata.entity.validation`

Path prefix: `javadoc/kd/bos/metadata/entity/validation/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `AbstractValidationParamPlugin` | class | `AbstractFormPlugin` |  | 13 | 2 |  |
| `CustValidation` | class | `kd.bos.metadata.entity.validation.Validation` | `java.io.Serializable` | 3 | 0 |  |
| `CustValidationParamPlugin` | class | `kd.bos.metadata.entity.validation.AbstractValidationParamPlugin` |  | 5 | 0 |  |
| `DynamicValidation` | class | `kd.bos.metadata.entity.validation.Validation` | `java.io.Serializable` | 3 | 0 |  |
| `PreCondition` | class |  | `java.io.Serializable` | 6 | 0 |  |
| `Validation` | class |  | `java.io.Serializable`, `kd.bos.metadata.IInheritFlag` | 20 | 0 |  |
| `ValidationType` | class |  |  | 32 | 0 |  |
| `ValidationTypes` | class |  |  | 7 | 0 |  |

### `kd.bos.metadata.exception`

Path prefix: `javadoc/kd/bos/metadata/exception/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `CheckResultInfo` | class |  |  | 7 | 0 |  |
| `ErrorInfo` | class |  |  | 17 | 4 | yes |

### `kd.bos.metadata.filter`

Path prefix: `javadoc/kd/bos/metadata/filter/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `CommonApproverFilterColumnAp` | class | `kd.bos.metadata.filter.CommonFilterColumnAp` |  | 1 | 0 |  |
| `CommonBaseDataFilterColumnAp` | class | `kd.bos.metadata.filter.CommonFilterColumnAp` |  | 11 | 0 |  |
| `CommonCheckBoxFilterColumnAp` | class | `kd.bos.metadata.filter.CommonFilterColumnAp` |  | 1 | 0 |  |
| `CommonCheckBoxGroupFilterColumnAp` | class | `kd.bos.metadata.filter.CommonFilterColumnAp` |  | 2 | 0 |  |
| `CommonDateFilterColumnAp` | class | `kd.bos.metadata.filter.CommonFilterColumnAp` |  | 6 | 0 |  |
| `CommonFilterColumnAp` | class | `kd.bos.metadata.filter.FilterColumnAp` |  | 22 | 0 |  |
| `FastSearchGridViewAp` | class | `<any>` |  | 6 | 1 |  |
| `FilterColumnAp` | class | `<any>` |  | 5 | 0 |  |
| `FilterContainerAp` | class | `<any>` |  | 17 | 1 |  |
| `FilterGridViewAp` | class | `<any>` |  | 12 | 1 |  |
| `SchemeApproverFilterColumnAp` | class | `kd.bos.metadata.filter.SchemeFilterColumnAp` |  | 1 | 0 |  |
| `SchemeBaseDataFilterColumnAp` | class | `kd.bos.metadata.filter.SchemeFilterColumnAp` |  | 11 | 0 |  |
| `SchemeComboFilterColumnAp` | class | `kd.bos.metadata.filter.SchemeFilterColumnAp` |  | 0 | 0 |  |
| `SchemeFilterColumnAp` | class | `kd.bos.metadata.filter.FilterColumnAp` |  | 8 | 0 |  |
| `SchemeFilterViewAp` | class | `<any>` |  | 6 | 1 |  |
| `SchemeVoucherFilterColumnAp` | class | `kd.bos.metadata.filter.SchemeFilterColumnAp` |  | 7 | 0 |  |

### `kd.bos.metadata.form`

Path prefix: `javadoc/kd/bos/metadata/form/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `AbstractStyle` | class |  |  | 9 | 0 |  |
| `BasedataFormAp` | class | `kd.bos.metadata.form.BillFormAp` |  | 1 | 0 |  |
| `BillFormAp` | class | `kd.bos.metadata.form.FormAp` |  | 16 | 0 |  |
| `Border` | class | `kd.bos.metadata.form.AbstractStyle` |  | 0 | 0 |  |
| `CardAp` | class | `kd.bos.metadata.form.FormAp` |  | 1 | 0 |  |
| `ContainerAp` | class | `kd.bos.metadata.form.ControlAp` |  | 37 | 0 |  |
| `ControlAp` | class | `kd.bos.metadata.AbstractElement` |  | 61 | 8 |  |
| `FormAp` | class | `kd.bos.metadata.form.ContainerAp` |  | 58 | 0 | yes |
| `FormMetadata` | class | `kd.bos.metadata.AbstractMetadata` | `kd.bos.metadata.IEntityBinder`, `kd.bos.metadata.lang.ResBundleLocalizable` | 49 | 0 |  |
| `IBillListAp` | interface |  |  | 2 | 0 |  |
| `ICardRowPanelAp` | interface |  |  | 0 | 0 |  |
| `IListGridViewAp` | interface |  |  | 0 | 0 |  |
| `LogBillFormAp` | class | `kd.bos.metadata.form.BillFormAp` |  | 1 | 0 |  |
| `Margin` | class | `kd.bos.metadata.form.AbstractStyle` |  | 0 | 0 |  |
| `MenuItem` | class |  |  | 17 | 0 |  |
| `MobileBillFormAp` | class | `kd.bos.metadata.form.BillFormAp` |  | 7 | 0 |  |
| `MobileFormAp` | class | `kd.bos.metadata.form.FormAp` |  | 8 | 0 |  |
| `MobileUserGuideFormAp` | class | `kd.bos.metadata.form.MobileFormAp` |  | 0 | 0 |  |
| `Padding` | class | `kd.bos.metadata.form.AbstractStyle` |  | 0 | 0 |  |
| `ParameterFormAp` | class | `kd.bos.metadata.form.FormAp` |  | 4 | 0 |  |
| `PrintFormAp` | class | `kd.bos.metadata.print.control.BaseContainer` |  | 35 | 0 |  |
| `PrintMetadata` | class | `kd.bos.metadata.AbstractMetadata` | `kd.bos.metadata.IEntityBinder` | 30 | 0 |  |
| `Style` | class |  |  | 7 | 0 |  |
| `WidgetFormAp` | class | `kd.bos.metadata.form.FormAp` |  | 2 | 0 |  |

### `kd.bos.metadata.form.cardentry`

Path prefix: `javadoc/kd/bos/metadata/form/cardentry/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `CardEntryAp` | class | `kd.bos.metadata.form.control.EntryAp` |  | 8 | 0 |  |
| `CardEntryFieldAp` | class | `kd.bos.metadata.form.control.FieldAp` |  | 9 | 0 |  |
| `CardEntryFixRowAp` | class | `kd.bos.metadata.form.ContainerAp` |  | 5 | 0 |  |
| `CardEntryFixRowPanelAp` | class | `kd.bos.metadata.form.cardentry.CardEntryFlexPanelAp` |  | 1 | 0 |  |
| `CardEntryFlexPanelAp` | class | `kd.bos.metadata.form.container.FlexPanelAp` |  | 9 | 0 |  |
| `CardEntryRowAp` | class | `kd.bos.metadata.form.ContainerAp` |  | 22 | 0 |  |
| `CardEntryViewAp` | class | `kd.bos.metadata.form.ContainerAp` |  | 27 | 0 |  |
| `CardSelectorAp` | class | `kd.bos.metadata.form.ControlAp` |  | 1 | 0 |  |
| `SubCardEntryAp` | class | `kd.bos.metadata.form.cardentry.CardEntryAp` |  | 1 | 0 |  |

### `kd.bos.metadata.form.chart`

Path prefix: `javadoc/kd/bos/metadata/form/chart/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `BarChartAp` | class | `kd.bos.metadata.form.chart.ChartAp` |  | 2 | 0 |  |
| `ChartAp` | class | `kd.bos.metadata.form.ControlAp` |  | 13 | 0 |  |
| `CustomChartAp` | class | `kd.bos.metadata.form.chart.ChartAp` |  | 2 | 0 |  |
| `GaugeChartAp` | class | `kd.bos.metadata.form.chart.ChartAp` |  | 2 | 0 |  |
| `HistogramChartAp` | class | `kd.bos.metadata.form.chart.ChartAp` |  | 2 | 0 |  |
| `PieChartAp` | class | `kd.bos.metadata.form.chart.ChartAp` |  | 2 | 0 |  |
| `PointLineChartAp` | class | `kd.bos.metadata.form.chart.ChartAp` |  | 2 | 0 |  |
| `RadarChartAp` | class | `kd.bos.metadata.form.chart.ChartAp` |  | 2 | 0 |  |

### `kd.bos.metadata.form.container`

Path prefix: `javadoc/kd/bos/metadata/form/container/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `AdvConAp` | class | `kd.bos.metadata.form.ContainerAp` |  | 8 | 0 |  |
| `AdvConBarItemAp` | class | `kd.bos.metadata.form.control.BarItemAp` |  | 1 | 0 |  |
| `AdvConChildPanelAp` | class | `kd.bos.metadata.form.container.FlexPanelAp` |  | 1 | 0 |  |
| `AdvConSummaryPanelAp` | class | `kd.bos.metadata.form.container.FlexPanelAp` |  | 1 | 0 |  |
| `AdvConToolbarAp` | class | `kd.bos.metadata.form.control.ToolbarAp` |  | 1 | 0 |  |
| `ColumnAp` | class | `kd.bos.metadata.form.ContainerAp` |  | 3 | 0 |  |
| `ColumnPanelAp` | class | `kd.bos.metadata.form.ContainerAp` |  | 3 | 0 |  |
| `FieldgroupPanelAp` | class | `kd.bos.metadata.form.container.FlexPanelAp` |  | 3 | 0 |  |
| `FieldsetPanelAp` | class | `kd.bos.metadata.form.ContainerAp` |  | 26 | 0 |  |
| `FlexPanelAp` | class | `kd.bos.metadata.form.ContainerAp` |  | 27 | 0 |  |
| `GridFlatPanelAp` | class | `kd.bos.metadata.form.container.FlexPanelAp` |  | 4 | 0 |  |
| `HomePageTabAp` | class | `kd.bos.metadata.form.container.TabAp` |  | 6 | 0 |  |
| `HomePageTabItemAp` | class | `kd.bos.metadata.form.container.TabPageAp` |  | 1 | 0 |  |
| `LayoutFlexAp` | class | `kd.bos.metadata.form.ContainerAp` |  | 10 | 0 |  |
| `SidePanelAp` | class | `kd.bos.metadata.form.container.FlexPanelAp` |  | 1 | 0 |  |
| `SplitContainerAp` | class | `kd.bos.metadata.form.ContainerAp` |  | 14 | 0 |  |
| `SplitPanelAp` | class | `kd.bos.metadata.form.container.FlexPanelAp` |  | 1 | 0 |  |
| `TabAp` | class | `kd.bos.metadata.form.ContainerAp` |  | 32 | 0 |  |
| `TabPageAp` | class | `kd.bos.metadata.form.ContainerAp` |  | 12 | 0 |  |
| `WizardAp` | class | `kd.bos.metadata.form.ContainerAp` |  | 20 | 0 |  |
| `WizardPageAp` | class | `kd.bos.metadata.form.container.FlexPanelAp` |  | 1 | 0 |  |

### `kd.bos.metadata.form.control`

Path prefix: `javadoc/kd/bos/metadata/form/control/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `AttachmentPanelAp` | class | `<any>` |  | 17 | 0 |  |
| `ImageAp` | class | `ButtonAp` |  | 14 | 0 | yes |

### `kd.bos.metadata.form.control.embedform`

Path prefix: `javadoc/kd/bos/metadata/form/control/embedform/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `EmbedFormAp` | class | `kd.bos.metadata.form.container.FlexPanelAp` |  | 6 | 0 |  |
| `EmbedFormShowParam` | class |  |  | 26 | 0 |  |

### `kd.bos.metadata.form.control.grid`

Path prefix: `javadoc/kd/bos/metadata/form/control/grid/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `DataGridAp` | class | `kd.bos.metadata.form.ContainerAp` |  | 16 | 0 |  |

### `kd.bos.metadata.form.control.grid.column`

Path prefix: `javadoc/kd/bos/metadata/form/control/grid/column/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `AmountDataGridColumnAp` | class | `kd.bos.metadata.form.control.grid.column.DataGridColumnAp` |  | 8 | 0 |  |
| `DataGridColumnAp` | class | `kd.bos.metadata.form.ControlAp` |  | 2 | 0 |  |
| `DateDataGridColumnAp` | class | `kd.bos.metadata.form.control.grid.column.DataGridColumnAp` |  | 4 | 0 |  |
| `DecimalDataGridColumnAp` | class | `kd.bos.metadata.form.control.grid.column.DataGridColumnAp` |  | 8 | 0 |  |
| `IntegerDataGridColumnAp` | class | `kd.bos.metadata.form.control.grid.column.DecimalDataGridColumnAp` |  | 2 | 0 |  |
| `OperationDataGridColumnAp` | class | `kd.bos.metadata.form.control.grid.column.DataGridColumnAp` |  | 4 | 0 |  |
| `PictureDataGridColumnAp` | class | `kd.bos.metadata.form.control.grid.column.DataGridColumnAp` |  | 1 | 0 |  |
| `TextDataGridColumnAp` | class | `kd.bos.metadata.form.control.grid.column.DataGridColumnAp` |  | 1 | 0 |  |
| `TimeDataGridColumnAp` | class | `kd.bos.metadata.form.control.grid.column.DataGridColumnAp` |  | 4 | 0 |  |

### `kd.bos.metadata.form.mcontrol`

Path prefix: `javadoc/kd/bos/metadata/form/mcontrol/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `MobAdvFilterPanelAp` | class | `<any>` |  | 14 | 1 |  |
| `MobCommonBaseDataFilterColumnAp` | class | `kd.bos.metadata.filter.CommonBaseDataFilterColumnAp` |  | 1 | 0 |  |
| `MobCommonCheckBoxFilterColumnAp` | class | `kd.bos.metadata.filter.CommonCheckBoxFilterColumnAp` |  | 1 | 0 |  |
| `MobCommonDateFilterColumnAp` | class | `kd.bos.metadata.filter.CommonDateFilterColumnAp` |  | 2 | 0 |  |
| `MobCommonFilterColumnAp` | class | `kd.bos.metadata.filter.CommonFilterColumnAp` |  | 1 | 0 |  |
| `MobFilterPanelAp` | class | `<any>` |  | 0 | 1 |  |
| `MobFilterSortAp` | class | `<any>` |  | 6 | 1 |  |
| `MobSortColumnAp` | class | `<any>` |  | 5 | 0 |  |
| `MobSortPanelAp` | class | `<any>` |  | 2 | 1 |  |
| `MobileSearchAp` | class | `<any>` |  | 12 | 1 |  |
| `MBarItemAp` | class | `kd.bos.metadata.form.control.ButtonAp` |  | 11 | 0 |  |
| `MBlockMenuAp` | class | `kd.bos.metadata.form.ContainerAp` |  | 11 | 0 |  |
| `MBlockMenuItemAp` | class | `kd.bos.metadata.form.mcontrol.MBarItemAp` |  | 3 | 0 |  |
| `MTabBarAp` | class | `kd.bos.metadata.form.ContainerAp` |  | 6 | 0 |  |
| `MTabBarFormAp` | class | `kd.bos.metadata.form.ContainerAp` |  | 15 | 1 |  |
| `MTabBarItemAp` | class | `kd.bos.metadata.form.ContainerAp` |  | 16 | 1 |  |
| `MToolbarAp` | class | `kd.bos.metadata.form.ContainerAp` |  | 8 | 1 |  |
| `SearchAp` | class | `kd.bos.metadata.form.ContainerAp` |  | 12 | 1 |  |

### `kd.bos.metadata.form.mcontrol.mobtable`

Path prefix: `javadoc/kd/bos/metadata/form/mcontrol/mobtable/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `MobTableAp` | class | `kd.bos.metadata.form.ContainerAp` |  | 26 | 0 |  |

### `kd.bos.metadata.form.mcontrol.mobtable.tablecolumn`

Path prefix: `javadoc/kd/bos/metadata/form/mcontrol/mobtable/tablecolumn/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `AmountMobTableColumnAp` | class | `kd.bos.metadata.form.mcontrol.mobtable.tablecolumn.MobTableColumnAp` |  | 9 | 0 |  |
| `DateMobTableColumnAp` | class | `kd.bos.metadata.form.mcontrol.mobtable.tablecolumn.MobTableColumnAp` |  | 5 | 0 |  |
| `DecimalMobTableColumnAp` | class | `kd.bos.metadata.form.mcontrol.mobtable.tablecolumn.MobTableColumnAp` |  | 9 | 0 |  |
| `IntegerMobTableColumnAp` | class | `kd.bos.metadata.form.mcontrol.mobtable.tablecolumn.DecimalMobTableColumnAp` |  | 3 | 0 |  |
| `MobTableColumnAp` | class | `kd.bos.metadata.form.ControlAp` |  | 6 | 0 |  |
| `PictureMobTableColumnAp` | class | `kd.bos.metadata.form.mcontrol.mobtable.tablecolumn.MobTableColumnAp` |  | 5 | 0 |  |
| `TextMobTableColumnAp` | class | `kd.bos.metadata.form.mcontrol.mobtable.tablecolumn.MobTableColumnAp` |  | 2 | 0 |  |
| `TimeMobTableColumnAp` | class | `kd.bos.metadata.form.mcontrol.mobtable.tablecolumn.MobTableColumnAp` |  | 5 | 0 |  |

### `kd.bos.metadata.form.spread`

Path prefix: `javadoc/kd/bos/metadata/form/spread/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `SpreadAp` | class | `kd.bos.metadata.form.ContainerAp` |  | 8 | 0 |  |

### `kd.bos.metadata.form.userguide`

Path prefix: `javadoc/kd/bos/metadata/form/userguide/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `GuideItemAp` | class | `kd.bos.metadata.form.ContainerAp` |  | 4 | 0 |  |
| `GuidePageAp` | class | `kd.bos.metadata.form.ContainerAp` |  | 2 | 0 |  |

### `kd.bos.metadata.form.widget`

Path prefix: `javadoc/kd/bos/metadata/form/widget/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `WidgetAp` | class | `kd.bos.metadata.form.ControlAp` |  | 9 | 0 |  |
| `WidgetContainerAp` | class | `kd.bos.metadata.form.ContainerAp` |  | 2 | 0 |  |
| `WidgetGroupPanelAp` | class | `kd.bos.metadata.form.ContainerAp` |  | 3 | 0 |  |

### `kd.bos.metadata.list`

Path prefix: `javadoc/kd/bos/metadata/list/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `ApproverListColumnAp` | class | `<any>` |  | 2 | 0 |  |
| `BillListAp` | class | `<any>` |  | 35 | 2 |  |
| `CardCheckBoxListColumnAp` | class | `kd.bos.metadata.list.CheckBoxListColumnAp` |  | 3 | 0 |  |
| `CardColorPickerListColumnAp` | class | `kd.bos.metadata.list.ColorPickerListColumnAp` |  | 1 | 0 |  |
| `CardComboListColumnAp` | class | `kd.bos.metadata.list.ComboListColumnAp` |  | 2 | 0 |  |
| `CardDateListColumnAp` | class | `kd.bos.metadata.list.DateListColumnAp` |  | 1 | 0 |  |
| `CardDecimalListColumnAp` | class | `kd.bos.metadata.list.DecimalListColumnAp` |  | 4 | 0 |  |
| `CardFlexListColumnAp` | class | `kd.bos.metadata.list.FlexListColumnAp` |  | 2 | 0 |  |
| `CardFlexPanelAp` | class | `FlexPanelAp` |  | 9 | 0 |  |
| `CardListColumnAp` | class | `kd.bos.metadata.list.ListColumnAp` |  | 1 | 0 |  |
| `CardMulComboListColumnAp` | class | `kd.bos.metadata.list.CardComboListColumnAp` |  | 0 | 0 |  |
| `CardRowPanelAp` | class | `<any>` |  | 16 | 0 |  |
| `CardTimeListColumnAp` | class | `kd.bos.metadata.list.TimeListColumnAp` |  | 1 | 0 |  |
| `CardVoucherNoListColumnAp` | class | `kd.bos.metadata.list.VoucherNoListColumnAp` |  | 1 | 0 |  |
| `CheckBoxListColumnAp` | class | `kd.bos.metadata.list.ListColumnAp` |  | 8 | 0 |  |
| `CityListAp` | class | `<any>` |  | 2 | 0 |  |
| `ColorPickerListColumnAp` | class | `kd.bos.metadata.list.ListColumnAp` |  | 4 | 0 | yes |
| `ComboListColumnAp` | class | `kd.bos.metadata.list.ListColumnAp` |  | 7 | 0 |  |
| `DateListColumnAp` | class | `kd.bos.metadata.list.ListColumnAp` |  | 6 | 0 |  |
| `DecimalListColumnAp` | class | `kd.bos.metadata.list.ListColumnAp` |  | 18 | 0 |  |
| `DynamicTextListColumnAp` | class | `<any>` |  | 4 | 0 |  |
| `F7SelectedListAp` | class | `<any>` |  | 4 | 1 |  |
| `FlexListColumnAp` | class | `kd.bos.metadata.list.ListColumnAp` |  | 9 | 0 |  |
| `ListCardViewAp` | class | `<any>` |  | 26 | 1 |  |
| `ListColumnAp` | class | `<any>` |  | 34 | 0 |  |
| `ListColumnGroupAp` | class | `<any>` |  | 6 | 0 |  |
| `ListFormAp` | class | `FormAp` |  | 1 | 0 |  |
| `ListGridViewAp` | class | `<any>` |  | 45 | 1 |  |
| `ListOperationColumnAp` | class | `<any>` |  | 8 | 0 |  |
| `MergeListColumnAp` | class | `<any>` |  | 6 | 0 |  |
| `MobF7SelectedListAp` | class | `<any>` |  | 2 | 0 |  |
| `MobileListAp` | class | `<any>` |  | 5 | 0 |  |
| `MobileListFormAp` | class | `kd.bos.metadata.list.ListFormAp` |  | 4 | 0 |  |
| `MulComboListColumnAp` | class | `kd.bos.metadata.list.ComboListColumnAp` |  | 2 | 0 |  |
| `OrgListAp` | class | `<any>` |  | 2 | 0 |  |
| `QingViewAp` | class | `kd.bos.metadata.list.ListGridViewAp` |  | 4 | 0 |  |
| `TimeListColumnAp` | class | `kd.bos.metadata.list.ListColumnAp` |  | 5 | 0 |  |
| `UserListAp` | class | `<any>` |  | 2 | 0 |  |
| `VoucherNoListColumnAp` | class | `<any>` |  | 10 | 0 |  |

### `kd.bos.metadata.lockvisible`

Path prefix: `javadoc/kd/bos/metadata/lockvisible/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `BillTypeInfo` | class |  |  | 10 | 0 | yes |
| `ControlInfo` | class |  |  | 10 | 0 | yes |
| `ControlLockVisibleInfo` | class |  |  | 10 | 0 | yes |
| `LockVisibleInfoReader` | class |  |  | 9 | 1 | yes |

### `kd.bos.metadata.report`

Path prefix: `javadoc/kd/bos/metadata/report/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `ReportCommFilterPanelAp` | class | `FlexPanelAp` |  | 1 | 0 |  |
| `ReportEntity` | class | `MainEntity` |  | 0 | 0 |  |
| `ReportFilterAp` | class | `FlexPanelAp` |  | 15 | 0 |  |
| `ReportFormAp` | class | `FormAp` |  | 8 | 0 |  |
| `ReportListAp` | class | `EntryAp` |  | 43 | 0 |  |
| `ReportMoreFilterPanelAp` | class | `FlexPanelAp` |  | 1 | 0 |  |
| `ReportTreeAp` | class | `TreeViewAp` |  | 7 | 0 |  |

### `kd.bos.metadata.treebuilder`

Path prefix: `javadoc/kd/bos/metadata/treebuilder/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `ExpressionEditHelper` | class |  |  | 4 | 7 |  |
| `FilterEditHelper` | class |  |  | 3 | 5 |  |

### `kd.bos.mvc.form`

Path prefix: `javadoc/kd/bos/mvc/form/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `IFormController` | interface |  |  | 12 | 0 |  |

### `kd.bos.mvc.form.helper`

Path prefix: `javadoc/kd/bos/mvc/form/helper/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `WebOfficeBrowserHelper` | class |  |  | 1 | 0 |  |
| `WebOfficeBrowserParam` | class |  |  | 16 | 0 |  |

### `kd.bos.mvc.list`

Path prefix: `javadoc/kd/bos/mvc/list/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `ListUserConfig` | class |  | `java.io.Serializable` | 6 | 1 |  |

### `kd.bos.mvc.report`

Path prefix: `javadoc/kd/bos/mvc/report/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `ReportListModel` | class | `AbstractReportListModel` |  | 9 | 0 |  |
| `ReportPropUtil` | class |  |  | 1 | 0 |  |
| `ReportView` | class | `kd.bos.mvc.form.FormView` |  | 43 | 1 |  |

### `kd.bos.notification`

Path prefix: `javadoc/kd/bos/notification/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `AbstractNotificationClick` | class |  | `kd.bos.notification.INotificationClick` | 5 | 0 |  |

### `kd.bos.service.operation`

Path prefix: `javadoc/kd/bos/service/operation/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `EntityOperateService` | class |  |  | 57 | 8 |  |
| `OperationService` | interface |  |  | 2 | 0 |  |

### `kd.bos.tree`

Path prefix: `javadoc/kd/bos/tree/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `TreeFilterParameter` | class |  | `java.io.Serializable` | 9 | 0 |  |

### `kd.bos.upload`

Path prefix: `javadoc/kd/bos/upload/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `UploadOption` | class |  | `java.io.Serializable` | 19 | 0 |  |
