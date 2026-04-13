import { createTenantApiClient } from "./api-client.js";
import { TENANT_LOGIN_ROUTE, requireTenantSession } from "./tenant-context.js";

const PAGE_SIZE = 8;

function isLocalEdition(controller) {
  return controller?.session?.session?.edition === "local";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
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

function formatNumber(value) {
  const numeric = Number(value || 0);
  return Number.isFinite(numeric) ? new Intl.NumberFormat("zh-CN").format(numeric) : "0";
}

function formatDecimal(value, maximumFractionDigits = 4) {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) {
    return "0";
  }
  return new Intl.NumberFormat("zh-CN", {
    minimumFractionDigits: numeric > 0 && numeric < 1 ? 4 : 0,
    maximumFractionDigits,
  }).format(numeric);
}

function formatLocalDateInput(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.valueOf())) {
    const fallback = new Date();
    return `${fallback.getFullYear()}-${String(fallback.getMonth() + 1).padStart(2, "0")}-${String(
      fallback.getDate(),
    ).padStart(2, "0")}`;
  }
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

function normalizeUsageDateRange(startDate, endDate) {
  const safeStart = /^\d{4}-\d{2}-\d{2}$/.test(String(startDate || "").trim())
    ? String(startDate).trim()
    : formatLocalDateInput();
  const safeEnd = /^\d{4}-\d{2}-\d{2}$/.test(String(endDate || "").trim())
    ? String(endDate).trim()
    : safeStart;
  if (safeStart <= safeEnd) {
    return { startDate: safeStart, endDate: safeEnd };
  }
  return { startDate: safeEnd, endDate: safeStart };
}

function createEmptyUsageStats(startDate, endDate) {
  return {
    range: {
      startDate,
      endDate,
    },
    totals: {
      responseCount: 0,
      memberCount: 0,
      agentCount: 0,
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      totalTokens: 0,
      totalCost: 0,
      lastUsedAt: null,
    },
    byMember: [],
    byAgent: [],
    byDay: [],
  };
}

function setFeedback(root, text, isError = false) {
  const feedback = root.querySelector("[data-tenant-feedback]");
  if (!(feedback instanceof HTMLElement)) {
    return;
  }
  feedback.hidden = !text;
  feedback.textContent = text;
  feedback.className = `callout ${isError ? "danger" : "info"} oc-tenant-surface-feedback`;
}

function openDialog(dialog) {
  if (!(dialog instanceof HTMLDialogElement)) {
    return;
  }
  if (!dialog.open) {
    dialog.showModal();
  }
}

function closeDialog(dialog) {
  if (dialog instanceof HTMLDialogElement && dialog.open) {
    dialog.close();
  }
}

function ensureController(root, session, apiClient) {
  if (root.__ocTenantConsoleController) {
    root.__ocTenantConsoleController.session = session;
    return root.__ocTenantConsoleController;
  }

  const today = formatLocalDateInput();
  const controller = {
    apiClient,
    session,
    section: "members",
    searchBySection: {
      members: "",
      "agent-assignment": "",
    },
    pageBySection: {
      members: 1,
      "agent-assignment": 1,
    },
    members: [],
    tenantAgents: [],
    activeMember: null,
    usageFilters: {
      startDate: today,
      endDate: today,
    },
    usageStats: createEmptyUsageStats(today, today),
    dialogs: {
      createMemberOpen: false,
      assignOpen: false,
    },
  };

  root.__ocTenantConsoleController = controller;
  root.addEventListener("click", (event) => {
    void handleClick(root, controller, event);
  });
  root.addEventListener("input", (event) => {
    handleInput(root, controller, event);
  });
  root.addEventListener("submit", (event) => {
    void handleSubmit(root, controller, event);
  });
  root.addEventListener("close", (event) => {
    if (!(event.target instanceof HTMLDialogElement)) {
      return;
    }
    if (event.target.matches("[data-tenant-create-dialog]")) {
      controller.dialogs.createMemberOpen = false;
    }
    if (event.target.matches("[data-tenant-assign-dialog]")) {
      controller.dialogs.assignOpen = false;
    }
    render(root, controller);
  });
  return controller;
}

function getSearchValue(controller) {
  return controller.searchBySection[controller.section] || "";
}

function getPageValue(controller) {
  return controller.pageBySection[controller.section] || 1;
}

function setPageValue(controller, page) {
  controller.pageBySection[controller.section] = Math.max(1, page);
}

function filterMembers(controller) {
  const query = getSearchValue(controller).trim().toLowerCase();
  if (!query) {
    return controller.members;
  }
  return controller.members.filter((member) =>
    [member.username, member.status]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(query)),
  );
}

function paginate(items, page) {
  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * PAGE_SIZE;
  return {
    items: items.slice(start, start + PAGE_SIZE),
    page: safePage,
    totalPages,
    totalItems: items.length,
  };
}

function renderToolbar(controller) {
  if (controller.section === "usage-stats") {
    return `
      <div class="data-table-toolbar oc-tenant-table-toolbar oc-tenant-usage-toolbar">
        <div class="oc-tenant-usage-toolbar__filters">
          <label class="field oc-tenant-usage-field">
            <span>开始日期</span>
            <input
              type="date"
              value="${escapeHtml(controller.usageFilters.startDate)}"
              data-tenant-usage-start
            />
          </label>
          <label class="field oc-tenant-usage-field">
            <span>结束日期</span>
            <input
              type="date"
              value="${escapeHtml(controller.usageFilters.endDate)}"
              data-tenant-usage-end
            />
          </label>
          <button class="btn primary" type="button" data-tenant-usage-refresh>刷新统计</button>
        </div>
        <div class="oc-tenant-usage-toolbar__hint">
          默认按当天统计，可切换时间范围查看按成员、按 Agent、按天聚合结果。
        </div>
      </div>
    `;
  }

  return `
    <div class="data-table-toolbar oc-tenant-table-toolbar">
      <label class="data-table-search">
        <input
          type="search"
          placeholder="${controller.section === "members" ? "搜索成员账号或状态" : "搜索成员账号或状态"}"
          value="${escapeHtml(getSearchValue(controller))}"
          data-tenant-search
        />
      </label>
      ${
        controller.section === "members"
          ? `<button class="btn primary" type="button" data-tenant-open-create>创建成员</button>`
          : ""
      }
    </div>
  `;
}

function renderMembersTable(rows) {
  return `
    <div class="data-table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th>成员账号</th>
            <th>状态</th>
            <th>已分配 Agent</th>
            <th>创建时间</th>
          </tr>
        </thead>
        <tbody>
          ${
            rows.length
              ? rows
                  .map(
                    (member) => `
                      <tr>
                        <td>${escapeHtml(member.username)}</td>
                        <td><span class="data-table-badge data-table-badge--${member.status === "active" ? "direct" : "unknown"}">${escapeHtml(member.status)}</span></td>
                        <td>${formatNumber(member.assignedAgentCount)}</td>
                        <td>${escapeHtml(formatDateTime(member.createdAt))}</td>
                      </tr>
                    `,
                  )
                  .join("")
              : `<tr><td colspan="4" class="oc-tenant-table-empty">暂无成员数据</td></tr>`
          }
        </tbody>
      </table>
    </div>
  `;
}

function renderAssignmentTable(rows) {
  return `
    <div class="data-table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th>成员账号</th>
            <th>状态</th>
            <th>已分配 Agent</th>
            <th>创建时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          ${
            rows.length
              ? rows
                  .map(
                    (member) => `
                      <tr>
                        <td>${escapeHtml(member.username)}</td>
                        <td><span class="data-table-badge data-table-badge--${member.status === "active" ? "direct" : "unknown"}">${escapeHtml(member.status)}</span></td>
                        <td>${formatNumber(member.assignedAgentCount)}</td>
                        <td>${escapeHtml(formatDateTime(member.createdAt))}</td>
                        <td>
                          <div class="oc-tenant-table-actions">
                            <button class="btn" type="button" data-tenant-open-assign="${escapeHtml(member.id)}">分配Agent</button>
                          </div>
                        </td>
                      </tr>
                    `,
                  )
                  .join("")
              : `<tr><td colspan="5" class="oc-tenant-table-empty">暂无成员数据</td></tr>`
          }
        </tbody>
      </table>
    </div>
  `;
}

function renderPagination(pagination) {
  return `
    <div class="data-table-pagination">
      <div class="data-table-pagination__info">
        共 ${formatNumber(pagination.totalItems)} 条，第 ${formatNumber(pagination.page)} / ${formatNumber(pagination.totalPages)} 页
      </div>
      <div class="data-table-pagination__controls">
        <button type="button" data-tenant-page="prev" ${pagination.page <= 1 ? "disabled" : ""}>上一页</button>
        <button type="button" data-tenant-page="next" ${pagination.page >= pagination.totalPages ? "disabled" : ""}>下一页</button>
      </div>
    </div>
  `;
}

function renderCreateMemberDialog() {
  return `
    <dialog class="oc-tenant-modal" data-tenant-create-dialog>
      <div class="oc-tenant-modal__panel">
        <header class="oc-tenant-modal__header">
          <h3 class="oc-tenant-modal__title">创建成员</h3>
          <button class="btn" type="button" data-tenant-close-dialog="create">关闭</button>
        </header>
        <div class="oc-tenant-modal__body">
          <form class="oc-tenant-modal__form" data-tenant-member-form>
            <label class="field"><span>成员账号</span><input name="username" type="text" required /></label>
            <label class="field"><span>成员密码</span><input name="password" type="password" required /></label>
            <div class="oc-tenant-modal__actions">
              <button class="btn primary" type="submit">创建成员</button>
            </div>
          </form>
        </div>
      </div>
    </dialog>
  `;
}

function renderAssignDialog(controller) {
  const member = controller.activeMember;
  const localEdition = isLocalEdition(controller);
  return `
    <dialog class="oc-tenant-modal" data-tenant-assign-dialog>
      <div class="oc-tenant-modal__panel">
        <header class="oc-tenant-modal__header">
          <h3 class="oc-tenant-modal__title">分配Agent</h3>
          <button class="btn" type="button" data-tenant-close-dialog="assign">关闭</button>
        </header>
        <div class="oc-tenant-modal__body">
          ${
            member
              ? `
                <form class="oc-tenant-modal__form" data-tenant-assignment-form>
                  <input type="hidden" name="userId" value="${escapeHtml(member.id)}" />
                  <label class="field"><span>目标成员</span><input type="text" value="${escapeHtml(member.username)}" disabled /></label>
                  <label class="field">
                    <span>租户已下发 Agent</span>
                    <select name="tenantAgentId" required>
                      <option value="">请选择租户可用 Agent</option>
                      ${controller.tenantAgents
                        .map(
                          (agent) =>
                            `<option value="${escapeHtml(agent.id)}">${escapeHtml(agent.agentName)}${localEdition ? "" : ` · ${formatNumber(agent.balancePoints)} 积分`}</option>`,
                        )
                        .join("")}
                    </select>
                  </label>
                  <div class="oc-tenant-modal__actions">
                    <button class="btn primary" type="submit">保存分配</button>
                  </div>
                </form>
              `
              : `<div class="callout info">请选择成员后再操作。</div>`
          }
        </div>
      </div>
    </dialog>
  `;
}

function renderUsageCard(label, value, hint) {
  return `
    <div class="oc-tenant-usage-card">
      <span class="oc-tenant-usage-card__label">${escapeHtml(label)}</span>
      <strong class="oc-tenant-usage-card__value">${escapeHtml(value)}</strong>
      <span class="oc-tenant-usage-card__hint">${escapeHtml(hint)}</span>
    </div>
  `;
}

function renderUsageSummary(stats) {
  const totals = stats?.totals ?? createEmptyUsageStats("", "").totals;
  return `
    <div class="oc-tenant-usage-summary">
      ${renderUsageCard(
        "助手回复数",
        formatNumber(totals.responseCount),
        totals.lastUsedAt
          ? `最近记录：${formatDateTime(totals.lastUsedAt)}`
          : "当前范围内暂无回复记录",
      )}
      ${renderUsageCard(
        "总 Tokens",
        formatNumber(totals.totalTokens),
        `输入 ${formatNumber(totals.inputTokens)} / 输出 ${formatNumber(totals.outputTokens)}`,
      )}
      ${renderUsageCard(
        "活跃成员",
        formatNumber(totals.memberCount),
        `涉及 ${formatNumber(totals.agentCount)} 个 Agent`,
      )}
      ${renderUsageCard(
        "缓存读写",
        `${formatNumber(totals.cacheReadTokens)} / ${formatNumber(totals.cacheWriteTokens)}`,
        totals.totalCost > 0 ? `估算费用 ${formatDecimal(totals.totalCost)}` : "当前以耗量统计为主",
      )}
    </div>
  `;
}

function renderUsageMemberTable(rows) {
  return `
    <div class="data-table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th>成员账号</th>
            <th>助手回复</th>
            <th>总 Tokens</th>
            <th>输入</th>
            <th>输出</th>
            <th>最近记录</th>
          </tr>
        </thead>
        <tbody>
          ${
            rows.length
              ? rows
                  .map(
                    (row) => `
                      <tr>
                        <td>${escapeHtml(row.username || "-")}</td>
                        <td>${formatNumber(row.responseCount)}</td>
                        <td>${formatNumber(row.totalTokens)}</td>
                        <td>${formatNumber(row.inputTokens)}</td>
                        <td>${formatNumber(row.outputTokens)}</td>
                        <td>${escapeHtml(formatDateTime(row.lastUsedAt))}</td>
                      </tr>
                    `,
                  )
                  .join("")
              : `<tr><td colspan="6" class="oc-tenant-table-empty">当前范围内暂无成员耗量记录</td></tr>`
          }
        </tbody>
      </table>
    </div>
  `;
}

function renderUsageAgentTable(rows) {
  return `
    <div class="data-table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th>Agent</th>
            <th>助手回复</th>
            <th>总 Tokens</th>
            <th>输入</th>
            <th>输出</th>
            <th>最近记录</th>
          </tr>
        </thead>
        <tbody>
          ${
            rows.length
              ? rows
                  .map(
                    (row) => `
                      <tr>
                        <td>
                          <strong>${escapeHtml(row.agentName || row.agentId || "-")}</strong>
                          <small>${escapeHtml(row.agentId || "-")}</small>
                        </td>
                        <td>${formatNumber(row.responseCount)}</td>
                        <td>${formatNumber(row.totalTokens)}</td>
                        <td>${formatNumber(row.inputTokens)}</td>
                        <td>${formatNumber(row.outputTokens)}</td>
                        <td>${escapeHtml(formatDateTime(row.lastUsedAt))}</td>
                      </tr>
                    `,
                  )
                  .join("")
              : `<tr><td colspan="6" class="oc-tenant-table-empty">当前范围内暂无 Agent 耗量记录</td></tr>`
          }
        </tbody>
      </table>
    </div>
  `;
}

function renderUsageDayTable(rows) {
  return `
    <div class="data-table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th>日期</th>
            <th>助手回复</th>
            <th>总 Tokens</th>
            <th>输入</th>
            <th>输出</th>
            <th>最近记录</th>
          </tr>
        </thead>
        <tbody>
          ${
            rows.length
              ? rows
                  .map(
                    (row) => `
                      <tr>
                        <td>${escapeHtml(row.usageDay || "-")}</td>
                        <td>${formatNumber(row.responseCount)}</td>
                        <td>${formatNumber(row.totalTokens)}</td>
                        <td>${formatNumber(row.inputTokens)}</td>
                        <td>${formatNumber(row.outputTokens)}</td>
                        <td>${escapeHtml(formatDateTime(row.lastUsedAt))}</td>
                      </tr>
                    `,
                  )
                  .join("")
              : `<tr><td colspan="6" class="oc-tenant-table-empty">当前范围内暂无按天统计记录</td></tr>`
          }
        </tbody>
      </table>
    </div>
  `;
}

function renderUsageSection(title, subtitle, body) {
  return `
    <section class="oc-tenant-usage-section">
      <div class="oc-tenant-usage-section__head">
        <div>
          <h3>${escapeHtml(title)}</h3>
          <p>${escapeHtml(subtitle)}</p>
        </div>
      </div>
      ${body}
    </section>
  `;
}

function renderUsageStats(controller) {
  const stats =
    controller.usageStats ||
    createEmptyUsageStats(controller.usageFilters.startDate, controller.usageFilters.endDate);
  return `
    <section class="oc-tenant-usage-grid">
      <div class="oc-tenant-usage-range">
        统计区间：${escapeHtml(stats.range?.startDate || controller.usageFilters.startDate)} 至 ${escapeHtml(
          stats.range?.endDate || controller.usageFilters.endDate,
        )}
      </div>
      ${renderUsageSummary(stats)}
      ${renderUsageSection(
        "按成员",
        "查看每个租户成员的累计耗量与最近使用时间。",
        renderUsageMemberTable(Array.isArray(stats.byMember) ? stats.byMember : []),
      )}
      ${renderUsageSection(
        "按 Agent",
        "查看被租户成员实际使用到的 Agent 耗量聚合。",
        renderUsageAgentTable(Array.isArray(stats.byAgent) ? stats.byAgent : []),
      )}
      ${renderUsageSection(
        "按天",
        "查看当前时间范围内逐日汇总的耗量变化。",
        renderUsageDayTable(Array.isArray(stats.byDay) ? stats.byDay : []),
      )}
    </section>
  `;
}

function captureRenderFocusState(root) {
  const active = document.activeElement;
  if (!(active instanceof HTMLInputElement) || !root.contains(active)) {
    return null;
  }
  if (active.hasAttribute("data-tenant-search")) {
    return {
      kind: "search",
      selectionStart: active.selectionStart,
      selectionEnd: active.selectionEnd,
    };
  }
  return null;
}

function restoreRenderFocusState(root, state) {
  if (!state) {
    return;
  }
  if (state.kind === "search") {
    const input = root.querySelector("[data-tenant-search]");
    if (input instanceof HTMLInputElement) {
      input.focus();
      if (typeof state.selectionStart === "number" && typeof state.selectionEnd === "number") {
        try {
          input.setSelectionRange(state.selectionStart, state.selectionEnd);
        } catch {
          // Ignore unsupported selection restoration.
        }
      }
    }
  }
}

function render(root, controller) {
  const focusState = captureRenderFocusState(root);
  const filtered = filterMembers(controller);
  const pagination = paginate(filtered, getPageValue(controller));
  setPageValue(controller, pagination.page);

  const contentMarkup =
    controller.section === "usage-stats"
      ? renderUsageStats(controller)
      : `
        <div class="data-table-wrapper">
          ${
            controller.section === "agent-assignment"
              ? renderAssignmentTable(pagination.items)
              : renderMembersTable(pagination.items)
          }
          ${renderPagination(pagination)}
        </div>
      `;

  root.dataset.ocTenantEmbedded = "true";
  root.innerHTML = `
    <section class="oc-tenant-list-view ${controller.section === "usage-stats" ? "oc-tenant-list-view--scrollable" : ""}">
      ${renderToolbar(controller)}
      ${contentMarkup}
      <div class="callout info oc-tenant-surface-feedback" data-tenant-feedback hidden></div>
    </section>
    ${
      controller.section === "usage-stats"
        ? ""
        : `${renderCreateMemberDialog()}${renderAssignDialog(controller)}`
    }
  `;

  if (controller.section !== "usage-stats") {
    if (controller.dialogs.createMemberOpen) {
      openDialog(root.querySelector("[data-tenant-create-dialog]"));
    }
    if (controller.dialogs.assignOpen) {
      openDialog(root.querySelector("[data-tenant-assign-dialog]"));
    }
  }
  restoreRenderFocusState(root, focusState);
}

async function refresh(root, controller) {
  if (controller.section === "usage-stats") {
    const normalizedRange = normalizeUsageDateRange(
      controller.usageFilters.startDate,
      controller.usageFilters.endDate,
    );
    controller.usageFilters = normalizedRange;
    controller.usageStats = await controller.apiClient.getTenantUsageStats(
      normalizedRange.startDate,
      normalizedRange.endDate,
    );
    render(root, controller);
    return;
  }

  const [members, tenantAgents] = await Promise.all([
    controller.apiClient.listTenantMembers(),
    controller.apiClient.listTenantAgents(),
  ]);
  controller.members = members;
  controller.tenantAgents = tenantAgents;
  if (
    controller.activeMember &&
    !members.some((member) => member.id === controller.activeMember.id)
  ) {
    controller.activeMember = null;
  }
  render(root, controller);
}

function memberById(controller, userId) {
  return controller.members.find((member) => member.id === userId) ?? null;
}

async function handleClick(root, controller, event) {
  const target = event.target;
  if (!(target instanceof Element)) {
    return;
  }

  const paginationButton = target.closest("[data-tenant-page]");
  if (paginationButton instanceof HTMLElement) {
    const action = paginationButton.dataset.tenantPage;
    const currentPage = getPageValue(controller);
    setPageValue(controller, action === "next" ? currentPage + 1 : currentPage - 1);
    render(root, controller);
    return;
  }

  if (target.closest("[data-tenant-usage-refresh]")) {
    try {
      await refresh(root, controller);
      setFeedback(root, "耗量统计已刷新。");
    } catch (error) {
      setFeedback(root, error instanceof Error ? error.message : String(error), true);
    }
    return;
  }

  if (target.closest("[data-tenant-open-create]")) {
    controller.dialogs.createMemberOpen = true;
    render(root, controller);
    return;
  }

  const closeDialogTrigger = target.closest("[data-tenant-close-dialog]");
  if (closeDialogTrigger instanceof HTMLElement) {
    const dialogKind = closeDialogTrigger.dataset.tenantCloseDialog || "";
    if (dialogKind === "create") {
      controller.dialogs.createMemberOpen = false;
      closeDialog(root.querySelector("[data-tenant-create-dialog]"));
    }
    if (dialogKind === "assign") {
      controller.dialogs.assignOpen = false;
      closeDialog(root.querySelector("[data-tenant-assign-dialog]"));
    }
    render(root, controller);
    return;
  }

  const assignTrigger = target.closest("[data-tenant-open-assign]");
  if (assignTrigger instanceof HTMLElement) {
    controller.activeMember = memberById(controller, assignTrigger.dataset.tenantOpenAssign);
    controller.dialogs.assignOpen = true;
    render(root, controller);
  }
}

function handleInput(root, controller, event) {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) {
    return;
  }
  if (target.hasAttribute("data-tenant-search")) {
    controller.searchBySection[controller.section] = target.value;
    setPageValue(controller, 1);
    render(root, controller);
    return;
  }
  if (target.hasAttribute("data-tenant-usage-start")) {
    controller.usageFilters.startDate = target.value;
    return;
  }
  if (target.hasAttribute("data-tenant-usage-end")) {
    controller.usageFilters.endDate = target.value;
  }
}

async function handleSubmit(root, controller, event) {
  const target = event.target;
  if (!(target instanceof HTMLFormElement)) {
    return;
  }

  if (target.matches("[data-tenant-member-form]")) {
    event.preventDefault();
    try {
      const payload = Object.fromEntries(new FormData(target).entries());
      await controller.apiClient.createTenantMember(payload);
      controller.dialogs.createMemberOpen = false;
      await refresh(root, controller);
      closeDialog(root.querySelector("[data-tenant-create-dialog]"));
      setFeedback(root, "成员已创建。");
    } catch (error) {
      setFeedback(root, error instanceof Error ? error.message : String(error), true);
    }
    return;
  }

  if (target.matches("[data-tenant-assignment-form]")) {
    event.preventDefault();
    try {
      const payload = Object.fromEntries(new FormData(target).entries());
      await controller.apiClient.assignTenantAgent(payload);
      controller.dialogs.assignOpen = false;
      await refresh(root, controller);
      closeDialog(root.querySelector("[data-tenant-assign-dialog]"));
      setFeedback(root, "成员 Agent 分配已生效。");
    } catch (error) {
      setFeedback(root, error instanceof Error ? error.message : String(error), true);
    }
  }
}

export async function mountTenantConsolePage(root, options = {}) {
  if (!(root instanceof HTMLElement)) {
    return null;
  }

  const session = requireTenantSession(["tenant_admin"], { loginHref: TENANT_LOGIN_ROUTE });
  if (!session) {
    return null;
  }

  const apiClient = createTenantApiClient();
  const controller = ensureController(root, session, apiClient);
  controller.section = options.section || "members";
  if (controller.section === "usage-stats") {
    controller.dialogs.createMemberOpen = false;
    controller.dialogs.assignOpen = false;
  }
  await refresh(root, controller);
  return { root };
}
