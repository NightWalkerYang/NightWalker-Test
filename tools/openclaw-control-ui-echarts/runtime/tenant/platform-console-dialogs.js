import { showTransientFeedbackToast } from "./feedback-toast.js";
import {
  escapeHtml,
  formatDateTime,
  formatNumber,
  isLocalEdition,
  localLicenseStatusLabel,
} from "./platform-console-controller.js";

export function setFeedback(root, text, isError = false) {
  showTransientFeedbackToast(root, text, isError);
}

export function openDialog(dialog) {
  if (!(dialog instanceof HTMLDialogElement)) {
    return;
  }
  if (!dialog.open) {
    if (typeof dialog.showModal === "function") {
      dialog.showModal();
      return;
    }
    dialog.setAttribute("open", "");
  }
}

export function closeDialog(dialog) {
  if (dialog instanceof HTMLDialogElement && dialog.open) {
    if (typeof dialog.close === "function") {
      dialog.close();
      return;
    }
    dialog.removeAttribute("open");
  }
}

export function createRevokeTenantAgentDialogState() {
  return {
    open: false,
    loading: false,
    busy: false,
    confirmOpen: false,
    confirmSelectedTenantAgentIds: [],
    tenantId: "",
    tenantName: "",
    agents: [],
    selectedTenantAgentIds: new Set(),
    error: "",
    requestToken: 0,
  };
}

export function createAssignTenantAgentDialogState() {
  return {
    open: false,
    loading: false,
    busy: false,
    tenantId: "",
    tenantName: "",
    agents: [],
    assignedAgentIds: new Set(),
    selectedAgentIds: new Set(),
    description: "",
    rateMultiplier: "1",
    balancePoints: "0",
    error: "",
    requestToken: 0,
  };
}

export function getAssignTenantAgentDialog(controller) {
  if (
    !(controller?.assignTenantAgentDialog && typeof controller.assignTenantAgentDialog === "object")
  ) {
    controller.assignTenantAgentDialog = createAssignTenantAgentDialogState();
  }
  return controller.assignTenantAgentDialog;
}

export function getRevokeTenantAgentDialog(controller) {
  if (
    !(
      controller?.revokeTenantAgentDialog &&
      typeof controller.revokeTenantAgentDialog === "object"
    )
  ) {
    controller.revokeTenantAgentDialog = createRevokeTenantAgentDialogState();
  }
  return controller.revokeTenantAgentDialog;
}

export function isTenantRevokeSelectionTarget(tenant) {
  return Number(tenant?.agentCount || 0) > 0;
}

export function getRevokeTenantAgentSelectableAgents(dialog) {
  if (!Array.isArray(dialog?.agents)) {
    return [];
  }
  return dialog.agents.filter((agent) => Boolean(String(agent?.id || "").trim()));
}

export function getRevokeTenantAgentDisplayName(agent) {
  for (const candidate of [agent?.agentName, agent?.description, agent?.agentId, agent?.id]) {
    const value = String(candidate || "").trim();
    if (value) {
      return value;
    }
  }
  return "未知 Agent";
}

export function getRevokeTenantAgentConfirmAgents(dialog) {
  const selectedTenantAgentIds = new Set(
    Array.isArray(dialog?.confirmSelectedTenantAgentIds)
      ? dialog.confirmSelectedTenantAgentIds
          .map((tenantAgentId) => String(tenantAgentId || "").trim())
          .filter(Boolean)
      : [],
  );
  if (!selectedTenantAgentIds.size) {
    return [];
  }
  return getRevokeTenantAgentSelectableAgents(dialog).filter((agent) =>
    selectedTenantAgentIds.has(String(agent.id || "").trim()),
  );
}

export function isRevokeTenantAgentSelected(controller, tenantAgentId) {
  return getRevokeTenantAgentDialog(controller).selectedTenantAgentIds.has(
    String(tenantAgentId || "").trim(),
  );
}

export function setRevokeTenantAgentSelected(controller, tenantAgentId, selected) {
  const normalized = String(tenantAgentId || "").trim();
  if (!normalized) {
    return;
  }
  const dialog = getRevokeTenantAgentDialog(controller);
  if (selected) {
    dialog.selectedTenantAgentIds.add(normalized);
    return;
  }
  dialog.selectedTenantAgentIds.delete(normalized);
}

export function clearRevokeTenantAgentSelection(controller) {
  getRevokeTenantAgentDialog(controller).selectedTenantAgentIds.clear();
}

export function pruneRevokeTenantAgentSelection(controller) {
  const dialog = controller?.revokeTenantAgentDialog;
  if (!dialog?.open) {
    return;
  }
  const tenantAgentIds = new Set(
    getRevokeTenantAgentSelectableAgents(dialog).map((agent) => String(agent.id || "").trim()),
  );
  for (const tenantAgentId of Array.from(dialog.selectedTenantAgentIds)) {
    if (!tenantAgentIds.has(tenantAgentId)) {
      dialog.selectedTenantAgentIds.delete(tenantAgentId);
    }
  }
}

export function getAssignablePlatformCatalogAgents(dialog) {
  if (!Array.isArray(dialog?.agents)) {
    return [];
  }
  const assignedAgentIds =
    dialog?.assignedAgentIds instanceof Set ? dialog.assignedAgentIds : new Set();
  return dialog.agents.filter((agent) => {
    const agentId = String(agent?.id || "").trim();
    return Boolean(agentId) && !assignedAgentIds.has(agentId);
  });
}

export function getAssignTenantAgentDisplayName(agent) {
  for (const candidate of [
    agent?.name,
    agent?.agentName,
    agent?.label,
    agent?.description,
    agent?.agentId,
    agent?.id,
  ]) {
    const value = String(candidate || "").trim();
    if (value) {
      return value;
    }
  }
  return "未知 Agent";
}

export function isAssignTenantAgentSelected(controller, agentId) {
  return getAssignTenantAgentDialog(controller).selectedAgentIds.has(String(agentId || "").trim());
}

export function setAssignTenantAgentSelected(controller, agentId, selected) {
  const normalized = String(agentId || "").trim();
  if (!normalized) {
    return;
  }
  const dialog = getAssignTenantAgentDialog(controller);
  if (selected) {
    dialog.selectedAgentIds.add(normalized);
    return;
  }
  dialog.selectedAgentIds.delete(normalized);
}

export function clearAssignTenantAgentSelection(controller) {
  getAssignTenantAgentDialog(controller).selectedAgentIds.clear();
}

export function pruneAssignTenantAgentSelection(controller) {
  const dialog = controller?.assignTenantAgentDialog;
  if (!dialog?.open) {
    return;
  }
  const agentIds = new Set(
    getAssignablePlatformCatalogAgents(dialog).map((agent) => String(agent.id || "").trim()),
  );
  for (const agentId of Array.from(dialog.selectedAgentIds)) {
    if (!agentIds.has(agentId)) {
      dialog.selectedAgentIds.delete(agentId);
    }
  }
}

export function renderCreateDialog(controller) {
  const localEdition = isLocalEdition(controller);
  return `
    <dialog class="oc-platform-modal" data-platform-create-dialog>
      <div class="oc-platform-modal__panel">
        <header class="oc-platform-modal__header">
          <h3 class="oc-platform-modal__title">创建租户</h3>
          <button class="btn" type="button" data-platform-close-dialog="create">关闭</button>
        </header>
        <div class="oc-platform-modal__body">
          <form class="oc-platform-modal__form" data-platform-tenant-form>
            <label class="field"><span>租户编码</span><input name="code" type="text" required /></label>
            <label class="field"><span>租户名称</span><input name="name" type="text" required /></label>
            <label class="field"><span>管理员账号</span><input name="adminUsername" type="text" required /></label>
            <label class="field"><span>管理员密码</span><input name="adminPassword" type="password" required /></label>
            <label class="field"><span>人数上限</span><input name="memberLimit" type="number" min="1" value="5" required /></label>
            ${
              localEdition
                ? `<input type="hidden" name="deploymentMode" value="local" />`
                : `
                  <label class="field">
                    <span>部署模式</span>
                    <select name="deploymentMode">
                      <option value="cloud">公有云</option>
                      <option value="local">本地部署</option>
                    </select>
                  </label>
                  <label class="field"><span>到期日期（可选）</span><input name="licenseExpiresAt" type="datetime-local" /></label>
                  <label class="field"><span>续期码（可选）</span><input name="renewalCode" type="text" /></label>
                `
            }
            <div class="oc-platform-modal__actions">
              <button class="btn primary" type="submit">创建租户</button>
            </div>
          </form>
        </div>
      </div>
    </dialog>
  `;
}

export function renderMemberLimitDialog(controller) {
  const tenant = controller.activeTenant;
  return `
    <dialog class="oc-platform-modal" data-platform-member-limit-dialog>
      <div class="oc-platform-modal__panel">
        <header class="oc-platform-modal__header">
          <h3 class="oc-platform-modal__title">人数调整</h3>
          <button class="btn" type="button" data-platform-close-dialog="member-limit">关闭</button>
        </header>
        <div class="oc-platform-modal__body">
          ${
            tenant
              ? `
                <form class="oc-platform-modal__form" data-platform-member-limit-form>
                  <input type="hidden" name="tenantId" value="${escapeHtml(tenant.id)}" />
                  <label class="field"><span>目标租户</span><input type="text" value="${escapeHtml(tenant.name)}" disabled /></label>
                  <label class="field"><span>当前成员数</span><input type="text" value="${formatNumber(tenant.memberCount)}" disabled /></label>
                  <label class="field"><span>人数上限</span><input name="memberLimit" type="number" min="${Math.max(1, Number(tenant.memberCount || 0))}" value="${escapeHtml(tenant.memberLimit)}" required /></label>
                  <div class="oc-platform-modal__actions">
                    <button class="btn primary" type="submit">保存</button>
                  </div>
                </form>
              `
              : `<div class="callout info">请选择租户后再操作。</div>`
          }
        </div>
      </div>
    </dialog>
  `;
}

export function renderAssignDialog(controller) {
  const dialog = getAssignTenantAgentDialog(controller);
  const selectedCount = dialog.selectedAgentIds.size;
  const selectableAgents = getAssignablePlatformCatalogAgents(dialog);
  const allAgentsSelected =
    selectableAgents.length > 0 && selectedCount === selectableAgents.length;
  const localEdition = isLocalEdition(controller);
  const statusMarkup = dialog.loading
    ? `<div class="callout info">正在加载该租户可分配的 Agent...</div>`
    : dialog.error
      ? `<div class="callout info">${escapeHtml(dialog.error)}</div>`
      : "";
  const listMarkup =
    !dialog.loading && selectableAgents.length
      ? `
        <div class="data-table-container oc-platform-revoke-agent-list">
          <table class="data-table">
            <thead>
              <tr>
                <th class="oc-platform-agent-select-col"></th>
                <th>Agent</th>
                <th>说明</th>
              </tr>
            </thead>
            <tbody>
              ${selectableAgents
                .map(
                  (agent) => `
                    <tr>
                      <td class="oc-platform-agent-select-cell">
                        <input
                          type="checkbox"
                          data-platform-assign-agent-select="${escapeHtml(agent.id)}"
                          aria-label="选择 ${escapeHtml(getAssignTenantAgentDisplayName(agent))}"
                          ${dialog.busy ? "disabled" : ""}
                          ${isAssignTenantAgentSelected(controller, agent.id) ? "checked" : ""}
                        />
                      </td>
                      <td>
                        <div class="oc-platform-revoke-agent__name">${escapeHtml(getAssignTenantAgentDisplayName(agent))}</div>
                        <div class="oc-platform-revoke-agent__meta">${escapeHtml(agent.id || "-")}</div>
                      </td>
                      <td>${escapeHtml(agent.description || agent.summary || "-")}</td>
                    </tr>
                  `,
                )
                .join("")}
            </tbody>
          </table>
        </div>
      `
      : !dialog.loading && !dialog.error
        ? `<div class="callout info">该租户当前没有可分配的 Agent。</div>`
        : "";
  return `
    <dialog class="oc-platform-modal oc-platform-modal--wide" data-platform-assign-dialog>
      <div class="oc-platform-modal__panel oc-platform-modal__panel--wide">
        <header class="oc-platform-modal__header">
          <h3 class="oc-platform-modal__title">分配Agent</h3>
          <button class="btn" type="button" data-platform-close-dialog="assign">关闭</button>
        </header>
        <div class="oc-platform-modal__body">
          ${
            dialog.tenantId
              ? `
                <form class="oc-platform-modal__form" data-platform-agent-form>
                  <input type="hidden" name="tenantId" value="${escapeHtml(dialog.tenantId)}" />
                  <label class="field"><span>目标租户</span><input type="text" value="${escapeHtml(dialog.tenantName || dialog.tenantId)}" disabled /></label>
                  <div class="field">
                    <span>平台已有 Agent</span>
                    <div class="oc-platform-revoke-agent-toolbar">
                      <label class="oc-platform-revoke-agent-toolbar__select-all">
                        <input
                          type="checkbox"
                          data-platform-assign-agent-select-all
                          aria-label="全选可分配的 Agent"
                          ${dialog.loading || dialog.busy || !selectableAgents.length ? "disabled" : ""}
                          ${allAgentsSelected ? "checked" : ""}
                        />
                        <span>全选</span>
                      </label>
                      <span class="oc-platform-revoke-agent-toolbar__summary">
                        已选择 ${formatNumber(selectedCount)} 个 Agent
                      </span>
                    </div>
                  </div>
                  ${statusMarkup}
                  ${listMarkup}
                  <label class="field">
                    <span>简短描述</span>
                    <input
                      name="description"
                      type="text"
                      data-platform-assign-description
                      value="${escapeHtml(dialog.description)}"
                      placeholder="显示在租户 Agent 列表和成员分配里的描述"
                      ${dialog.busy ? "disabled" : ""}
                    />
                  </label>
                  ${
                    localEdition
                      ? `
                        <input type="hidden" name="rateMultiplier" value="1" />
                        <input type="hidden" name="balancePoints" value="0" />
                      `
                      : `
                        <label class="field">
                          <span>计费倍率</span>
                          <input
                            name="rateMultiplier"
                            type="number"
                            step="0.01"
                            min="0"
                            data-platform-assign-rate-multiplier
                            value="${escapeHtml(dialog.rateMultiplier)}"
                            ${dialog.busy ? "disabled" : ""}
                            required
                          />
                        </label>
                        <label class="field">
                          <span>初始积分</span>
                          <input
                            name="balancePoints"
                            type="number"
                            step="0.01"
                            min="0"
                            data-platform-assign-balance-points
                            value="${escapeHtml(dialog.balancePoints)}"
                            ${dialog.busy ? "disabled" : ""}
                            required
                          />
                        </label>
                      `
                  }
                  <div class="oc-platform-modal__actions">
                    <button class="btn" type="button" data-platform-close-dialog="assign">取消</button>
                    <button class="btn primary" type="submit" ${dialog.loading || dialog.busy || selectedCount === 0 ? "disabled" : ""}>保存分配</button>
                  </div>
                </form>
              `
              : `<div class="callout info">请选择租户后再操作。</div>`
          }
        </div>
      </div>
    </dialog>
  `;
}

export function renderRateDialog(controller) {
  const tenant = controller.activeTenant;
  const agents = controller.rateDialogAgents;
  return `
    <dialog class="oc-platform-modal oc-platform-modal--wide" data-platform-rate-dialog>
      <div class="oc-platform-modal__panel oc-platform-modal__panel--wide">
        <header class="oc-platform-modal__header">
          <h3 class="oc-platform-modal__title">倍率调整</h3>
          <button class="btn" type="button" data-platform-close-dialog="rate">关闭</button>
        </header>
        <div class="oc-platform-modal__body">
          ${
            !tenant
              ? `<div class="callout info">请选择租户后再操作。</div>`
              : controller.loadingRateAgents
                ? `<div class="callout info">正在加载当前租户的 Agent...</div>`
                : agents.length
                  ? `
                    <form class="oc-platform-modal__form" data-platform-rate-form>
                      <input type="hidden" name="tenantId" value="${escapeHtml(tenant.id)}" />
                      <div class="data-table-container">
                        <table class="data-table">
                          <thead>
                            <tr>
                              <th>Agent</th>
                              <th>描述</th>
                              <th>当前积分</th>
                              <th>倍率</th>
                            </tr>
                          </thead>
                          <tbody>
                            ${agents
                              .map(
                                (agent) => `
                                  <tr>
                                    <td>${escapeHtml(agent.agentName)}</td>
                                    <td>${escapeHtml(agent.description || "-")}</td>
                                    <td>${formatNumber(agent.balancePoints)}</td>
                                    <td>
                                      <input
                                        class="oc-platform-rate-input"
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        name="rateMultiplier:${escapeHtml(agent.id)}"
                                        value="${escapeHtml(agent.rateMultiplier ?? 1)}"
                                      />
                                    </td>
                                  </tr>
                                `,
                              )
                              .join("")}
                          </tbody>
                        </table>
                      </div>
                      <div class="oc-platform-modal__actions">
                        <button class="btn primary" type="submit">保存倍率</button>
                      </div>
                    </form>
                  `
                  : `<div class="callout info">该租户当前还没有已分配的 Agent。</div>`
          }
        </div>
      </div>
    </dialog>
  `;
}

export function renderRevokeTenantAgentDialog(controller) {
  const dialog = getRevokeTenantAgentDialog(controller);
  const selectedCount = dialog.selectedTenantAgentIds.size;
  const selectableAgents = getRevokeTenantAgentSelectableAgents(dialog);
  const allAgentsSelected =
    selectableAgents.length > 0 && selectedCount === selectableAgents.length;
  const statusMarkup = dialog.loading
    ? `<div class="callout info">正在加载该租户已下发的 Agent...</div>`
    : dialog.error
      ? `<div class="callout info">${escapeHtml(dialog.error)}</div>`
      : "";
  const listMarkup =
    !dialog.loading && dialog.agents.length
      ? `
        <div class="data-table-container oc-platform-revoke-agent-list">
          <table class="data-table">
            <thead>
              <tr>
                <th class="oc-platform-agent-select-col"></th>
                <th>Agent</th>
                <th>说明</th>
                <th>当前积分</th>
              </tr>
            </thead>
            <tbody>
              ${dialog.agents
                .map(
                  (agent) => `
                    <tr>
                      <td class="oc-platform-agent-select-cell">
                        <input
                          type="checkbox"
                          data-platform-revoke-agent-select="${escapeHtml(agent.id)}"
                          aria-label="选择 ${escapeHtml(getRevokeTenantAgentDisplayName(agent))}"
                          ${dialog.busy ? "disabled" : ""}
                          ${isRevokeTenantAgentSelected(controller, agent.id) ? "checked" : ""}
                        />
                      </td>
                      <td>
                        <div class="oc-platform-revoke-agent__name">${escapeHtml(getRevokeTenantAgentDisplayName(agent))}</div>
                        <div class="oc-platform-revoke-agent__meta">${escapeHtml(agent.agentId || agent.id || "-")}</div>
                      </td>
                      <td>${escapeHtml(agent.description || "-")}</td>
                      <td>${formatNumber(agent.balancePoints)}</td>
                    </tr>
                  `,
                )
                .join("")}
            </tbody>
          </table>
        </div>
      `
      : !dialog.loading && !dialog.error
        ? `<div class="callout info">该租户当前没有可撤回的 Agent。</div>`
        : "";
  return `
    <dialog class="oc-platform-modal oc-platform-modal--wide" data-platform-revoke-tenant-agent-dialog>
      <div class="oc-platform-modal__panel oc-platform-modal__panel--wide">
        <header class="oc-platform-modal__header">
          <h3 class="oc-platform-modal__title">撤回分配</h3>
          <button class="btn" type="button" data-platform-close-dialog="revoke">关闭</button>
        </header>
        <div class="oc-platform-modal__body">
          <form class="oc-platform-modal__form" data-platform-revoke-tenant-agent-form>
            <input type="hidden" name="tenantId" value="${escapeHtml(dialog.tenantId)}" />
            <label class="field">
              <span>目标租户</span>
              <input type="text" value="${escapeHtml(dialog.tenantName || dialog.tenantId)}" disabled />
            </label>
            <div class="oc-platform-revoke-agent-toolbar">
              <label class="oc-platform-revoke-agent-toolbar__select-all">
                <input
                  type="checkbox"
                  data-platform-revoke-agent-select-all
                  aria-label="全选该租户已下发的 Agent"
                  ${dialog.loading || dialog.busy || !selectableAgents.length ? "disabled" : ""}
                  ${allAgentsSelected ? "checked" : ""}
                />
                <span>全选</span>
              </label>
              <span class="oc-platform-revoke-agent-toolbar__summary">
                已选择 ${formatNumber(selectedCount)} 个 Agent
              </span>
            </div>
            ${statusMarkup}
            ${listMarkup}
            <div class="oc-platform-modal__actions">
              <button class="btn" type="button" data-platform-close-dialog="revoke">取消</button>
              <button class="btn primary" type="submit" ${dialog.loading || dialog.busy || selectedCount === 0 ? "disabled" : ""}>下一步</button>
            </div>
          </form>
        </div>
      </div>
    </dialog>
  `;
}

export function renderRevokeTenantAgentConfirmDialog(controller) {
  const dialog = getRevokeTenantAgentDialog(controller);
  if (!dialog.confirmOpen) {
    return "";
  }
  const selectedAgents = getRevokeTenantAgentConfirmAgents(dialog);
  const tenantLabel = dialog.tenantName || dialog.tenantId || "该租户";
  const selectedCount = selectedAgents.length || dialog.confirmSelectedTenantAgentIds.length;
  return `
    <dialog class="oc-platform-modal" data-platform-revoke-confirm-dialog>
      <div class="oc-platform-modal__panel">
        <header class="oc-platform-modal__header">
          <h3 class="oc-platform-modal__title">确认撤回</h3>
          <button class="btn" type="button" data-platform-close-dialog="revoke-confirm">关闭</button>
        </header>
        <div class="oc-platform-modal__body">
          <div class="callout info">
            确认后将立即撤回租户“${escapeHtml(tenantLabel)}”已选中的 ${formatNumber(selectedCount)} 个 Agent，并同步失效该租户成员上的相关分配。
          </div>
          ${
            selectedAgents.length
              ? `
                <section class="oc-platform-revoke-confirm">
                  <div class="oc-platform-revoke-confirm__title">将撤回的 Agent</div>
                  <ul class="oc-platform-revoke-confirm__list">
                    ${selectedAgents
                      .map(
                        (agent) => `
                          <li>
                            <div class="oc-platform-revoke-confirm__name">${escapeHtml(getRevokeTenantAgentDisplayName(agent))}</div>
                            <div class="oc-platform-revoke-confirm__meta">${escapeHtml(agent.agentId || agent.id || "-")}</div>
                          </li>
                        `,
                      )
                      .join("")}
                  </ul>
                </section>
              `
              : ""
          }
          <form class="oc-platform-modal__form" data-platform-revoke-confirm-form>
            <div class="oc-platform-modal__actions">
              <button class="btn" type="button" data-platform-close-dialog="revoke-confirm">返回</button>
              <button class="btn primary" type="submit" ${dialog.busy ? "disabled" : ""}>确认撤回</button>
            </div>
          </form>
        </div>
      </div>
    </dialog>
  `;
}

export function renderLocalLicenseDialog(controller) {
  if (!isLocalEdition(controller)) {
    return "";
  }
  const localLicense = controller.localLicense;
  return `
    <dialog class="oc-platform-modal oc-platform-modal--wide" data-platform-local-license-dialog>
      <div class="oc-platform-modal__panel oc-platform-modal__panel--wide">
        <header class="oc-platform-modal__header">
          <h3 class="oc-platform-modal__title">本地授权管理</h3>
          <button class="btn" type="button" data-platform-close-dialog="local-license">关闭</button>
        </header>
        <div class="oc-platform-modal__body">
          <div class="callout ${localLicense?.status === "active" ? "info" : "danger"}">
            <strong>${escapeHtml(localLicenseStatusLabel(localLicense))}</strong><br/>
            客户名称：${escapeHtml(localLicense?.customerName || "-")}<br/>
            到期时间：${escapeHtml(formatDateTime(localLicense?.expiresAt))}<br/>
            剩余天数：${escapeHtml(localLicense?.remainingDays ?? "-")}<br/>
            当前说明：${escapeHtml(localLicense?.reason || "-")}
          </div>
          <form class="oc-platform-modal__form" data-platform-license-import-form>
            <label class="field">
              <span>导入授权文件内容</span>
              <textarea name="licenseText" rows="8" placeholder="粘贴签名后的授权 JSON"></textarea>
            </label>
            <div class="oc-platform-modal__actions">
              <button class="btn primary" type="submit">导入授权</button>
            </div>
          </form>
          <form class="oc-platform-modal__form" data-platform-license-renew-form>
            <label class="field">
              <span>续期码</span>
              <input name="renewalCode" type="text" placeholder="输入续期码" />
            </label>
            <div class="oc-platform-modal__actions">
              <button class="btn primary" type="submit">应用续期码</button>
            </div>
          </form>
        </div>
      </div>
    </dialog>
  `;
}

export function dismissPlatformDialog(root, controller, dialogKind, helpers) {
  if (dialogKind === "create") {
    controller.dialogs.createTenantOpen = false;
    helpers.closeDialog(root.querySelector("[data-platform-create-dialog]"));
    helpers.render(root, controller);
    return true;
  }
  if (dialogKind === "member-limit") {
    controller.dialogs.memberLimitOpen = false;
    helpers.closeDialog(root.querySelector("[data-platform-member-limit-dialog]"));
    helpers.render(root, controller);
    return true;
  }
  if (dialogKind === "assign") {
    controller.dialogs.assignOpen = false;
    controller.assignTenantAgentDialog = helpers.createAssignTenantAgentDialogState();
    helpers.closeDialog(root.querySelector("[data-platform-assign-dialog]"));
    helpers.render(root, controller);
    return true;
  }
  if (dialogKind === "rate") {
    controller.dialogs.rateOpen = false;
    controller.rateDialogAgents = [];
    helpers.closeDialog(root.querySelector("[data-platform-rate-dialog]"));
    helpers.render(root, controller);
    return true;
  }
  if (dialogKind === "revoke") {
    controller.revokeTenantAgentDialog = helpers.createRevokeTenantAgentDialogState();
    helpers.closeDialog(root.querySelector("[data-platform-revoke-tenant-agent-dialog]"));
    helpers.render(root, controller);
    return true;
  }
  if (dialogKind === "revoke-confirm") {
    const dialog = getRevokeTenantAgentDialog(controller);
    dialog.confirmOpen = false;
    dialog.confirmSelectedTenantAgentIds = [];
    helpers.closeDialog(root.querySelector("[data-platform-revoke-confirm-dialog]"));
    helpers.render(root, controller);
    return true;
  }
  if (dialogKind === "local-license") {
    controller.dialogs.localLicenseOpen = false;
    helpers.closeDialog(root.querySelector("[data-platform-local-license-dialog]"));
    helpers.render(root, controller);
    return true;
  }
  if (dialogKind === "binding") {
    controller.tenantDataSourceBindingDialog =
      helpers.createTenantDataSourceBindingDialogState();
    helpers.closeDialog(root.querySelector("[data-platform-binding-dialog]"));
    helpers.render(root, controller);
    return true;
  }
  if (dialogKind === "data-source") {
    controller.dataSourceCatalogDialog = helpers.createDataSourceCatalogDialogState();
    helpers.closeDialog(root.querySelector("[data-platform-data-source-dialog]"));
    helpers.render(root, controller);
    return true;
  }
  if (dialogKind === "node") {
    controller.dialogs.nodeOpen = false;
    controller.activeNode = null;
    controller.nodeDialog = helpers.createNodeDialogState();
    helpers.closeDialog(root.querySelector("[data-platform-node-dialog]"));
    helpers.render(root, controller);
    return true;
  }
  if (dialogKind === "bind-node") {
    controller.dialogs.bindNodeOpen = false;
    controller.bindNodeDialog = helpers.createBindNodeDialogState();
    helpers.closeDialog(root.querySelector("[data-platform-bind-node-dialog]"));
    helpers.render(root, controller);
    return true;
  }
  return false;
}

export function handlePlatformDialogClosed(controller, dialogElement, helpers) {
  if (dialogElement.matches("[data-platform-create-dialog]")) {
    controller.dialogs.createTenantOpen = false;
  }
  if (dialogElement.matches("[data-platform-member-limit-dialog]")) {
    controller.dialogs.memberLimitOpen = false;
  }
  if (dialogElement.matches("[data-platform-assign-dialog]")) {
    controller.dialogs.assignOpen = false;
    controller.assignTenantAgentDialog = helpers.createAssignTenantAgentDialogState();
  }
  if (dialogElement.matches("[data-platform-rate-dialog]")) {
    controller.dialogs.rateOpen = false;
    controller.rateDialogAgents = [];
  }
  if (dialogElement.matches("[data-platform-local-license-dialog]")) {
    controller.dialogs.localLicenseOpen = false;
  }
  if (dialogElement.matches("[data-platform-data-source-dialog]")) {
    controller.dataSourceCatalogDialog = helpers.createDataSourceCatalogDialogState();
  }
  if (dialogElement.matches("[data-platform-binding-dialog]")) {
    controller.tenantDataSourceBindingDialog =
      helpers.createTenantDataSourceBindingDialogState();
  }
  if (dialogElement.matches("[data-platform-node-dialog]")) {
    controller.dialogs.nodeOpen = false;
    controller.nodeDialog = helpers.createNodeDialogState();
  }
  if (dialogElement.matches("[data-platform-bind-node-dialog]")) {
    controller.dialogs.bindNodeOpen = false;
    controller.bindNodeDialog = helpers.createBindNodeDialogState();
  }
  if (dialogElement.matches("[data-platform-revoke-tenant-agent-dialog]")) {
    controller.revokeTenantAgentDialog = helpers.createRevokeTenantAgentDialogState();
  }
  if (dialogElement.matches("[data-platform-revoke-confirm-dialog]")) {
    const dialog = getRevokeTenantAgentDialog(controller);
    dialog.confirmOpen = false;
    dialog.confirmSelectedTenantAgentIds = [];
  }
}
