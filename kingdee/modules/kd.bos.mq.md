# kd.bos.mq

**MQ服务** · app=`sys` cloud=`bos` isv=`kingdee`

Class HTML path rule: `javadoc/<package-with-slashes>/<ClassName>.html`
Example: package `kd.bos.algo`, class `Algo` → `javadoc/kd/bos/algo/Algo.html`

Each class HTML contains a `cm={...}` JSON object on line 2 with full Javadoc:
`comment`, `declare`, `methods[]` (name/modifiers/returnType/paramNames/paramTypes/comment/tags/throwExceptions/annotations), `fields[]`, `interfaces`, `allInterfaces`, `isDeprecated`, `isPlugin`, `isService`.

## Packages

### `kd.bos.mq`

Path prefix: `javadoc/kd/bos/mq/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `MQFactory` | class |  |  | 3 | 0 |  |
| `MessageAcker` | interface |  |  | 3 | 0 |  |
| `MessageConsumer` | interface |  |  | 2 | 0 |  |
| `MessagePublisher` | interface |  |  | 11 | 0 |  |
| `MessageServiceModule` | class |  | `kd.sdk.module.Module` | 0 | 0 |  |

### `kd.bos.mq.broadcast`

Path prefix: `javadoc/kd/bos/mq/broadcast/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `BroadcastService` | class |  |  | 4 | 0 |  |

### `kd.bos.mq.support`

Path prefix: `javadoc/kd/bos/mq/support/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `MQCreateFactory` | class | `kd.bos.mq.MQFactory` |  | 2 | 0 |  |

### `kd.bos.mq.support.partition`

Path prefix: `javadoc/kd/bos/mq/support/partition/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `PartitionStrategy` | enum |  |  | 0 | 1 |  |
