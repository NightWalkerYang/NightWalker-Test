# kd.sdk.tmc

**司库云** · app=`tmc` cloud=`tmc` isv=`kingdee`

Class HTML path rule: `javadoc/<package-with-slashes>/<ClassName>.html`
Example: package `kd.bos.algo`, class `Algo` → `javadoc/kd/bos/algo/Algo.html`

Each class HTML contains a `cm={...}` JSON object on line 2 with full Javadoc:
`comment`, `declare`, `methods[]` (name/modifiers/returnType/paramNames/paramTypes/comment/tags/throwExceptions/annotations), `fields[]`, `interfaces`, `allInterfaces`, `isDeprecated`, `isPlugin`, `isService`.

## Packages

### `kd.sdk.tmc`

Path prefix: `javadoc/kd/sdk/tmc/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `SdkTmcModule` | class |  | `kd.sdk.module.Module` | 0 | 0 |  |

### `kd.sdk.tmc.am.extpoint.bankacct`

Path prefix: `javadoc/kd/sdk/tmc/am/extpoint/bankacct/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `IBankAccountFilter` | interface |  |  | 2 | 0 |  |
| `ILinkPayRelationAddCompanyFilter` | interface |  |  | 1 | 0 |  |

### `kd.sdk.tmc.am.extpoint.inspect`

Path prefix: `javadoc/kd/sdk/tmc/am/extpoint/inspect/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `IInspectPushMyself` | interface |  |  | 2 | 0 |  |

### `kd.sdk.tmc.am.extpoint.report`

Path prefix: `javadoc/kd/sdk/tmc/am/extpoint/report/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `IDormantFormListFilter` | interface |  |  | 1 | 0 |  |

### `kd.sdk.tmc.bei.extpoint.balance`

Path prefix: `javadoc/kd/sdk/tmc/bei/extpoint/balance/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `IBalanceReportInterface` | interface |  |  | 2 | 0 |  |
| `IFillBankBalance` | interface |  |  | 1 | 0 |  |
| `IGenHistoryBalanceInterface` | interface |  |  | 1 | 0 |  |

### `kd.sdk.tmc.bei.extpoint.bankpay`

Path prefix: `javadoc/kd/sdk/tmc/bei/extpoint/bankpay/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `IAfterBankPayQueryExt` | interface |  |  | 1 | 0 |  |
| `IBankPayDetailExt` | interface |  |  | 1 | 0 |  |

### `kd.sdk.tmc.bei.extpoint.claim`

Path prefix: `javadoc/kd/sdk/tmc/bei/extpoint/claim/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `INoticeClaimSchemeInterface` | interface |  |  | 2 | 0 |  |

### `kd.sdk.tmc.bei.extpoint.receipt`

Path prefix: `javadoc/kd/sdk/tmc/bei/extpoint/receipt/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `IAfterReceiptRecognition` | interface |  |  | 1 | 0 |  |
| `IReceiptMatchTransDetail` | interface |  |  | 1 | 0 |  |

### `kd.sdk.tmc.bei.extpoint.transdetail`

Path prefix: `javadoc/kd/sdk/tmc/bei/extpoint/transdetail/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `IDeleteTransDetail` | interface |  |  | 1 | 0 |  |
| `IFillTransDetail` | interface |  |  | 1 | 0 |  |

### `kd.sdk.tmc.cfm.extpoint.common`

Path prefix: `javadoc/kd/sdk/tmc/cfm/extpoint/common/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `IGetCustomBillFormIdSecondDevService` | interface |  |  | 1 | 0 |  |
| `IGetExtCfmBillLayoutInfoDev` | interface |  |  | 1 | 0 |  |

### `kd.sdk.tmc.cfm.extpoint.confirm`

Path prefix: `javadoc/kd/sdk/tmc/cfm/extpoint/confirm/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `IConfirmListInterface` | interface |  |  | 2 | 0 |  |

### `kd.sdk.tmc.cfm.extpoint.creditm`

Path prefix: `javadoc/kd/sdk/tmc/cfm/extpoint/creditm/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `IApplyReturnCreditlimit` | interface |  |  | 1 | 0 |  |

### `kd.sdk.tmc.cfm.extpoint.extapply`

Path prefix: `javadoc/kd/sdk/tmc/cfm/extpoint/extapply/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `IExtApplyBillSecondDevFields` | interface |  |  | 1 | 0 |  |

### `kd.sdk.tmc.cfm.extpoint.init`

Path prefix: `javadoc/kd/sdk/tmc/cfm/extpoint/init/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `IInitBillSecondDevFields` | interface |  |  | 1 | 0 |  |

### `kd.sdk.tmc.cfm.extpoint.interestbill`

Path prefix: `javadoc/kd/sdk/tmc/cfm/extpoint/interestbill/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `ILoanIntBillBatchSecondDevFields` | interface |  |  | 1 | 0 |  |

### `kd.sdk.tmc.cfm.extpoint.preinst`

Path prefix: `javadoc/kd/sdk/tmc/cfm/extpoint/preinst/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `IPreIntBillBatchSecondDevFields` | interface |  |  | 1 | 0 |  |

### `kd.sdk.tmc.cfm.extpoint.repay`

Path prefix: `javadoc/kd/sdk/tmc/cfm/extpoint/repay/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `IRepayBillSecondDevFields` | interface |  |  | 1 | 0 |  |

### `kd.sdk.tmc.cfm.extpoint.repayapply`

Path prefix: `javadoc/kd/sdk/tmc/cfm/extpoint/repayapply/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `IRepayApplyBillSecondDevFields` | interface |  |  | 1 | 0 |  |

### `kd.sdk.tmc.cfm.util`

Path prefix: `javadoc/kd/sdk/tmc/cfm/util/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `CostShareUtil` | class |  |  | 1 | 0 |  |

### `kd.sdk.tmc.cim.extpoint`

Path prefix: `javadoc/kd/sdk/tmc/cim/extpoint/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `IReleaseApplyAutoReleaseSDKService` | interface |  |  | 1 | 0 |  |
| `IReleasePushDptRevenue` | interface |  |  | 1 | 0 |  |

### `kd.sdk.tmc.creditm.extpoint`

Path prefix: `javadoc/kd/sdk/tmc/creditm/extpoint/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `ICreditLimitExtInerface` | interface |  |  | 1 | 0 |  |

### `kd.sdk.tmc.creditm.util.creditlimit`

Path prefix: `javadoc/kd/sdk/tmc/creditm/util/creditlimit/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `CreditLimitServiceUtil` | class |  |  | 5 | 0 |  |

### `kd.sdk.tmc.ext.extpoint.committobe`

Path prefix: `javadoc/kd/sdk/tmc/ext/extpoint/committobe/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `IGenBankBillSDKService` | interface |  |  | 1 | 0 |  |

### `kd.sdk.tmc.fbp.extpoint`

Path prefix: `javadoc/kd/sdk/tmc/fbp/extpoint/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `IFeeDetailSaveAndSubmitAddFields` | interface |  |  | 1 | 0 |  |
| `IGetCustomSceneBillStatusSDKService` | interface |  |  | 1 | 0 |  |

### `kd.sdk.tmc.fbp.extpoint.orgfilter`

Path prefix: `javadoc/kd/sdk/tmc/fbp/extpoint/orgfilter/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `IFunderOrgPermissionExtDev` | interface |  |  | 2 | 0 |  |

### `kd.sdk.tmc.fca.extpoint`

Path prefix: `javadoc/kd/sdk/tmc/fca/extpoint/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `IBalanceService` | interface |  |  | 1 | 0 |  |
| `ITranSupBillVoucher` | interface |  |  | 1 | 0 |  |

### `kd.sdk.tmc.fcs.extpoint.paymonitor`

Path prefix: `javadoc/kd/sdk/tmc/fcs/extpoint/paymonitor/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `IRelationShipJob` | interface |  |  | 1 | 0 |  |
| `IRelationShipNotFind` | interface |  |  | 1 | 0 |  |

### `kd.sdk.tmc.ifm.expoint`

Path prefix: `javadoc/kd/sdk/tmc/ifm/expoint/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `IGlAccountBalance` | interface |  |  | 2 | 0 |  |
| `IInstBalanceCalcSecondDev` | interface |  |  | 1 | 0 |  |

### `kd.sdk.tmc.ifp.expoint.planedit`

Path prefix: `javadoc/kd/sdk/tmc/ifp/expoint/planedit/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `IPlanEditBasedataF7Filter2Dev` | interface |  |  | 1 | 0 |  |

### `kd.sdk.tmc.mon.extpoint.mobile`

Path prefix: `javadoc/kd/sdk/tmc/mon/extpoint/mobile/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `IMobileSecondaryDevCard` | interface |  |  | 3 | 0 |  |

### `kd.sdk.tmc.psd.extpoint`

Path prefix: `javadoc/kd/sdk/tmc/psd/extpoint/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `ICheckDefaultAccount` | interface |  |  | 1 | 0 |  |
| `IPayScheduleSelectBill` | interface |  |  | 1 | 0 |  |

### `kd.sdk.tmc.psd.extpoint.task`

Path prefix: `javadoc/kd/sdk/tmc/psd/extpoint/task/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `IAssemblySecondaryDevFields` | interface |  |  | 1 | 0 |  |

### `kd.sdk.tmc.tda.extpoint.arap`

Path prefix: `javadoc/kd/sdk/tmc/tda/extpoint/arap/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `IArApTopCustSuppInterface` | interface |  |  | 1 | 0 |  |

### `kd.sdk.tmc.tda.extpoint.bankacct`

Path prefix: `javadoc/kd/sdk/tmc/tda/extpoint/bankacct/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `IBankAcctByBankInterfaceRPA` | interface |  |  | 1 | 0 |  |
| `IBankAcctInterface` | interface |  |  | 6 | 0 |  |
| `IParentAcctInterface` | interface |  |  | 1 | 0 |  |

### `kd.sdk.tmc.tda.extpoint.cash`

Path prefix: `javadoc/kd/sdk/tmc/tda/extpoint/cash/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `ICashCommonSourceReBuildInterface` | interface |  |  | 1 | 0 |  |

### `kd.sdk.tmc.tda.extpoint.credit`

Path prefix: `javadoc/kd/sdk/tmc/tda/extpoint/credit/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `ICreditGetDataInterface` | interface |  |  | 1 | 0 |  |

### `kd.sdk.tmc.tda.extpoint.finance`

Path prefix: `javadoc/kd/sdk/tmc/tda/extpoint/finance/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `IFinanceDataFilter` | interface |  |  | 1 | 0 |  |
| `IFinanceLeaseSourceInterface` | interface |  |  | 1 | 0 |  |
| `IFinanceSourceReBuildInterface` | interface |  |  | 1 | 0 |  |

### `kd.sdk.tmc.tda.extpoint.interloan`

Path prefix: `javadoc/kd/sdk/tmc/tda/extpoint/interloan/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `IInterLoanDetailInterface` | interface |  |  | 2 | 0 |  |

### `kd.sdk.tmc.tda.extpoint.liquidity`

Path prefix: `javadoc/kd/sdk/tmc/tda/extpoint/liquidity/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `ILiquidityCalculateInterface` | interface |  |  | 3 | 0 |  |
| `ILiquidityIndicatorDetailInterface` | interface |  |  | 8 | 0 |  |

### `kd.sdk.tmc.tda.extpoint.note`

Path prefix: `javadoc/kd/sdk/tmc/tda/extpoint/note/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `IDraftBillDecisionRptInterface` | interface |  |  | 1 | 0 |  |

### `kd.sdk.tmc.tda.extpoint.settle`

Path prefix: `javadoc/kd/sdk/tmc/tda/extpoint/settle/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `IBigAmountDataInterface` | interface |  |  | 1 | 0 |  |

### `kd.sdk.tmc.tda.extpoint.synthesis`

Path prefix: `javadoc/kd/sdk/tmc/tda/extpoint/synthesis/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `ISynthesisLoadDataInterface` | interface |  |  | 1 | 0 |  |

### `kd.sdk.tmc.tda.extpoint.transdetail`

Path prefix: `javadoc/kd/sdk/tmc/tda/extpoint/transdetail/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `ITransDetailGetDataInterface` | interface |  |  | 1 | 0 |  |

### `kd.sdk.tmc.tm.businessbill.extpoint`

Path prefix: `javadoc/kd/sdk/tmc/tm/businessbill/extpoint/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `IBizBillPayAmtValidateExtService` | interface |  |  | 2 | 0 |  |

### `kd.sdk.tmc.tm.forex.extpoint`

Path prefix: `javadoc/kd/sdk/tmc/tm/forex/extpoint/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `IAutoSetExchangeRateDevService` | interface |  |  | 1 | 0 |  |
| `IForexWbExcludeStatusExtService` | interface |  |  | 1 | 0 |  |

### `kd.sdk.tmc.tm.init.forexfwd`

Path prefix: `javadoc/kd/sdk/tmc/tm/init/forexfwd/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `IForexFwdInit2BizBillSecondDevService` | interface |  |  | 1 | 0 |  |
| `IForexFwdInit2TradeSecondDevService` | interface |  |  | 1 | 0 |  |

### `kd.sdk.tmc.tm.plinfo.extpoint`

Path prefix: `javadoc/kd/sdk/tmc/tm/plinfo/extpoint/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `IPlInfoDevService` | interface |  |  | 1 | 0 |  |

### `kd.sdk.tmc.tm.swaps.extpoint`

Path prefix: `javadoc/kd/sdk/tmc/tm/swaps/extpoint/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `IFixedInterestRateAllowZeroDevService` | interface |  |  | 1 | 0 |  |

### `kd.sdk.tmc.tmbrm.extpoint`

Path prefix: `javadoc/kd/sdk/tmc/tmbrm/extpoint/`

| Class | Kind | Extends | Implements | Methods | Fields | Deprecated |
|-------|------|---------|------------|---------|--------|------------|
| `IFinOrgArchivesAssociatedBillInterface` | interface |  |  | 2 | 0 |  |
