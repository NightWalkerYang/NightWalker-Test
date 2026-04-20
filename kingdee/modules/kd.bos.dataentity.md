# kd.bos.dataentity

**数据实体** · app=`bos` cloud=`bos` isv=`kingdee`

Class HTML path rule: `javadoc/<package-with-slashes>/<ClassName>.html`
Example: package `kd.bos.algo`, class `Algo` → `javadoc/kd/bos/algo/Algo.html`

Each class HTML contains a `cm={...}` JSON object on line 2 with full Javadoc:
`comment`, `declare`, `methods[]` (name/modifiers/returnType/paramNames/paramTypes/comment/tags/throwExceptions/annotations), `fields[]`, `interfaces`, `allInterfaces`, `isDeprecated`, `isPlugin`, `isService`.

## Packages

### `kd.bos.dataentity`

Path prefix: `javadoc/kd/bos/dataentity/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `Consumer` | interface |  |  | 1 | 0 |  |
| `DataEntityModule` | class |  | `kd.sdk.module.Module` | 0 | 0 |  |
| `FourTuple` | class | `kd.bos.dataentity.ThreeTuple` |  | 1 | 1 |  |
| `OperateOption` | class |  | `java.io.Serializable` | 11 | 2 |  |
| `RefObject` | class |  |  | 5 | 1 |  |
| `SqlParameter` | class | `kd.bos.db.SqlParameter` |  | 7 | 0 |  |
| `ThreeTuple` | class | `kd.bos.dataentity.Tuple` |  | 1 | 1 |  |
| `Tuple` | class |  |  | 2 | 2 |  |
| `TypesContainer` | class |  |  | 5 | 0 |  |

### `kd.bos.dataentity.entity`

Path prefix: `javadoc/kd/bos/dataentity/entity/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `CloneUtils` | class |  |  | 3 | 0 |  |
| `CollectionPropertyAttribute` | interface |  | `java.lang.annotation.Annotation` | 3 | 0 |  |
| `ComplexPropertyAttribute` | interface |  | `java.lang.annotation.Annotation` | 3 | 0 |  |
| `DataEntityBase` | class |  | `kd.bos.dataentity.entity.INotifyPropertyChanged`, `kd.bos.dataentity.entity.ISupportInitialize`, `kd.bos.dataentity.entity.IDataEntityBase`, `kd.bos.dataentity.entity.IObjectWithParent`, `java.io.Serializable` | 18 | 1 |  |
| `DataEntityCollection` | class | `java.util.ArrayList` | `kd.bos.dataentity.entity.ISupportInitialize`, `java.io.Serializable` | 14 | 1 |  |
| `DataEntityState` | class |  | `java.io.Serializable` | 40 | 1 |  |
| `DataEntityTypeAttribute` | interface |  | `java.lang.annotation.Annotation` | 5 | 0 |  |
| `DbIgnoreAttribute` | interface |  | `java.lang.annotation.Annotation` | 0 | 0 |  |
| `DefaultValueAttribute` | interface |  | `java.lang.annotation.Annotation` | 1 | 0 |  |
| `DynamicObject` | class | `kd.bos.dataentity.entity.DataEntityBase` | `java.io.Serializable` | 49 | 0 |  |
| `DynamicObjectCollection` | class | `kd.bos.dataentity.entity.DataEntityCollection` | `java.io.Serializable` | 25 | 0 |  |
| `EntryInfo` | class |  | `java.io.Serializable` | 7 | 0 |  |
| `IBillEntityType` | interface |  |  | 1 | 0 |  |
| `IDataCacheControl` | interface |  |  | 1 | 0 |  |
| `IDataEntityBase` | interface |  |  | 2 | 0 |  |
| `IDataStorage` | interface |  |  | 3 | 0 |  |
| `ILocaleString` | interface |  | `kd.bos.dataentity.entity.ILocaleValue` | 8 | 1 |  |
| `ILocaleValue` | interface |  | `java.util.Map` | 4 | 0 | yes |
| `IObjectWithParent` | interface |  |  | 2 | 0 |  |
| `ISupportInitialize` | interface |  |  | 3 | 0 |  |
| `LocaleDynamicObjectCollection` | class | `kd.bos.dataentity.entity.DynamicObjectCollection` |  | 15 | 0 |  |
| `LocaleString` | class | `kd.bos.dataentity.entity.LocaleValue` | `kd.bos.dataentity.entity.ILocaleString`, `java.io.Serializable` | 10 | 0 |  |
| `LocaleValue` | class |  | `kd.bos.dataentity.entity.ILocaleValue`, `java.util.Map`, `java.io.Serializable`, `kd.bos.dataentity.entity.ILocaleResValue` | 28 | 3 | yes |
| `LocaleValueItem` | class |  |  | 3 | 0 |  |
| `MulBasedataDynamicObjectCollection` | class | `kd.bos.dataentity.entity.DynamicObjectCollection` |  | 4 | 0 |  |
| `ObjectConverter` | class |  |  | 2 | 7 |  |
| `OrmLocaleValue` | class |  | `kd.bos.dataentity.entity.ILocaleString`, `java.io.Serializable` | 19 | 0 |  |
| `PkSnapshot` | class |  | `java.io.Serializable` | 2 | 3 |  |
| `PkSnapshotSet` | class |  | `java.io.Serializable` | 2 | 1 |  |
| `ReadonlyDynamicObject` | class |  | `java.io.Serializable` | 6 | 0 |  |
| `SimplePropertyAttribute` | interface |  | `java.lang.annotation.Annotation` | 12 | 0 |  |

### `kd.bos.dataentity.exception`

Path prefix: `javadoc/kd/bos/dataentity/exception/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `ORMArgInvalidException` | class | `kd.bos.dataentity.exception.OrmException` | `java.io.Serializable` | 2 | 0 |  |
| `ORMBusinessException` | class | `kd.bos.dataentity.exception.OrmException` | `java.io.Serializable` | 1 | 0 |  |
| `ORMDesignException` | class | `kd.bos.dataentity.exception.OrmException` | `java.io.Serializable` | 2 | 0 |  |
| `OrmException` | class | `java.lang.RuntimeException` | `java.io.Serializable` | 4 | 0 |  |
| `SerializationException` | class | `kd.bos.dataentity.exception.OrmException` | `java.io.Serializable` | 5 | 0 |  |

### `kd.bos.dataentity.limiter`

Path prefix: `javadoc/kd/bos/dataentity/limiter/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `KDRateLimiterException` | class | `KDException` |  | 3 | 0 |  |
| `LimiterIntConfigRegistry` | class |  |  | 1 | 0 |  |

### `kd.bos.dataentity.message`

Path prefix: `javadoc/kd/bos/dataentity/message/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `PushMessage` | class |  | `java.io.Serializable` | 19 | 0 |  |
| `PushMessageBuilder` | class |  |  | 12 | 0 |  |
| `PushMessageRange` | enum |  |  | 0 | 4 |  |
| `PushMessageType` | enum |  |  | 0 | 2 |  |

### `kd.bos.dataentity.metadata`

Path prefix: `javadoc/kd/bos/dataentity/metadata/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `DataEntityCacheType` | enum |  |  | 2 | 2 |  |
| `DataEntityTypeFlag` | enum |  |  | 2 | 5 |  |
| `IBillNoProperty` | interface |  |  | 0 | 0 |  |
| `ICollectionProperty` | interface |  | `kd.bos.dataentity.metadata.IDataEntityProperty` | 4 | 0 |  |
| `IColumnValuePair` | interface |  |  | 3 | 0 |  |
| `IComplexProperty` | interface |  | `kd.bos.dataentity.metadata.IDataEntityProperty` | 5 | 0 |  |
| `ICreateTimeProperty` | interface |  | `kd.bos.dataentity.metadata.ISimpleProperty` | 0 | 0 |  |
| `ICreatedByProperty` | interface |  | `kd.bos.dataentity.metadata.ISimpleProperty` | 0 | 0 |  |
| `IDataEntityProperty` | interface |  | `kd.bos.dataentity.metadata.IMetadata` | 15 | 0 |  |
| `IDataEntityPropertyCollection` | interface |  |  | 0 | 0 |  |
| `IDataEntityType` | interface |  | `kd.bos.dataentity.metadata.IMetadata` | 19 | 0 |  |
| `IDataEntityTypeCollection` | interface |  | `kd.bos.dataentity.collections.IKeyedCollectionBase`, `java.util.List` | 0 | 0 |  |
| `IDeleteMetaRow` | interface |  |  | 1 | 0 |  |
| `IDirtyProperty` | interface |  |  | 1 | 0 |  |
| `IEntryType` | interface |  |  | 1 | 0 |  |
| `IGeoPointProperty` | interface |  | `kd.bos.dataentity.metadata.ISimpleProperty` | 4 | 0 |  |
| `IJoinProperty` | interface |  |  | 2 | 0 |  |
| `ILocaleProperty` | interface |  |  | 2 | 0 |  |
| `ILongDataProperty` | interface |  |  | 6 | 0 |  |
| `IMetadata` | interface |  | `java.lang.Cloneable` | 5 | 0 |  |
| `IModifierProperty` | interface |  | `kd.bos.dataentity.metadata.ISimpleProperty` | 0 | 0 |  |
| `IModifyTimeProperty` | interface |  | `kd.bos.dataentity.metadata.ISimpleProperty` | 0 | 0 |  |
| `ISaveDataSet` | interface |  |  | 1 | 0 |  |
| `ISaveDataTable` | interface |  |  | 4 | 0 | yes |
| `ISaveMetaRow` | interface |  |  | 11 | 0 |  |
| `ISimpleProperty` | interface |  | `kd.bos.dataentity.metadata.IDataEntityProperty` | 3 | 0 |  |
| `ISubEntryType` | interface |  |  | 0 | 0 |  |
| `RowOperateType` | enum |  |  | 2 | 5 |  |

### `kd.bos.dataentity.metadata.clr`

Path prefix: `javadoc/kd/bos/dataentity/metadata/clr/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `CollectionProperty` | class | `kd.bos.dataentity.metadata.clr.DataEntityProperty` | `kd.bos.dataentity.metadata.ICollectionProperty` | 4 | 0 |  |
| `ComplexProperty` | class | `kd.bos.dataentity.metadata.clr.DataEntityProperty` | `kd.bos.dataentity.metadata.IComplexProperty` | 4 | 0 |  |
| `DataEntityProperty` | class |  | `kd.bos.dataentity.metadata.IDataEntityProperty`, `kd.bos.dataentity.metadata.IMetadata`, `kd.bos.dataentity.DefinedDbIgnoreAttribute` | 18 | 3 |  |
| `DataEntityPropertyCollection` | class | `kd.bos.dataentity.collections.KeyedCollectionBase` | `java.io.Serializable` | 10 | 1 |  |
| `DataEntityType` | class |  | `kd.bos.dataentity.metadata.IDataEntityType` | 35 | 0 |  |
| `SimpleProperty` | class | `kd.bos.dataentity.metadata.clr.DataEntityProperty` | `kd.bos.dataentity.metadata.ISimpleProperty` | 15 | 0 |  |

### `kd.bos.dataentity.metadata.dynamicobject`

Path prefix: `javadoc/kd/bos/dataentity/metadata/dynamicobject/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `DynamicCollectionProperty` | class | `kd.bos.dataentity.metadata.dynamicobject.DynamicProperty` | `kd.bos.dataentity.metadata.ICollectionProperty`, `java.io.Serializable` | 15 | 0 |  |
| `DynamicComplexProperty` | class | `kd.bos.dataentity.metadata.dynamicobject.DynamicProperty` | `kd.bos.dataentity.metadata.IComplexProperty`, `java.io.Serializable` | 15 | 0 |  |
| `DynamicLocaleProperty` | class | `kd.bos.dataentity.metadata.dynamicobject.DynamicCollectionProperty` |  | 5 | 0 |  |
| `DynamicMetadata` | class |  | `kd.bos.dataentity.metadata.IMetadata`, `java.io.Serializable` | 7 | 0 |  |
| `DynamicObjectType` | class | `kd.bos.dataentity.metadata.dynamicobject.DynamicMetadata` | `kd.bos.dataentity.metadata.IDataEntityType`, `java.io.Serializable`, `java.lang.Cloneable` | 63 | 2 |  |
| `DynamicProperty` | class | `kd.bos.dataentity.metadata.dynamicobject.DynamicMetadata` | `kd.bos.dataentity.metadata.IDataEntityProperty`, `kd.bos.dataentity.metadata.ILongDataProperty`, `java.io.Serializable`, `java.lang.Cloneable` | 46 | 8 |  |
| `DynamicPropertyCollection` | class | `kd.bos.dataentity.metadata.clr.DataEntityPropertyCollection` | `java.io.Serializable` | 11 | 0 |  |
| `DynamicSimpleProperty` | class | `kd.bos.dataentity.metadata.dynamicobject.DynamicProperty` | `kd.bos.dataentity.metadata.ISimpleProperty`, `java.io.Serializable` | 18 | 0 |  |
| `ExtractOption` | class |  |  | 4 | 0 |  |

### `kd.bos.dataentity.resource`

Path prefix: `javadoc/kd/bos/dataentity/resource/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `ImageDirectory` | enum |  |  | 2 | 2 |  |
| `ResManager` | class |  |  | 4 | 0 |  |

### `kd.bos.dataentity.resource.cache`

Path prefix: `javadoc/kd/bos/dataentity/resource/cache/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `CacheKeyUtil` | class |  |  | 2 | 0 |  |

### `kd.bos.dataentity.serialization`

Path prefix: `javadoc/kd/bos/dataentity/serialization/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `DataEntityDeserializerOption` | class |  |  | 2 | 0 |  |
| `DataEntitySerializer` | class |  |  | 16 | 0 |  |
| `DataEntitySerializerOption` | class |  |  | 13 | 0 |  |
| `DcBinder` | class |  |  | 31 | 1 | yes |
| `DcJsonSerializer` | class | `kd.bos.dataentity.serialization.DcSerializer` |  | 6 | 2 |  |
| `DcSerializer` | class |  |  | 10 | 0 |  |
| `DcxmlSerializer` | class | `kd.bos.dataentity.serialization.DcSerializer` |  | 25 | 0 |  |
| `DynamicObjectSerializationBinder` | class | `kd.bos.dataentity.serialization.DcBinder` |  | 3 | 0 |  |
| `IDataEntityBinder` | interface |  |  | 1 | 0 |  |
| `ListDcxmlBinder` | class | `kd.bos.dataentity.serialization.DcBinder` |  | 2 | 0 |  |
| `LocaleStringSerializationUtils` | class |  |  | 1 | 0 |  |
| `SerializationUtils` | class |  |  | 14 | 0 |  |

### `kd.bos.dataentity.trace`

Path prefix: `javadoc/kd/bos/dataentity/trace/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `EntityTraceHint` | class |  |  | 7 | 0 |  |
| `EntityTraceSpan` | interface |  | `java.lang.AutoCloseable` | 19 | 0 |  |
| `EntityTracer` | class |  |  | 17 | 0 |  |

### `kd.bos.dataentity.utils`

Path prefix: `javadoc/kd/bos/dataentity/utils/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `ArrayUtils` | class |  |  | 207 | 20 |  |
| `CharSequenceUtils` | class |  |  | 2 | 0 |  |
| `CharUtils` | class |  |  | 24 | 2 |  |
| `ObjectUtils` | class |  |  | 40 | 0 |  |
| `OrmUtils` | class |  |  | 7 | 0 |  |
| `StringUtils` | class |  |  | 170 | 5 |  |
| `Uuid16` | class |  | `java.io.Serializable` | 2 | 0 |  |
| `Uuid8` | class |  | `java.io.Serializable` | 1 | 0 |  |
| `Validate` | class |  |  | 47 | 0 |  |
