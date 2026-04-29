function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeAttribute(value) {
  return escapeHtml(value)
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDateTime(value) {
  if (!value) {
    return "-";
  }
  const timestamp = Date.parse(String(value));
  if (Number.isNaN(timestamp)) {
    return String(value);
  }
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

function formatNumber(value, fractionDigits = 2) {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) {
    return "0.00";
  }
  return new Intl.NumberFormat("zh-CN", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(numeric);
}

function resolveOrderStatusLabel(status) {
  switch (String(status || "").trim()) {
    case "paid":
      return "已支付";
    case "processing":
      return "处理中";
    case "closed":
      return "已关闭";
    case "failed":
      return "支付失败";
    case "pending_confirmation":
      return "待确认";
    case "pending_payment":
    default:
      return "待支付";
  }
}

function resolveOrderStatusVariant(status) {
  switch (String(status || "").trim()) {
    case "paid":
      return "direct";
    case "processing":
    case "pending_confirmation":
      return "warn";
    case "closed":
    case "failed":
      return "unknown";
    case "pending_payment":
    default:
      return "warn";
  }
}

function resolveLedgerCategoryLabel(category) {
  switch (String(category || "").trim()) {
    case "recharge":
      return "充值入账";
    case "agent_transfer":
      return "划转 Agent";
    case "usage_charge":
      return "模型扣费";
    default:
      return String(category || "-").trim() || "-";
  }
}

function renderWalletMetrics(summary) {
  return `
    <div class="oc-tenant-wallet-grid">
      <div class="oc-tenant-card oc-tenant-metric-card">
        <div class="oc-tenant-metric-label">钱包余额</div>
        <div class="oc-tenant-metric-value">${formatNumber(summary.walletBalance)}</div>
        <div class="oc-tenant-metric-sub">当前可划转到 Agent 的积分</div>
      </div>
      <div class="oc-tenant-card oc-tenant-metric-card">
        <div class="oc-tenant-metric-label">待处理订单</div>
        <div class="oc-tenant-metric-value">${formatNumber(summary.pendingOrderCount, 0)}</div>
        <div class="oc-tenant-metric-sub">待支付或支付处理中</div>
      </div>
      <div class="oc-tenant-card oc-tenant-metric-card">
        <div class="oc-tenant-metric-label">累计充值</div>
        <div class="oc-tenant-metric-value">${formatNumber(summary.totalRecharged)}</div>
        <div class="oc-tenant-metric-sub">按人民币 1:1 入账积分</div>
      </div>
      <div class="oc-tenant-card oc-tenant-metric-card">
        <div class="oc-tenant-metric-label">已划转 Agent</div>
        <div class="oc-tenant-metric-value">${formatNumber(summary.totalTransferred)}</div>
        <div class="oc-tenant-metric-sub">租户钱包累计下发预算</div>
      </div>
    </div>
  `;
}

function renderRechargePanel(payment) {
  if (!payment?.enabled) {
    return `
      <div class="callout info">
        当前未配置通联支付参数或公网回调地址，暂时不能创建在线充值订单。
      </div>
    `;
  }
  const channelOptions = Array.isArray(payment.channels) ? payment.channels : [];
  return `
    <form class="oc-tenant-wallet-form" data-tenant-wallet-recharge-form>
      <label class="field">
        <span>充值金额 (元)</span>
        <input
          type="number"
          name="amountCny"
          min="1"
          step="0.01"
          inputmode="decimal"
          placeholder="请输入充值金额"
          required
        />
      </label>
      <label class="field">
        <span>支付方式</span>
        <select name="channel">
          ${channelOptions
            .map(
              (channel) => `
                <option value="${escapeAttribute(channel.id)}">${escapeHtml(channel.label)}</option>
              `,
            )
            .join("")}
        </select>
      </label>
      <div class="oc-tenant-wallet-form__footnote">
        创建订单后会打开通联收银台；支付完成后返回本页刷新状态即可。
      </div>
      <div class="oc-tenant-wallet-form__actions">
        <button class="btn primary" type="submit">创建支付订单</button>
      </div>
    </form>
  `;
}

function renderTransferPanel(tenantAgents = []) {
  if (!tenantAgents.length) {
    return `<div class="callout info">当前租户还没有可划转预算的 Agent。</div>`;
  }
  return `
    <form class="oc-tenant-wallet-form" data-tenant-wallet-transfer-form>
      <label class="field">
        <span>目标 Agent</span>
        <select name="tenantAgentId" required>
          <option value="">请选择 Agent</option>
          ${tenantAgents
            .map(
              (agent) => `
                <option value="${escapeAttribute(agent.id)}">
                  ${escapeHtml(agent.agentName || agent.description || agent.agentId || agent.id)} (${formatNumber(agent.balancePoints)})
                </option>
              `,
            )
            .join("")}
        </select>
      </label>
      <label class="field">
        <span>划转积分</span>
        <input
          type="number"
          name="amountPoints"
          min="0.01"
          step="0.01"
          inputmode="decimal"
          placeholder="请输入划转积分"
          required
        />
      </label>
      <label class="field">
        <span>备注</span>
        <input type="text" name="note" maxlength="120" placeholder="可选，用于流水备注" />
      </label>
      <div class="oc-tenant-wallet-form__actions">
        <button class="btn" type="submit">确认划转</button>
      </div>
    </form>
  `;
}

export function renderTenantWalletOrdersTable(orders = []) {
  return `
    <div class="data-table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th>订单号</th>
            <th>金额</th>
            <th>状态</th>
            <th>渠道</th>
            <th>更新时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          ${
            orders.length
              ? orders
                  .map((order) => {
                    const statusLabel = resolveOrderStatusLabel(order.status);
                    const channelLabel =
                      order.providerPayload?.channelLabel ||
                      order.channelLabel ||
                      order.channel ||
                      "通联收银台";
                    const canPay = Boolean(order.launchHref);
                    const canShowQr = Boolean(order.launchQrDataUrl);
                    const canQuery = ["pending_payment", "processing", "pending_confirmation"].includes(
                      String(order.status || "").trim(),
                    );
                    return `
                      <tr>
                        <td class="oc-tenant-wallet-table__id">${escapeHtml(order.id)}</td>
                        <td>${formatNumber(order.amountCny)}</td>
                        <td>
                          <span class="data-table-badge data-table-badge--${escapeAttribute(resolveOrderStatusVariant(order.status))}">
                            ${escapeHtml(statusLabel)}
                          </span>
                        </td>
                        <td>${escapeHtml(channelLabel)}</td>
                        <td>${escapeHtml(formatDateTime(order.updatedAt || order.createdAt))}</td>
                        <td>
                          <div class="oc-tenant-table-actions">
                            ${
                              canShowQr
                                ? `<button class="btn" type="button" data-tenant-wallet-show-qr="${escapeAttribute(order.id)}">显示扫码</button>`
                                : ""
                            }
                            ${
                              canPay
                                ? `<a class="btn" href="${escapeAttribute(order.launchHref)}" target="_blank" rel="noopener">去支付</a>`
                                : ""
                            }
                            ${
                              canQuery
                                ? `<button class="btn" type="button" data-tenant-wallet-query-order="${escapeAttribute(order.id)}">刷新状态</button>`
                                : ""
                            }
                          </div>
                        </td>
                      </tr>
                    `;
                  })
                  .join("")
              : `<tr><td colspan="6" class="oc-tenant-table-empty">暂无充值订单</td></tr>`
          }
        </tbody>
      </table>
    </div>
  `;
}

export function renderTenantWalletLedgerTable(ledger = []) {
  return `
    <div class="data-table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th>类型</th>
            <th>方向</th>
            <th>积分</th>
            <th>余额</th>
            <th>关联</th>
            <th>时间</th>
          </tr>
        </thead>
        <tbody>
          ${
            ledger.length
              ? ledger
                  .map(
                    (item) => `
                      <tr>
                        <td>${escapeHtml(resolveLedgerCategoryLabel(item.category))}</td>
                        <td>${escapeHtml(item.direction === "credit" ? "收入" : "支出")}</td>
                        <td>${formatNumber(item.amountPoints)}</td>
                        <td>${formatNumber(item.balanceAfter)}</td>
                        <td>
                          ${
                            item.paymentOrderId
                              ? `订单 ${escapeHtml(item.paymentOrderId)}`
                              : item.tenantAgentName
                                ? escapeHtml(item.tenantAgentName)
                                : escapeHtml(item.note || "-")
                          }
                        </td>
                        <td>${escapeHtml(formatDateTime(item.createdAt))}</td>
                      </tr>
                    `,
                  )
                  .join("")
              : `<tr><td colspan="6" class="oc-tenant-table-empty">暂无钱包流水</td></tr>`
          }
        </tbody>
      </table>
    </div>
  `;
}

export function renderTenantWalletActiveOrderPanel(activeOrder) {
  if (!activeOrder) {
    return "";
  }
  const statusLabel = resolveOrderStatusLabel(activeOrder.status);
  const canQuery = ["pending_payment", "processing", "pending_confirmation"].includes(
    String(activeOrder.status || "").trim(),
  );
  return `
    <section class="oc-tenant-card oc-tenant-wallet-qr-card">
      <div class="oc-tenant-card-header">
        <h3 class="oc-tenant-card-title">支付二维码</h3>
        <div class="oc-tenant-wallet-panel__meta">订单号: ${escapeHtml(activeOrder.id)}</div>
      </div>
      <div class="oc-tenant-wallet-qr">
        ${
          activeOrder.launchQrDataUrl
            ? `<img class="oc-tenant-wallet-qr__image" src="${escapeAttribute(activeOrder.launchQrDataUrl)}" alt="支付二维码" />`
            : `<div class="callout info">当前订单暂不支持生成扫码，请使用“去支付”打开支付页。</div>`
        }
        <div class="oc-tenant-wallet-qr__side">
          <div class="oc-tenant-wallet-qr__amount">${formatNumber(activeOrder.amountCny)} 元</div>
          <div class="oc-tenant-wallet-qr__status">
            状态:
            <span class="data-table-badge data-table-badge--${escapeAttribute(resolveOrderStatusVariant(activeOrder.status))}">
              ${escapeHtml(statusLabel)}
            </span>
          </div>
          <div class="oc-tenant-wallet-form__footnote">
            用手机微信或支付宝扫码。支付完成后点击“刷新状态”，订单确认后钱包自动入账。
          </div>
          <div class="oc-tenant-wallet-form__actions">
            ${
              canQuery
                ? `<button class="btn primary" type="button" data-tenant-wallet-query-order="${escapeAttribute(activeOrder.id)}">刷新状态</button>`
                : ""
            }
            ${
              activeOrder.launchHref
                ? `<a class="btn" href="${escapeAttribute(activeOrder.launchHref)}" target="_blank" rel="noopener">在浏览器打开</a>`
                : ""
            }
          </div>
        </div>
      </div>
    </section>
  `;
}

export function renderTenantWalletPage(controller) {
  const walletData = controller.walletData;
  if (!walletData) {
    return `<div class="oc-tenant-overview-loading">正在加载钱包数据...</div>`;
  }

  const summary = walletData.summary || {};
  const payment = walletData.payment || {};
  const orders = Array.isArray(walletData.orders) ? walletData.orders : [];
  const activeOrderId = String(controller.walletActiveOrderId || "").trim();
  const activeOrder =
    orders.find((order) => String(order?.id || "").trim() === activeOrderId) ||
    controller.walletActiveOrder ||
    null;

  return `
    <div class="oc-tenant-wallet">
      ${renderWalletMetrics(summary)}
      ${renderTenantWalletActiveOrderPanel(activeOrder)}

      <div class="oc-tenant-wallet-panels">
        <section class="oc-tenant-card oc-tenant-wallet-panel">
          <div class="oc-tenant-card-header">
            <h3 class="oc-tenant-card-title">在线充值</h3>
            <div class="oc-tenant-wallet-panel__meta">当前供应商: ${escapeHtml(payment.providerName || "通联支付")}</div>
          </div>
          ${renderRechargePanel(payment)}
        </section>
      </div>
    </div>
  `;
}
