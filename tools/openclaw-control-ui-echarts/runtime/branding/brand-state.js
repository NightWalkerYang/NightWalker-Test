const DEFAULT_BRAND_STATE = Object.freeze({
  brandName: "苏博泰克",
  pageTitle: "苏博泰克",
  logoMode: "text",
  logoText: "SPTC",
  logoImage: null,
});
export const BRAND_STATE_SYNC_STORAGE_KEY = "openclaw.control-ui.branding.state";
const BRAND_STATE_SYNC_CHANNEL_NAME = "openclaw.control-ui.branding";

let currentBrandState = { ...DEFAULT_BRAND_STATE };
let currentBrandStateSerialized = JSON.stringify(currentBrandState);
const subscribers = new Set();
let syncBooted = false;
let syncChannel = null;
let storageListener = null;
let channelListener = null;

function normalizeText(value, fallback = "") {
  const normalized = String(value ?? "").trim();
  return normalized || fallback;
}

function resolveBrandState(input) {
  const logoMode = input?.logoMode === "image" ? "image" : "text";
  return {
    brandName: normalizeText(input?.brandName, DEFAULT_BRAND_STATE.brandName),
    pageTitle: normalizeText(
      input?.pageTitle,
      normalizeText(input?.brandName, DEFAULT_BRAND_STATE.pageTitle),
    ),
    logoMode,
    logoText:
      logoMode === "image"
        ? ""
        : normalizeText(input?.logoText, DEFAULT_BRAND_STATE.logoText),
    logoImage:
      logoMode === "image" && input?.logoImage?.src
        ? {
            fileName: normalizeText(input.logoImage.fileName),
            mimeType: normalizeText(input.logoImage.mimeType),
            src: normalizeText(input.logoImage.src),
          }
        : null,
  };
}

function serializeBrandState(state) {
  return JSON.stringify(resolveBrandState(state));
}

function broadcastBrandState(nextState, serializedState = serializeBrandState(nextState)) {
  try {
    globalThis.localStorage?.setItem(BRAND_STATE_SYNC_STORAGE_KEY, serializedState);
  } catch {
    // Ignore sync storage failures so local branding stays usable.
  }

  if (!syncChannel) {
    return;
  }

  try {
    syncChannel.postMessage(nextState);
  } catch {
    // Ignore cross-tab sync failures; local tab updates already applied.
  }
}

function applyBrandState(nextState, { broadcast = true } = {}) {
  const resolvedState = resolveBrandState(nextState);
  const serializedState = JSON.stringify(resolvedState);
  if (serializedState === currentBrandStateSerialized) {
    return getCurrentBrandState();
  }
  currentBrandState = resolvedState;
  currentBrandStateSerialized = serializedState;
  notifySubscribers();
  if (broadcast) {
    broadcastBrandState(resolvedState, serializedState);
  }
  return getCurrentBrandState();
}

function applyIncomingBrandState(nextState) {
  if (!nextState || typeof nextState !== "object") {
    return getCurrentBrandState();
  }
  return applyBrandState(nextState, { broadcast: false });
}

function teardownBrandStateSync() {
  if (storageListener && typeof globalThis.removeEventListener === "function") {
    globalThis.removeEventListener("storage", storageListener);
  }
  storageListener = null;

  if (syncChannel && channelListener && typeof syncChannel.removeEventListener === "function") {
    syncChannel.removeEventListener("message", channelListener);
  }
  channelListener = null;

  if (syncChannel && typeof syncChannel.close === "function") {
    try {
      syncChannel.close();
    } catch {
      // Ignore teardown failures in tests.
    }
  }
  syncChannel = null;
  syncBooted = false;
}

function notifySubscribers() {
  const snapshot = getCurrentBrandState();
  for (const subscriber of subscribers) {
    try {
      subscriber(snapshot);
    } catch {
      // Ignore subscriber failures so runtime brand updates stay best-effort.
    }
  }
}

export function getDefaultBrandState() {
  return { ...DEFAULT_BRAND_STATE };
}

export function getCurrentBrandState() {
  return { ...currentBrandState };
}

export function setCurrentBrandState(nextState) {
  return applyBrandState(nextState);
}

export function subscribeBrandState(listener) {
  if (typeof listener !== "function") {
    return () => {};
  }
  subscribers.add(listener);
  return () => {
    subscribers.delete(listener);
  };
}

export function bootBrandStateSync() {
  if (syncBooted) {
    return;
  }
  if (typeof globalThis.addEventListener !== "function") {
    return;
  }

  syncBooted = true;
  storageListener = (event) => {
    if (event?.key !== BRAND_STATE_SYNC_STORAGE_KEY || !event.newValue) {
      return;
    }
    try {
      applyIncomingBrandState(JSON.parse(event.newValue));
    } catch {
      // Ignore malformed sync payloads from storage.
    }
  };
  globalThis.addEventListener("storage", storageListener);

  if (typeof globalThis.BroadcastChannel !== "function") {
    return;
  }

  try {
    syncChannel = new globalThis.BroadcastChannel(BRAND_STATE_SYNC_CHANNEL_NAME);
    channelListener = (event) => {
      applyIncomingBrandState(event?.data);
    };
    if (typeof syncChannel.addEventListener === "function") {
      syncChannel.addEventListener("message", channelListener);
    }
  } catch {
    syncChannel = null;
    channelListener = null;
  }
}

export async function loadBrandState(fetchImpl = globalThis.fetch) {
  if (typeof fetchImpl !== "function") {
    return getCurrentBrandState();
  }
  try {
    const response = await fetchImpl("/tenant-platform-api/v1/public/branding");
    const payload = await response.json();
    if (!payload?.ok) {
      return getCurrentBrandState();
    }
    return applyBrandState(payload.data);
  } catch {
    return getCurrentBrandState();
  }
}

export function resetBrandStateForTests() {
  currentBrandState = { ...DEFAULT_BRAND_STATE };
  currentBrandStateSerialized = JSON.stringify(currentBrandState);
  subscribers.clear();
  teardownBrandStateSync();
}
