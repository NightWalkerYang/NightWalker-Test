function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderHighlights(items) {
  return items
    .map(
      (item) => `
        <li class="tenant-auth-gate__feature-item">
          <span class="tenant-auth-gate__feature-dot" aria-hidden="true"></span>
          <span>${escapeHtml(item)}</span>
        </li>
      `,
    )
    .join("");
}

function renderSetupPanel(setup) {
  if (!setup) {
    return "";
  }
  return `
    <section class="tenant-auth-gate__panel" data-tenant-setup-card hidden>
      <p class="tenant-eyebrow">${escapeHtml(setup.eyebrow)}</p>
      <h2 class="tenant-auth-gate__panel-title">${escapeHtml(setup.title)}</h2>
      <p class="tenant-auth-gate__panel-subtitle">${escapeHtml(setup.subtitle)}</p>
      <form class="tenant-form" data-tenant-setup-form>
        <label class="tenant-field">
          <span>${escapeHtml(setup.usernameLabel)}</span>
          <input name="username" type="text" required />
        </label>
        <label class="tenant-field">
          <span>${escapeHtml(setup.passwordLabel)}</span>
          <input name="password" type="password" required />
        </label>
        <div class="tenant-actions">
          <button class="tenant-btn tenant-btn--primary" type="submit">${escapeHtml(setup.submitLabel)}</button>
        </div>
      </form>
    </section>
  `;
}

export function renderTenantAuthLayout(root, options) {
  const {
    mode,
    eyebrow,
    title,
    subtitle,
    switchHref,
    switchLabel,
    switchAttr,
    highlights,
    loginEyebrow,
    loginTitle,
    loginSubtitle,
    loginSubmitLabel,
    setup,
  } = options;

  root.innerHTML = `
    <section class="tenant-auth-gate tenant-auth-gate--${escapeHtml(mode)}">
      <header class="tenant-auth-gate__header">
        <div class="tenant-auth-gate__brand">
          <span class="tenant-auth-gate__mark">SPTC</span>
          <div class="tenant-auth-gate__brand-copy">
            <p class="tenant-auth-gate__eyebrow">${escapeHtml(eyebrow)}</p>
            <h1 class="tenant-auth-gate__title">${escapeHtml(title)}</h1>
            <p class="tenant-auth-gate__subtitle">${escapeHtml(subtitle)}</p>
          </div>
        </div>
        <a class="tenant-auth-gate__switch" href="${escapeHtml(switchHref)}" ${switchAttr}>${escapeHtml(switchLabel)}</a>
      </header>

      <section class="tenant-auth-gate__advanced">
        <details class="tenant-auth-gate__details">
          <summary>高级设置</summary>
          <form class="tenant-form tenant-form--inline" data-tenant-api-base-form>
            <label class="tenant-field tenant-field--full">
              <span>租户平台 API 基地址</span>
              <input name="apiBase" type="text" placeholder="/tenant-platform-api/v1" />
            </label>
            <button class="tenant-btn tenant-btn--ghost" type="submit">保存 API 地址</button>
          </form>
        </details>
      </section>

      ${renderSetupPanel(setup)}

      <section class="tenant-auth-gate__panel" data-tenant-login-card ${setup ? "hidden" : ""}>
        <p class="tenant-eyebrow">${escapeHtml(loginEyebrow)}</p>
        <h2 class="tenant-auth-gate__panel-title">${escapeHtml(loginTitle)}</h2>
        <p class="tenant-auth-gate__panel-subtitle">${escapeHtml(loginSubtitle)}</p>
        <form class="tenant-form" data-tenant-login-form>
          <label class="tenant-field">
            <span>账号</span>
            <input name="username" type="text" required />
          </label>
          <label class="tenant-field">
            <span>密码</span>
            <input name="password" type="password" required />
          </label>
          <div class="tenant-actions">
            <button class="tenant-btn tenant-btn--primary" type="submit">${escapeHtml(loginSubmitLabel)}</button>
          </div>
        </form>
      </section>

      <section class="tenant-auth-gate__features">
        <div class="tenant-auth-gate__features-title">当前入口说明</div>
        <ul class="tenant-auth-gate__feature-list">
          ${renderHighlights(highlights)}
        </ul>
      </section>

      <p class="tenant-feedback" data-tenant-feedback>正在检查租户平台状态...</p>
    </section>
  `;
}
