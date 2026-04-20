# kd.bos.algo

**内存计算** · app=`sys` cloud=`bos` isv=`kingdee`

Class HTML path rule: `javadoc/<package-with-slashes>/<ClassName>.html`
Example: package `kd.bos.algo`, class `Algo` → `javadoc/kd/bos/algo/Algo.html`

Each class HTML contains a `cm={...}` JSON object on line 2 with full Javadoc:
`comment`, `declare`, `methods[]` (name/modifiers/returnType/paramNames/paramTypes/comment/tags/throwExceptions/annotations), `fields[]`, `interfaces`, `allInterfaces`, `isDeprecated`, `isPlugin`, `isService`.

## Packages

### `kd.bos.algo`

Path prefix: `javadoc/kd/bos/algo/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `Algo` | class |  |  | 13 | 0 |  |
| `AlgoContext` | interface |  | `java.io.Closeable`, `java.lang.AutoCloseable` | 1 | 0 |  |
| `AlgoException` | class | `java.lang.RuntimeException` |  | 10 | 0 |  |
| `AlgoModule` | class |  | `kd.sdk.module.Module` | 0 | 0 |  |
| `CacheHint` | class |  | `java.io.Serializable` | 15 | 1 |  |
| `CachedDataSet` | interface |  |  | 7 | 0 |  |
| `CachedDataSet.Builder` | interface |  |  | 3 | 0 |  |
| `Collector` | interface |  |  | 1 | 0 |  |
| `CustomAggFunction` | class |  |  | 7 | 0 |  |
| `CustomizedInput` | interface |  | `kd.bos.algo.Input`, `java.io.Closeable` | 2 | 0 |  |
| `CustomizedOutput` | interface |  | `kd.bos.algo.Output`, `java.io.Closeable` | 3 | 0 |  |
| `DataSet` | interface |  | `java.lang.AutoCloseable`, `java.lang.Iterable`, `java.util.Iterator` | 61 | 0 |  |
| `DataSet.Listener` | interface |  |  | 2 | 0 |  |
| `DataSetBuilder` | interface |  |  | 3 | 0 |  |
| `DataType` | class |  | `java.io.Serializable` | 16 | 23 |  |
| `Field` | class |  | `java.io.Serializable` | 16 | 0 |  |
| `FilterFunction` | class | `kd.bos.algox.Function` |  | 1 | 0 |  |
| `GroupbyDataSet` | interface |  |  | 23 | 0 |  |
| `HashJoinDataSet` | interface |  |  | 5 | 0 |  |
| `HashTable` | interface |  |  | 2 | 0 |  |
| `Input` | interface |  | `java.io.Serializable` | 1 | 0 |  |
| `JoinDataSet` | interface |  |  | 5 | 0 |  |
| `JoinHint` | class | `kd.bos.algo.Hint` |  | 6 | 0 |  |
| `JoinType` | enum |  |  | 1 | 5 |  |
| `MapFunction` | class | `kd.bos.algox.Function` | `kd.bos.algox.ResultAwarable` | 1 | 0 |  |
| `Output` | interface |  | `java.io.Serializable` | 2 | 0 |  |
| `ReduceGroupFunction` | class | `kd.bos.algox.Function` | `kd.bos.algox.ResultAwarable` | 1 | 0 |  |
| `ReduceGroupFunctionWithCollector` | class | `kd.bos.algox.Function` | `kd.bos.algox.ResultAwarable` | 1 | 0 |  |
| `Row` | interface |  | `kd.bos.algo.RowFeature` | 19 | 0 |  |
| `RowFeature` | interface |  |  | 1 | 0 |  |
| `RowMeta` | class |  | `java.io.Serializable` | 23 | 0 |  |
| `RowMetaFactory` | class |  |  | 1 | 0 |  |
| `RowUtil` | class |  |  | 4 | 0 |  |
| `SqlHint` | class |  |  | 3 | 1 |  |

### `kd.bos.algo.dataset`

Path prefix: `javadoc/kd/bos/algo/dataset/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `RowFactory` | class |  |  | 6 | 0 |  |

### `kd.bos.algo.dataset.cache`

Path prefix: `javadoc/kd/bos/algo/dataset/cache/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `CachedDataSetBuilder` | class |  | `kd.bos.algo.CachedDataSet.Builder` | 5 | 0 |  |

### `kd.bos.algo.datatype`

Path prefix: `javadoc/kd/bos/algo/datatype/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `AnyType` | class | `kd.bos.algo.DataType` |  | 3 | 1 |  |
| `BigDecimalType` | class | `kd.bos.algo.datatype.FractionalType` |  | 5 | 0 |  |
| `BooleanType` | class | `kd.bos.algo.DataType` |  | 4 | 0 |  |
| `DateType` | class | `kd.bos.algo.DataType` |  | 4 | 0 |  |
| `FractionalType` | class | `kd.bos.algo.datatype.NumericType` |  | 0 | 0 |  |
| `IntegerType` | class | `kd.bos.algo.datatype.IntegralType` |  | 4 | 0 |  |
| `IntegralType` | class | `kd.bos.algo.datatype.NumericType` |  | 2 | 0 |  |
| `LongType` | class | `kd.bos.algo.datatype.IntegralType` |  | 3 | 0 |  |
| `NullType` | class | `kd.bos.algo.DataType` |  | 4 | 0 |  |
| `NumericType` | class | `kd.bos.algo.DataType` |  | 5 | 1 |  |
| `StringType` | class | `kd.bos.algo.DataType` |  | 4 | 0 |  |
| `TimestampType` | class | `kd.bos.algo.DataType` |  | 4 | 0 |  |

### `kd.bos.algo.exception`

Path prefix: `javadoc/kd/bos/algo/exception/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `AlgoCrossThreadAccessDataSetException` | class | `kd.bos.algo.AlgoException` |  | 2 | 0 |  |
| `AlgoExceedAllowMaxDataSetsException` | class | `kd.bos.algo.AlgoException` |  | 4 | 0 |  |
| `AlgoExceedAllowMaxRows4SortException` | class | `kd.bos.algo.AlgoException` |  | 4 | 0 |  |
| `AlgoExceedAllowMaxRowsException` | class | `kd.bos.algo.AlgoException` |  | 4 | 0 |  |
| `AlgoExceedAllowMaxRowsToDiskException` | class | `kd.bos.algo.AlgoException` |  | 4 | 0 |  |
| `AlgoExceedCollectionAllowMaxCellsException` | class | `kd.bos.algo.AlgoException` |  | 4 | 0 |  |
| `AlgoTimeOutException` | class | `kd.bos.algo.AlgoException` |  | 2 | 0 |  |

### `kd.bos.algo.input`

Path prefix: `javadoc/kd/bos/algo/input/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `DataSetInput` | class |  |  | 4 | 0 |  |
| `DbInput` | class |  |  | 7 | 0 |  |
| `EmptyInput` | class |  |  | 2 | 0 |  |
| `IterableInput` | class |  |  | 3 | 0 |  |
| `IteratorInput` | class |  |  | 3 | 0 |  |
| `OqlInput` | class |  |  | 6 | 0 |  |
| `OrmInput` | class |  |  | 11 | 0 |  |

### `kd.bos.algo.output`

Path prefix: `javadoc/kd/bos/algo/output/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `DataSetCacheOutput` | class | `kd.bos.algo.output.AbstractOutput` |  | 5 | 0 |  |
| `DataSetOutput` | class | `kd.bos.algo.output.AbstractOutput` |  | 3 | 0 |  |
| `DbOutput` | class | `kd.bos.algo.output.AbstractOutput` |  | 13 | 0 |  |
| `IgnoreOutput` | class | `kd.bos.algo.output.AbstractOutput` |  | 1 | 0 |  |
| `PrintOutput` | class | `kd.bos.algo.output.AbstractOutput` |  | 1 | 0 |  |
