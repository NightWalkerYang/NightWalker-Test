import { isEchartsViewPublicPath, normalizeEchartsViewRouteUrl } from "./context.js";

const ECHARTS_VIEW_BOOTSTRAP_MARKER = "data-openclaw-echarts-view-bootstrap";
const MAIN_BUNDLE_PATTERN =
  /^\s*<script type="module" crossorigin src="\.\/assets\/index-[^"]+"><\/script>\s*$/m;
const DEFAULT_RUNTIME_ASSET_BASE_PATH = "./assets/runtime";
const ECHARTS_VIEW_BOOTSTRAP_PATTERN = new RegExp(
  `^\\s*<script[^>]*${ECHARTS_VIEW_BOOTSTRAP_MARKER}[^>]*><\\/script>\\s*$`,
  "gm",
);

function patchPublicRouteHistory() {
  if (window.__OPENCLAW_ECHARTS_VIEW_HISTORY_PATCHED__) {
    return;
  }

  const originalReplaceState = window.history.replaceState.bind(window.history);
  const originalPushState = window.history.pushState.bind(window.history);

  const wrap = (original) => (state, unused, url) => {
    if (url == null) {
      return original(state, unused, url);
    }
    const normalized = normalizeEchartsViewRouteUrl(url, window.location.href);
    return original(state, unused, normalized.toString());
  };

  window.history.replaceState = wrap(originalReplaceState);
  window.history.pushState = wrap(originalPushState);
  window.__OPENCLAW_ECHARTS_VIEW_HISTORY_PATCHED__ = true;
}

function injectBeforeMainBundle(indexHtml, nextTag) {
  const cleaned = indexHtml.replace(ECHARTS_VIEW_BOOTSTRAP_PATTERN, "");
  if (!nextTag) {
    return cleaned;
  }
  if (MAIN_BUNDLE_PATTERN.test(cleaned)) {
    return cleaned.replace(MAIN_BUNDLE_PATTERN, `${nextTag}\n$&`);
  }
  if (!cleaned.includes("</head>")) {
    throw new Error("index.html is missing </head>; cannot inject the ECharts view bootstrap.");
  }
  return cleaned.replace("  </head>", `${nextTag}\n  </head>`);
}

export function applyEchartsViewPublicBootstrap() {
  if (
    typeof window === "undefined" ||
    typeof document === "undefined" ||
    typeof location === "undefined"
  ) {
    return;
  }
  if (!isEchartsViewPublicPath(location.pathname)) {
    return;
  }

  window.__OPENCLAW_CONTROL_UI_BASE_PATH__ = "/";
  window.__OPENCLAW_ECHARTS_VIEW_MODE__ = true;
  document.documentElement.setAttribute("data-oc-echarts-view-route", "true");

  patchPublicRouteHistory();

  const normalizedCurrent = normalizeEchartsViewRouteUrl(
    window.location.href,
    window.location.href,
  );
  if (
    normalizedCurrent.pathname !== window.location.pathname ||
    normalizedCurrent.search !== window.location.search
  ) {
    window.history.replaceState({}, "", normalizedCurrent.toString());
  }
}

function resolveRuntimeScriptSrc(runtimeAssetBasePath, relativePath) {
  const basePath = String(runtimeAssetBasePath ?? "").trim();
  const normalizedBasePath = basePath || DEFAULT_RUNTIME_ASSET_BASE_PATH;
  const baseWithSlash = normalizedBasePath.endsWith("/")
    ? normalizedBasePath
    : `${normalizedBasePath}/`;
  return `${baseWithSlash}${relativePath}`;
}

export function buildEchartsViewPublicBootstrapTag(options = {}) {
  const scriptSrc = resolveRuntimeScriptSrc(
    options.runtimeAssetBasePath,
    "echarts-view/preboot.js",
  );
  return `    <script type="module" src="${scriptSrc}" ${ECHARTS_VIEW_BOOTSTRAP_MARKER}></script>`;
}

export function injectEchartsViewPublicBootstrap(indexHtml, options = {}) {
  return injectBeforeMainBundle(indexHtml, buildEchartsViewPublicBootstrapTag(options));
}
