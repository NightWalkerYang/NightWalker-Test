# kd.bos.algox

**分布式计算** · app=`sys` cloud=`bos` isv=`kingdee`

Class HTML path rule: `javadoc/<package-with-slashes>/<ClassName>.html`
Example: package `kd.bos.algo`, class `Algo` → `javadoc/kd/bos/algo/Algo.html`

Each class HTML contains a `cm={...}` JSON object on line 2 with full Javadoc:
`comment`, `declare`, `methods[]` (name/modifiers/returnType/paramNames/paramTypes/comment/tags/throwExceptions/annotations), `fields[]`, `interfaces`, `allInterfaces`, `isDeprecated`, `isPlugin`, `isService`.

## Packages

### `kd.bos.algox`

Path prefix: `javadoc/kd/bos/algox/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `AlgoX` | class |  |  | 2 | 0 |  |
| `AlgoXCallBack` | interface |  |  | 2 | 0 |  |
| `AlgoXModule` | class |  | `kd.sdk.module.Module` | 0 | 0 |  |
| `CancelTimeoutException` | class | `kd.bos.algo.AlgoException` |  | 0 | 0 |  |
| `CoGroupDataSetX` | class | `kd.bos.algox.core.AbstractDataSetX` |  | 1 | 0 |  |
| `CoGroupFunction` | class | `kd.bos.algox.Function` | `kd.bos.algox.ResultAwarable` | 1 | 0 |  |
| `Collector` | interface |  |  | 1 | 0 |  |
| `CommitTimeoutException` | class | `kd.bos.algo.AlgoException` |  | 0 | 0 |  |
| `DataSetX` | interface |  |  | 34 | 0 |  |
| `FilterFunction` | class | `kd.bos.algox.Function` |  | 1 | 0 |  |
| `FlatMapFunction` | class | `kd.bos.algox.Function` | `kd.bos.algox.ResultAwarable` | 1 | 0 |  |
| `GroupCombineFunction` | class | `kd.bos.algox.Function` | `kd.bos.algox.ResultAwarable` | 1 | 0 |  |
| `GroupCombineReduceFunction` | class | `kd.bos.algox.Function` | `kd.bos.algox.ResultAwarable`, `kd.bos.algox.ResultConvertable` | 2 | 0 |  |
| `GroupReduceFunction` | class | `kd.bos.algox.Function` | `kd.bos.algox.ResultAwarable`, `kd.bos.algox.ResultConvertable` | 1 | 0 |  |
| `Grouper` | class |  |  | 11 | 0 |  |
| `JobSession` | class |  |  | 15 | 0 |  |
| `JoinDataSetX` | class | `kd.bos.algox.core.AbstractDataSetX` |  | 4 | 0 |  |
| `JoinFunction` | class | `kd.bos.algox.Function` | `kd.bos.algox.ResultAwarable` | 1 | 0 |  |
| `MapFunction` | class | `kd.bos.algox.Function` | `kd.bos.algox.ResultAwarable` | 1 | 0 |  |
| `ResultAwarable` | interface |  |  | 1 | 0 |  |
| `RowX` | class |  | `kd.bos.algo.RowFeature`, `java.io.Serializable` | 16 | 0 |  |
| `RunningTimeoutException` | class | `kd.bos.algo.AlgoException` |  | 0 | 0 |  |
