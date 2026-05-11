import {
  escapeHtml,
  formatNumber,
  getSearchValue,
} from "./platform-console-controller.js";

export function readDataSourceConnection(source) {
  const raw = source?.connection ?? source?.connectionJson ?? source?.connection_json ?? null;
  if (!raw) {
    return {};
  }
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }
  return typeof raw === "object" ? raw : {};
}

export function createDataSourceDraft(source = null, boundTenantId = "") {
  const connection = readDataSourceConnection(source);
  return {
    id: String(source?.id || "").trim(),
    code: String(source?.code || "").trim(),
    name: String(source?.name || "").trim(),
    sourceType: "kingdee_analytics",
    status: String(source?.status || "").trim() || "active",
    sourceDbid: String(source?.sourceDbid ?? source?.source_dbid ?? "").trim(),
    sourceTenantCode: String(
      source?.sourceTenantCode ?? source?.source_tenant_code ?? "",
    ).trim(),
    connectionHost: String(connection?.host || "").trim(),
    connectionPort:
      connection?.port === null || connection?.port === undefined
        ? "5432"
        : String(connection.port).trim(),
    connectionDatabase: String(connection?.database || "").trim(),
    connectionUser: String(connection?.user || "").trim(),
    connectionPassword:
      typeof connection?.password === "string"
        ? connection.password
        : connection?.password === null || connection?.password === undefined
          ? ""
          : String(connection.password),
    connectionPasswordStored: Boolean(source?.connectionPasswordStored),
    boundTenantId: String(boundTenantId || "").trim(),
  };
}

export function createDataSourceCatalogDialogState() {
  return {
    open: false,
    loading: false,
    busy: false,
    error: "",
    requestToken: 0,
    dataSources: [],
    draft: createDataSourceDraft(),
  };
}

export function createTenantDataSourceBindingDialogState() {
  return {
    open: false,
    loading: false,
    busy: false,
    error: "",
    requestToken: 0,
    tenantId: "",
    tenantName: "",
    currentBinding: null,
    dataSources: [],
    selectedDataSourceId: "",
  };
}

export function getDataSourceCatalogDialog(controller) {
  if (
    !(
      controller?.dataSourceCatalogDialog &&
      typeof controller.dataSourceCatalogDialog === "object"
    )
  ) {
    controller.dataSourceCatalogDialog = createDataSourceCatalogDialogState();
  }
  return controller.dataSourceCatalogDialog;
}

export function getTenantDataSourceBindingDialog(controller) {
  if (
    !(
      controller?.tenantDataSourceBindingDialog &&
      typeof controller.tenantDataSourceBindingDialog === "object"
    )
  ) {
    controller.tenantDataSourceBindingDialog = createTenantDataSourceBindingDialogState();
  }
  return controller.tenantDataSourceBindingDialog;
}

export function getActiveDataSources(dataSources) {
  if (!Array.isArray(dataSources)) {
    return [];
  }
  return dataSources.filter((source) => {
    const sourceId = String(source?.id || "").trim();
    return Boolean(sourceId) && String(source?.status || "active").trim() === "active";
  });
}

export function getDataSourceDisplayName(source) {
  for (const candidate of [source?.name, source?.code, source?.id]) {
    const value = String(candidate || "").trim();
    if (value) {
      return value;
    }
  }
  return "未命名数据源";
}

export function getTenantDisplayName(tenant) {
  for (const candidate of [tenant?.name, tenant?.code, tenant?.id]) {
    const value = String(candidate || "").trim();
    if (value) {
      return value;
    }
  }
  return "未绑定";
}

export function dataSourceById(dataSources, dataSourceId) {
  if (!Array.isArray(dataSources)) {
    return null;
  }
  return (
    dataSources.find((source) => String(source?.id || "").trim() === String(dataSourceId || "").trim()) ??
    null
  );
}

export function tenantByDataSourceId(controller, dataSourceId) {
  const normalizedDataSourceId = String(dataSourceId || "").trim();
  if (!normalizedDataSourceId || !Array.isArray(controller?.tenants)) {
    return null;
  }
  return (
    controller.tenants.find((tenant) => {
      const tenantSourceId = String(tenant?.dataSourceId || "").trim();
      if (tenantSourceId) {
        return tenantSourceId === normalizedDataSourceId;
      }
      return String(tenant?.dataSourceName || "").trim() === String(
        dataSourceById(controller.dataSources, normalizedDataSourceId)?.name || "",
      ).trim();
    }) ?? null
  );
}

export function listUnboundTenants(controller) {
  if (!Array.isArray(controller?.tenants)) {
    return [];
  }
  return controller.tenants.filter((tenant) => !String(tenant?.dataSourceId || "").trim());
}

export function resolveDefaultBoundTenantId(controller, dataSourceId = "") {
  const boundTenant = tenantByDataSourceId(controller, dataSourceId);
  if (boundTenant?.id) {
    return String(boundTenant.id || "").trim();
  }
  return String(listUnboundTenants(controller)[0]?.id || "").trim();
}

export function syncDataSourceDraftTenant(controller) {
  const dialog = getDataSourceCatalogDialog(controller);
  const currentDraft = dialog.draft || createDataSourceDraft();
  const boundTenantId = resolveDefaultBoundTenantId(controller, currentDraft.id);
  const selectedTenantId = String(currentDraft.boundTenantId || "").trim();
  if (boundTenantId) {
    dialog.draft = {
      ...currentDraft,
      boundTenantId,
    };
    return;
  }
  if (
    selectedTenantId &&
    controller.tenants.some(
      (tenant) =>
        String(tenant?.id || "").trim() === selectedTenantId &&
        !String(tenant?.dataSourceId || "").trim(),
    )
  ) {
    return;
  }
  dialog.draft = {
    ...currentDraft,
    boundTenantId: "",
  };
}

export function listSelectableTenantsForDraft(controller, draft) {
  const boundTenant = draft?.id ? tenantByDataSourceId(controller, draft.id) : null;
  if (boundTenant) {
    return [boundTenant];
  }
  return listUnboundTenants(controller);
}

export function describePlatformDataSourceError(errorMessage) {
  switch (String(errorMessage || "").trim()) {
    case "data_source_already_bound":
      return "该数据源已经绑定到其他平台租户。";
    case "tenant_data_source_rebind_locked":
      return "已绑定的数据源归属不能在这里改动，请继续使用租户管理里的“绑定数据源”。";
    default:
      return String(errorMessage || "").trim();
  }
}

export function getBindingSourceSummary(binding) {
  if (!binding || typeof binding !== "object") {
    return "未绑定";
  }
  const parts = [];
  if (binding.sourceDbid) {
    parts.push(`账套 ID：${String(binding.sourceDbid)}`);
  }
  if (binding.sourceTenantCode) {
    parts.push(`租户编码：${String(binding.sourceTenantCode)}`);
  }
  if (binding.dataSourceType) {
    parts.push(`类型：${String(binding.dataSourceType)}`);
  }
  return parts.length ? parts.join(" · ") : "已绑定，但暂无补充信息";
}

export function buildDataSourcePayloadFromDraft(draft) {
  const port = Number.parseInt(String(draft.connectionPort || "").trim(), 10);
  const connection = {
    host: String(draft.connectionHost || "").trim(),
    database: String(draft.connectionDatabase || "").trim(),
  };
  const user = String(draft.connectionUser || "").trim();
  if (Number.isFinite(port) && port > 0) {
    connection.port = port;
  }
  if (user) {
    connection.user = user;
  }
  if (typeof draft.connectionPassword === "string" && draft.connectionPassword !== "") {
    connection.password = draft.connectionPassword;
  }
  return {
    id: String(draft.id || "").trim() || undefined,
    code: String(draft.code || "").trim(),
    name: String(draft.name || "").trim(),
    sourceType: "kingdee_analytics",
    status: String(draft.status || "").trim() || "active",
    sourceDbid: String(draft.sourceDbid || "").trim() || null,
    sourceTenantCode: String(draft.sourceTenantCode || "").trim() || null,
    connection,
  };
}

export function filterDataSources(controller) {
  const query = getSearchValue(controller).trim().toLowerCase();
  const dialog = getDataSourceCatalogDialog(controller);
  if (!query) {
    return dialog.dataSources;
  }
  return dialog.dataSources.filter((source) => {
    const boundTenant = tenantByDataSourceId(controller, source?.id);
    return [
      source?.name,
      source?.code,
      source?.status,
      source?.sourceType,
      source?.sourceDbid,
      source?.sourceTenantCode,
      boundTenant?.name,
      boundTenant?.code,
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(query));
  });
}

export function renderDataSourceManagementTable(controller, rows) {
  const dialog = getDataSourceCatalogDialog(controller);
  const activeCount = getActiveDataSources(dialog.dataSources).length;
  const emptyState =
    dialog.dataSources.length && getSearchValue(controller).trim()
      ? "当前筛选条件下没有数据源"
      : "暂无数据源";
  return `
    <section class="oc-platform-data-source-page">
      <div class="oc-platform-data-source-page__summary">
        共 ${formatNumber(dialog.dataSources.length)} 个数据源，启用 ${formatNumber(activeCount)} 个
      </div>
      <div class="data-table-container">
          <table class="data-table oc-platform-data-source-table">
            <thead>
              <tr>
                <th>数据源名称</th>
                <th>数据源编码</th>
                <th>归属租户</th>
                <th>状态</th>
                <th>连接摘要</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              ${
                rows.length
                  ? rows
                      .map((source) => {
                        const connection = readDataSourceConnection(source);
                        const connectionParts = [];
                        const ownerTenant = tenantByDataSourceId(controller, source?.id);
                        if (source.sourceDbid) {
                          connectionParts.push(`账套 ID：${source.sourceDbid}`);
                        }
                        if (source.sourceTenantCode) {
                          connectionParts.push(`上游租户编码：${source.sourceTenantCode}`);
                        }
                        if (connection.host) {
                          connectionParts.push(`主机：${connection.host}`);
                        }
                        if (connection.database) {
                          connectionParts.push(`库：${connection.database}`);
                        }
                        return `
                          <tr>
                            <td>
                              <div class="oc-platform-revoke-agent__name">${escapeHtml(
                                getDataSourceDisplayName(source),
                              )}</div>
                              <div class="oc-platform-revoke-agent__meta">${escapeHtml(
                                source.sourceType || "kingdee_analytics",
                              )}</div>
                            </td>
                            <td>${escapeHtml(source.code || "-")}</td>
                            <td>${escapeHtml(getTenantDisplayName(ownerTenant))}</td>
                            <td><span class="data-table-badge data-table-badge--${source.status === "active" ? "direct" : "unknown"}">${escapeHtml(source.status || "unknown")}</span></td>
                            <td>${escapeHtml(connectionParts.join(" · ") || "未配置连接摘要")}</td>
                            <td><button class="btn" type="button" data-platform-edit-data-source="${escapeHtml(source.id)}" ${dialog.busy ? "disabled" : ""}>编辑</button></td>
                          </tr>
                        `;
                      })
                      .join("")
                  : `<tr><td colspan="6" class="oc-platform-table-empty">${escapeHtml(emptyState)}</td></tr>`
              }
            </tbody>
          </table>
      </div>
    </section>
  `;
}

export function renderDataSourceCatalogDialog(controller) {
  const dialog = getDataSourceCatalogDialog(controller);
  if (!dialog.open) {
    return "";
  }
  const draft = dialog.draft || createDataSourceDraft();
  const boundTenant = tenantByDataSourceId(controller, draft.id);
  const selectableTenants = listSelectableTenantsForDraft(controller, draft);
  const selectedTenantId =
    String(boundTenant?.id || "").trim() ||
    String(draft.boundTenantId || "").trim() ||
    resolveDefaultBoundTenantId(controller, draft.id);
  return `
    <dialog class="oc-platform-modal oc-platform-modal--wide" data-platform-data-source-dialog>
      <div class="oc-platform-modal__panel oc-platform-modal__panel--wide">
        <header class="oc-platform-modal__header">
          <h3 class="oc-platform-modal__title">${draft.id ? "编辑数据源" : "创建数据源"}</h3>
          <button class="btn" type="button" data-platform-close-dialog="data-source">关闭</button>
        </header>
        <div class="oc-platform-modal__body">
          <div class="callout info">
            一套数据源只归属一个平台租户。创建后会立即绑定到所选租户，租户下的成员共享这套数据源，成员级别只再控制组织范围。
          </div>
          ${
            boundTenant
              ? `<div class="oc-platform-revoke-agent__meta">当前已归属平台租户：${escapeHtml(
                  getTenantDisplayName(boundTenant),
                )}。若要切换归属，请继续使用租户管理里的“绑定数据源”。</div>`
              : ""
          }
          ${
            !boundTenant && !selectableTenants.length
              ? `<div class="callout danger">当前没有可绑定的空闲平台租户，请先在租户管理里确认租户与数据源占用情况。</div>`
              : ""
          }
          ${dialog.error ? `<div class="callout info">${escapeHtml(dialog.error)}</div>` : ""}
          <form class="oc-platform-modal__form" data-platform-data-source-form>
            <input type="hidden" name="id" value="${escapeHtml(draft.id)}" />
            <label class="field">
              <span>平台租户</span>
              <select
                name="tenantId"
                data-platform-data-source-tenant
                ${dialog.loading || dialog.busy || !selectableTenants.length ? "disabled" : ""}
                required
              >
                <option value="">请选择平台租户</option>
                ${selectableTenants
                  .map(
                    (tenant) => `
                      <option value="${escapeHtml(tenant.id)}" ${selectedTenantId === String(tenant.id || "") ? "selected" : ""}>
                        ${escapeHtml(getTenantDisplayName(tenant))}
                      </option>
                    `,
                  )
                  .join("")}
              </select>
            </label>
            <label class="field"><span>数据源编码</span><input name="code" type="text" value="${escapeHtml(draft.code)}" data-platform-data-source-code ${dialog.busy ? "disabled" : ""} required /></label>
            <label class="field"><span>数据源名称</span><input name="name" type="text" value="${escapeHtml(draft.name)}" data-platform-data-source-name ${dialog.busy ? "disabled" : ""} required /></label>
            <label class="field">
              <span>状态</span>
              <select name="status" data-platform-data-source-status ${dialog.busy ? "disabled" : ""}>
                <option value="active" ${draft.status === "active" ? "selected" : ""}>active</option>
                <option value="inactive" ${draft.status === "inactive" ? "selected" : ""}>inactive</option>
              </select>
            </label>
            <label class="field"><span>账套 ID</span><input name="sourceDbid" type="text" value="${escapeHtml(draft.sourceDbid)}" data-platform-data-source-dbid ${dialog.busy ? "disabled" : ""} /></label>
            <label class="field"><span>上游租户编码（可选）</span><input name="sourceTenantCode" type="text" value="${escapeHtml(draft.sourceTenantCode)}" data-platform-data-source-tenant-code ${dialog.busy ? "disabled" : ""} /></label>
            <label class="field"><span>连接主机</span><input name="connectionHost" type="text" value="${escapeHtml(draft.connectionHost)}" data-platform-data-source-host ${dialog.busy ? "disabled" : ""} required /></label>
            <label class="field"><span>连接端口</span><input name="connectionPort" type="number" min="1" value="${escapeHtml(draft.connectionPort)}" data-platform-data-source-port ${dialog.busy ? "disabled" : ""} /></label>
            <label class="field"><span>数据库名称</span><input name="connectionDatabase" type="text" value="${escapeHtml(draft.connectionDatabase)}" data-platform-data-source-database ${dialog.busy ? "disabled" : ""} required /></label>
            <label class="field"><span>连接用户名</span><input name="connectionUser" type="text" value="${escapeHtml(draft.connectionUser)}" data-platform-data-source-user ${dialog.busy ? "disabled" : ""} /></label>
            <label class="field">
              <span>连接密码</span>
              <input
                name="connectionPassword"
                type="password"
                value=""
                placeholder="${escapeHtml(draft.id && draft.connectionPasswordStored ? "留空则保留当前密码" : "")}"
                autocomplete="new-password"
                data-platform-data-source-password
                ${dialog.busy ? "disabled" : ""}
              />
            </label>
            <div class="oc-platform-modal__actions">
              <button class="btn" type="button" data-platform-close-dialog="data-source">取消</button>
              <button class="btn primary" type="submit" ${dialog.loading || dialog.busy || !selectableTenants.length ? "disabled" : ""}>${draft.id ? "保存数据源" : "创建数据源"}</button>
            </div>
          </form>
        </div>
      </div>
    </dialog>
  `;
}

export function renderTenantDataSourceBindingDialog(controller) {
  const dialog = getTenantDataSourceBindingDialog(controller);
  if (!dialog.open) {
    return "";
  }
  const activeDataSources = getActiveDataSources(dialog.dataSources);
  const statusMarkup = dialog.loading
    ? `<div class="callout info">正在加载当前绑定和可用数据源...</div>`
    : dialog.error
      ? `<div class="callout info">${escapeHtml(dialog.error)}</div>`
      : "";
  const selectedDataSourceId =
    dialog.selectedDataSourceId ||
    (activeDataSources.length === 1 ? String(activeDataSources[0].id || "") : "");
  return `
    <dialog class="oc-platform-modal" data-platform-binding-dialog>
      <div class="oc-platform-modal__panel">
        <header class="oc-platform-modal__header">
          <h3 class="oc-platform-modal__title">绑定数据源</h3>
          <button class="btn" type="button" data-platform-close-dialog="binding">关闭</button>
        </header>
        <div class="oc-platform-modal__body">
          <form class="oc-platform-modal__form" data-platform-binding-form>
            <input type="hidden" name="tenantId" value="${escapeHtml(dialog.tenantId)}" />
            <label class="field">
              <span>目标租户</span>
              <input type="text" value="${escapeHtml(dialog.tenantName || dialog.tenantId)}" disabled />
            </label>
            <label class="field">
              <span>当前绑定</span>
              <input type="text" value="${escapeHtml(dialog.currentBinding?.dataSourceName || "未绑定")}" disabled />
            </label>
            <div class="oc-platform-revoke-agent__meta">${escapeHtml(getBindingSourceSummary(dialog.currentBinding))}</div>
            <label class="field">
              <span>可用数据源</span>
              <select
                name="dataSourceId"
                data-platform-binding-select
                ${dialog.loading || dialog.busy || !activeDataSources.length ? "disabled" : ""}
                required
              >
                <option value="">请选择数据源</option>
                ${activeDataSources
                  .map(
                    (source) => `
                      <option value="${escapeHtml(source.id)}" ${selectedDataSourceId === String(source.id || "") ? "selected" : ""}>
                        ${escapeHtml(getDataSourceDisplayName(source))}
                      </option>
                    `,
                  )
                  .join("")}
              </select>
            </label>
            <div class="callout danger">
              更换绑定后会清空该租户成员已配置的组织权限范围，并将成员权限重置为无权限，请确认后再保存。
            </div>
            ${statusMarkup}
            ${
              !dialog.loading && !activeDataSources.length
                ? `<div class="callout info">当前没有可绑定的启用数据源，请先到“创建数据源”页面中创建或启用数据源。</div>`
                : ""
            }
            <div class="oc-platform-modal__actions">
              <button class="btn" type="button" data-platform-close-dialog="binding">取消</button>
              <button class="btn primary" type="submit" ${dialog.loading || dialog.busy || !selectedDataSourceId ? "disabled" : ""}>保存绑定</button>
            </div>
          </form>
        </div>
      </div>
    </dialog>
  `;
}

export function openCreateDataSourceCatalogDialog(root, controller, helpers) {
  const dialog = getDataSourceCatalogDialog(controller);
  dialog.open = true;
  dialog.busy = false;
  dialog.error = "";
  dialog.draft = createDataSourceDraft(null, resolveDefaultBoundTenantId(controller));
  helpers.render(root, controller);
}

export function openEditDataSourceCatalogDialog(root, controller, dataSourceId, helpers) {
  const current = dataSourceById(controller.dataSources, dataSourceId);
  if (!current) {
    helpers.setFeedback(root, "未找到数据源。", true);
    return;
  }
  const dialog = getDataSourceCatalogDialog(controller);
  dialog.open = true;
  dialog.busy = false;
  dialog.error = "";
  dialog.draft = createDataSourceDraft(
    current,
    resolveDefaultBoundTenantId(controller, dataSourceId),
  );
  helpers.render(root, controller);
}

export async function openTenantDataSourceBindingDialog(root, controller, tenantId, helpers) {
  const tenant = helpers.tenantById(controller, tenantId);
  if (!tenant) {
    return;
  }

  controller.activeTenant = tenant;
  const previousToken = Number(controller.tenantDataSourceBindingDialog?.requestToken || 0);
  controller.tenantDataSourceBindingDialog = {
    ...createTenantDataSourceBindingDialogState(),
    open: true,
    loading: true,
    tenantId: tenant.id,
    tenantName: tenant.name,
    requestToken: previousToken + 1,
  };
  helpers.render(root, controller);

  const requestToken = controller.tenantDataSourceBindingDialog.requestToken;
  try {
    const [dataSources, currentBinding] = await Promise.all([
      controller.apiClient.listPlatformDataSources(),
      controller.apiClient.getTenantDataSourceBinding(tenant.id),
    ]);
    const currentDialog = controller.tenantDataSourceBindingDialog;
    if (
      !currentDialog?.open ||
      currentDialog.requestToken !== requestToken ||
      currentDialog.tenantId !== tenant.id
    ) {
      return;
    }
    currentDialog.dataSources = Array.isArray(dataSources) ? dataSources : [];
    currentDialog.currentBinding = currentBinding ?? null;
    const activeDataSources = getActiveDataSources(currentDialog.dataSources);
    const activeIds = new Set(activeDataSources.map((source) => String(source.id || "").trim()));
    const currentBindingId = String(currentBinding?.dataSourceId || "").trim();
    currentDialog.selectedDataSourceId = activeIds.has(currentBindingId)
      ? currentBindingId
      : String(activeDataSources[0]?.id || "");
    currentDialog.loading = false;
    currentDialog.error = "";
    helpers.render(root, controller);
  } catch (error) {
    const currentDialog = controller.tenantDataSourceBindingDialog;
    if (
      !currentDialog?.open ||
      currentDialog.requestToken !== requestToken ||
      currentDialog.tenantId !== tenant.id
    ) {
      return;
    }
    currentDialog.loading = false;
    currentDialog.error = error instanceof Error ? error.message : String(error);
    helpers.render(root, controller);
    helpers.setFeedback(root, currentDialog.error, true);
  }
}
