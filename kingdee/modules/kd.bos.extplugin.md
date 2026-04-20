# kd.bos.extplugin

**业务扩展插件** · app=`bos` cloud=`bos` isv=`kingdee`

Class HTML path rule: `javadoc/<package-with-slashes>/<ClassName>.html`
Example: package `kd.bos.algo`, class `Algo` → `javadoc/kd/bos/algo/Algo.html`

Each class HTML contains a `cm={...}` JSON object on line 2 with full Javadoc:
`comment`, `declare`, `methods[]` (name/modifiers/returnType/paramNames/paramTypes/comment/tags/throwExceptions/annotations), `fields[]`, `interfaces`, `allInterfaces`, `isDeprecated`, `isPlugin`, `isService`.

## Packages

### `kd.bos.extplugin`

Path prefix: `javadoc/kd/bos/extplugin/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `AbstractStdExtPlugin` | class |  | `kd.bos.extplugin.StdExtPlugin` | 0 | 0 |  |
| `ExtEvent` | class |  |  | 4 | 0 |  |
| `PluginCall` | interface |  |  | 1 | 0 |  |
| `PluginFilter` | interface |  |  | 4 | 0 |  |
| `PluginModule` | class |  | `kd.sdk.module.Module` | 0 | 0 |  |
| `PluginProvider` | interface |  |  | 2 | 0 |  |
| `PluginProxy` | interface |  |  | 11 | 0 |  |
| `ScriptExtensionManager` | class |  |  | 2 | 0 |  |
| `StdExtPlugin` | interface |  |  | 2 | 0 |  |
| `StdExtPluginProxy` | class |  |  | 3 | 0 |  |
