# kd.bos.kdtx

**分布式事务** · app=`sys` cloud=`bos` isv=`kingdee`

Class HTML path rule: `javadoc/<package-with-slashes>/<ClassName>.html`
Example: package `kd.bos.algo`, class `Algo` → `javadoc/kd/bos/algo/Algo.html`

Each class HTML contains a `cm={...}` JSON object on line 2 with full Javadoc:
`comment`, `declare`, `methods[]` (name/modifiers/returnType/paramNames/paramTypes/comment/tags/throwExceptions/annotations), `fields[]`, `interfaces`, `allInterfaces`, `isDeprecated`, `isPlugin`, `isService`.

## Packages

### `kd.bos.kdtx`

Path prefix: `javadoc/kd/bos/kdtx/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `KdtxModule` | class |  | `kd.sdk.module.Module` | 0 | 0 |  |

### `kd.bos.kdtx.common`

Path prefix: `javadoc/kd/bos/kdtx/common/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `CommonParam` | class |  | `kd.bos.kdtx.common.Param` | 8 | 0 |  |
| `Param` | interface |  | `java.io.Serializable` | 0 | 0 |  |

### `kd.bos.kdtx.common.entity`

Path prefix: `javadoc/kd/bos/kdtx/common/entity/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `BranchExecuteInfo` | class |  | `java.io.Serializable` | 9 | 0 |  |
| `TxLogInfo` | class |  | `java.io.Serializable` | 14 | 0 |  |

### `kd.bos.kdtx.common.invoke`

Path prefix: `javadoc/kd/bos/kdtx/common/invoke/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `CommonDtxResponse` | class |  | `kd.bos.kdtx.common.invoke.DtxResponse` | 7 | 0 |  |
| `DtxBranch` | class |  | `java.io.Serializable` | 3 | 0 |  |
| `DtxGlobalResult` | class |  | `java.io.Serializable` | 2 | 0 |  |
| `DtxResponse` | interface |  | `java.io.Serializable` | 1 | 0 |  |
| `DtxResult` | class |  | `java.io.Serializable` | 5 | 0 |  |

### `kd.bos.kdtx.common.response`

Path prefix: `javadoc/kd/bos/kdtx/common/response/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `CompensateResponse` | class |  | `java.io.Serializable` | 2 | 0 |  |
| `CompensateResponse.TxInfo` | class |  | `java.io.Serializable` | 3 | 0 |  |

### `kd.bos.kdtx.sdk.api`

Path prefix: `javadoc/kd/bos/kdtx/sdk/api/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `DTXCallback` | interface |  |  | 1 | 0 |  |
| `EventualConsistencyService` | class |  |  | 1 | 0 |  |
| `KdtxBusinessHelper` | class |  |  | 6 | 0 |  |
| `TCCAdapterService` | class |  | `kd.bos.kdtx.sdk.api.TCCService` | 6 | 0 |  |
| `TCCServiceOnlyConfirm` | class | `kd.bos.kdtx.sdk.api.TCCAdapterService` |  | 0 | 0 |  |

### `kd.bos.kdtx.sdk.check`

Path prefix: `javadoc/kd/bos/kdtx/sdk/check/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `TxCheckUtil` | class |  |  | 6 | 0 |  |

### `kd.bos.kdtx.sdk.context`

Path prefix: `javadoc/kd/bos/kdtx/sdk/context/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `DtxContext` | class |  |  | 3 | 0 |  |

### `kd.bos.kdtx.sdk.session`

Path prefix: `javadoc/kd/bos/kdtx/sdk/session/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `AbstractSession` | class | `kd.bos.kdtx.sdk.session.ListenSession` | `kd.bos.kdtx.sdk.session.Session` | 7 | 1 |  |
| `DTX` | class |  |  | 4 | 0 |  |
| `DTXHandle` | class |  | `java.lang.AutoCloseable` | 10 | 0 |  |
| `DtxFactory` | class |  |  | 3 | 0 |  |

### `kd.bos.kdtx.sdk.session.ec`

Path prefix: `javadoc/kd/bos/kdtx/sdk/session/ec/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `ECGlobalSession` | class |  |  | 15 | 0 |  |
| `ECSession` | class | `kd.bos.kdtx.sdk.session.AbstractSession` |  | 7 | 0 |  |

### `kd.bos.kdtx.sdk.session.tcc`

Path prefix: `javadoc/kd/bos/kdtx/sdk/session/tcc/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `TCCGlobalSession` | class |  |  | 10 | 6 |  |
| `TCCSession` | class | `kd.bos.kdtx.sdk.session.AbstractSession` |  | 6 | 0 |  |
