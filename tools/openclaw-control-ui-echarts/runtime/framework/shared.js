import {
  findClosestChatSurface,
  findClosestOpenClawApp,
  findOpenClawApp,
} from "./dom-compat.js";

const FENCED_CARD_STATE_STORAGE_PREFIX = "openclaw:fenced-card-state:v1:";

export function normalizeText(value) {
  return String(value || "")
    .replace(/\r\n?/g, "\n")
    .trim();
}

export function hashText(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function truncateString(value, maxLength = 160) {
  const text = String(value ?? "");
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, Math.max(0, maxLength - 1))}…`;
}

export function toDisplayString(value) {
  if (value == null) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function ensureArray(value) {
  if (Array.isArray(value)) {
    return value;
  }
  if (value && typeof value === "object") {
    return [value];
  }
  return [];
}

function getCodeBlockWrapper(candidate) {
  if (!(candidate instanceof Element)) {
    return null;
  }
  return candidate.closest(".code-block-wrapper") || candidate.closest("pre") || candidate;
}

function safeLocalStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function resolveActiveSessionKey(target = document) {
  const app = findClosestOpenClawApp(target) || findOpenClawApp(document);
  const candidates = [
    app?.__ocPinnedSessionKey,
    app?.sessionKey,
    app?.settings?.sessionKey,
  ];
  for (const value of candidates) {
    const normalized = String(value || "").trim();
    if (normalized) {
      return normalized;
    }
  }

  try {
    const fromUrl = new URL(window.location.href).searchParams.get("session");
    return String(fromUrl || "").trim();
  } catch {
    return "";
  }
}

function resolveFencedCardOrdinal(wrapper) {
  if (!(wrapper instanceof Element)) {
    return 0;
  }
  const searchRoot = findClosestChatSurface(wrapper) || document;
  const wrappers = [];
  const seen = new Set();
  for (const codeEl of searchRoot.querySelectorAll("code")) {
    const codeWrapper = getCodeBlockWrapper(codeEl);
    if (!(codeWrapper instanceof Element) || seen.has(codeWrapper)) {
      continue;
    }
    seen.add(codeWrapper);
    wrappers.push(codeWrapper);
  }
  const index = wrappers.indexOf(wrapper);
  return index >= 0 ? index : 0;
}

function buildFencedCardStateStorageKey({ wrapper, adapterId, source }) {
  const sessionKey = resolveActiveSessionKey(wrapper);
  if (!sessionKey) {
    return "";
  }
  const normalizedAdapterId = String(adapterId || "").trim();
  if (!normalizedAdapterId) {
    return "";
  }
  const sourceHash = hashText(normalizeText(source));
  const ordinal = resolveFencedCardOrdinal(wrapper);
  return `${FENCED_CARD_STATE_STORAGE_PREFIX}${sessionKey}|${normalizedAdapterId}|${ordinal}|${sourceHash}`;
}

export function readPersistedFencedCardState(identity) {
  const storage = safeLocalStorage();
  const key = buildFencedCardStateStorageKey(identity);
  if (!storage || !key) {
    return null;
  }
  try {
    const raw = storage.getItem(key);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

export function writePersistedFencedCardState(identity, state) {
  const storage = safeLocalStorage();
  const key = buildFencedCardStateStorageKey(identity);
  if (!storage || !key || !state || typeof state !== "object") {
    return false;
  }
  try {
    storage.setItem(key, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function waitForFrame(count = 1) {
  return new Promise((resolve) => {
    const step = (remaining) => {
      if (remaining <= 0) {
        resolve();
        return;
      }
      requestAnimationFrame(() => step(remaining - 1));
    };
    step(count);
  });
}
