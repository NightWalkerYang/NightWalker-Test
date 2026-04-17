import {
  isEchartsViewPublicPath,
  normalizeEchartsViewRouteUrl,
} from "./context.js";

const ECHARTS_VIEW_BOOTSTRAP_MARKER = "data-openclaw-echarts-view-bootstrap";

function patchPublicRouteHistory() {
  if (window.__OPENCLAW_ECHARTS_VIEW_HISTORY_PATCHED__) {
    return;
  }

  const originalReplaceState = window.history.replaceState.bind(window.history);
  const originalPushState = window.history.pushState.bind(window.history);

  const wrap =
    (original) =>
    (state, unused, url) => {
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

  const normalizedCurrent = normalizeEchartsViewRouteUrl(window.location.href, window.location.href);
  if (
    normalizedCurrent.pathname !== window.location.pathname ||
    normalizedCurrent.search !== window.location.search
  ) {
    window.history.replaceState({}, "", normalizedCurrent.toString());
  }
}

export function buildEchartsViewPublicBootstrapTag() {
  return `    <script type="module" src="./assets/runtime/echarts-view/preboot.js" ${ECHARTS_VIEW_BOOTSTRAP_MARKER}></script>`;
}

export function injectEchartsViewPublicBootstrap(indexHtml) {
  if (indexHtml.includes(ECHARTS_VIEW_BOOTSTRAP_MARKER)) {
    return indexHtml;
  }
  if (!indexHtml.includes("</head>")) {
    throw new Error("index.html is missing </head>; cannot inject the ECharts view bootstrap.");
  }
  return indexHtml.replace("  </head>", `${buildEchartsViewPublicBootstrapTag()}\n  </head>`);
}
