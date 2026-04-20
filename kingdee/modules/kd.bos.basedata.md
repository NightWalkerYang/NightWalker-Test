# kd.bos.basedata

**基础数据** · app=`sys` cloud=`bos` isv=`kingdee`

Class HTML path rule: `javadoc/<package-with-slashes>/<ClassName>.html`
Example: package `kd.bos.algo`, class `Algo` → `javadoc/kd/bos/algo/Algo.html`

Each class HTML contains a `cm={...}` JSON object on line 2 with full Javadoc:
`comment`, `declare`, `methods[]` (name/modifiers/returnType/paramNames/paramTypes/comment/tags/throwExceptions/annotations), `fields[]`, `interfaces`, `allInterfaces`, `isDeprecated`, `isPlugin`, `isService`.

## Packages

### `kd.bos.basedata`

Path prefix: `javadoc/kd/bos/basedata/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `BaseDataModule` | class |  | `kd.sdk.module.Module` | 0 | 0 |  |

### `kd.bos.basedata.service`

Path prefix: `javadoc/kd/bos/basedata/service/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `BaseDataServiceImpl` | class | `kd.bos.basedata.service.AbstractBaseDataService` |  | 107 | 34 |  |

### `kd.bos.bd.engine`

Path prefix: `javadoc/kd/bos/bd/engine/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `BaseDataUseRelQueryEngine` | class | `kd.bos.bd.engine.AbstractBaseDataUseRelEngine` |  | 11 | 0 |  |

### `kd.bos.bd.pojo`

Path prefix: `javadoc/kd/bos/bd/pojo/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `BaseDataUseRelBit` | class |  |  | 5 | 0 |  |

### `kd.bos.bd.service`

Path prefix: `javadoc/kd/bos/bd/service/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `BaseDataCommonService` | class | `kd.bos.bd.service.AbstractBaseDataService` |  | 2 | 0 | yes |
