import { findContentMountRoot, findOpenClawApp } from "./dom-compat.js";

export const MOUNT_COMPAT_CONTRACT_VERSION = "mount-compat-v1";
const COMPAT_LOG_PREFIX = "[oc.mount-compat]";

function normalizeRouteKind(routeKind = "") {
  return String(routeKind || "")
    .trim()
    .toLowerCase();
}

function resolveFallbackAttr(featureKind = "") {
  const normalized = String(featureKind || "")
    .trim()
    .toLowerCase();
  if (!normalized) {
    return "data-oc-fallback-mount-root";
  }
  return `data-oc-${normalized.replace(/[^a-z0-9-]+/g, "-")}-fallback`;
}

function resolveFallbackClass(featureKind = "") {
  const normalized = String(featureKind || "")
    .trim()
    .toLowerCase();
  return normalized ? `oc-${normalized.replace(/[^a-z0-9-]+/g, "-")}-fallback` : "oc-fallback";
}

function safeLog(kind, sourceTag, message, details = null) {
  const logger = kind === "error" ? console.error : console.warn;
  if (details) {
    logger(`${COMPAT_LOG_PREFIX} ${sourceTag}: ${message}`, details);
    return;
  }
  logger(`${COMPAT_LOG_PREFIX} ${sourceTag}: ${message}`);
}

export function resolvePrimaryMountRoot(root = document, routeKind = "", sourceTag = "mount") {
  try {
    const contentRoot = findContentMountRoot(root);
    if (contentRoot instanceof HTMLElement) {
      return contentRoot;
    }
    if (normalizeRouteKind(routeKind) === "chat") {
      return null;
    }
    return null;
  } catch (error) {
    safeLog("warn", sourceTag, "resolvePrimaryMountRoot_failed", error);
    return null;
  }
}

export function ensureFallbackMountRoot(root = document, featureKind = "", sourceTag = "mount") {
  try {
    const scope = root instanceof Document ? root : document;
    const attr = resolveFallbackAttr(featureKind);
    const existing = scope.querySelector(`[${attr}]`);
    if (existing instanceof HTMLElement) {
      return existing;
    }
    const app = findOpenClawApp(scope);
    if (!(app instanceof HTMLElement)) {
      safeLog("warn", sourceTag, "fallback_mount_skipped_missing_app");
      return null;
    }
    const mount = document.createElement("main");
    mount.className = `content ${resolveFallbackClass(featureKind)}`;
    mount.setAttribute(attr, "true");
    document.body.append(mount);
    return mount;
  } catch (error) {
    safeLog("warn", sourceTag, "ensureFallbackMountRoot_failed", error);
    return null;
  }
}

export function observeMountTargets(root = document, callback, sourceTag = "mount") {
  if (typeof callback !== "function") {
    return () => {};
  }
  const scan = (scope) => {
    const primary = resolvePrimaryMountRoot(scope, "", sourceTag);
    callback({
      primary,
      scope: scope instanceof Element || scope instanceof Document ? scope : document,
    });
  };

  scan(root);

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node instanceof Element) {
          scan(node);
        }
      }
    }
  });

  observer.observe(document.documentElement, {
    subtree: true,
    childList: true,
  });

  return () => observer.disconnect();
}
