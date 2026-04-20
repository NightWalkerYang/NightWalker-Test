# kd.bos.fileservice

**FileService** · app=`sys` cloud=`bos` isv=`kingdee`

Class HTML path rule: `javadoc/<package-with-slashes>/<ClassName>.html`
Example: package `kd.bos.algo`, class `Algo` → `javadoc/kd/bos/algo/Algo.html`

Each class HTML contains a `cm={...}` JSON object on line 2 with full Javadoc:
`comment`, `declare`, `methods[]` (name/modifiers/returnType/paramNames/paramTypes/comment/tags/throwExceptions/annotations), `fields[]`, `interfaces`, `allInterfaces`, `isDeprecated`, `isPlugin`, `isService`.

## Packages

### `kd.bos.fileservice`

Path prefix: `javadoc/kd/bos/fileservice/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `BatchDownloadRequest` | class |  | `java.io.Serializable` | 8 | 1 |  |
| `BatchDownloadRequest.Dir` | class |  |  | 6 | 0 |  |
| `BatchDownloadRequest.File` | class |  |  | 4 | 0 |  |
| `FileItem` | class |  |  | 24 | 0 | yes |
| `FileService` | interface |  | `kd.bos.fileservice.preview.PreviewService` | 17 | 0 | yes |
| `FileServiceFactory` | class |  |  | 2 | 0 |  |
| `FileServiceModule` | class |  | `kd.sdk.module.Module` | 0 | 0 |  |

### `kd.bos.filestorage.spi`

Path prefix: `javadoc/kd/bos/filestorage/spi/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `FileStorageConfig` | class |  |  | 20 | 0 |  |
| `FileStorageService` | interface |  | `java.io.Closeable` | 9 | 0 |  |
