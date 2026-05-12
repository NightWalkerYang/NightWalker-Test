import {
  escapeAttribute,
  escapeHtml,
  formatCredits,
  formatDateTime,
  formatNumber,
  getPageValue,
  getSearchValue,
  isLocalEdition,
  PAGE_SIZE,
} from "./tenant-console-controller.js";
import {
  getAgentDetailDialog,
  getAgentTransferDialog,
  setFeedback,
} from "./tenant-console-dialogs.js";
import {
  renderTenantWalletActiveOrderPanel,
  renderTenantWalletLedgerTable,
  renderTenantWalletOrdersTable,
} from "./tenant-wallet-page.js";

export function getTenantAgentDisplayName(agent) {
  for (const candidate of [agent?.agentName, agent?.description, agent?.agentId, agent?.id]) {
    const value = String(candidate || "").trim();
    if (value) {
      return value;
    }
  }
  return "未知 Agent";
}

export function getTenantAgentStatusVariant(status) {
  return String(status || "").trim() === "active" ? "direct" : "unknown";
}

function renderTenantAgentVisual(agent) {
  const avatar = String(agent?.avatar || "").trim();
  const emoji = String(agent?.emoji || "").trim();
  const label = getTenantAgentDisplayName(agent);
  if (avatar) {
    return `
      <span class="oc-tenant-agent-card__visual oc-tenant-agent-card__visual--image">
        <img src="${escapeAttribute(avatar)}" alt="${escapeAttribute(label)}" />
      </span>
    `;
  }
  if (emoji) {
    return `<span class="oc-tenant-agent-card__visual">${escapeHtml(emoji)}</span>`;
  }
  return `<span class="oc-tenant-agent-card__visual">${escapeHtml(label.slice(0, 1).toUpperCase() || "A")}</span>`;
}

export function filterTenantAgents(controller) {
  const query = getSearchValue(controller).trim().toLowerCase();
  if (!query) {
    return Array.isArray(controller.tenantAgents) ? controller.tenantAgents : [];
  }
  return (Array.isArray(controller.tenantAgents) ? controller.tenantAgents : []).filter((agent) =>
    [agent?.agentName, agent?.agentId, agent?.description, agent?.status]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(query)),
  );
}

export function renderOwnedAgentsCards(rows, controller) {
  const localEdition = isLocalEdition(controller);
  if (!rows.length) {
    return `<div class="callout info oc-tenant-agent-empty">当前租户还没有可查看的 Agent。</div>`;
  }
  return `
    <div class="oc-tenant-agent-grid">
      ${rows
        .map(
          (agent) => `
            <article class="oc-tenant-agent-card" data-tenant-agent-card="${escapeAttribute(agent.id)}">
              <div class="oc-tenant-agent-card__header">
                <div class="oc-tenant-agent-card__identity">
                  ${renderTenantAgentVisual(agent)}
                  <div class="oc-tenant-agent-card__copy">
                    <h3 class="oc-tenant-agent-card__title">${escapeHtml(getTenantAgentDisplayName(agent))}</h3>
                    <div class="oc-tenant-agent-card__subtitle">${escapeHtml(agent.agentId || agent.id || "-")}</div>
                  </div>
                </div>
                <span class="data-table-badge data-table-badge--${getTenantAgentStatusVariant(agent.status)}">${escapeHtml(agent.status || "unknown")}</span>
              </div>
              <p class="oc-tenant-agent-card__description">${escapeHtml(agent.description || "暂无说明")}</p>
              <dl class="oc-tenant-agent-card__meta">
                ${
                  localEdition
                    ? `<div><dt>部署模式</dt><dd>本地版</dd></div>`
                    : `<div><dt>余额积分</dt><dd>${formatCredits(agent.balancePoints)}</dd></div>`
                }
                <div><dt>更新时间</dt><dd>${escapeHtml(formatDateTime(agent.updatedAt || agent.createdAt))}</dd></div>
              </dl>
              <div class="oc-tenant-agent-card__actions">
                ${
                  localEdition
                    ? ""
                    : `
                      <button
                        class="btn primary"
                        type="button"
                        data-tenant-open-agent-transfer="${escapeAttribute(agent.id)}"
                      >
                        划转积分
                      </button>
                    `
                }
                <button
                  class="btn"
                  type="button"
                  data-tenant-open-agent-detail="${escapeAttribute(agent.id)}"
                >
                  详情
                </button>
              </div>
            </article>
          `,
        )
        .join("")}
    </div>
  `;
}

function getAgentDetailTarget(controller) {
  const dialog = getAgentDetailDialog(controller);
  const agentId = String(dialog.agentId || "").trim();
  if (!agentId) {
    return null;
  }
  return (
    (Array.isArray(controller.tenantAgents) ? controller.tenantAgents : []).find(
      (agent) => String(agent?.id || "").trim() === agentId,
    ) || null
  );
}

function getAgentTransferTarget(controller) {
  const dialog = getAgentTransferDialog(controller);
  const agentId = String(dialog.agentId || "").trim();
  if (!agentId) {
    return null;
  }
  return (
    (Array.isArray(controller.tenantAgents) ? controller.tenantAgents : []).find(
      (agent) => String(agent?.id || "").trim() === agentId,
    ) || null
  );
}

export function renderAgentDetailDialog(controller) {
  const agent = getAgentDetailTarget(controller);
  const localEdition = isLocalEdition(controller);
  return `
    <dialog class="oc-tenant-modal" data-tenant-agent-detail-dialog>
      <div class="oc-tenant-modal__panel">
        <header class="oc-tenant-modal__header">
          <h3 class="oc-tenant-modal__title">Agent 详情</h3>
          <button class="btn" type="button" data-tenant-close-dialog="agent-detail">关闭</button>
        </header>
        <div class="oc-tenant-modal__body">
          ${
            agent
              ? `
                <div class="oc-tenant-agent-detail">
                  <div class="oc-tenant-agent-detail__hero">
                    ${renderTenantAgentVisual(agent)}
                    <div class="oc-tenant-agent-detail__hero-copy">
                      <div class="oc-tenant-agent-detail__name">${escapeHtml(getTenantAgentDisplayName(agent))}</div>
                      <div class="oc-tenant-agent-detail__subtitle">${escapeHtml(agent.agentId || agent.id || "-")}</div>
                    </div>
                  </div>
                  <dl class="oc-tenant-agent-detail__grid">
                    <div>
                      <dt>租户 Agent ID</dt>
                      <dd>${escapeHtml(agent.id || "-")}</dd>
                    </div>
                    <div>
                      <dt>状态</dt>
                      <dd>${escapeHtml(agent.status || "-")}</dd>
                    </div>
                    <div>
                      <dt>计费倍率</dt>
                      <dd>${formatCredits(agent.rateMultiplier || 1)}</dd>
                    </div>
                    <div>
                      <dt>${localEdition ? "部署模式" : "余额积分"}</dt>
                      <dd>${localEdition ? "本地版" : formatCredits(agent.balancePoints)}</dd>
                    </div>
                    <div>
                      <dt>创建时间</dt>
                      <dd>${escapeHtml(formatDateTime(agent.createdAt))}</dd>
                    </div>
                    <div>
                      <dt>更新时间</dt>
                      <dd>${escapeHtml(formatDateTime(agent.updatedAt))}</dd>
                    </div>
                    <div class="oc-tenant-agent-detail__description">
                      <dt>说明</dt>
                      <dd>${escapeHtml(agent.description || "暂无说明")}</dd>
                    </div>
                  </dl>
                </div>
              `
              : `<div class="callout info">未找到对应的 Agent 详情。</div>`
          }
        </div>
      </div>
    </dialog>
  `;
}

export function renderAgentTransferDialog(controller) {
  const agent = getAgentTransferTarget(controller);
  const walletBalance = formatCredits(controller.walletSummary?.walletBalance);
  return `
    <dialog class="oc-tenant-modal" data-tenant-agent-transfer-dialog>
      <div class="oc-tenant-modal__panel">
        <header class="oc-tenant-modal__header">
          <h3 class="oc-tenant-modal__title">划转积分</h3>
          <button class="btn" type="button" data-tenant-close-dialog="transfer">关闭</button>
        </header>
        <div class="oc-tenant-modal__body">
          ${
            agent
              ? `
                <form class="oc-tenant-modal__form" data-tenant-agent-transfer-form>
                  <input type="hidden" name="tenantAgentId" value="${escapeAttribute(agent.id)}" />
                  <label class="field">
                    <span>目标 Agent</span>
                    <input type="text" value="${escapeAttribute(getTenantAgentDisplayName(agent))}" disabled />
                  </label>
                  <label class="field">
                    <span>钱包余额</span>
                    <input type="text" value="${escapeAttribute(walletBalance)}" disabled />
                  </label>
                  <label class="field">
                    <span>当前 Agent 积分</span>
                    <input type="text" value="${escapeAttribute(formatCredits(agent.balancePoints))}" disabled />
                  </label>
                  <label class="field">
                    <span>划转积分</span>
                    <input
                      type="number"
                      name="amountPoints"
                      min="0.01"
                      step="0.01"
                      inputmode="decimal"
                      placeholder="请输入积分"
                      required
                    />
                  </label>
                  <label class="field">
                    <span>备注</span>
                    <input type="text" name="note" maxlength="120" placeholder="可选，用于流水备注" />
                  </label>
                  <div class="oc-tenant-modal__actions">
                    <button class="btn" type="button" data-tenant-close-dialog="transfer">取消</button>
                    <button class="btn primary" type="submit">确认划转</button>
                  </div>
                </form>
              `
              : `<div class="callout info">请选择目标 Agent 后再操作。</div>`
          }
        </div>
      </div>
    </dialog>
  `;
}

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

export function openAgentTransferDialog(root, controller, tenantAgentId, helpers) {
  if (isLocalEdition(controller)) {
    return;
  }
  const agent = (Array.isArray(controller.tenantAgents) ? controller.tenantAgents : []).find(
    (item) => String(item?.id || "").trim() === String(tenantAgentId || "").trim(),
  );
  if (!agent) {
    return;
  }
  controller.agentTransferDialog = {
    open: true,
    agentId: String(agent.id || "").trim(),
  };
  helpers.render(root, controller);
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
