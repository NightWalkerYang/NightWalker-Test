# kd.sdk.hr.hom

**玩美入职** · app=`hom` cloud=`hr` isv=`kingdee`

Class HTML path rule: `javadoc/<package-with-slashes>/<ClassName>.html`
Example: package `kd.bos.algo`, class `Algo` → `javadoc/kd/bos/algo/Algo.html`

Each class HTML contains a `cm={...}` JSON object on line 2 with full Javadoc:
`comment`, `declare`, `methods[]` (name/modifiers/returnType/paramNames/paramTypes/comment/tags/throwExceptions/annotations), `fields[]`, `interfaces`, `allInterfaces`, `isDeprecated`, `isPlugin`, `isService`.

## Packages

### `kd.sdk.hr.hom`

Path prefix: `javadoc/kd/sdk/hr/hom/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `SdkHRHomModule` | class |  | `kd.sdk.module.Module` | 0 | 0 |  |

### `kd.sdk.hr.hom.business.mservice.helper`

Path prefix: `javadoc/kd/sdk/hr/hom/business/mservice/helper/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `HOMLoginServiceHelper` | class |  |  | 1 | 0 |  |

### `kd.sdk.hr.hom.business.onbrd`

Path prefix: `javadoc/kd/sdk/hr/hom/business/onbrd/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `IConfirmOnbrdService` | interface |  |  | 2 | 0 |  |
| `IOnbrdService` | interface |  |  | 2 | 0 |  |
| `IPerChgBizParam` | interface |  |  | 1 | 0 |  |
| `IShareTaskService` | interface |  |  | 1 | 0 |  |

### `kd.sdk.hr.hom.business.personinfo`

Path prefix: `javadoc/kd/sdk/hr/hom/business/personinfo/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `IBankCardService` | interface |  | `kd.sdk.hr.hom.business.personinfo.IBasePeronInfoService` | 0 | 0 |  |
| `IBaseInfoService` | interface |  | `kd.sdk.hr.hom.business.personinfo.IHcfInfoPageService` | 0 | 0 |  |
| `ICanFamilyService` | interface |  | `kd.sdk.hr.hom.business.personinfo.IBasePeronInfoService` | 1 | 0 |  |
| `ICancontactService` | interface |  | `kd.sdk.hr.hom.business.personinfo.IBasePeronInfoService` | 0 | 0 |  |
| `ICertificateInfoService` | interface |  |  | 3 | 0 |  |
| `IContactInfoService` | interface |  | `kd.sdk.hr.hom.business.personinfo.IHcfInfoPageService` | 3 | 0 |  |
| `IEducationExpService` | interface |  |  | 5 | 0 |  |
| `ILanguageSkillService` | interface |  | `kd.sdk.hr.hom.business.personinfo.ITableValueInfoService` | 1 | 0 |  |
| `IPreviousWorkExpService` | interface |  | `kd.sdk.hr.hom.business.personinfo.ITableValueInfoService` | 0 | 0 |  |
| `IRsmpatinvService` | interface |  | `kd.sdk.hr.hom.business.personinfo.ITableValueInfoService` | 0 | 0 |  |

### `kd.sdk.hr.hom.mservice.helper`

Path prefix: `javadoc/kd/sdk/hr/hom/mservice/helper/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `HOMServiceHelper` | class |  |  | 3 | 0 |  |

### `kd.sdk.hr.hom.service`

Path prefix: `javadoc/kd/sdk/hr/hom/service/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `IHOMLoginService` | interface |  |  | 1 | 0 |  |
| `IOnbrdInfoService` | interface |  |  | 3 | 0 |  |
