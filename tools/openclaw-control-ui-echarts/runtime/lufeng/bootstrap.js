import {
  LUFENG_ROUTE,
  LUFENG_SESSION_KEY,
  buildSettingsStorageKey,
  buildTokenStorageKey,
  isLufengPublicPath,
  normalizeGatewayScope,
  normalizeLufengRouteUrl,
  resolveGatewayOrigin,
} from "./context.js";

const MAIN_BUNDLE_PATTERN =
  /^\s*<script type="module" crossorigin src="\.\/assets\/index-[^"]+"><\/script>\s*$/m;
const LUFENG_BOOTSTRAP_PATTERN =
  /^\s*<script[^>]*data-openclaw-lufeng-bootstrap[^>]*><\/script>\s*$/gm;
const DEFAULT_RUNTIME_ASSET_BASE_PATH = "./assets/runtime";

export function applyLufengPublicBootstrap(rawToken) {
  if (
    typeof window === "undefined" ||
    typeof document === "undefined" ||
    typeof location === "undefined" ||
    !isLufengPublicPath(location.pathname)
  ) {
    return;
  }

  const gatewayOrigin = resolveGatewayOrigin(location);
  const lufengScopeUrl = `${gatewayOrigin}${LUFENG_ROUTE}`;
  const rootGatewayScope = normalizeGatewayScope(gatewayOrigin);

  window.__OPENCLAW_CONTROL_UI_BASE_PATH__ = LUFENG_ROUTE;
  window.__OPENCLAW_LUFENG_MODE__ = true;
  document.documentElement.setAttribute("data-oc-lufeng-route", "true");

  try {
    const storage = window.localStorage;
    if (storage) {
      const key = buildSettingsStorageKey(lufengScopeUrl);
      const existingRaw = storage.getItem(key);
      const existing = existingRaw && existingRaw.trim() ? JSON.parse(existingRaw) : {};
      const next = {
        ...existing,
        gatewayUrl: gatewayOrigin,
        sessionKey: LUFENG_SESSION_KEY,
        lastActiveSessionKey: LUFENG_SESSION_KEY,
        sessionsByGateway: {
          ...(existing.sessionsByGateway && typeof existing.sessionsByGateway === "object"
            ? existing.sessionsByGateway
            : {}),
          [rootGatewayScope]: {
            sessionKey: LUFENG_SESSION_KEY,
            lastActiveSessionKey: LUFENG_SESSION_KEY,
          },
        },
      };
      storage.setItem(key, JSON.stringify(next));
    }
  } catch {
    // Best-effort only.
  }

  try {
    const token = String(rawToken ?? "").trim();
    if (token && window.sessionStorage) {
      window.sessionStorage.setItem(buildTokenStorageKey(gatewayOrigin), token);
    }
  } catch {
    // Best-effort only.
  }

  if (!window.__OPENCLAW_LUFENG_HISTORY_PATCHED__) {
    const originalReplaceState = window.history.replaceState.bind(window.history);
    const originalPushState = window.history.pushState.bind(window.history);

    const wrap = (original) => (state, unused, url) => {
      if (url == null) {
        return original(state, unused, url);
      }
      const normalized = normalizeLufengRouteUrl(url, window.location.href);
      return original(state, unused, normalized.toString());
    };

    window.history.replaceState = wrap(originalReplaceState);
    window.history.pushState = wrap(originalPushState);
    window.__OPENCLAW_LUFENG_HISTORY_PATCHED__ = true;
  }

  const normalizedCurrent = normalizeLufengRouteUrl(window.location.href, window.location.href);
  if (
    normalizedCurrent.pathname !== window.location.pathname ||
    normalizedCurrent.search !== window.location.search
  ) {
    window.history.replaceState({}, "", normalizedCurrent.toString());
  }
}

function escapeHtmlAttribute(value) {
  return String(value ?? "").replace(/[&"<>\u2028\u2029]/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case '"':
        return "&quot;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case "\u2028":
        return "&#8232;";
      case "\u2029":
        return "&#8233;";
      default:
        return char;
    }
  });
}

function injectBeforeMainBundle(indexHtml, nextTag) {
  const cleaned = indexHtml.replace(LUFENG_BOOTSTRAP_PATTERN, "");
  if (!nextTag) {
    return cleaned;
  }
  if (MAIN_BUNDLE_PATTERN.test(cleaned)) {
    return cleaned.replace(MAIN_BUNDLE_PATTERN, `${nextTag}\n$&`);
  }
  if (!cleaned.includes("</head>")) {
    throw new Error("index.html is missing </head>; cannot inject the Lufeng bootstrap.");
  }
  return cleaned.replace("  </head>", `${nextTag}\n  </head>`);
}

function resolveRuntimeScriptSrc(runtimeAssetBasePath, relativePath) {
  const basePath = String(runtimeAssetBasePath ?? "").trim();
  const normalizedBasePath = basePath || DEFAULT_RUNTIME_ASSET_BASE_PATH;
  const baseWithSlash = normalizedBasePath.endsWith("/")
    ? normalizedBasePath
    : `${normalizedBasePath}/`;
  return `${baseWithSlash}${relativePath}`;
}

export function buildLufengPublicBootstrapTag(rawToken, options = {}) {
  const scriptSrc = resolveRuntimeScriptSrc(options.runtimeAssetBasePath, "lufeng/preboot.js");
  return `    <script src="${scriptSrc}" data-openclaw-lufeng-bootstrap data-gateway-token="${escapeHtmlAttribute(rawToken)}"></script>`;
}

export function injectLufengPublicBootstrap(indexHtml, rawToken, options = {}) {
  return injectBeforeMainBundle(indexHtml, buildLufengPublicBootstrapTag(rawToken, options));
}
