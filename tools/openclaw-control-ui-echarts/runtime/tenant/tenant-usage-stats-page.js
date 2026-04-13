import { createTenantApiClient } from "./api-client.js";
import {
  TENANT_LOGIN_ROUTE,
  requireTenantSession,
} from "./tenant-context.js";

const DEFAULT_PAGE_SIZE = 8;
const SEARCH_DEBOUNCE_MS = 250;

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

function formatCredits(value) {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) {
    return "0";
  }
  return new Intl.NumberFormat("zh-CN", {
    maximumFractionDigits: 2,
  }).format(numeric);
}

function formatTokens(value) {
  if (value === null || value === undefined || value === "") {
    return "-";
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? formatNumber(numeric) : "-";
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

function totalPagesFor(controller) {
  const pageSize = controller.pageSize || DEFAULT_PAGE_SIZE;
  return Math.max(1, Math.ceil((controller.total || 0) / pageSize));
}

function captureFocusState(root) {
  const active = document.activeElement;
  if (!(active instanceof HTMLInputElement) || !root.contains(active)) {
    return null;
  }
  if (active.hasAttribute("data-tenant-usage-search")) {
    return {
      kind: "search",
      selectionStart: active.selectionStart,
      selectionEnd: active.selectionEnd,
    };
  }
  return null;
}

function restoreFocusState(root, state) {
  if (!state) {
    return;
  }
  if (state.kind === "search") {
    const input = root.querySelector("[data-tenant-usage-search]");
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

function renderToolbar(controller) {
  return `
    <div class="data-table-toolbar oc-tenant-table-toolbar">
      <label class="data-table-search">
        <input
          type="search"
          placeholder="搜索成员、Agent 或模型"
          value="${escapeHtml(controller.search)}"
          data-tenant-usage-search
        />
      </label>
    </div>
  `;
}

function renderTable(rows) {
  return `
    <div class="data-table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th>成员</th>
            <th>Agent</th>
            <th>耗用总token</th>
            <th>输入</th>
            <th>输出</th>
            <th>耗用积分</th>
            <th>时间</th>
          </tr>
        </thead>
        <tbody>
          ${
            rows.length
              ? rows
                  .map(
                    (row) => `
                      <tr>
                        <td>${escapeHtml(row.memberUsername || "-")}</td>
                        <td>${escapeHtml(row.agentName || row.agentId || "-")}</td>
                        <td>${escapeHtml(formatTokens(row.totalTokens ?? row.tokens))}</td>
                        <td>${escapeHtml(formatTokens(row.inputTokens))}</td>
                        <td>${escapeHtml(formatTokens(row.outputTokens))}</td>
                        <td>${escapeHtml(formatCredits(row.creditsUsed))}</td>
                        <td>${escapeHtml(formatDateTime(row.createdAt))}</td>
                      </tr>
                    `,
                  )
                  .join("")
              : `<tr><td colspan="7" class="oc-tenant-table-empty">暂无耗量记录</td></tr>`
          }
        </tbody>
      </table>
    </div>
  `;
}

function renderPagination(controller) {
  const totalPages = totalPagesFor(controller);
  return `
    <div class="data-table-pagination">
      <div class="data-table-pagination__info">
        共 ${formatNumber(controller.total)} 条，第 ${formatNumber(controller.page)} / ${formatNumber(totalPages)} 页
      </div>
      <div class="data-table-pagination__controls">
        <button type="button" data-tenant-usage-page="prev" ${controller.page <= 1 ? "disabled" : ""}>上一页</button>
        <button type="button" data-tenant-usage-page="next" ${controller.page >= totalPages ? "disabled" : ""}>下一页</button>
      </div>
    </div>
  `;
}

function render(root, controller) {
  const focusState = captureFocusState(root);
  root.dataset.ocTenantEmbedded = "true";
  root.innerHTML = `
    <section class="oc-tenant-list-view oc-tenant-list-view--scrollable">
      ${renderToolbar(controller)}
      <div class="data-table-wrapper">
        ${renderTable(controller.items)}
        ${renderPagination(controller)}
      </div>
      <div class="callout info oc-tenant-surface-feedback" data-tenant-feedback hidden></div>
    </section>
  `;
  restoreFocusState(root, focusState);
}

async function refresh(root, controller) {
  try {
    controller.loading = true;
    const data = await controller.apiClient.listTenantUsageStats({
      page: controller.page,
      pageSize: controller.pageSize,
      search: controller.search,
    });
    controller.items = Array.isArray(data?.items) ? data.items : [];
    controller.total = Number(data?.total || 0);
    controller.page = Number(data?.page || controller.page) || 1;
    controller.pageSize = Number(data?.pageSize || controller.pageSize) || DEFAULT_PAGE_SIZE;
    const totalPages = totalPagesFor(controller);
    if (controller.page > totalPages) {
      controller.page = totalPages;
      return refresh(root, controller);
    }
    render(root, controller);
  } catch (error) {
    render(root, controller);
    setFeedback(root, error instanceof Error ? error.message : String(error), true);
  } finally {
    controller.loading = false;
  }
}

function ensureController(root, session, apiClient) {
  if (root.__ocTenantUsageStatsController) {
    const existing = root.__ocTenantUsageStatsController;
    existing.session = session;
    existing.apiClient = apiClient;
    return existing;
  }

  const controller = {
    apiClient,
    session,
    search: "",
    page: 1,
    pageSize: DEFAULT_PAGE_SIZE,
    items: [],
    total: 0,
    loading: false,
    searchTimer: null,
  };

  root.__ocTenantUsageStatsController = controller;

  root.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }
    const pageButton = target.closest("[data-tenant-usage-page]");
    if (pageButton instanceof HTMLElement) {
      const action = pageButton.dataset.tenantUsagePage;
      const totalPages = totalPagesFor(controller);
      const next = action === "next" ? controller.page + 1 : controller.page - 1;
      controller.page = Math.min(Math.max(1, next), totalPages);
      void refresh(root, controller);
    }
  });

  root.addEventListener("input", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) {
      return;
    }
    if (!target.hasAttribute("data-tenant-usage-search")) {
      return;
    }
    controller.search = target.value;
    controller.page = 1;
    if (controller.searchTimer) {
      window.clearTimeout(controller.searchTimer);
    }
    controller.searchTimer = window.setTimeout(() => {
      controller.searchTimer = null;
      void refresh(root, controller);
    }, SEARCH_DEBOUNCE_MS);
  });

  return controller;
}

export async function mountTenantUsageStatsPage(root, options = {}) {
  if (!(root instanceof HTMLElement)) {
    return null;
  }

  const session = requireTenantSession(["tenant_admin"], {
    loginHref: TENANT_LOGIN_ROUTE,
  });
  if (!session) {
    return null;
  }

  const apiClient = createTenantApiClient();
  const controller = ensureController(root, session, apiClient);
  if (options.search !== undefined) {
    controller.search = String(options.search || "");
  }
  render(root, controller);
  await refresh(root, controller);
  return { root };
}
