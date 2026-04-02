function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderAuthForm({ submitAttr, title, subtitle, submitLabel, usernameLabel, passwordLabel }) {
  return `
    <form class="login-gate__form" ${submitAttr} hidden>
      <div class="oc-tenant-login-section">
        <div class="oc-tenant-login-section__title">${escapeHtml(title)}</div>
        <div class="oc-tenant-login-section__sub">${escapeHtml(subtitle)}</div>
      </div>
      <label class="field">
        <span>${escapeHtml(usernameLabel)}</span>
        <input name="username" type="text" required />
      </label>
      <label class="field">
        <span>${escapeHtml(passwordLabel)}</span>
        <input name="password" type="password" required />
      </label>
      <button class="btn primary login-gate__connect" type="submit">${escapeHtml(submitLabel)}</button>
    </form>
  `;
}

export function renderTenantAuthLayout(root, options) {
  const {
    title,
    subtitle,
    switchHref,
    switchLabel,
    switchAttr,
    loginTitle,
    loginSubtitle,
    loginSubmitLabel,
    loginUsernameLabel = "账号",
    loginPasswordLabel = "密码",
    setup,
  } = options;

  root.innerHTML = `
    <section class="login-gate oc-tenant-login-gate">
      <div class="login-gate__card oc-tenant-login-card">
        <div class="login-gate__header">
          <div class="login-gate__logo oc-tenant-login-mark" aria-hidden="true">SPTC</div>
          <div class="login-gate__title">${escapeHtml(title)}</div>
          <div class="login-gate__sub">${escapeHtml(subtitle)}</div>
        </div>
        ${
          setup
            ? renderAuthForm({
                submitAttr: 'data-tenant-setup-form',
                title: setup.title,
                subtitle: setup.subtitle,
                submitLabel: setup.submitLabel,
                usernameLabel: setup.usernameLabel,
                passwordLabel: setup.passwordLabel,
              })
            : ""
        }
        ${renderAuthForm({
          submitAttr: 'data-tenant-login-form',
          title: loginTitle,
          subtitle: loginSubtitle,
          submitLabel: loginSubmitLabel,
          usernameLabel: loginUsernameLabel,
          passwordLabel: loginPasswordLabel,
        })}
        <div class="callout info oc-tenant-login-feedback" data-tenant-feedback hidden></div>
        <div class="oc-tenant-login-footer">
          <a class="session-link" href="${escapeHtml(switchHref)}" ${switchAttr}>${escapeHtml(switchLabel)}</a>
        </div>
      </div>
    </section>
  `;
}
