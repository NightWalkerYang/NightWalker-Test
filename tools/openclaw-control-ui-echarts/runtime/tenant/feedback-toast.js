const TOAST_ROOT_ATTR = "data-oc-tenant-feedback-toast-root";
const TOAST_SELECTOR = "[data-oc-tenant-feedback-toast]";
let toastTimer = 0;

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
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

