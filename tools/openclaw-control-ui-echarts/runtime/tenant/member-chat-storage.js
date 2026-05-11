import { isTenantMemberSessionKey } from "./tenant-context.js";

export const MEMBER_DRAFT_ROUTE_LOCK_STORAGE_KEY =
  "openclaw:tenant-platform:member-chat:draft-route-lock:v1";

function safeSessionStorage() {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function readSessionJson(key) {
  try {
    const raw = safeSessionStorage()?.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeSessionJson(key, value) {
  try {
    safeSessionStorage()?.setItem(key, JSON.stringify(value));
  } catch {
    // Best-effort only.
  }
}

function removeSessionStorageKey(key) {
  try {
    safeSessionStorage()?.removeItem(key);
  } catch {
    // Best-effort only.
  }
}

function buildMemberDraftRouteLockId(session, selectedAgent) {
  const tenantId = String(session?.session?.tenantId || "")
    .trim()
    .toLowerCase();
  const userId = String(session?.session?.userId || "")
    .trim()
    .toLowerCase();
  const tenantAgentId = String(selectedAgent?.id || "")
    .trim()
    .toLowerCase();
  if (!tenantId || !userId || !tenantAgentId) {
    return "";
  }
  return `${tenantId}:${userId}:${tenantAgentId}`;
}

export function readMemberDraftRouteLock(session, selectedAgent) {
  const lockId = buildMemberDraftRouteLockId(session, selectedAgent);
  if (!lockId) {
    return "";
  }
  const locks = readSessionJson(MEMBER_DRAFT_ROUTE_LOCK_STORAGE_KEY);
  const candidate = locks && typeof locks === "object" ? locks[lockId] : "";
  if (!isTenantMemberSessionKey(candidate, session, selectedAgent)) {
    return "";
  }
  return String(candidate).trim().toLowerCase();
}

export function writeMemberDraftRouteLock(session, selectedAgent, sessionKey) {
  if (!isTenantMemberSessionKey(sessionKey, session, selectedAgent)) {
    return;
  }
  const lockId = buildMemberDraftRouteLockId(session, selectedAgent);
  if (!lockId) {
    return;
  }
  const locks = readSessionJson(MEMBER_DRAFT_ROUTE_LOCK_STORAGE_KEY);
  const next = locks && typeof locks === "object" ? { ...locks } : {};
  next[lockId] = String(sessionKey).trim().toLowerCase();
  writeSessionJson(MEMBER_DRAFT_ROUTE_LOCK_STORAGE_KEY, next);
}

export function clearMemberDraftRouteLock(session, selectedAgent) {
  const lockId = buildMemberDraftRouteLockId(session, selectedAgent);
  if (!lockId) {
    return;
  }
  const locks = readSessionJson(MEMBER_DRAFT_ROUTE_LOCK_STORAGE_KEY);
  if (!locks || typeof locks !== "object" || !(lockId in locks)) {
    return;
  }
  const next = { ...locks };
  delete next[lockId];
  if (Object.keys(next).length === 0) {
    removeSessionStorageKey(MEMBER_DRAFT_ROUTE_LOCK_STORAGE_KEY);
    return;
  }
  writeSessionJson(MEMBER_DRAFT_ROUTE_LOCK_STORAGE_KEY, next);
}
