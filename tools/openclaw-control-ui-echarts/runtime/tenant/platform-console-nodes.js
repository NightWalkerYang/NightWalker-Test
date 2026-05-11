import {
  escapeHtml,
  formatDateTime,
  formatDateTimeInputValue,
  formatNumber,
  getSearchValue,
} from "./platform-console-controller.js";

export function createNodeDialogState() {
  return {
    id: "",
    name: "",
    sharedSecret: "",
    status: "active",
    leaseStatus: "active",
    leaseExpiresAt: "",
    error: "",
    editing: false,
  };
}

export function createBindNodeDialogState() {
  return {
    tenantId: "",
    tenantName: "",
    nodeId: "",
    error: "",
  };
}

export function filterNodes(controller) {
  const query = getSearchValue(controller).trim().toLowerCase();
  if (!query) {
    return controller.nodes;
  }
  return controller.nodes.filter((node) =>
    [node.id, node.name, node.status, node.leaseStatus]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(query)),
  );
}

export function renderNodeManagementTable(rows) {
  return `
    <div class="data-table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th>节点标识</th>
            <th>节点名称</th>
            <th>状态</th>
            <th>授权状态</th>
            <th>授权到期</th>
            <th>已绑定租户</th>
            <th>本机 Agent</th>
            <th>最后心跳</th>
            <th>同步版本</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          ${
            rows.length
              ? rows
                  .map(
                    (node) => `
                      <tr>
                        <td>${escapeHtml(node.id)}</td>
                        <td>${escapeHtml(node.name)}</td>
                        <td><span class="data-table-badge data-table-badge--${node.status === "active" ? "direct" : "unknown"}">${escapeHtml(node.status)}</span></td>
                        <td>${escapeHtml(node.leaseStatus || "-")}</td>
                        <td>${escapeHtml(formatDateTime(node.leaseExpiresAt))}</td>
                        <td>${formatNumber(node.boundTenantCount)}</td>
                        <td>${formatNumber(node.agentCount)}</td>
                        <td>${escapeHtml(formatDateTime(node.lastHeartbeatAt))}</td>
                        <td>${escapeHtml(`${formatNumber(node.lastAppliedRevision)} / ${formatNumber(node.desiredRevision)}`)}</td>
                        <td>
                          <div class="oc-platform-table-actions">
                            <button class="btn" type="button" data-platform-open-edit-node="${escapeHtml(node.id)}">编辑</button>
                          </div>
                        </td>
                      </tr>
                    `,
                  )
                  .join("")
              : `<tr><td colspan="10" class="oc-platform-table-empty">暂无节点数据</td></tr>`
          }
        </tbody>
      </table>
    </div>
  `;
}

export function renderNodeDialog(controller) {
  if (!controller.dialogs.nodeOpen) {
    return "";
  }
  const dialog = controller.nodeDialog || createNodeDialogState();
  return `
    <dialog class="oc-platform-modal oc-platform-modal--wide" data-platform-node-dialog>
      <div class="oc-platform-modal__panel oc-platform-modal__panel--wide">
        <header class="oc-platform-modal__header">
          <h3 class="oc-platform-modal__title">${dialog.editing ? "编辑节点" : "创建节点"}</h3>
          <button class="btn" type="button" data-platform-close-dialog="node">关闭</button>
        </header>
        <div class="oc-platform-modal__body">
          <form class="oc-platform-modal__form" data-platform-node-form>
            <label class="field">
              <span>节点标识</span>
              <input name="id" type="text" value="${escapeHtml(dialog.id)}" ${dialog.editing ? "disabled" : ""} required />
            </label>
            <label class="field">
              <span>节点名称</span>
              <input name="name" type="text" value="${escapeHtml(dialog.name)}" required />
            </label>
            <label class="field">
              <span>共享密钥${dialog.editing ? "（留空则保持不变）" : ""}</span>
              <input name="sharedSecret" type="text" value="" ${dialog.editing ? "" : "required"} />
            </label>
            <label class="field">
              <span>节点状态</span>
              <select name="status">
                <option value="active" ${dialog.status === "active" ? "selected" : ""}>active</option>
                <option value="disabled" ${dialog.status === "disabled" ? "selected" : ""}>disabled</option>
              </select>
            </label>
            <label class="field">
              <span>授权状态</span>
              <select name="leaseStatus">
                <option value="active" ${dialog.leaseStatus === "active" ? "selected" : ""}>active</option>
                <option value="disabled" ${dialog.leaseStatus === "disabled" ? "selected" : ""}>disabled</option>
              </select>
            </label>
            <label class="field">
              <span>授权到期时间（可选）</span>
              <input name="leaseExpiresAt" type="datetime-local" value="${escapeHtml(dialog.leaseExpiresAt)}" />
            </label>
            <div class="oc-platform-modal__actions">
              <button class="btn" type="button" data-platform-close-dialog="node">取消</button>
              <button class="btn primary" type="submit">${dialog.editing ? "保存节点" : "创建节点"}</button>
            </div>
          </form>
        </div>
      </div>
    </dialog>
  `;
}

export function renderBindNodeDialog(controller) {
  if (!controller.dialogs.bindNodeOpen) {
    return "";
  }
  const dialog = controller.bindNodeDialog || createBindNodeDialogState();
  const nodeOptions = Array.isArray(controller.nodes) ? controller.nodes : [];
  return `
    <dialog class="oc-platform-modal" data-platform-bind-node-dialog>
      <div class="oc-platform-modal__panel">
        <header class="oc-platform-modal__header">
          <h3 class="oc-platform-modal__title">节点绑定</h3>
          <button class="btn" type="button" data-platform-close-dialog="bind-node">关闭</button>
        </header>
        <div class="oc-platform-modal__body">
          <form class="oc-platform-modal__form" data-platform-bind-node-form>
            <input type="hidden" name="tenantId" value="${escapeHtml(dialog.tenantId)}" />
            <label class="field">
              <span>目标租户</span>
              <input type="text" value="${escapeHtml(dialog.tenantName || dialog.tenantId)}" disabled />
            </label>
            <label class="field">
              <span>受管节点</span>
              <select name="nodeId">
                <option value="">未绑定</option>
                ${nodeOptions
                  .map(
                    (node) => `
                      <option value="${escapeHtml(node.id)}" ${dialog.nodeId === node.id ? "selected" : ""}>
                        ${escapeHtml(node.name)} (${escapeHtml(node.id)})
                      </option>
                    `,
                  )
                  .join("")}
              </select>
            </label>
            <div class="oc-platform-modal__actions">
              <button class="btn" type="button" data-platform-close-dialog="bind-node">取消</button>
              <button class="btn primary" type="submit">保存绑定</button>
            </div>
          </form>
        </div>
      </div>
    </dialog>
  `;
}

export function openCreateNodeDialog(root, controller, render) {
  controller.activeNode = null;
  controller.dialogs.nodeOpen = true;
  controller.nodeDialog = createNodeDialogState();
  render(root, controller);
}

export function openEditNodeDialog(root, controller, node, helpers) {
  if (!node) {
    helpers.setFeedback(root, "未找到节点信息。", true);
    return;
  }
  controller.activeNode = node;
  controller.dialogs.nodeOpen = true;
  controller.nodeDialog = {
    id: node.id,
    name: node.name,
    sharedSecret: "",
    status: node.status || "active",
    leaseStatus: node.leaseStatus || "active",
    leaseExpiresAt: formatDateTimeInputValue(node.leaseExpiresAt),
    error: "",
    editing: true,
  };
  helpers.render(root, controller);
}

export function openBindNodeDialog(root, controller, tenant, helpers) {
  if (!tenant) {
    helpers.setFeedback(root, "未找到租户信息。", true);
    return;
  }
  controller.activeTenant = tenant;
  controller.dialogs.bindNodeOpen = true;
  controller.bindNodeDialog = {
    tenantId: tenant.id,
    tenantName: tenant.name,
    nodeId: String(tenant.boundNodeId || "").trim(),
    error: "",
  };
  helpers.render(root, controller);
}
