import {
  isSandboxViewPublicPath,
  normalizeSandboxViewRouteUrl,
} from "./context.js";

const SANDBOX_VIEW_BOOTSTRAP_MARKER = "data-openclaw-sandbox-view-bootstrap";
const MAIN_BUNDLE_PATTERN =
  /^\s*<script type="module" crossorigin src="\.\/assets\/index-[^"]+"><\/script>\s*$/m;
const SANDBOX_VIEW_BOOTSTRAP_PATTERN = new RegExp(
  `^\\s*<script[^>]*${SANDBOX_VIEW_BOOTSTRAP_MARKER}[^>]*><\\/script>\\s*$`,
  "gm",
);

function patchPublicRouteHistory() {
  if (window.__OPENCLAW_SANDBOX_VIEW_HISTORY_PATCHED__) {
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
      const normalized = normalizeSandboxViewRouteUrl(url, window.location.href);
      return original(state, unused, normalized.toString());
    };

  window.history.replaceState = wrap(originalReplaceState);
  window.history.pushState = wrap(originalPushState);
  window.__OPENCLAW_SANDBOX_VIEW_HISTORY_PATCHED__ = true;
}

function injectBeforeMainBundle(indexHtml, nextTag) {
  const cleaned = indexHtml.replace(SANDBOX_VIEW_BOOTSTRAP_PATTERN, "");
  if (!nextTag) {
    return cleaned;
  }
  if (MAIN_BUNDLE_PATTERN.test(cleaned)) {
    return cleaned.replace(MAIN_BUNDLE_PATTERN, `${nextTag}\n$&`);
  }
  if (!cleaned.includes("</head>")) {
    throw new Error("index.html is missing </head>; cannot inject the sandbox view bootstrap.");
  }
  return cleaned.replace("  </head>", `${nextTag}\n  </head>`);
}

export function applySandboxViewPublicBootstrap() {
  if (
    typeof window === "undefined" ||
    typeof document === "undefined" ||
    typeof location === "undefined"
  ) {
    return;
  }
  if (!isSandboxViewPublicPath(location.pathname)) {
    return;
  }

  window.__OPENCLAW_CONTROL_UI_BASE_PATH__ = "/";
  window.__OPENCLAW_SANDBOX_VIEW_MODE__ = true;
  document.documentElement.setAttribute("data-oc-sandbox-view-route", "true");

  patchPublicRouteHistory();

  const normalizedCurrent = normalizeSandboxViewRouteUrl(window.location.href, window.location.href);
  if (
    normalizedCurrent.pathname !== window.location.pathname ||
    normalizedCurrent.search !== window.location.search
  ) {
    window.history.replaceState({}, "", normalizedCurrent.toString());
  }
}

export function buildSandboxViewPublicBootstrapTag() {
  return `    <script type="module" src="/assets/runtime/sandbox-view/preboot.js" ${SANDBOX_VIEW_BOOTSTRAP_MARKER}></script>`;
}

export function injectSandboxViewPublicBootstrap(indexHtml) {
  return injectBeforeMainBundle(indexHtml, buildSandboxViewPublicBootstrapTag());
}
