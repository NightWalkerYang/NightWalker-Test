# kd.sdk.base

**SDK定义模型** · app=`sys` cloud=`bos` isv=`kingdee`

Class HTML path rule: `javadoc/<package-with-slashes>/<ClassName>.html`
Example: package `kd.bos.algo`, class `Algo` → `javadoc/kd/bos/algo/Algo.html`

Each class HTML contains a `cm={...}` JSON object on line 2 with full Javadoc:
`comment`, `declare`, `methods[]` (name/modifiers/returnType/paramNames/paramTypes/comment/tags/throwExceptions/annotations), `fields[]`, `interfaces`, `allInterfaces`, `isDeprecated`, `isPlugin`, `isService`.

## Packages

### `kd.sdk`

Path prefix: `javadoc/kd/sdk/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `SdkBaseModule` | class |  | `kd.sdk.module.Module` | 0 | 0 |  |

### `kd.sdk.annotation`

Path prefix: `javadoc/kd/sdk/annotation/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `SdkBeta` | interface |  | `java.lang.annotation.Annotation` | 0 | 0 |  |
| `SdkDeprecated` | interface |  | `java.lang.annotation.Annotation` | 0 | 0 |  |
| `SdkInternal` | interface |  | `java.lang.annotation.Annotation` | 0 | 0 |  |
| `SdkModule` | interface |  | `java.lang.annotation.Annotation` | 6 | 0 |  |
| `SdkPackage` | interface |  | `java.lang.annotation.Annotation` | 1 | 0 |  |
| `SdkPlugin` | interface |  | `java.lang.annotation.Annotation` | 1 | 0 |  |
| `SdkPublic` | interface |  | `java.lang.annotation.Annotation` | 1 | 0 |  |
| `SdkSPI` | interface |  | `java.lang.annotation.Annotation` | 1 | 0 |  |
| `SdkService` | interface |  | `java.lang.annotation.Annotation` | 1 | 0 |  |
| `SdkScriptBound` | interface |  | `java.lang.annotation.Annotation` | 1 | 0 |  |
| `SdkScriptUnBound` | interface |  | `java.lang.annotation.Annotation` | 0 | 0 |  |
| `SdkScriptWrapper` | interface |  | `java.lang.annotation.Annotation` | 5 | 0 |  |

### `kd.sdk.kingscript.debug`

Path prefix: `javadoc/kd/sdk/kingscript/debug/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `DebugOptions` | class |  |  | 6 | 0 |  |

### `kd.sdk.kingscript.engine.reflect`

Path prefix: `javadoc/kd/sdk/kingscript/engine/reflect/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `EngineInfo` | class |  |  | 4 | 0 |  |

### `kd.sdk.kingscript.lib`

Path prefix: `javadoc/kd/sdk/kingscript/lib/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `LibModule` | interface |  |  | 14 | 2 | yes |

### `kd.sdk.kingscript.pool`

Path prefix: `javadoc/kd/sdk/kingscript/pool/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `KingScriptEnginePool` | class |  |  | 18 | 0 |  |

### `kd.sdk.kingscript.test`

Path prefix: `javadoc/kd/sdk/kingscript/test/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `KSUnitTestResult` | class |  | `java.io.Serializable` | 3 | 0 | yes |

### `kd.sdk.kingscript.types`

Path prefix: `javadoc/kd/sdk/kingscript/types/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `ScriptIterator` | interface |  |  | 3 | 0 |  |

### `kd.sdk.kingscript.types.builtins`

Path prefix: `javadoc/kd/sdk/kingscript/types/builtins/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `ScriptDate` | class |  | `kd.sdk.kingscript.types.wrapper.ScriptProxyWrapper` | 15 | 0 |  |
| `ScriptExecutableWrapper` | class |  | `kd.sdk.kingscript.types.wrapper.ScriptObjectWrapper` | 3 | 0 |  |

### `kd.sdk.module`

Path prefix: `javadoc/kd/sdk/module/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `Module` | interface |  |  | 2 | 0 |  |

### `kd.sdk.plugin`

Path prefix: `javadoc/kd/sdk/plugin/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `Plugin` | interface |  |  | 0 | 0 |  |

### `kd.sdk.service`

Path prefix: `javadoc/kd/sdk/service/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `Service` | interface |  |  | 0 | 0 |  |

### `kd.sdk.spi`

Path prefix: `javadoc/kd/sdk/spi/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `SPIConfigurationException` | class | `java.lang.RuntimeException` |  | 1 | 0 |  |
| `ServiceLoader` | class |  |  | 2 | 0 |  |
