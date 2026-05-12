import { findContentMountRoot, findOpenClawApp } from "./dom-compat.js";

export const MOUNT_COMPAT_CONTRACT_VERSION = "mount-compat-v1";
const COMPAT_LOG_PREFIX = "[oc.mount-compat]";
const FALLBACK_ROOT_ATTR = "data-oc-fallback-mount-root";
const MOUNT_OBSERVER_RELEVANT_SELECTOR = [
  "openclaw-app",
  "[data-openclaw-app]",
  `[${FALLBACK_ROOT_ATTR}]`,
  "[data-oc-platform-surface-fallback]",
  "[data-oc-tenant-surface-fallback]",
  "[data-oc-member-surface-root]",
  "[data-oc-platform-surface-root]",
  "[data-oc-tenant-surface-root]",
  ".content",
  "main.content",
  "main[class*='content']",
  "main[class*='workspace']",
  ".workspace-content",
  "[role='main']",
  "[data-testid*='content' i]",
].join(", ");

function normalizeRouteKind(routeKind = "") {
  return String(routeKind || "")
    .trim()
    .toLowerCase();
}

function toSearchRoot(root) {
  if (root instanceof Document || root instanceof Element) {
    return root;
  }
  return document;
}

function toOwnerDocument(root) {
  if (root instanceof Document) {
    return root;
  }
  if (root instanceof Node && root.ownerDocument instanceof Document) {
    return root.ownerDocument;
  }
  return document;
}

function resolveFallbackAttr(featureKind = "") {
  const normalized = String(featureKind || "")
    .trim()
    .toLowerCase();
  if (!normalized) {
    return FALLBACK_ROOT_ATTR;
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

function isFallbackMountRoot(candidate) {
  return candidate instanceof HTMLElement && candidate.hasAttribute(FALLBACK_ROOT_ATTR);
}

function findExistingFallbackMountRoot(root = document, featureKind = "") {
  const searchRoot = toSearchRoot(root);
  const attr = resolveFallbackAttr(featureKind);
  if (searchRoot instanceof HTMLElement && searchRoot.hasAttribute(attr)) {
    return searchRoot;
  }
  if (searchRoot instanceof HTMLElement && searchRoot.hasAttribute(FALLBACK_ROOT_ATTR)) {
    return searchRoot;
  }
  const existing =
    searchRoot.querySelector?.(`[${attr}]`) ??
    searchRoot.querySelector?.(`[${FALLBACK_ROOT_ATTR}]`) ??
    null;
  return existing instanceof HTMLElement ? existing : null;
}

function findAppRoot(root = document) {
  const searchRoot = toSearchRoot(root);
  const ownerDocument = toOwnerDocument(searchRoot);
  return findOpenClawApp(searchRoot) || findOpenClawApp(ownerDocument);
}

function findNativePrimaryMountRoot(root = document) {
  const searchRoot = toSearchRoot(root);
  const ownerDocument = toOwnerDocument(searchRoot);
  const match = findContentMountRoot(searchRoot) || findContentMountRoot(ownerDocument);
  return isFallbackMountRoot(match) ? null : match;
}

function createMountState(primary, appRoot, fallbackRoot = null) {
  if (primary instanceof HTMLElement) {
    return {
      mode: "native",
      primary,
      appRoot: appRoot instanceof HTMLElement ? appRoot : null,
      fallbackRoot: fallbackRoot instanceof HTMLElement ? fallbackRoot : null,
    };
  }
  if (fallbackRoot instanceof HTMLElement) {
    return {
      mode: "fallback",
      primary: fallbackRoot,
      appRoot: appRoot instanceof HTMLElement ? appRoot : null,
      fallbackRoot,
    };
  }
  return {
    mode: "missing",
    primary: null,
    appRoot: appRoot instanceof HTMLElement ? appRoot : null,
    fallbackRoot: null,
  };
}

function nextAnimationFrame() {
  return new Promise((resolve) => {
    const schedule =
      typeof window.requestAnimationFrame === "function"
        ? window.requestAnimationFrame.bind(window)
        : (callback) => window.setTimeout(() => callback(Date.now()), 0);
    schedule(() => resolve());
  });
}

export function resolvePrimaryMountRoot(root = document, routeKind = "", sourceTag = "mount") {
  try {
    const contentRoot = findNativePrimaryMountRoot(root);
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
    const searchRoot = toSearchRoot(root);
    const ownerDocument = toOwnerDocument(searchRoot);
    const attr = resolveFallbackAttr(featureKind);
    const existing = findExistingFallbackMountRoot(searchRoot, featureKind);
    if (existing instanceof HTMLElement) {
      existing.setAttribute(FALLBACK_ROOT_ATTR, "true");
      existing.setAttribute(attr, "true");
      return existing;
    }
    const app = findAppRoot(searchRoot);
    if (!(app instanceof HTMLElement)) {
      safeLog("warn", sourceTag, "fallback_mount_skipped_missing_app");
      return null;
    }
    const mount = ownerDocument.createElement("main");
    mount.className = `content ${resolveFallbackClass(featureKind)}`;
    mount.setAttribute(FALLBACK_ROOT_ATTR, "true");
    mount.setAttribute(attr, "true");
    app.append(mount);
    return mount;
  } catch (error) {
    safeLog("warn", sourceTag, "ensureFallbackMountRoot_failed", error);
    return null;
  }
}

export function resolveMountState(
  root = document,
  { routeKind = "", featureKind = "", sourceTag = "mount", createFallback = false } = {},
) {
  try {
    const primary = resolvePrimaryMountRoot(root, routeKind, sourceTag);
    const appRoot = findAppRoot(root);
    if (primary instanceof HTMLElement) {
      return createMountState(primary, appRoot, null);
    }
    const fallbackRoot = findExistingFallbackMountRoot(root, featureKind);
    if (fallbackRoot instanceof HTMLElement) {
      return createMountState(null, appRoot, fallbackRoot);
    }
    if (createFallback) {
      const createdFallback = ensureFallbackMountRoot(root, featureKind, sourceTag);
      if (createdFallback instanceof HTMLElement) {
        return createMountState(null, appRoot || findAppRoot(root), createdFallback);
      }
    }
    return createMountState(null, appRoot, null);
  } catch (error) {
    safeLog("warn", sourceTag, "resolveMountState_failed", error);
    return createMountState(null, null, null);
  }
}

export async function resolveMountStateWithRetry(
  root = document,
  {
    routeKind = "",
    featureKind = "",
    sourceTag = "mount",
    allowFallback = false,
    preferNative = false,
  } = {},
) {
  let state = resolveMountState(root, {
    routeKind,
    featureKind,
    sourceTag,
    createFallback: false,
  });
  if (state.mode === "native") {
    return state;
  }
  if (preferNative) {
    await Promise.resolve();
    state = resolveMountState(root, {
      routeKind,
      featureKind,
      sourceTag,
      createFallback: false,
    });
    if (state.mode === "native") {
      return state;
    }
    await nextAnimationFrame();
    state = resolveMountState(root, {
      routeKind,
      featureKind,
      sourceTag,
      createFallback: false,
    });
    if (state.mode === "native") {
      return state;
    }
    await nextAnimationFrame();
    state = resolveMountState(root, {
      routeKind,
      featureKind,
      sourceTag,
      createFallback: false,
    });
    if (state.mode === "native") {
      return state;
    }
  }
  if (allowFallback) {
    return resolveMountState(root, {
      routeKind,
      featureKind,
      sourceTag,
      createFallback: true,
    });
  }
  return state;
}

function isMountObserverRelevantElement(element) {
  return element instanceof Element && element.matches(MOUNT_OBSERVER_RELEVANT_SELECTOR);
}

function subtreeContainsMountObserverRelevantElement(element) {
  if (!(element instanceof Element)) {
    return false;
  }
  return Boolean(element.querySelector(MOUNT_OBSERVER_RELEVANT_SELECTOR));
}

function resolveRelevantMutationScope(mutations, ownerDocument) {
  for (const mutation of mutations) {
    const target = mutation.target instanceof Element ? mutation.target : null;
    if (isMountObserverRelevantElement(target)) {
      return target;
    }
    if (isMountObserverRelevantElement(target?.parentElement)) {
      return target.parentElement;
    }
    for (const node of mutation.addedNodes) {
      if (!(node instanceof Element)) {
        continue;
      }
      if (isMountObserverRelevantElement(node)) {
        return node;
      }
      if (subtreeContainsMountObserverRelevantElement(node)) {
        return node;
      }
      if (isMountObserverRelevantElement(node.parentElement)) {
        return node.parentElement;
      }
    }
    for (const node of mutation.removedNodes) {
      if (!(node instanceof Element)) {
        continue;
      }
      if (
        isMountObserverRelevantElement(node) ||
        subtreeContainsMountObserverRelevantElement(node)
      ) {
        return target || ownerDocument;
      }
    }
  }
  return null;
}

export function observeMountTargets(root = document, callback, sourceTag = "mount") {
  if (typeof callback !== "function") {
    return () => {};
  }
  const searchRoot = toSearchRoot(root);
  const ownerDocument = toOwnerDocument(searchRoot);
  let lastMode = "";
  let lastPrimary = null;
  let lastAppRoot = null;
  let disconnected = false;
  let queuedScope = ownerDocument;
  let emitQueued = false;

  const emit = (scope) => {
    if (disconnected) {
      return;
    }
    const state = resolveMountState(searchRoot, { sourceTag });
    if (state.mode === lastMode && state.primary === lastPrimary && state.appRoot === lastAppRoot) {
      return;
    }
    lastMode = state.mode;
    lastPrimary = state.primary;
    lastAppRoot = state.appRoot;
    callback({
      mode: state.mode,
      primary: state.primary,
      appRoot: state.appRoot,
      fallbackRoot: state.fallbackRoot,
      scope: scope instanceof Element || scope instanceof Document ? scope : ownerDocument,
    });
  };

  const queueEmit = (scope) => {
    queuedScope = scope instanceof Element || scope instanceof Document ? scope : ownerDocument;
    if (emitQueued) {
      return;
    }
    emitQueued = true;
    queueMicrotask(() => {
      emitQueued = false;
      emit(queuedScope);
      queuedScope = ownerDocument;
    });
  };

  const observer = new MutationObserver((mutations) => {
    const scope = resolveRelevantMutationScope(mutations, ownerDocument);
    if (!scope) {
      return;
    }
    queueEmit(scope);
  });

  observer.observe(ownerDocument.documentElement, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["class", "hidden", "aria-hidden", "data-testid"],
  });

  emit(searchRoot);
  queueMicrotask(() => emit(ownerDocument));
  void nextAnimationFrame().then(() => emit(ownerDocument));
  void nextAnimationFrame().then(() => nextAnimationFrame().then(() => emit(ownerDocument)));

  return () => {
    disconnected = true;
    observer.disconnect();
  };
}
