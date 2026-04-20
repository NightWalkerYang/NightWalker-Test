import { listDashboards, createDashboard, deleteDashboard, shareDashboard } from "./api.js";

const ECHARTS_VIEW_BASE = "/echarts-view";

function formatDate(iso) {
  if (!iso) {
    return "";
  }
  try {
    return new Date(iso).toLocaleDateString("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso.slice(0, 16).replace("T", " ");
  }
}

function typeLabel(type) {
  const labels = {
    custom: "自定义",
    financial_overview: "财务总览",
    accounts_receivable: "应收分析",
    accounts_payable: "应付分析",
    cash_monitor: "资金监控",
    asset_mgmt: "资产管理",
    expense: "费用分析",
    budget: "预算执行",
  };
  return labels[type] || type;
}

export async function renderDashboardList(root, { onNavigate }) {
  root.innerHTML = `<div class="oc-dv-list-loading">加载中…</div>`;

  let dashboards = [];
  try {
    dashboards = await listDashboards();
  } catch {
    root.innerHTML = `<div class="oc-dv-error">加载大屏列表失败，请检查连接</div>`;
    return;
  }

  root.innerHTML = `
    <div class="oc-dv-list-header">
      <h1 class="oc-dv-list-title">可视化大屏</h1>
      <button class="oc-dv-btn oc-dv-btn--primary" id="oc-dv-new">+ 新建大屏</button>
    </div>
    <div class="oc-dv-grid" id="oc-dv-grid">
      ${dashboards.length === 0 ? renderEmpty() : dashboards.map(renderCard).join("")}
    </div>
    <div class="oc-dv-modal" id="oc-dv-create-modal" style="display:none">
      ${renderCreateModal()}
    </div>
  `;

  root.querySelector("#oc-dv-new")?.addEventListener("click", () => {
    root.querySelector("#oc-dv-create-modal").style.display = "flex";
  });

  root.querySelector("#oc-dv-create-modal")?.addEventListener("click", (e) => {
    if (e.target.id === "oc-dv-create-modal") {
      root.querySelector("#oc-dv-create-modal").style.display = "none";
    }
  });

  root.querySelector("#oc-dv-create-cancel")?.addEventListener("click", () => {
    root.querySelector("#oc-dv-create-modal").style.display = "none";
  });

  root.querySelector("#oc-dv-create-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.target;
    const title = form.querySelector("[name=title]")?.value?.trim();
    const dashboardType = form.querySelector("[name=type]")?.value;
    const theme = form.querySelector("[name=theme]")?.value || "dark";
    if (!title) {
      return;
    }
    try {
      const dashboard = await createDashboard({ title, dashboardType, theme });
      window.dispatchEvent(new CustomEvent("oc-dashboards-changed"));
      onNavigate(`${ECHARTS_VIEW_BASE}/dashboard/${dashboard.id}/edit`);
    } catch (error) {
      alert(`创建失败: ${error.message}`);
    }
  });

  root.querySelector("#oc-dv-grid")?.addEventListener("click", async (e) => {
    const card = e.target.closest("[data-dashboard-id]");
    if (!card) {
      return;
    }
    const id = card.dataset.dashboardId;

    if (e.target.closest(".oc-dv-card__action--edit")) {
      onNavigate(`${ECHARTS_VIEW_BASE}/dashboard/${id}/edit`);
      return;
    }
    if (e.target.closest(".oc-dv-card__action--display")) {
      onNavigate(`${ECHARTS_VIEW_BASE}/dashboard/${id}/display`);
      return;
    }
    if (e.target.closest(".oc-dv-card__action--delete")) {
      if (!confirm("确定删除此大屏？")) {
        return;
      }
      try {
        await deleteDashboard(id);
        window.dispatchEvent(new CustomEvent("oc-dashboards-changed"));
        card.remove();
        if (!root.querySelector("[data-dashboard-id]")) {
          root.querySelector("#oc-dv-grid").innerHTML = renderEmpty();
        }
      } catch (error) {
        alert(`删除失败: ${error.message}`);
      }
      return;
    }
    if (e.target.closest(".oc-dv-card__action--share")) {
      const isPublic = card.dataset.isPublic === "true";
      try {
        const result = await shareDashboard(id, !isPublic);
        card.dataset.isPublic = String(!isPublic);
        const shareBtn = card.querySelector(".oc-dv-card__action--share");
        if (shareBtn) {
          shareBtn.textContent = !isPublic ? "取消分享" : "分享";
        }
        if (!isPublic && result.publicToken) {
          const shareUrl = `${window.location.origin}${ECHARTS_VIEW_BASE}/public/${result.publicToken}`;
          prompt("公开分享链接（复制后可直接访问）:", shareUrl);
        }
      } catch (error) {
        alert(`操作失败: ${error.message}`);
      }
    }
  });
}

function renderEmpty() {
  return `
    <div class="oc-dv-empty">
      <div class="oc-dv-empty__icon">📊</div>
      <p class="oc-dv-empty__text">还没有大屏，点击右上角新建</p>
    </div>
  `;
}

function renderCard(d) {
  return `
    <article class="oc-dv-card" data-dashboard-id="${d.id}" data-is-public="${d.isPublic}">
      <div class="oc-dv-card__header">
        <span class="oc-dv-card__type">${typeLabel(d.dashboardType)}</span>
        ${d.isPublic ? '<span class="oc-dv-card__public-badge">公开</span>' : ""}
      </div>
      <h2 class="oc-dv-card__title">${escapeHtml(d.title)}</h2>
      ${d.description ? `<p class="oc-dv-card__desc">${escapeHtml(d.description)}</p>` : ""}
      <div class="oc-dv-card__meta">更新于 ${formatDate(d.updatedAt)}</div>
      <div class="oc-dv-card__actions">
        <button class="oc-dv-card__action oc-dv-card__action--display">全屏</button>
        <button class="oc-dv-card__action oc-dv-card__action--edit">编辑</button>
        <button class="oc-dv-card__action oc-dv-card__action--share">${d.isPublic ? "取消分享" : "分享"}</button>
        <button class="oc-dv-card__action oc-dv-card__action--delete oc-dv-card__action--danger">删除</button>
      </div>
    </article>
  `;
}

function renderCreateModal() {
  return `
    <div class="oc-dv-modal__box">
      <h2 class="oc-dv-modal__title">新建大屏</h2>
      <form class="oc-dv-modal__form" id="oc-dv-create-form">
        <label class="oc-dv-form-label">
          大屏名称
          <input class="oc-dv-form-input" name="title" placeholder="输入大屏名称" required autofocus />
        </label>
        <label class="oc-dv-form-label">
          类型
          <select class="oc-dv-form-select" name="type">
            <option value="custom">自定义</option>
            <option value="financial_overview">财务总览</option>
            <option value="accounts_receivable">应收分析</option>
            <option value="accounts_payable">应付分析</option>
            <option value="cash_monitor">资金监控</option>
            <option value="expense">费用分析</option>
            <option value="budget">预算执行</option>
          </select>
        </label>
        <label class="oc-dv-form-label">
          主题
          <select class="oc-dv-form-select" name="theme">
            <option value="dark">深色</option>
            <option value="light">浅色</option>
          </select>
        </label>
        <div class="oc-dv-modal__footer">
          <button type="button" class="oc-dv-btn" id="oc-dv-create-cancel">取消</button>
          <button type="submit" class="oc-dv-btn oc-dv-btn--primary">创建并进入编辑</button>
        </div>
      </form>
    </div>
  `;
}

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
