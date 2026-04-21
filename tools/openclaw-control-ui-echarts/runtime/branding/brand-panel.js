import { createTenantApiClient } from "../tenant/api-client.js";
import { getCurrentBrandState, loadBrandState, setCurrentBrandState } from "./brand-state.js";

const PANEL_STYLE_ATTR = "data-oc-brand-panel-style";
const PANEL_ROOT_ATTR = "data-oc-brand-panel-root";
const PANEL_DIALOG_ATTR = "data-oc-brand-panel";
const PANEL_FORM_SELECTOR = "[data-oc-brand-form]";
const PANEL_OPEN_SELECTOR = ".oc-brand-settings-link";
const PANEL_CLOSE_SELECTOR = "[data-oc-brand-close]";
const PANEL_RESTORE_SELECTOR = "[data-oc-brand-restore]";
const PANEL_LOGO_MODE_SELECTOR = "[data-oc-brand-logo-mode]";
const PANEL_LOGO_TEXT_SELECTOR = "[data-oc-brand-logo-text]";
const PANEL_LOGO_FILE_SELECTOR = "[data-oc-brand-logo-file]";
const PANEL_BRAND_NAME_SELECTOR = "[data-oc-brand-name]";
const PANEL_PAGE_TITLE_SELECTOR = "[data-oc-brand-page-title]";

function ensureStyle() {
  let link = document.head.querySelector(`[${PANEL_STYLE_ATTR}]`);
  if (link instanceof HTMLLinkElement) {
    return link;
  }
  link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = new URL("./brand-panel.css", import.meta.url).href;
  link.setAttribute(PANEL_STYLE_ATTR, "true");
  document.head.append(link);
  return link;
}

function openDialog(dialog) {
  if (!(dialog instanceof HTMLDialogElement)) {
    return;
  }
  if (typeof dialog.showModal === "function") {
    try {
      if (!dialog.open) {
        dialog.showModal();
      }
      return;
    } catch {
      // Fall back to the open attribute when jsdom lacks full dialog support.
    }
  }
  dialog.setAttribute("open", "");
}

function closeDialog(dialog) {
  if (!(dialog instanceof HTMLDialogElement)) {
    return;
  }
  if (typeof dialog.close === "function") {
    try {
      if (dialog.open) {
        dialog.close();
        return;
      }
    } catch {
      // Ignore and fall back to open-attribute removal.
    }
  }
  dialog.removeAttribute("open");
}

function readMode(dialog) {
  const input = dialog.querySelector(PANEL_LOGO_MODE_SELECTOR);
  return input instanceof HTMLSelectElement ? input.value : "text";
}

function syncModeControls(dialog) {
  if (!(dialog instanceof HTMLElement)) {
    return;
  }
  const mode = readMode(dialog);
  const textInput = dialog.querySelector(PANEL_LOGO_TEXT_SELECTOR);
  const fileInput = dialog.querySelector(PANEL_LOGO_FILE_SELECTOR);
  if (textInput instanceof HTMLInputElement) {
    textInput.disabled = mode !== "text";
  }
  if (fileInput instanceof HTMLInputElement) {
    fileInput.disabled = mode !== "image";
  }
}

function fillForm(dialog, state) {
  const brandName = dialog.querySelector(PANEL_BRAND_NAME_SELECTOR);
  const pageTitle = dialog.querySelector(PANEL_PAGE_TITLE_SELECTOR);
  const logoMode = dialog.querySelector(PANEL_LOGO_MODE_SELECTOR);
  const logoText = dialog.querySelector(PANEL_LOGO_TEXT_SELECTOR);
  const logoFile = dialog.querySelector(PANEL_LOGO_FILE_SELECTOR);

  if (brandName instanceof HTMLInputElement) {
    brandName.value = String(state?.brandName || "");
  }
  if (pageTitle instanceof HTMLInputElement) {
    pageTitle.value = String(state?.pageTitle || "");
  }
  if (logoMode instanceof HTMLSelectElement) {
    logoMode.value = String(state?.logoMode || "text");
  }
  if (logoText instanceof HTMLInputElement) {
    logoText.value = String(state?.logoText || "");
  }
  if (logoFile instanceof HTMLInputElement) {
    logoFile.value = "";
  }
  syncModeControls(dialog);
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("branding_logo_read_failed"));
    reader.onload = () => resolve(String(reader.result || ""));
    reader.readAsDataURL(file);
  });
}

async function buildPayload(dialog, currentState) {
  const brandNameInput = dialog.querySelector(PANEL_BRAND_NAME_SELECTOR);
  const pageTitleInput = dialog.querySelector(PANEL_PAGE_TITLE_SELECTOR);
  const logoModeInput = dialog.querySelector(PANEL_LOGO_MODE_SELECTOR);
  const logoTextInput = dialog.querySelector(PANEL_LOGO_TEXT_SELECTOR);
  const logoFileInput = dialog.querySelector(PANEL_LOGO_FILE_SELECTOR);
  const payload = {
    brandName: brandNameInput instanceof HTMLInputElement ? brandNameInput.value.trim() : "",
    pageTitle: pageTitleInput instanceof HTMLInputElement ? pageTitleInput.value.trim() : "",
    logoMode: logoModeInput instanceof HTMLSelectElement ? logoModeInput.value : "text",
  };

  if (payload.logoMode === "image") {
    const file =
      logoFileInput instanceof HTMLInputElement && logoFileInput.files?.length
        ? logoFileInput.files[0]
        : null;
    if (file) {
      return {
        ...payload,
        logoImageDataUrl: await readFileAsDataUrl(file),
      };
    }

    if (currentState?.logoMode === "image" && currentState.logoImage?.src) {
      return {
        ...payload,
        keepExistingLogoImage: true,
      };
    }

    throw new Error("branding_logo_file_required");
  }

  return {
    ...payload,
    logoText: logoTextInput instanceof HTMLInputElement ? logoTextInput.value.trim() : "",
  };
}

function ensureRoot() {
  let root = document.body.querySelector(`[${PANEL_ROOT_ATTR}]`);
  if (root instanceof HTMLElement) {
    return root;
  }
  root = document.createElement("div");
  root.setAttribute(PANEL_ROOT_ATTR, "true");
  root.innerHTML = `
    <dialog class="oc-brand-panel" ${PANEL_DIALOG_ATTR}>
      <form class="oc-brand-panel__panel" data-oc-brand-form method="dialog">
        <header class="oc-brand-panel__header">
          <strong>更改品牌</strong>
          <button class="btn" type="button" data-oc-brand-close>关闭</button>
        </header>
        <div class="oc-brand-panel__body">
          <label class="oc-brand-panel__row">
            <span>品牌名称</span>
            <input class="field" type="text" data-oc-brand-name />
          </label>
          <label class="oc-brand-panel__row">
            <span>页面标题</span>
            <input class="field" type="text" data-oc-brand-page-title />
          </label>
          <label class="oc-brand-panel__row">
            <span>Logo 类型</span>
            <select class="field" data-oc-brand-logo-mode>
              <option value="text">文字 Logo</option>
              <option value="image">图片 Logo</option>
            </select>
          </label>
          <label class="oc-brand-panel__row">
            <span>Logo 文字</span>
            <input class="field" type="text" data-oc-brand-logo-text />
          </label>
          <label class="oc-brand-panel__row">
            <span>Logo 图片</span>
            <input class="field" type="file" accept="image/png,image/jpeg,image/webp" data-oc-brand-logo-file />
          </label>
        </div>
        <footer class="oc-brand-panel__footer">
          <button class="btn" type="button" data-oc-brand-restore>恢复默认</button>
          <div class="oc-brand-panel__actions">
            <button class="btn" type="button" data-oc-brand-close>取消</button>
            <button class="btn primary" type="submit">保存</button>
          </div>
        </footer>
      </form>
    </dialog>
  `;
  document.body.append(root);
  return root;
}

export function bootBrandPanel(options = {}) {
  if (window.__openclawBrandPanelBooted) {
    return;
  }
  window.__openclawBrandPanelBooted = true;
  ensureStyle();
  const root = ensureRoot();
  const dialog = root.querySelector(`[${PANEL_DIALOG_ATTR}]`);
  const apiClient = options.apiClient || createTenantApiClient();
  let dialogState = getCurrentBrandState();

  document.addEventListener("click", async (event) => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    const closeTrigger = target.closest(PANEL_CLOSE_SELECTOR);
    if (closeTrigger) {
      event.preventDefault();
      closeDialog(dialog);
      return;
    }

    const restoreTrigger = target.closest(PANEL_RESTORE_SELECTOR);
    if (restoreTrigger) {
      event.preventDefault();
      const state = await apiClient.restorePlatformBranding();
      setCurrentBrandState(state);
      dialogState = state;
      fillForm(dialog, state);
      closeDialog(dialog);
      return;
    }

    const openTrigger = target.closest(PANEL_OPEN_SELECTOR);
    if (!openTrigger) {
      return;
    }
    event.preventDefault();
    const state = apiClient.getPublicBranding
      ? await apiClient.getPublicBranding()
      : await loadBrandState();
    dialogState = state || getCurrentBrandState();
    fillForm(dialog, state || getCurrentBrandState());
    openDialog(dialog);
  });

  dialog?.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }
    if (target.matches(PANEL_LOGO_MODE_SELECTOR)) {
      syncModeControls(dialog);
    }
  });

  dialog?.querySelector(PANEL_FORM_SELECTOR)?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const payload = await buildPayload(dialog, dialogState);
    const state = await apiClient.savePlatformBranding(payload);
    setCurrentBrandState(state);
    dialogState = state;
    fillForm(dialog, state);
    closeDialog(dialog);
  });
}
