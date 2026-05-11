import { navigateTenantRoute } from "./route-sync.js";
import {
  buildTenantMemberChatRoute,
  buildTenantMemberLegacySessionKey,
  createTenantMemberSessionKey,
  isTenantMemberSessionKey,
} from "./tenant-context.js";
import { clearMemberDraftRouteLock, readMemberDraftRouteLock } from "./member-chat-storage.js";

function normalizeSessionTitleValue(value) {
  return String(value ?? "").trim();
}

function isGeneratedTimestampTitle(value) {
  const normalized = normalizeSessionTitleValue(value);
  if (!normalized) {
    return false;
  }
  return (
    /^\[[A-Za-z]{3}\s+\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}/.test(normalized) ||
    /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/.test(normalized)
  );
}

function isProvisionalSessionTitle(value) {
  const normalized = normalizeSessionTitleValue(value);
  if (!normalized) {
    return true;
  }
  return normalized === "新会话" || isGeneratedTimestampTitle(normalized);
}

function isDraftOnlySessionRow(row) {
  if (!row || row.hasGatewaySession !== false) {
    return false;
  }
  const title = normalizeSessionTitleValue(row?.title || row?.label);
  return isProvisionalSessionTitle(title);
}

function isPinnedDraftSessionStillActive(app, sessionKey) {
  const normalizedSessionKey = String(sessionKey || "")
    .trim()
    .toLowerCase();
  if (!normalizedSessionKey || !(app instanceof HTMLElement)) {
    return false;
  }
  const pinnedSessionKey = String(app.__ocPinnedSessionKey || app.sessionKey || "")
    .trim()
    .toLowerCase();
  if (pinnedSessionKey !== normalizedSessionKey) {
    return false;
  }
  const controller = window._ocMemberChatSurfaceController;
  const controllerSessionKey = String(controller?.currentSessionKey || "")
    .trim()
    .toLowerCase();
  if (controllerSessionKey === normalizedSessionKey && controller?.hasDraftSession) {
    return true;
  }
  if (app.chatSending || app.chatLoading || app.chatRunId) {
    return true;
  }
  if (typeof app.chatStream === "string" && app.chatStream.trim()) {
    return true;
  }
  if (Array.isArray(app.chatMessages) && app.chatMessages.length > 0) {
    return true;
  }
  if (Array.isArray(app.chatQueue) && app.chatQueue.length > 0) {
    return true;
  }
  return false;
}

export function isMemberDraftRouteLocked(session, selectedAgent, sessionKey) {
  const normalizedSessionKey = String(sessionKey || "")
    .trim()
    .toLowerCase();
  if (!normalizedSessionKey) {
    return false;
  }
  return readMemberDraftRouteLock(session, selectedAgent) === normalizedSessionKey;
}

export function resolveRouteSessionKey(sessions, sessionKey, shouldSkipSessionHistoryHydration) {
  return shouldSkipSessionHistoryHydration(sessions, sessionKey) ? "" : sessionKey;
}

export function findTargetSessionKey(app, selectedAgent, session, href, sessions) {
  const url = new URL(href, document.baseURI);
  const resolveCandidate = (value) => {
    const normalized = String(value || "")
      .trim()
      .toLowerCase();
    if (!normalized || !isTenantMemberSessionKey(normalized, session, selectedAgent)) {
      return "";
    }
    const existingRow = sessions.find(
      (row) =>
        String(row?.key || "")
          .trim()
          .toLowerCase() === normalized,
    );
    if (
      isDraftOnlySessionRow(existingRow) &&
      !isPinnedDraftSessionStillActive(app, normalized) &&
      !isMemberDraftRouteLocked(session, selectedAgent, normalized)
    ) {
      return "";
    }
    return existingRow?.key ? String(existingRow.key).trim().toLowerCase() : normalized;
  };
  const fromQuery = resolveCandidate(url.searchParams.get("session"));
  if (fromQuery) {
    return fromQuery;
  }
  const draftRouteLock = readMemberDraftRouteLock(session, selectedAgent);
  if (draftRouteLock) {
    const locked = resolveCandidate(draftRouteLock);
    if (locked) {
      return locked;
    }
    clearMemberDraftRouteLock(session, selectedAgent);
  }
  for (const candidate of [
    app?.sessionKey,
    app?.settings?.lastActiveSessionKey,
    app?.settings?.sessionKey,
  ]) {
    const persisted = resolveCandidate(candidate);
    if (persisted) {
      return persisted;
    }
  }
  const latestGatewayRow = sessions.find((row) => row?.hasGatewaySession !== false);
  const latestGateway = resolveCandidate(latestGatewayRow?.key);
  if (latestGateway) {
    return latestGateway;
  }
  const legacy = buildTenantMemberLegacySessionKey(selectedAgent);
  if (legacy) {
    const legacyRow = sessions.find(
      (row) =>
        String(row.key || "")
          .trim()
          .toLowerCase() === legacy,
    );
    if (legacyRow?.key) {
      return legacyRow.key.trim().toLowerCase();
    }
  }
  return createTenantMemberSessionKey(session, selectedAgent).toLowerCase();
}

export function syncRouteForSession(
  selectedAgent,
  sessionKey,
  memberChatSurfaceSuppressNextRouteSyncRef,
  { replace = true } = {},
) {
  const current = new URL(window.location.href);
  const target = buildTenantMemberChatRoute(selectedAgent.id, sessionKey);
  const targetUrl = new URL(target, document.baseURI);
  if (current.href !== targetUrl.href) {
    memberChatSurfaceSuppressNextRouteSyncRef.value = true;
    navigateTenantRoute(targetUrl.href, { replace });
  }
}
