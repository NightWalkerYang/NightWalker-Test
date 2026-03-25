import { createJson5Loader } from "./libraries.js";
import { getFileStyles } from "./styles.js";
import { FILE_LANGUAGE_ALIASES, localizeErrorMessage, parseFilePayload } from "./parser.js";
import { UI_TEXT } from "./ui-text.js";

function createClipboardFallback() {
  const textarea = document.createElement("textarea");
  textarea.setAttribute("aria-hidden", "true");
  textarea.tabIndex = -1;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  textarea.style.pointerEvents = "none";
  textarea.style.inset = "0 auto auto 0";
  document.body.append(textarea);
  return textarea;
}

async function copyText(text) {
  const value = String(text || "");
  if (!value) {
    return false;
  }

  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      // Fall through to the execCommand fallback.
    }
  }

  try {
    const textarea = createClipboardFallback();
    textarea.value = value;
    textarea.focus();
    textarea.select();
    const copied = document.execCommand("copy");
    textarea.remove();
    return copied;
  } catch {
    return false;
  }
}

function triggerUrlDownload(url, fileName) {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.target = "_blank";
  anchor.rel = "noreferrer noopener";
  anchor.download = fileName || "";
  anchor.style.display = "none";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
}

function createMetaItem(label, value) {
  const item = document.createElement("span");
  const labelEl = document.createElement("strong");
  labelEl.textContent = `${label} `;
  item.append(labelEl, document.createTextNode(value));
  return item;
}

function createButton({ label, primary = false, href = "", onClick = null }) {
  const element = href ? document.createElement("a") : document.createElement("button");
  element.className = `oc-file-card__button${primary ? " oc-file-card__button--primary" : ""}`;
  element.textContent = label;

  if (href && element instanceof HTMLAnchorElement) {
    element.href = href;
    element.target = "_blank";
    element.rel = "noreferrer noopener";
    element.download = "";
  } else if (element instanceof HTMLButtonElement) {
    element.type = "button";
  }

  if (typeof onClick === "function") {
    element.addEventListener("click", (event) => {
      onClick(event, element);
    });
  }

  return element;
}

function markCopied(button, uiText, timers) {
  const previous = button.textContent || "";
  button.dataset.copied = "true";
  button.textContent = uiText.actionCopied;

  const timer = window.setTimeout(() => {
    button.removeAttribute("data-copied");
    button.textContent = previous;
  }, 1400);
  timers.push(timer);
}

function buildCard(payload, uiText, state) {
  const surface = document.createElement("article");
  surface.className = "oc-file-card__surface";

  const icon = document.createElement("div");
  icon.className = "oc-file-card__icon";
  icon.setAttribute("aria-hidden", "true");

  const iconLabel = document.createElement("span");
  iconLabel.className = "oc-file-card__icon-label";
  iconLabel.textContent = payload.extension;
  icon.append(iconLabel);

  const content = document.createElement("div");
  content.className = "oc-file-card__content";

  const heading = document.createElement("div");
  heading.className = "oc-file-card__heading";

  const title = document.createElement("div");
  title.className = "oc-file-card__title";
  title.textContent = payload.name;
  title.title = payload.name;

  const kind = document.createElement("span");
  kind.className = "oc-file-card__kind";
  kind.textContent = payload.kind === "url" ? uiText.kindUrl : uiText.kindPath;

  heading.append(title, kind);

  const meta = document.createElement("div");
  meta.className = "oc-file-card__meta";
  meta.append(
    createMetaItem(
      payload.kind === "url" ? uiText.metaUrl : uiText.metaPath,
      payload.sourceLabel,
    ),
  );

  if (payload.sizeLabel) {
    meta.append(createMetaItem("大小", payload.sizeLabel));
  }

  const path = document.createElement("code");
  path.className = "oc-file-card__path";
  path.textContent = payload.kind === "url" ? payload.url : payload.path;
  path.title = payload.kind === "url" ? payload.url : payload.path;

  content.append(heading, meta, path);

  if (payload.description) {
    const description = document.createElement("div");
    description.className = "oc-file-card__description";
    description.textContent = payload.description;
    content.append(description);
  }

  const actions = document.createElement("div");
  actions.className = "oc-file-card__actions";

  if (payload.kind === "url") {
    actions.append(
      createButton({
        label: uiText.actionDownload,
        primary: true,
        href: payload.url,
        onClick: (event) => {
          event.preventDefault();
          triggerUrlDownload(payload.url, payload.name);
        },
      }),
      createButton({
        label: uiText.actionCopyLink,
        onClick: async (_, button) => {
          if (await copyText(payload.url)) {
            markCopied(button, uiText, state.timers);
          }
        },
      }),
    );
  } else {
    actions.append(
      createButton({
        label: uiText.actionCopyPath,
        primary: true,
        onClick: async (_, button) => {
          if (await copyText(payload.path)) {
            markCopied(button, uiText, state.timers);
          }
        },
      }),
    );
  }

  content.append(actions);
  surface.append(icon, content);
  return surface;
}

export function createFileAdapter({ vendorBaseUrl }) {
  const ensureJson5 = createJson5Loader(vendorBaseUrl);

  return {
    id: "file",
    uiText: {
      ...UI_TEXT,
      summarySuccess: UI_TEXT.summarySuccessUrl,
    },
    languageAliases: FILE_LANGUAGE_ALIASES,
    getStyles: getFileStyles,
    ensureReady: ensureJson5,
    localizeErrorMessage,
    disposeState(state) {
      for (const timer of state?.timers || []) {
        clearTimeout(timer);
      }
    },
    async renderContent({ source, wrapper, host, context, renderHostScaffold }) {
      const payload = parseFilePayload(source, context?.json5);
      const summaryText =
        payload.kind === "url" ? UI_TEXT.summarySuccessUrl : UI_TEXT.summarySuccessPath;
      const cardEl = renderHostScaffold(host, wrapper, "success", "", {
        summaryText,
      });

      const state = { timers: [] };
      cardEl.classList.add("oc-file-card");
      cardEl.replaceChildren(buildCard(payload, UI_TEXT, state));
      cardEl.setAttribute(
        "aria-label",
        `${payload.kind === "url" ? UI_TEXT.kindUrl : UI_TEXT.kindPath}: ${payload.name}`,
      );

      return state;
    },
  };
}
