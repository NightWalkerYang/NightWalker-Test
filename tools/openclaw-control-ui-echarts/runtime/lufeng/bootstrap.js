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
      const existing =
        existingRaw && existingRaw.trim()
          ? JSON.parse(existingRaw)
          : {};
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

    const wrap =
      (original) =>
      (state, unused, url) => {
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

function serializeInlineScriptValue(value) {
  return JSON.stringify(String(value ?? "")).replace(/[<>&\u2028\u2029]/g, (char) => {
    switch (char) {
      case "<":
        return "\\u003c";
      case ">":
        return "\\u003e";
      case "&":
        return "\\u0026";
      case "\u2028":
        return "\\u2028";
      case "\u2029":
        return "\\u2029";
      default:
        return char;
    }
  });
}

export function buildLufengPublicBootstrapTag(rawToken) {
  return [
    '    <script data-openclaw-lufeng-bootstrap>',
    `      (${applyLufengPublicBootstrap.toString()})(${serializeInlineScriptValue(rawToken)});`,
    "    </script>",
  ].join("\n");
}

export function injectLufengPublicBootstrap(indexHtml, rawToken) {
  if (indexHtml.includes("data-openclaw-lufeng-bootstrap")) {
    return indexHtml;
  }
  if (!indexHtml.includes("</head>")) {
    throw new Error("index.html is missing </head>; cannot inject the Lufeng bootstrap.");
  }
  return indexHtml.replace(
    "  </head>",
    `${buildLufengPublicBootstrapTag(rawToken)}\n  </head>`,
  );
}
