# kd.hbp.basetemplate

**HR基础模型模板** · app=`hbp` cloud=`hrmp` isv=`kingdee`

Class HTML path rule: `javadoc/<package-with-slashes>/<ClassName>.html`
Example: package `kd.bos.algo`, class `Algo` → `javadoc/kd/bos/algo/Algo.html`

Each class HTML contains a `cm={...}` JSON object on line 2 with full Javadoc:
`comment`, `declare`, `methods[]` (name/modifiers/returnType/paramNames/paramTypes/comment/tags/throwExceptions/annotations), `fields[]`, `interfaces`, `allInterfaces`, `isDeprecated`, `isPlugin`, `isService`.

## Packages

### `kd.hr.hbp.business.openservicehelper.basedata`

Path prefix: `javadoc/kd/hr/hbp/business/openservicehelper/basedata/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `HRBaseDataModelModule` | class |  | `kd.sdk.module.Module` | 0 | 0 |  |

### `kd.hr.hbp.formplugin.web`

Path prefix: `javadoc/kd/hr/hbp/formplugin/web/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `HRCoreBaseBillEdit` | class | `AbstractBillPlugIn` |  | 0 | 0 |  |
| `HRCoreBaseBillList` | class | `AbstractListPlugin` |  | 0 | 0 |  |
| `HRDataBaseEdit` | class | `AbstractBasePlugIn` |  | 12 | 0 | yes |
| `HRDataBaseList` | class | `AbstractListPlugin` |  | 0 | 0 |  |

### `kd.hr.hbp.formplugin.web.template`

Path prefix: `javadoc/kd/hr/hbp/formplugin/web/template/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `HRBaseDataTplEdit` | class | `kd.hr.hbp.formplugin.web.HRDataBaseEdit` |  | 6 | 1 | yes |
| `HRBaseDataTplList` | class | `kd.hr.hbp.formplugin.web.HRDataBaseList` |  | 6 | 0 | yes |
