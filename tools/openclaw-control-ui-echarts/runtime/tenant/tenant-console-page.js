import { createTenantApiClient } from "./api-client.js";
import {
  TENANT_AGENT_ASSIGNMENT_VIEW,
  TENANT_LOGIN_ROUTE,
  TENANT_MEMBERS_VIEW,
  requireTenantSession,
} from "./tenant-context.js";

const PAGE_SIZE = 8;

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
  return Number.isFinite(numeric)
    ? new Intl.NumberFormat("zh-CN").format(numeric)
    : "0";
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
                            `<option value="${escapeHtml(agent.id)}">${escapeHtml(agent.agentName)} · ${formatNumber(agent.balancePoints)} 积分</option>`,
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
      if (
        typeof state.selectionStart === "number" &&
        typeof state.selectionEnd === "number"
      ) {
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

  root.dataset.ocTenantEmbedded = "true";
  root.innerHTML = `
    <section class="oc-tenant-list-view">
      ${renderToolbar(controller)}
      <div class="data-table-wrapper">
        ${
          controller.section === "agent-assignment"
            ? renderAssignmentTable(pagination.items)
            : renderMembersTable(pagination.items)
        }
        ${renderPagination(pagination)}
      </div>
      <div class="callout info oc-tenant-surface-feedback" data-tenant-feedback hidden></div>
    </section>
    ${renderCreateMemberDialog()}
    ${renderAssignDialog(controller)}
  `;

  if (controller.dialogs.createMemberOpen) {
    openDialog(root.querySelector("[data-tenant-create-dialog]"));
  }
  if (controller.dialogs.assignOpen) {
    openDialog(root.querySelector("[data-tenant-assign-dialog]"));
  }
  restoreRenderFocusState(root, focusState);
}

async function refresh(root, controller) {
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
  await refresh(root, controller);
  return { root };
}
