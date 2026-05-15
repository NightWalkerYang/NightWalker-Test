import {
  filterTenantAgents,
  renderAgentDetailDialog,
  renderAgentTransferDialog,
  renderOwnedAgentsCards,
} from "./tenant-console-agents.js";
import {
  filterMembers,
  getPageValue,
  getSearchValue,
  isLocalEdition,
  paginate,
  setPageValue,
  escapeHtml,
  escapeAttribute,
  formatCredits,
  formatDateTime,
  formatNumber,
} from "./tenant-console-controller.js";
import { openDialog } from "./tenant-console-dialogs.js";
import {
  clearAssignAgentSelection,
  clearRevokeAssignmentSelection,
  pruneAssignAgentSelection,
  pruneRevokeAssignmentSelection,
  renderAssignDialog,
  renderAssignmentTable,
  renderChangePasswordDialog,
  renderCreateMemberDialog,
  renderDeleteMemberDialog,
  renderMemberOrgScopeDialog,
  renderMembersTable,
  renderRevokeAssignmentConfirmDialog,
  renderRevokeAssignmentDialog,
  syncAssignAgentSelectionState,
  syncMemberOrgScopeSelectionState,
  syncRevokeAssignmentSelectionState,
} from "./tenant-console-members.js";
import { renderUsageList } from "./tenant-console-usage.js";
import {
  renderWalletFlowList,
  renderWalletLedgerList,
  renderWalletOrdersList,
} from "./tenant-console-wallet.js";
import {
  disposeTenantOverviewCharts,
  initTenantOverviewCharts,
  renderTenantOverview,
} from "./tenant-overview-page.js";
import { renderTenantWalletPage } from "./tenant-wallet-page.js";

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

function renderToolbar(controller) {
  if (
    controller.section === "skills-market" ||
    controller.section === "skills-entitlements" ||
    controller.section === "skills-assignments"
  ) {
    return `
      <div class="data-table-toolbar oc-tenant-table-toolbar">
        <div class="oc-tenant-wallet-toolbar__summary">
          Skills 管理
        </div>
      </div>
    `;
  }
  if (controller.section === "skills-workbench") {
    return `
      <div class="data-table-toolbar oc-tenant-table-toolbar">
        <label class="data-table-search">
          <input
            type="search"
            placeholder="搜索成员、Agent 或 Skill"
            value="${escapeHtml(getSearchValue(controller))}"
            data-tenant-search
          />
        </label>
      </div>
    `;
  }
  if (controller.section === "wallet") {
    const pendingCount = Number(controller.walletData?.summary?.pendingOrderCount || 0);
    return `
      <div class="data-table-toolbar oc-tenant-table-toolbar">
        <div class="oc-tenant-wallet-toolbar__summary">
          待处理订单: ${formatNumber(pendingCount)}
        </div>
        <div class="oc-tenant-table-toolbar__actions">
          <button class="btn" type="button" data-tenant-wallet-refresh>刷新钱包</button>
        </div>
      </div>
    `;
  }

  if (controller.section === "usage-stats") {
    return `
      <div class="data-table-toolbar oc-tenant-table-toolbar">
        <label class="data-table-search">
          <input
            type="search"
            placeholder="搜索成员、Agent 或模型"
            value="${escapeHtml(getSearchValue(controller))}"
            data-tenant-search
          />
        </label>
      </div>
    `;
  }

  if (controller.section === "wallet-orders") {
    return `
      <div class="data-table-toolbar oc-tenant-table-toolbar">
        <label class="data-table-search">
          <input
            type="search"
            placeholder="搜索订单号、状态或供应商单号"
            value="${escapeHtml(getSearchValue(controller))}"
            data-tenant-search
          />
        </label>
      </div>
    `;
  }

  if (controller.section === "wallet-ledger") {
    return `
      <div class="data-table-toolbar oc-tenant-table-toolbar">
        <label class="data-table-search">
          <input
            type="search"
            placeholder="搜索模型扣费、Agent 或备注"
            value="${escapeHtml(getSearchValue(controller))}"
            data-tenant-search
          />
        </label>
      </div>
    `;
  }

  if (controller.section === "wallet-flow") {
    return `
      <div class="data-table-toolbar oc-tenant-table-toolbar">
        <label class="data-table-search">
          <input
            type="search"
            placeholder="搜索流水类型、订单号、Agent 或备注"
            value="${escapeHtml(getSearchValue(controller))}"
            data-tenant-search
          />
        </label>
      </div>
    `;
  }

  if (controller.section === "owned-agents") {
    return `
      <div class="data-table-toolbar oc-tenant-table-toolbar">
        <label class="data-table-search">
          <input
            type="search"
            placeholder="搜索 Agent 名称、标识或说明"
            value="${escapeHtml(getSearchValue(controller))}"
            data-tenant-search
          />
        </label>
      </div>
    `;
  }

  return `
    <div class="data-table-toolbar oc-tenant-table-toolbar">
      <label class="data-table-search">
        <input
          type="search"
          placeholder="搜索成员账号或状态"
          value="${escapeHtml(getSearchValue(controller))}"
          data-tenant-search
        />
      </label>
      <div class="oc-tenant-table-toolbar__actions">
        ${
          controller.section === "members"
            ? `<button class="btn primary" type="button" data-tenant-open-create>创建成员</button>`
            : ""
        }
      </div>
    </div>
  `;
}

function getWorkbenchMemberStatusVariant(status) {
  return String(status || "").trim() === "active" ? "direct" : "unknown";
}

function getWorkbenchAgentTitle(card) {
  return (
    String(card?.tenantAgent?.agentName || "").trim() ||
    String(card?.tenantAgent?.description || "").trim() ||
    String(card?.baseAgentId || "").trim() ||
    String(card?.tenantAgentId || "").trim() ||
    "未命名 Agent"
  );
}

function getWorkbenchSkillClassificationLabel(classification) {
  const normalized = String(classification || "").trim();
  if (normalized === "bundled") {
    return "内置";
  }
  if (normalized === "free") {
    return "免费";
  }
  if (normalized === "paid") {
    return "付费";
  }
  return normalized || "-";
}

function getSkillMarketClassificationLabel(classification) {
  return getWorkbenchSkillClassificationLabel(classification);
}

function getSkillMarketStatusVariant(entry) {
  const status = String(entry?.marketStatus || "").trim();
  if (
    entry?.enabledByTenant ||
    status === "已启用" ||
    status === "已购买已启用" ||
    status === "无需购买"
  ) {
    return "direct";
  }
  if (status === "待确认" || status === "待下单" || status === "免费可启用") {
    return "unknown";
  }
  return "unknown";
}

function getSkillMarketDisplayName(entry) {
  return (
    String(entry?.name || "").trim() ||
    String(entry?.skillKey || "").trim() ||
    String(entry?.id || "").trim() ||
    "未命名 Skill"
  );
}

function getSkillMarketId(entry) {
  return String(entry?.id || entry?.skillId || "").trim();
}

function getSkillMarketVersionLabel(entry) {
  return (
    String(entry?.latestVersionLabel || "").trim() ||
    String(entry?.currentVersionId || "").trim() ||
    String(entry?.latestVersionId || "").trim() ||
    "-"
  );
}

function renderSkillMarketActions(entry, { compact = false } = {}) {
  const sizeClass = compact ? " btn-sm" : "";
  const skillId = getSkillMarketId(entry);
  if (entry.classification === "paid" && !entry.entitlementId) {
    return `<button class="btn${sizeClass}" type="button" data-tenant-skill-order="${escapeAttribute(skillId)}">下单</button>`;
  }
  if (entry.classification === "paid" && entry.pendingOrderId) {
    return `<button class="btn primary${sizeClass}" type="button" data-tenant-skill-confirm-order="${escapeAttribute(entry.pendingOrderId)}">确认购买</button>`;
  }
  if (entry.classification === "free" && entry.entitlementId && !entry.enabledByTenant) {
    return `<button class="btn${sizeClass}" type="button" data-tenant-skill-enable="${escapeAttribute(entry.entitlementId)}">启用</button>`;
  }
  if (entry.classification === "free" && !entry.entitlementId) {
    return `<button class="btn${sizeClass}" type="button" data-tenant-skill-free-enable="${escapeAttribute(skillId)}">启用</button>`;
  }
  return `<span class="oc-tenant-skill-market-card__action-note">无需操作</span>`;
}

const WORKBENCH_CHEVRON_ICON = `
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="m6 9 6 6 6-6"></path>
  </svg>
`;

const WORKBENCH_AGENT_ICON = `
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 3.5a3 3 0 1 1 0 6 3 3 0 0 1 0-6Zm-5 8h10A2.5 2.5 0 0 1 19.5 14v3.5H4.5V14A2.5 2.5 0 0 1 7 11.5Zm-2.5 8h15v1.5h-15Z"></path>
  </svg>
`;

function getWorkbenchSkillStateLabel(skill) {
  if (skill?.templateBlocked) {
    return "缺授权阻断";
  }
  if (skill?.currentOverrideAction === "force_remove") {
    return "成员移除";
  }
  if (skill?.currentOverrideAction === "force_add") {
    return "成员加配";
  }
  if (skill?.templateEnabled && skill?.inResolvedSet) {
    return "已生效";
  }
  if (skill?.templateEnabled) {
    return "模板启用";
  }
  if (skill?.entitlement?.enabledByTenant) {
    return "已授权未分配";
  }
  return String(skill?.marketStatus || "").trim() || "未启用";
}

function getWorkbenchSkillStateVariant(skill) {
  if (skill?.templateBlocked) {
    return "unknown";
  }
  if (skill?.currentOverrideAction === "force_remove") {
    return "unknown";
  }
  if (skill?.currentOverrideAction === "force_add" || skill?.inResolvedSet) {
    return "direct";
  }
  return "unknown";
}

function getWorkbenchSkillAccessLabel(skill) {
  if (skill?.classification === "bundled") {
    return "无需购买";
  }
  if (skill?.entitlement?.enabledByTenant) {
    return "已启用";
  }
  return String(skill?.marketStatus || "").trim() || "未授权";
}

function renderSkillsWorkbenchSkillCard(card, skill) {
  const skillKey = String(skill?.skillKey || "").trim();
  return `
    <article class="oc-tenant-skill-workbench-skill-card">
      <div class="oc-tenant-skill-workbench-skill-card__header">
        <div>
          <h4 class="oc-tenant-skill-workbench-skill-card__title">${escapeHtml(
            skill?.name || skillKey || "-",
          )}</h4>
          <p class="oc-tenant-skill-workbench-skill-card__subtitle">${escapeHtml(
            skillKey || "-",
          )}</p>
        </div>
        <span class="data-table-badge data-table-badge--${getWorkbenchSkillStateVariant(skill)}">${escapeHtml(
          getWorkbenchSkillStateLabel(skill),
        )}</span>
      </div>
      <p class="oc-tenant-skill-workbench-skill-card__description">${escapeHtml(
        skill?.description || "暂无说明",
      )}</p>
      <dl class="oc-tenant-skill-workbench-skill-card__meta">
        <div>
          <dt>类型</dt>
          <dd>${escapeHtml(getWorkbenchSkillClassificationLabel(skill?.classification))}</dd>
        </div>
        <div>
          <dt>授权</dt>
          <dd>${escapeHtml(getWorkbenchSkillAccessLabel(skill))}</dd>
        </div>
        <div>
          <dt>版本</dt>
          <dd>${escapeHtml(skill?.latestVersionLabel || skill?.currentVersionId || skill?.latestVersionId || "-")}</dd>
        </div>
        <div>
          <dt>状态</dt>
          <dd>${escapeHtml(getWorkbenchSkillStateLabel(skill))}</dd>
        </div>
      </dl>
    </article>
  `;
}

function renderSkillsWorkbenchSelectedAgentPanel(member, card) {
  const cardSkills = Array.isArray(card?.displaySkills) ? card.displaySkills : [];
  return `
    <section class="oc-tenant-skill-workbench__selection-content">
      <div class="oc-tenant-skill-workbench__context-bar">
        <div class="oc-tenant-skill-workbench__context-copy">
          <p class="oc-tenant-skill-workbench__context-kicker">当前 Agent Skills</p>
          <h3 class="oc-tenant-skill-workbench__selection-title">${escapeHtml(
            getWorkbenchAgentTitle(card),
          )}</h3>
          <p class="oc-tenant-skill-workbench__context-meta">${escapeHtml(
            member?.username || member?.userId || "-",
          )} · ${escapeHtml(card?.baseAgentId || card?.tenantAgentId || "-")} · ${formatNumber(
            cardSkills.length,
          )} 个 skill</p>
        </div>
        <span class="data-table-badge data-table-badge--${String(card?.assignmentStatus || "").trim() === "active" ? "direct" : "unknown"}">${escapeHtml(
          String(card?.assignmentStatus || "").trim() === "blocked_missing_skills"
            ? "已阻断"
            : "已分配",
        )}</span>
      </div>
      ${
        cardSkills.length
          ? `<div class="oc-tenant-skill-workbench-skill-grid">
              ${cardSkills.map((skill) => renderSkillsWorkbenchSkillCard(card, skill)).join("")}
            </div>`
          : `<div class="callout info">该 Agent 当前没有可显示的 skills。</div>`
      }
    </section>
  `;
}

function renderSkillsWorkbenchTree(controller) {
  const state = controller.skillsWorkbenchState;
  const members = Array.isArray(state?.filteredMembers) ? state.filteredMembers : [];
  const expandedMemberIds = new Set(
    Array.isArray(state?.expandedMemberIds)
      ? state.expandedMemberIds.map((value) => String(value || "").trim()).filter(Boolean)
      : [],
  );
  return `
    <div class="oc-tenant-skill-workbench__member-nav">
      ${
        members.length
          ? members
              .map((member) => {
                const memberId = String(member?.userId || "").trim();
                const isExpanded = expandedMemberIds.has(memberId);
                const treeCards = Array.isArray(member?.treeCards)
                  ? member.treeCards
                  : member.cards || [];
                return `
                  <section class="nav-section oc-tenant-skill-workbench__member-section ${
                    isExpanded ? "" : "nav-section--collapsed"
                  }">
                    <button
                      type="button"
                      class="nav-section__label oc-tenant-skill-workbench__member-trigger ${
                        memberId === state?.selectedMemberId
                          ? "oc-tenant-skill-workbench__member-trigger--active"
                          : ""
                      }"
                      data-tenant-skill-member-toggle="${escapeAttribute(memberId)}"
                      aria-expanded="${isExpanded ? "true" : "false"}"
                    >
                      <span class="oc-tenant-skill-workbench__member-label-group">
                        <span class="nav-section__label-text">${escapeHtml(
                          member.username || member.userId,
                        )}</span>
                        <span class="oc-tenant-skill-workbench__member-summary">${formatNumber(
                          Array.isArray(member.cards) ? member.cards.length : 0,
                        )} 个 Agent</span>
                      </span>
                      <span class="nav-section__chevron" aria-hidden="true">${WORKBENCH_CHEVRON_ICON}</span>
                    </button>
                    <div class="nav-section__items" ${isExpanded ? "" : "hidden"}>
                      ${
                        treeCards.length
                          ? treeCards
                              .map(
                                (card) => `
                                  <button
                                    type="button"
                                    class="nav-item oc-tenant-skill-workbench__agent-nav-item ${
                                      String(card?.assignmentId || "").trim() ===
                                      String(state?.selectedAssignmentId || "").trim()
                                        ? "nav-item--active"
                                        : ""
                                    }"
                                    data-tenant-skill-assignment-select="${escapeAttribute(
                                      card?.assignmentId || "",
                                    )}"
                                    data-tenant-skill-member-select="${escapeAttribute(memberId)}"
                                  >
                                    <span class="nav-item__icon" aria-hidden="true">${WORKBENCH_AGENT_ICON}</span>
                                    <span class="nav-item__text">
                                      <span class="oc-tenant-skill-workbench__agent-nav-name">${escapeHtml(
                                        getWorkbenchAgentTitle(card),
                                      )}</span>
                                      <span class="oc-tenant-skill-workbench__agent-nav-meta">${escapeHtml(
                                        card?.baseAgentId || card?.tenantAgentId || "-",
                                      )}</span>
                                    </span>
                                  </button>
                                `,
                              )
                              .join("")
                          : `<div class="callout info">该成员当前没有已分配 Agent。</div>`
                      }
                    </div>
                  </section>
                `;
              })
              .join("")
          : `<div class="callout info">当前没有可管理 skills 的成员。</div>`
      }
    </div>
  `;
}

function renderSkillsWorkbench(controller) {
  const state = controller.skillsWorkbenchState;
  const selectedMember = state?.selectedMember || null;
  const selectedCard = state?.selectedCard || null;
  return `
    <section class="oc-tenant-skill-workbench">
      <aside class="oc-tenant-skill-workbench__sidebar">
        <header class="oc-tenant-skill-workbench__sidebar-header">
          <h2 class="oc-tenant-skill-workbench__sidebar-title">成员</h2>
          <p class="oc-tenant-skill-workbench__sidebar-summary">展开成员后选择 Agent，再查看该 Agent 的 skills</p>
        </header>
        ${renderSkillsWorkbenchTree(controller)}
      </aside>
      <div class="oc-tenant-skill-workbench__content">
        ${
          selectedMember && selectedCard
            ? renderSkillsWorkbenchSelectedAgentPanel(selectedMember, selectedCard)
            : selectedMember
              ? `<div class="callout info">请选择该成员下的 Agent 后查看 skills。</div>`
              : `<div class="callout info">请选择左侧成员后查看 Agent skills。</div>`
        }
      </div>
    </section>
  `;
}

function getSkillsMarketDetailTarget(controller) {
  const skillId = String(controller.skillsMarketDetailDialog?.skillId || "").trim();
  if (!skillId) {
    return null;
  }
  return (
    (Array.isArray(controller.skillsMarketItems) ? controller.skillsMarketItems : []).find(
      (entry) => getSkillMarketId(entry) === skillId,
    ) || null
  );
}

function renderSkillMarketDetailDialog(controller) {
  const entry = getSkillsMarketDetailTarget(controller);
  return `
    <dialog class="oc-tenant-modal oc-tenant-modal--wide" data-tenant-skill-market-detail-dialog>
      <div class="oc-tenant-modal__panel">
        <header class="oc-tenant-modal__header">
          <h3 class="oc-tenant-modal__title">Skill 详情</h3>
          <button class="btn" type="button" data-tenant-close-dialog="skill-market-detail">关闭</button>
        </header>
        <div class="oc-tenant-modal__body">
          ${
            entry
              ? `
                <div class="oc-tenant-skill-market-detail">
                  <div class="oc-tenant-skill-market-detail__hero">
                    <div>
                      <p class="oc-tenant-skill-market-detail__eyebrow">市场 Skill</p>
                      <h4 class="oc-tenant-skill-market-detail__title">${escapeHtml(getSkillMarketDisplayName(entry))}</h4>
                      <p class="oc-tenant-skill-market-detail__subtitle">${escapeHtml(entry.skillKey || entry.id || "-")}</p>
                    </div>
                    <span class="data-table-badge data-table-badge--${getSkillMarketStatusVariant(entry)}">${escapeHtml(entry.marketStatus || "-")}</span>
                  </div>
                  <p class="oc-tenant-skill-market-detail__description">${escapeHtml(entry.description || "暂无说明")}</p>
                  <dl class="oc-tenant-skill-market-detail__grid">
                    <div>
                      <dt>类型</dt>
                      <dd>${escapeHtml(getSkillMarketClassificationLabel(entry.classification))}</dd>
                    </div>
                    <div>
                      <dt>价格</dt>
                      <dd>${formatCredits(entry.pricePoints || 0)} 积分</dd>
                    </div>
                    <div>
                      <dt>版本</dt>
                      <dd>${escapeHtml(getSkillMarketVersionLabel(entry))}</dd>
                    </div>
                    <div>
                      <dt>当前版本</dt>
                      <dd>${escapeHtml(entry.currentVersionId || "-")}</dd>
                    </div>
                    <div>
                      <dt>影响模板</dt>
                      <dd>${formatNumber(entry.affectedTenantAgentCount || 0)} 个 Agent</dd>
                    </div>
                    <div>
                      <dt>影响成员</dt>
                      <dd>${formatNumber(entry.affectedAssignmentCount || 0)} 个分配</dd>
                    </div>
                    <div>
                      <dt>授权状态</dt>
                      <dd>${escapeHtml(entry.entitlementStatus || "-")}</dd>
                    </div>
                    <div>
                      <dt>兼容范围</dt>
                      <dd>${escapeHtml(
                        Array.isArray(entry.compatibleBaseAgents) &&
                          entry.compatibleBaseAgents.length
                          ? entry.compatibleBaseAgents.join(", ")
                          : "全部 Agent",
                      )}</dd>
                    </div>
                    <div>
                      <dt>发布时间</dt>
                      <dd>${escapeHtml(formatDateTime(entry.latestPublishedAt || entry.latestSyncedAt))}</dd>
                    </div>
                    <div>
                      <dt>更新时间</dt>
                      <dd>${escapeHtml(formatDateTime(entry.updatedAt || entry.createdAt))}</dd>
                    </div>
                  </dl>
                  <div class="oc-tenant-modal__actions">
                    ${renderSkillMarketActions(entry)}
                  </div>
                </div>
              `
              : `<div class="callout info">未找到对应的 Skill 详情。</div>`
          }
        </div>
      </div>
    </dialog>
  `;
}

function renderSkillsMarketCards(controller) {
  const rows = Array.isArray(controller.skillsMarketItems) ? controller.skillsMarketItems : [];
  if (!rows.length) {
    return `<div class="callout info oc-tenant-agent-empty">暂无 Skills 市场数据</div>`;
  }
  return `
    <div class="oc-tenant-skill-market-grid">
      ${rows
        .map((entry) => {
          const skillId = getSkillMarketId(entry);
          return `
            <article class="oc-tenant-skill-market-card" data-tenant-skill-market-detail="${escapeAttribute(skillId)}" tabindex="0" role="button" aria-label="查看 ${escapeAttribute(getSkillMarketDisplayName(entry))} 详情">
              <div class="oc-tenant-skill-market-card__header">
                <div class="oc-tenant-skill-market-card__copy">
                  <h3 class="oc-tenant-skill-market-card__title">${escapeHtml(getSkillMarketDisplayName(entry))}</h3>
                  <p class="oc-tenant-skill-market-card__subtitle">${escapeHtml(entry.skillKey || skillId || "-")}</p>
                </div>
                <span class="data-table-badge data-table-badge--${getSkillMarketStatusVariant(entry)}">${escapeHtml(entry.marketStatus || "-")}</span>
              </div>
              <p class="oc-tenant-skill-market-card__description">${escapeHtml(entry.description || "暂无说明")}</p>
              <dl class="oc-tenant-skill-market-card__meta">
                <div>
                  <dt>类型</dt>
                  <dd>${escapeHtml(getSkillMarketClassificationLabel(entry.classification))}</dd>
                </div>
                <div>
                  <dt>价格</dt>
                  <dd>${formatCredits(entry.pricePoints || 0)}</dd>
                </div>
                <div>
                  <dt>版本</dt>
                  <dd>${escapeHtml(getSkillMarketVersionLabel(entry))}</dd>
                </div>
                <div>
                  <dt>影响范围</dt>
                  <dd>${formatNumber(entry.affectedTenantAgentCount || 0)} 模板 / ${formatNumber(entry.affectedAssignmentCount || 0)} 成员</dd>
                </div>
              </dl>
              <div class="oc-tenant-skill-market-card__actions">
                <button class="btn btn-sm" type="button" data-tenant-skill-market-detail="${escapeAttribute(skillId)}">详情</button>
                ${renderSkillMarketActions(entry, { compact: true })}
              </div>
            </article>
          `;
        })
        .join("")}
    </div>
  `;
}

export function renderTenantConsole(root, controller) {
  const focusState = captureRenderFocusState(root);
  const isUsageStats = controller.section === "usage-stats";
  const isOverview = controller.section === "statistics-overview";
  const isWallet = controller.section === "wallet";
  const isWalletOrders = controller.section === "wallet-orders";
  const isWalletLedger = controller.section === "wallet-ledger";
  const isWalletFlow = controller.section === "wallet-flow";
  const isOwnedAgents = controller.section === "owned-agents";
  const isSkillsMarket = controller.section === "skills-market";
  const isSkillsWorkbench = controller.section === "skills-workbench";
  const isSkillsEntitlements = controller.section === "skills-entitlements";
  const isSkillsAssignments = controller.section === "skills-assignments";
  const isSkillsWorkbenchRoute = isSkillsWorkbench || isSkillsEntitlements || isSkillsAssignments;
  const usesScrollableShell =
    isUsageStats ||
    isOverview ||
    isWallet ||
    isWalletOrders ||
    isWalletLedger ||
    isWalletFlow ||
    isSkillsWorkbenchRoute ||
    isSkillsMarket;

  if (controller.section === "agent-assignment") {
    pruneRevokeAssignmentSelection(controller);
    pruneAssignAgentSelection(controller);
  }

  if (!isOverview) {
    disposeTenantOverviewCharts(root);
  }

  const pagination =
    isUsageStats ||
    isOverview ||
    isWallet ||
    isWalletOrders ||
    isWalletLedger ||
    isWalletFlow ||
    isSkillsWorkbenchRoute ||
    isSkillsMarket
      ? null
      : paginate(
          isOwnedAgents ? filterTenantAgents(controller) : filterMembers(controller),
          getPageValue(controller),
        );
  if (pagination) {
    setPageValue(controller, pagination.page);
  }

  const contentMarkup = isUsageStats
    ? renderUsageList(controller, renderPagination)
    : isOverview
      ? renderTenantOverview(controller)
      : isSkillsWorkbench
        ? renderSkillsWorkbench(controller)
        : isSkillsMarket
          ? renderSkillsMarketCards(controller)
          : isSkillsEntitlements || isSkillsAssignments
            ? renderSkillsWorkbench(controller)
            : isWallet
              ? renderTenantWalletPage(controller)
              : isWalletOrders
                ? renderWalletOrdersList(controller, renderPagination)
                : isWalletLedger
                  ? renderWalletLedgerList(controller, renderPagination)
                  : isWalletFlow
                    ? renderWalletFlowList(controller, renderPagination)
                    : isOwnedAgents
                      ? `
                  <div class="data-table-wrapper">
                    ${renderOwnedAgentsCards(pagination.items, controller)}
                    ${renderPagination(pagination)}
                  </div>
                `
                      : `
                  <div class="data-table-wrapper">
                    ${
                      controller.section === "agent-assignment"
                        ? renderAssignmentTable(pagination.items, controller)
                        : renderMembersTable(pagination.items, controller)
                    }
                    ${renderPagination(pagination)}
                  </div>
                `;

  root.dataset.ocTenantEmbedded = "true";
  root.dataset.ocTenantSection = controller.section;
  root.innerHTML = `
    <section class="oc-tenant-list-view ${usesScrollableShell ? "oc-tenant-list-view--scrollable" : ""} ${isSkillsWorkbenchRoute ? "oc-tenant-list-view--skills-workbench" : ""}">
      ${renderToolbar(controller)}
      ${contentMarkup}
    </section>
    ${
      isUsageStats ||
      isOverview ||
      isWallet ||
      isWalletOrders ||
      isWalletLedger ||
      isWalletFlow ||
      isSkillsWorkbench ||
      isSkillsMarket ||
      isSkillsEntitlements ||
      isSkillsAssignments
        ? ""
        : isOwnedAgents
          ? `${renderAgentDetailDialog(controller)}${renderAgentTransferDialog(controller)}`
          : `${renderCreateMemberDialog()}${renderChangePasswordDialog(controller)}${renderDeleteMemberDialog(controller)}${renderMemberOrgScopeDialog(controller)}${renderAssignDialog(controller, isLocalEdition)}${renderRevokeAssignmentDialog(controller)}${renderRevokeAssignmentConfirmDialog(controller)}`
    }
  `;

  if (isOverview) {
    void initTenantOverviewCharts(root, controller);
  }

  if (isSkillsMarket && controller.skillsMarketDetailDialog?.open) {
    root.insertAdjacentHTML("beforeend", renderSkillMarketDetailDialog(controller));
    openDialog(root.querySelector("[data-tenant-skill-market-detail-dialog]"));
  }

  if (
    !isUsageStats &&
    !isOverview &&
    !isWallet &&
    !isWalletOrders &&
    !isWalletLedger &&
    !isWalletFlow &&
    !isSkillsMarket &&
    !isSkillsEntitlements &&
    !isSkillsAssignments
  ) {
    if (isOwnedAgents && controller.agentDetailDialog?.open) {
      openDialog(root.querySelector("[data-tenant-agent-detail-dialog]"));
    }
    if (isOwnedAgents && controller.agentTransferDialog?.open) {
      openDialog(root.querySelector("[data-tenant-agent-transfer-dialog]"));
    }
    if (controller.dialogs.createMemberOpen) {
      openDialog(root.querySelector("[data-tenant-create-dialog]"));
    }
    if (controller.dialogs.changePasswordOpen) {
      openDialog(root.querySelector("[data-tenant-member-password-dialog]"));
    }
    if (controller.dialogs.deleteMemberOpen) {
      openDialog(root.querySelector("[data-tenant-member-delete-dialog]"));
    }
    if (controller.memberOrgScopeDialog?.open) {
      openDialog(root.querySelector("[data-tenant-member-org-scope-dialog]"));
    }
    if (controller.dialogs.assignOpen || controller.assignAgentDialog?.open) {
      openDialog(root.querySelector("[data-tenant-assign-dialog]"));
    }
    if (controller.revokeAssignmentDialog?.open) {
      openDialog(root.querySelector("[data-tenant-revoke-assignment-dialog]"));
    }
    if (controller.revokeAssignmentDialog?.confirmOpen) {
      openDialog(root.querySelector("[data-tenant-revoke-confirm-dialog]"));
    }
  }
  if (controller.section === "agent-assignment") {
    syncRevokeAssignmentSelectionState(root, controller);
    syncAssignAgentSelectionState(root, controller);
  }
  if (controller.section === "members") {
    syncMemberOrgScopeSelectionState(root, controller);
  }
  restoreRenderFocusState(root, focusState);
}

export function clearTenantConsoleSelections(controller) {
  clearAssignAgentSelection(controller);
  clearRevokeAssignmentSelection(controller);
}
