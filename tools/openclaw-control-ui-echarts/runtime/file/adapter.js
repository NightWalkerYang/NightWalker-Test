import { createJson5Loader } from "./libraries.js";
import { getFileStyles } from "./styles.js";
import { FILE_LANGUAGE_ALIASES, localizeErrorMessage, parseFilePayload } from "./parser.js";
import { UI_TEXT } from "./ui-text.js";

function encodeRelativePathForUrl(pathValue) {
  return String(pathValue || "")
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

export function buildWorkspaceDownloadUrl(controlUiRootUrl, pathValue, scope = "workspace") {
  const encodedPath = encodeRelativePathForUrl(pathValue);
  if (!encodedPath) {
    return "";
  }
  const basePath =
    scope === "agent-workspace" ? "workspace-agent-downloads" : "workspace-downloads";
  return new URL(`${basePath}/${encodedPath}`, controlUiRootUrl).href;
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

function buildCard(payload, uiText, options = {}) {
  const disableDownload = options.disableDownload === true;
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

  if (!disableDownload && payload.kind === "url") {
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
    );
  } else if (!disableDownload) {
    const downloadUrl = buildWorkspaceDownloadUrl(
      options.controlUiRootUrl,
      payload.path,
      payload.scope,
    );
    if (downloadUrl) {
      actions.append(
        createButton({
          label: uiText.actionDownload,
          primary: true,
          href: downloadUrl,
          onClick: (event) => {
            event.preventDefault();
            triggerUrlDownload(downloadUrl, payload.name);
          },
        }),
      );
    }
  }

  content.append(actions);
  surface.append(icon, content);
  return surface;
}

function renderFallbackCard(detail, uiText) {
  const payload = {
    kind: "path",
    name: "文件信息待补全",
    extension: "FILE",
    description: localizeErrorMessage(detail),
    sizeLabel: "",
    sourceLabel: "degraded",
    path: "请检查 file 代码块后重试",
    scope: "workspace",
  };
  return buildCard(payload, uiText, { disableDownload: true });
}

export function createFileAdapter({ vendorBaseUrl, controlUiRootUrl }) {
  const ensureJson5 = createJson5Loader(vendorBaseUrl);

  return {
    id: "file",
    uiText: {
      ...UI_TEXT,
      summarySuccess: UI_TEXT.summarySuccessUrl,
    },
    languageAliases: FILE_LANGUAGE_ALIASES,
    getStyles: getFileStyles,
    preload() {
      return ensureJson5();
    },
    ensureReady: ensureJson5,
    localizeErrorMessage,
    async renderContent({ source, wrapper, host, context, renderHostScaffold }) {
      let payload = null;
      let parseErrorDetail = "";
      try {
        payload = parseFilePayload(source, context?.json5);
      } catch (error) {
        parseErrorDetail =
          error && typeof error.message === "string"
            ? error.message
            : String(error || "Unknown error");
      }
      const summaryText = payload
        ? payload.kind === "url"
          ? UI_TEXT.summarySuccessUrl
          : UI_TEXT.summarySuccessPath
        : `${UI_TEXT.summaryError}（已降级）`;
      const cardEl = renderHostScaffold(host, wrapper, "success", "", {
        summaryText,
      });

      cardEl.classList.add("oc-file-card");
      if (payload) {
        cardEl.replaceChildren(buildCard(payload, UI_TEXT, { controlUiRootUrl }));
      } else {
        cardEl.replaceChildren(renderFallbackCard(parseErrorDetail, UI_TEXT));
      }
      cardEl.setAttribute(
        "aria-label",
        payload
          ? `${payload.kind === "url" ? UI_TEXT.kindUrl : UI_TEXT.kindPath}: ${payload.name}`
          : `${UI_TEXT.kindPath}: 文件信息待补全`,
      );

      return null;
    },
  };
}
