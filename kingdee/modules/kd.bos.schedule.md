# kd.bos.schedule

**调度计划** · app=`bos` cloud=`bos` isv=`kingdee`

Class HTML path rule: `javadoc/<package-with-slashes>/<ClassName>.html`
Example: package `kd.bos.algo`, class `Algo` → `javadoc/kd/bos/algo/Algo.html`

Each class HTML contains a `cm={...}` JSON object on line 2 with full Javadoc:
`comment`, `declare`, `methods[]` (name/modifiers/returnType/paramNames/paramTypes/comment/tags/throwExceptions/annotations), `fields[]`, `interfaces`, `allInterfaces`, `isDeprecated`, `isPlugin`, `isService`.

## Packages

### `kd.bos.schedule.api`

Path prefix: `javadoc/kd/bos/schedule/api/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `JobDispatcher` | interface |  |  | 18 | 0 |  |
| `JobInfo` | class |  | `java.io.Serializable` | 87 | 0 |  |
| `JobType` | enum |  |  | 1 | 5 |  |
| `MessageHandler` | interface |  |  | 3 | 0 |  |
| `PlanInfo` | class |  | `java.io.Serializable` | 34 | 0 |  |
| `ScheduleModule` | class |  | `kd.sdk.module.Module` | 0 | 0 |  |
| `ScheduleMsgInfo` | class |  |  | 18 | 0 |  |
| `ShardingParam` | class |  | `java.io.Serializable` | 7 | 0 |  |
| `ShardingTask` | interface |  | `kd.bos.schedule.api.Task` | 1 | 0 |  |
| `StopTask` | interface |  |  | 0 | 0 |  |
| `Task` | interface |  |  | 6 | 0 |  |
| `TaskInfo` | class |  | `java.io.Serializable` | 56 | 0 |  |
| `TaskStatusConstant` | class |  |  | 3 | 23 | yes |

### `kd.bos.schedule.executor`

Path prefix: `javadoc/kd/bos/schedule/executor/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `AbstractTask` | class |  |  | 7 | 1 |  |
| `JobClient` | class |  |  | 3 | 0 |  |

### `kd.bos.schedule.form`

Path prefix: `javadoc/kd/bos/schedule/form/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `AbstractTaskClick` | class |  | `kd.bos.schedule.form.TaskClick` | 11 | 0 |  |
| `JobForm` | class |  |  | 2 | 0 |  |
| `JobFormInfo` | class |  |  | 27 | 0 |  |
| `JobFromStatus` | enum |  |  | 2 | 2 |  |
| `TaskClick` | interface |  |  | 4 | 0 |  |
| `TaskClientProxy` | class |  |  | 12 | 0 |  |

### `kd.bos.schedule.form.event`

Path prefix: `javadoc/kd/bos/schedule/form/event/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `ClickEventArgs` | class |  |  | 2 | 0 |  |
| `ItemClickEventArgs` | class |  |  | 4 | 0 |  |

### `kd.bos.schedule.formplugin`

Path prefix: `javadoc/kd/bos/schedule/formplugin/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `CronStruct` | class |  |  | 17 | 0 |  |

### `kd.bos.schedule.server`

Path prefix: `javadoc/kd/bos/schedule/server/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `JobDispatcherProxy` | class |  |  | 20 | 0 |  |

### `kd.bos.schedule.server.schedulecreator`

Path prefix: `javadoc/kd/bos/schedule/server/schedulecreator/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `CronStruct` | class |  |  | 17 | 0 |  |
