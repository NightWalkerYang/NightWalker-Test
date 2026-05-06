const TOAST_ROOT_ATTR = "data-oc-tenant-feedback-toast-root";
const TOAST_SELECTOR = "[data-oc-tenant-feedback-toast]";
const TOAST_STYLE_ATTR = "data-oc-tenant-feedback-toast-style";
let toastTimer = 0;

const TOAST_STYLE_TEXT = `
  :where(.oc-tenant-feedback-toast-root) {
    position: fixed;
    right: 24px;
    bottom: 24px;
    z-index: 1200;
    pointer-events: none;
    width: min(420px, calc(100vw - 32px));
    display: grid;
    justify-items: end;
  }

  :where(.oc-tenant-feedback-toast) {
    width: 100%;
    margin: 0;
    min-width: 220px;
    max-width: 100%;
    overflow-wrap: anywhere;
    box-shadow: 0 16px 40px rgb(15 23 42 / 12%);
  }

  @media (max-width: 900px) {
    :where(.oc-tenant-feedback-toast-root) {
      right: 16px;
      bottom: 16px;
      left: 16px;
      width: auto;
      justify-items: stretch;
    }
  }
`;

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function ensureToastStyle(doc) {
  let style = doc.head?.querySelector(`[${TOAST_STYLE_ATTR}]`);
  if (style instanceof HTMLStyleElement) {
    return style;
  }
  style = doc.createElement("style");
  style.setAttribute(TOAST_STYLE_ATTR, "true");
  style.textContent = TOAST_STYLE_TEXT;
  doc.head?.append(style);
  return style;
}

function ensureToastRoot(doc) {
  let root = doc.body?.querySelector(`[${TOAST_ROOT_ATTR}]`);
  if (root instanceof HTMLElement) {
    return root;
  }
  root = doc.createElement("div");
  root.className = "oc-tenant-feedback-toast-root";
  root.setAttribute(TOAST_ROOT_ATTR, "true");
  doc.body?.append(root);
  return root;
}

export function showTransientFeedbackToast(root, message, isError = false) {
  const text = String(message ?? "").trim();
  if (!text) {
    return;
  }
  const doc = root?.ownerDocument ?? document;
  if (!(doc.body instanceof HTMLElement)) {
    return;
  }
  ensureToastStyle(doc);
  const toastRoot = ensureToastRoot(doc);
  const kind = isError ? "danger" : "info";
  const ariaRole = isError ? "alert" : "status";
  const ariaLive = isError ? "assertive" : "polite";
  toastRoot.innerHTML = `
    <div
      class="callout ${kind} oc-tenant-feedback-toast"
      data-oc-tenant-feedback-toast
      role="${ariaRole}"
      aria-live="${ariaLive}"
    >${escapeHtml(text)}</div>
  `;
  if (toastTimer) {
    window.clearTimeout(toastTimer);
  }
  toastTimer = window.setTimeout(() => {
    const toast = doc.body?.querySelector(TOAST_SELECTOR);
    toast?.remove();
    if (toastRoot.childElementCount === 0) {
      toastRoot.remove();
    }
    toastTimer = 0;
  }, 1200);
}
