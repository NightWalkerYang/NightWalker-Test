import {
  formatNumber,
  getPageValue,
  PAGE_SIZE,
} from "./tenant-console-controller.js";
import {
  setFeedback,
} from "./tenant-console-dialogs.js";
import {
  renderTenantWalletActiveOrderPanel,
  renderTenantWalletLedgerTable,
  renderTenantWalletOrdersTable,
} from "./tenant-wallet-page.js";

export function totalWalletOrdersPages(controller) {
  return Math.max(
    1,
    Math.ceil(
      (Number(controller.walletOrdersTotal || 0) || 0) /
        (controller.walletOrdersPageSize || PAGE_SIZE),
    ),
  );
}

export function totalWalletLedgerPages(controller) {
  return Math.max(
    1,
    Math.ceil(
      (Number(controller.walletLedgerTotal || 0) || 0) /
        (controller.walletLedgerPageSize || PAGE_SIZE),
    ),
  );
}

export function totalWalletFlowPages(controller) {
  return Math.max(
    1,
    Math.ceil(
      (Number(controller.walletFlowTotal || 0) || 0) / (controller.walletFlowPageSize || PAGE_SIZE),
    ),
  );
}

export function findWalletOrderById(controller, orderId) {
  const normalizedOrderId = String(orderId || "").trim();
  if (!normalizedOrderId) {
    return null;
  }
  for (const collection of [
    controller.walletOrdersItems,
    controller.walletData?.orders,
    controller.walletActiveOrder ? [controller.walletActiveOrder] : [],
  ]) {
    const matched = (Array.isArray(collection) ? collection : []).find(
      (order) => String(order?.id || "").trim() === normalizedOrderId,
    );
    if (matched) {
      return matched;
    }
  }
  return null;
}

export function renderWalletOrdersList(controller, renderPagination) {
  const activeOrder =
    findWalletOrderById(controller, controller.walletActiveOrderId) || controller.walletActiveOrder;
  return `
    <div class="oc-tenant-wallet">
      ${activeOrder ? renderTenantWalletActiveOrderPanel(activeOrder) : ""}
      <section class="oc-tenant-card oc-tenant-wallet-table-card">
        <div class="oc-tenant-card-header">
          <h3 class="oc-tenant-card-title">充值订单</h3>
          <div class="oc-tenant-wallet-panel__meta">支付完成后点击“刷新状态”即可入账</div>
        </div>
        ${renderTenantWalletOrdersTable(controller.walletOrdersItems)}
        ${renderPagination({
          totalItems: controller.walletOrdersTotal,
          page: getPageValue(controller),
          totalPages: totalWalletOrdersPages(controller),
        })}
      </section>
    </div>
  `;
}

export function renderWalletLedgerList(controller, renderPagination) {
  return `
    <div class="oc-tenant-wallet">
      <section class="oc-tenant-card oc-tenant-wallet-table-card">
        <div class="oc-tenant-card-header">
          <h3 class="oc-tenant-card-title">模型耗用</h3>
          <div class="oc-tenant-wallet-panel__meta">展示租户模型扣费明细</div>
        </div>
        ${renderTenantWalletLedgerTable(controller.walletLedgerItems, { emptyText: "暂无模型耗用" })}
        ${renderPagination({
          totalItems: controller.walletLedgerTotal,
          page: getPageValue(controller),
          totalPages: totalWalletLedgerPages(controller),
        })}
      </section>
    </div>
  `;
}

export function renderWalletFlowList(controller, renderPagination) {
  return `
    <div class="oc-tenant-wallet">
      <section class="oc-tenant-card oc-tenant-wallet-table-card">
        <div class="oc-tenant-card-header">
          <h3 class="oc-tenant-card-title">钱包流水</h3>
          <div class="oc-tenant-wallet-panel__meta">展示充值入账、划转扣减和撤回回退</div>
        </div>
        ${renderTenantWalletLedgerTable(controller.walletFlowItems)}
        ${renderPagination({
          totalItems: controller.walletFlowTotal,
          page: getPageValue(controller),
          totalPages: totalWalletFlowPages(controller),
        })}
      </section>
    </div>
  `;
}

export async function queryWalletOrderStatus(root, controller, orderId, helpers) {
  const normalizedOrderId = String(orderId || "").trim();
  if (!normalizedOrderId) {
    return;
  }
  try {
    const result = await controller.apiClient.queryTenantPaymentOrder({
      orderId: normalizedOrderId,
    });
    controller.walletActiveOrder = result?.order || null;
    controller.walletActiveOrderId = String(result?.order?.id || normalizedOrderId).trim();
    await helpers.refresh(root, controller);
    const status = String(result?.order?.status || result?.provider?.orderStatus || "").trim();
    if (status === "paid") {
      if (controller.section !== "wallet") {
        const wallet = await controller.apiClient.getTenantWallet();
        controller.walletSummary = wallet?.summary || controller.walletSummary;
        if (controller.walletSummary) {
          helpers.dispatchWalletSummary(controller.walletSummary);
        }
      }
      setFeedback(root, `订单 ${normalizedOrderId} 已支付并完成入账。`);
      return;
    }
    setFeedback(
      root,
      `订单 ${normalizedOrderId} 当前状态: ${String(
        result?.provider?.retmsg || result?.provider?.retcode || status || "待支付",
      ).trim()}`,
    );
  } catch (error) {
    setFeedback(root, error instanceof Error ? error.message : String(error), true);
  }
}
