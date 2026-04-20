# kd.sdk.wtc.wtes

**考勤核算** · app=`wtes` cloud=`wtc` isv=`kingdee`

Class HTML path rule: `javadoc/<package-with-slashes>/<ClassName>.html`
Example: package `kd.bos.algo`, class `Algo` → `javadoc/kd/bos/algo/Algo.html`

Each class HTML contains a `cm={...}` JSON object on line 2 with full Javadoc:
`comment`, `declare`, `methods[]` (name/modifiers/returnType/paramNames/paramTypes/comment/tags/throwExceptions/annotations), `fields[]`, `interfaces`, `allInterfaces`, `isDeprecated`, `isPlugin`, `isService`.

## Packages

### `kd.sdk.wtc.wtes`

Path prefix: `javadoc/kd/sdk/wtc/wtes/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `SdkWtcWtesModule` | class |  | `kd.sdk.module.Module` | 0 | 0 |  |

### `kd.sdk.wtc.wtes.business.qte`

Path prefix: `javadoc/kd/sdk/wtc/wtes/business/qte/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `QteContextExt` | interface |  |  | 5 | 0 |  |
| `QteRequest` | interface |  |  | 15 | 0 |  |

### `kd.sdk.wtc.wtes.business.qte.executor`

Path prefix: `javadoc/kd/sdk/wtc/wtes/business/qte/executor/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `AfterQteGenQTEvent` | class |  |  | 10 | 0 | yes |
| `QteGenQTExtPlugin` | interface |  |  | 8 | 0 |  |
| `QuotaDetail` | class |  |  | 27 | 10 | yes |
| `QuotaDetailInOut` | class | `kd.sdk.wtc.wtes.business.qte.executor.QuotaDetail` |  | 2 | 0 | yes |
| `QuotaDetailOverdraw` | class | `kd.sdk.wtc.wtes.business.qte.executor.QuotaDetail` |  | 3 | 0 | yes |
| `QuotaDetailOverdrawQl` | class | `kd.sdk.wtc.wtes.business.qte.executor.QuotaDetail` |  | 3 | 0 | yes |
| `QuotaDetailQualification` | class | `kd.sdk.wtc.wtes.business.qte.executor.QuotaDetail` |  | 2 | 0 | yes |
| `QuotaDetailStandard` | class | `kd.sdk.wtc.wtes.business.qte.executor.QuotaDetail` |  | 4 | 0 | yes |
| `QuotaDetailUse` | class | `kd.sdk.wtc.wtes.business.qte.executor.QuotaDetail` |  | 3 | 0 | yes |
| `QuotaDetailUseQualification` | class | `kd.sdk.wtc.wtes.business.qte.executor.QuotaDetail` |  | 2 | 0 | yes |

### `kd.sdk.wtc.wtes.business.qte.gendate`

Path prefix: `javadoc/kd/sdk/wtc/wtes/business/qte/gendate/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `AfterQteNoGenDateEvent` | class |  |  | 11 | 0 | yes |
| `QteNoGenDateResolutionExtPlugin` | interface |  |  | 1 | 0 |  |

### `kd.sdk.wtc.wtes.business.qte.init`

Path prefix: `javadoc/kd/sdk/wtc/wtes/business/qte/init/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `AfterQteAllParamInitEvent` | class |  |  | 5 | 0 | yes |
| `AfterQteParamInitEvent` | class |  |  | 6 | 0 | yes |
| `QteParamInitExtPlugin` | interface |  |  | 2 | 0 |  |
| `QteParamInitRequest` | class |  |  | 5 | 0 | yes |

### `kd.sdk.wtc.wtes.business.qte.init.model`

Path prefix: `javadoc/kd/sdk/wtc/wtes/business/qte/init/model/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `DataPoint` | class |  |  | 6 | 0 | yes |
| `QuotaGenConditionExt` | class |  |  | 2 | 1 | yes |

### `kd.sdk.wtc.wtes.business.qte.refdate`

Path prefix: `javadoc/kd/sdk/wtc/wtes/business/qte/refdate/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `AfterQteResolveRefDateEvent` | class |  |  | 11 | 0 | yes |
| `QteRefDateResolutionExtPlugin` | interface |  |  | 1 | 0 |  |

### `kd.sdk.wtc.wtes.business.qte.varcondition`

Path prefix: `javadoc/kd/sdk/wtc/wtes/business/qte/varcondition/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `AfterQteResolveVarConditionEvent` | class |  |  | 13 | 0 | yes |
| `QteVarConditionResolutionExtPlugin` | interface |  |  | 1 | 0 |  |

### `kd.sdk.wtc.wtes.business.tie.core.chain`

Path prefix: `javadoc/kd/sdk/wtc/wtes/business/tie/core/chain/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `TieContentPersistentExt` | interface |  |  | 5 | 0 |  |
| `TieContextExt` | interface |  |  | 14 | 0 |  |

### `kd.sdk.wtc.wtes.business.tie.core.chain.period`

Path prefix: `javadoc/kd/sdk/wtc/wtes/business/tie/core/chain/period/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `TieAttPeriodContextExt` | interface |  |  | 6 | 0 |  |

### `kd.sdk.wtc.wtes.business.tie.core.init`

Path prefix: `javadoc/kd/sdk/wtc/wtes/business/tie/core/init/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `AfterTieAllParamInitEvent` | class |  |  | 5 | 0 | yes |
| `TieParamInitExtPlugin` | interface |  |  | 1 | 0 |  |

### `kd.sdk.wtc.wtes.business.tie.exexutor.att`

Path prefix: `javadoc/kd/sdk/wtc/wtes/business/tie/exexutor/att/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `AfterExecAttendanceEvent` | class |  |  | 4 | 0 | yes |
| `AfterExecAttendanceParam` | interface |  | `kd.sdk.wtc.wtes.business.tie.exexutor.common.AfterExecDailyChainParam` | 1 | 0 |  |
| `AttEvaluatorExpService` | interface |  |  | 1 | 0 |  |
| `AttEvaluatorExpServiceDefault` | class |  | `kd.sdk.wtc.wtes.business.tie.exexutor.att.AttEvaluatorExpService` | 1 | 0 |  |
| `OnEvaluateAttendanceEndEvent` | class |  |  | 8 | 2 | yes |
| `TieExecAttendanceExtPlugin` | interface |  |  | 1 | 0 |  |

### `kd.sdk.wtc.wtes.business.tie.exexutor.common`

Path prefix: `javadoc/kd/sdk/wtc/wtes/business/tie/exexutor/common/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `AfterExecDailyChainParam` | interface |  |  | 5 | 2 |  |

### `kd.sdk.wtc.wtes.business.tie.exexutor.daily`

Path prefix: `javadoc/kd/sdk/wtc/wtes/business/tie/exexutor/daily/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `ExecDailyEvaluatorEvent` | interface |  |  | 4 | 0 |  |
| `TieAttDailyEvaluatorExtPlugin` | interface |  |  | 1 | 0 |  |

### `kd.sdk.wtc.wtes.business.tie.exexutor.ex`

Path prefix: `javadoc/kd/sdk/wtc/wtes/business/tie/exexutor/ex/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `AfterExecExEvent` | class |  |  | 4 | 0 | yes |
| `AfterExecExParam` | interface |  | `kd.sdk.wtc.wtes.business.tie.exexutor.common.AfterExecDailyChainParam` | 2 | 0 |  |
| `ExAttItemInstanceExtDTO` | class |  |  | 25 | 0 | yes |
| `ExEvaluatorExpServiceDefault` | class |  | `kd.sdk.wtc.wtes.business.tie.exexutor.ex.ExEvaluatorExpService` | 1 | 0 |  |
| `TieExecExExtPlugin` | interface |  |  | 1 | 0 |  |

### `kd.sdk.wtc.wtes.business.tie.exexutor.otcal`

Path prefix: `javadoc/kd/sdk/wtc/wtes/business/tie/exexutor/otcal/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `AfterExecOvertimeEvent` | class |  |  | 3 | 0 |  |
| `AfterExecOvertimeParam` | interface |  | `kd.sdk.wtc.wtes.business.tie.exexutor.common.AfterExecDailyChainParam` | 1 | 0 |  |
| `TieExecOvertimeExtPlugin` | interface |  |  | 1 | 0 |  |

### `kd.sdk.wtc.wtes.business.tie.exexutor.period`

Path prefix: `javadoc/kd/sdk/wtc/wtes/business/tie/exexutor/period/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `TieAttPeriodEvaluatorExt` | interface |  |  | 1 | 0 |  |
| `TieExecPerPeriodSummaryExtPlugin` | interface |  |  | 1 | 0 |  |

### `kd.sdk.wtc.wtes.business.tie.exexutor.tvl`

Path prefix: `javadoc/kd/sdk/wtc/wtes/business/tie/exexutor/tvl/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `AfterExecBusinessTripEvent` | class |  |  | 3 | 0 |  |
| `AfterExecBusinessTripParam` | interface |  | `kd.sdk.wtc.wtes.business.tie.exexutor.common.AfterExecDailyChainParam` | 1 | 0 |  |
| `TieExecBusinessTripExtPlugin` | interface |  |  | 1 | 0 |  |

### `kd.sdk.wtc.wtes.business.tie.exexutor.va`

Path prefix: `javadoc/kd/sdk/wtc/wtes/business/tie/exexutor/va/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `AfterExecVacationEvent` | class |  |  | 3 | 0 |  |
| `AfterExecVacationParam` | interface |  | `kd.sdk.wtc.wtes.business.tie.exexutor.common.AfterExecDailyChainParam` | 1 | 0 |  |
| `TieExecVacationExtPlugin` | interface |  |  | 1 | 0 |  |

### `kd.sdk.wtc.wtes.business.tie.init.accountplan`

Path prefix: `javadoc/kd/sdk/wtc/wtes/business/tie/init/accountplan/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `TieSchemeExtPlugin` | interface |  |  | 2 | 0 |  |

### `kd.sdk.wtc.wtes.business.tie.init.attfile`

Path prefix: `javadoc/kd/sdk/wtc/wtes/business/tie/init/attfile/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `AttFileQueryParamExt` | interface |  |  | 8 | 0 |  |
| `OnQueryInitParamOfAttFileEvent` | class |  |  | 4 | 0 | yes |
| `TieInitAttFileExtPlugin` | interface |  |  | 1 | 0 |  |

### `kd.sdk.wtc.wtes.business.tie.init.attitemspec`

Path prefix: `javadoc/kd/sdk/wtc/wtes/business/tie/init/attitemspec/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `OnQueryInitParamOfAttItemSpecEvent` | class |  |  | 2 | 0 | yes |
| `TieInitAttItemSpecExtPlugin` | interface |  |  | 1 | 0 |  |

### `kd.sdk.wtc.wtes.business.tie.init.bill`

Path prefix: `javadoc/kd/sdk/wtc/wtes/business/tie/init/bill/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `VaBillInitExpService` | interface |  |  | 1 | 0 |  |
| `VaTimeBucketSplitExtPlugin` | interface |  |  | 1 | 0 |  |

### `kd.sdk.wtc.wtes.business.tie.init.configmix`

Path prefix: `javadoc/kd/sdk/wtc/wtes/business/tie/init/configmix/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `ConfigMixInitPluginDemo` | class |  | `kd.sdk.wtc.wtes.business.tie.init.configmix.TieConfigMixInitPlugin` | 1 | 0 |  |
| `TieConfigMixInitPlugin` | interface |  |  | 1 | 0 |  |
| `TieConfigMixQueryEvent` | class |  |  | 5 | 0 | yes |

### `kd.sdk.wtc.wtes.business.tie.init.logiccard`

Path prefix: `javadoc/kd/sdk/wtc/wtes/business/tie/init/logiccard/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `OnQueryInitParamOfLogicCardEvent` | class |  |  | 4 | 0 | yes |
| `TieInitEffectiveCardExtPlugin` | interface |  |  | 2 | 0 |  |

### `kd.sdk.wtc.wtes.business.tie.init.perattperiod`

Path prefix: `javadoc/kd/sdk/wtc/wtes/business/tie/init/perattperiod/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `OnQueryInitParamOfPerAttPeriodEvent` | class |  |  | 4 | 0 | yes |
| `PerAttPeriodQueryParamExt` | interface |  |  | 8 | 0 |  |
| `TieInitAttPeriodExtPlugin` | interface |  |  | 1 | 0 |  |

### `kd.sdk.wtc.wtes.business.tie.model.accountplan`

Path prefix: `javadoc/kd/sdk/wtc/wtes/business/tie/model/accountplan/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `TieSchemeExt` | class |  |  | 2 | 0 |  |

### `kd.sdk.wtc.wtes.business.tie.model.attconfig`

Path prefix: `javadoc/kd/sdk/wtc/wtes/business/tie/model/attconfig/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `AttRuleCalExt` | interface |  |  | 3 | 0 |  |
| `AttRuleExt` | interface |  | `kd.sdk.wtc.wtbs.common.timeseq.TimeSeqVersionExt` | 5 | 0 |  |
| `AttendConfigExt` | interface |  | `kd.sdk.wtc.wtbs.common.timeseq.TimeSeqVersionExt` | 2 | 2 |  |

### `kd.sdk.wtc.wtes.business.tie.model.attenperson`

Path prefix: `javadoc/kd/sdk/wtc/wtes/business/tie/model/attenperson/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `AttendPersonExt` | interface |  |  | 7 | 0 |  |
| `CmpEmpExt` | interface |  | `kd.sdk.wtc.wtbs.common.timeseq.TimeSeqVersionExt` | 8 | 0 |  |
| `ContrWorkLocExt` | interface |  | `kd.sdk.wtc.wtbs.common.timeseq.TimeSeqVersionExt` | 1 | 0 |  |
| `EmpEntRelExt` | interface |  | `kd.sdk.wtc.wtbs.common.timeseq.TimeSeqVersionExt` | 4 | 0 |  |
| `EmpJobRelExt` | interface |  | `kd.sdk.wtc.wtbs.common.timeseq.TimeSeqVersionExt` | 15 | 0 |  |
| `EmpPosOrgRelExt` | interface |  | `kd.sdk.wtc.wtbs.common.timeseq.TimeSeqVersionExt` | 13 | 0 |  |
| `EmployeeExt` | interface |  | `kd.sdk.wtc.wtbs.common.timeseq.TimeSeqVersionExt` | 8 | 0 |  |
| `PerNonTsPropExt` | interface |  |  | 9 | 0 |  |
| `PersonExt` | interface |  |  | 7 | 0 |  |
| `TrialPeriodExt` | interface |  | `kd.sdk.wtc.wtbs.common.timeseq.TimeSeqVersionExt` | 2 | 0 |  |

### `kd.sdk.wtc.wtes.business.tie.model.attfile`

Path prefix: `javadoc/kd/sdk/wtc/wtes/business/tie/model/attfile/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `AttFileExt` | interface |  | `kd.sdk.wtc.wtbs.common.timeseq.TimeSeqVersionExt`, `kd.sdk.wtc.wtes.business.tie.model.common.DataAttributeExtendable` | 23 | 0 |  |
| `AttFileScheduleEntityExt` | interface |  |  | 4 | 0 |  |
| `AttStateExt` | interface |  |  | 12 | 0 |  |
| `TimeZoneExt` | interface |  |  | 2 | 0 |  |

### `kd.sdk.wtc.wtes.business.tie.model.attitem`

Path prefix: `javadoc/kd/sdk/wtc/wtes/business/tie/model/attitem/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `AttItemInstanceExt` | class |  |  | 6 | 0 |  |
| `AttItemSpecExt` | interface |  | `kd.sdk.wtc.wtbs.common.timeseq.TimeSeqVersionExt`, `kd.sdk.wtc.wtes.business.tie.model.common.DataAttributeExtendable` | 14 | 0 |  |
| `ExAttItemInstanceExt` | class | `kd.sdk.wtc.wtes.business.tie.model.attitem.AttItemInstanceExt` |  | 13 | 0 |  |
| `PeriodAttItemInstanceExt` | class |  |  | 4 | 0 | yes |

### `kd.sdk.wtc.wtes.business.tie.model.card`

Path prefix: `javadoc/kd/sdk/wtc/wtes/business/tie/model/card/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `LogicCardExt` | interface |  | `kd.sdk.wtc.wtes.business.tie.model.common.DataAttributeExtendable` | 5 | 0 |  |

### `kd.sdk.wtc.wtes.business.tie.model.common`

Path prefix: `javadoc/kd/sdk/wtc/wtes/business/tie/model/common/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `DataAttributeExtendable` | interface |  |  | 2 | 0 |  |
| `TieAttFileBoExt` | interface |  |  | 4 | 0 |  |
| `TieAttFileVersionExt` | interface |  |  | 3 | 0 |  |
| `TieAttSubjectExt` | interface |  |  | 4 | 0 |  |

### `kd.sdk.wtc.wtes.business.tie.model.ex`

Path prefix: `javadoc/kd/sdk/wtc/wtes/business/tie/model/ex/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `ExConfigExt` | interface |  | `kd.sdk.wtc.wtbs.common.timeseq.TimeSeqVersionExt` | 9 | 0 |  |
| `ExRulePackageExt` | interface |  | `kd.sdk.wtc.wtbs.common.timeseq.TimeSeqVersionExt` | 3 | 0 |  |

### `kd.sdk.wtc.wtes.business.tie.model.ex.enums`

Path prefix: `javadoc/kd/sdk/wtc/wtes/business/tie/model/ex/enums/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `DurationUnitEnumExt` | enum |  |  | 2 | 5 | yes |
| `ExDealTypeEnumExt` | enum |  |  | 2 | 3 | yes |

### `kd.sdk.wtc.wtes.business.tie.model.init`

Path prefix: `javadoc/kd/sdk/wtc/wtes/business/tie/model/init/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `TieRequestBaseExt` | interface |  |  | 3 | 0 |  |
| `TieRequestExt` | interface |  | `kd.sdk.wtc.wtes.business.tie.model.init.TieRequestBaseExt` | 4 | 0 |  |

### `kd.sdk.wtc.wtes.business.tie.model.otcal`

Path prefix: `javadoc/kd/sdk/wtc/wtes/business/tie/model/otcal/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `OtRuleCalCompenConfigExt` | interface |  |  | 9 | 0 |  |
| `OtRuleCalConfigExt` | interface |  |  | 9 | 0 |  |
| `OtRulePackageExt` | interface |  | `kd.sdk.wtc.wtbs.common.timeseq.TimeSeqVersionExt` | 1 | 0 |  |
| `OtSubConfigExt` | interface |  | `kd.sdk.wtc.wtbs.common.timeseq.TimeSeqVersionExt` | 6 | 0 |  |
| `OtSubTimeItemExt` | interface |  |  | 2 | 0 |  |

### `kd.sdk.wtc.wtes.business.tie.model.perattperiod`

Path prefix: `javadoc/kd/sdk/wtc/wtes/business/tie/model/perattperiod/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `PerAttPeriodExt` | interface |  | `kd.sdk.wtc.wtes.business.tie.model.common.DataAttributeExtendable` | 18 | 0 |  |

### `kd.sdk.wtc.wtes.business.tie.model.roster`

Path prefix: `javadoc/kd/sdk/wtc/wtes/business/tie/model/roster/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `DateTypeExt` | interface |  |  | 3 | 0 |  |
| `RosterExt` | interface |  |  | 7 | 0 |  |
| `RosterExtMap` | interface |  |  | 1 | 0 |  |
| `ShiftMiddleRuleExt` | interface |  |  | 6 | 0 |  |
| `ShiftSessionExt` | interface |  |  | 11 | 0 |  |
| `ShiftSpecExt` | interface |  |  | 18 | 2 | yes |

### `kd.sdk.wtc.wtes.business.tie.model.timebucket`

Path prefix: `javadoc/kd/sdk/wtc/wtes/business/tie/model/timebucket/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `AttBillTimeBucketExt` | interface |  |  | 17 | 0 | yes |
| `TimeBucketExt` | interface |  |  | 4 | 0 |  |

### `kd.sdk.wtc.wtes.business.tie.model.tvl`

Path prefix: `javadoc/kd/sdk/wtc/wtes/business/tie/model/tvl/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `TravelRuleExt` | interface |  | `kd.sdk.wtc.wtbs.common.timeseq.TimeSeqVersionExt` | 1 | 0 |  |

### `kd.sdk.wtc.wtes.business.tie.model.va`

Path prefix: `javadoc/kd/sdk/wtc/wtes/business/tie/model/va/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `VaBaseSetPackageExt` | interface |  | `kd.sdk.wtc.wtbs.common.timeseq.TimeSeqVersionExt` | 3 | 5 |  |
| `VaCalculateRuleExt` | interface |  |  | 12 | 0 |  |
| `VaRulePackageExt` | interface |  | `kd.sdk.wtc.wtbs.common.timeseq.TimeSeqVersionExt` | 1 | 0 |  |

### `kd.sdk.wtc.wtes.business.tie.persistent.clean`

Path prefix: `javadoc/kd/sdk/wtc/wtes/business/tie/persistent/clean/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `AfterCleanExDataEvent` | class |  |  | 3 | 0 | yes |
| `AfterCleanHisDataEvent` | class |  |  | 3 | 0 | yes |
| `TieCleanExDataExtPlugin` | interface |  |  | 1 | 0 |  |
| `TieCleanHisDataExtPlugin` | interface |  |  | 1 | 0 |  |

### `kd.sdk.wtc.wtes.business.tie.persistent.daily`

Path prefix: `javadoc/kd/sdk/wtc/wtes/business/tie/persistent/daily/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `BeforeSaveDailyDataResultEvent` | class |  |  | 3 | 0 | yes |
| `TieSaveDailyDataExtPlugin` | interface |  |  | 1 | 0 |  |

### `kd.sdk.wtc.wtes.business.tie.persistent.period`

Path prefix: `javadoc/kd/sdk/wtc/wtes/business/tie/persistent/period/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `AfterSaveAllPerPeriodDataResultEvent` | class |  |  | 3 | 0 | yes |
| `BeforeSavePerPeriodDataResultEvent` | class |  |  | 3 | 0 | yes |
| `TieSaveAllAttPeriodDataExtPlugin` | interface |  |  | 1 | 0 |  |
| `TieSavePerPeriodDataExtPlugin` | interface |  |  | 1 | 0 |  |

### `kd.sdk.wtc.wtes.business.tie.persistent.utils`

Path prefix: `javadoc/kd/sdk/wtc/wtes/business/tie/persistent/utils/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `TieDataResultExt` | class |  |  | 5 | 0 | yes |
| `TieDataResultRelExt` | class |  |  | 3 | 0 | yes |

### `kd.sdk.wtc.wtes.business.tie.task`

Path prefix: `javadoc/kd/sdk/wtc/wtes/business/tie/task/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `AfterTieTaskEndEvent` | class |  |  | 5 | 0 | yes |
| `TieTaskEndExtPlugin` | interface |  |  | 1 | 0 |  |

### `kd.sdk.wtc.wtes.business.timecut`

Path prefix: `javadoc/kd/sdk/wtc/wtes/business/timecut/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `OnTimeCutMatchEvent` | class |  |  | 7 | 0 | yes |
| `TimeCutMatchExtPlugin` | interface |  |  | 1 | 0 |  |
