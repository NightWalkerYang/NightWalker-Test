import fs from "node:fs";
import path from "node:path";

const DERIVED_AGENT_METADATA_FILE = ".tenant-derived-agent.json";
const BOOTSTRAP_FILENAME = "BOOTSTRAP.md";
const LEGACY_MEMBER_SESSION_RE = /^agent:[^:]+:tenant-[a-z0-9_-]+$/i;
const MEMBER_CHAT_SESSION_RE =
  /^agent:[^:]+:tenant:[^:]+:tenant-agent:[^:]+:user:[^:]+:chat:[^:]+$/i;

function normalizeString(value) {
  return String(value || "").trim();
}

function isTenantDerivedWorkspace(workspaceDir) {
  const normalized = normalizeString(workspaceDir);
  if (!normalized) {
    return false;
  }
  return fs.existsSync(path.join(normalized, DERIVED_AGENT_METADATA_FILE));
}

function isTenantMemberChatSession(sessionKey) {
  const normalized = normalizeString(sessionKey).toLowerCase();
  if (!normalized) {
    return false;
  }
  return MEMBER_CHAT_SESSION_RE.test(normalized) || LEGACY_MEMBER_SESSION_RE.test(normalized);
}

export default function tenantMemberBootstrapFilter(event) {
  if (event?.type !== "agent" || event?.action !== "bootstrap") {
    return;
  }
  const context = event?.context;
  if (!context || typeof context !== "object") {
    return;
  }
  if (!isTenantDerivedWorkspace(context.workspaceDir)) {
    return;
  }
  if (!isTenantMemberChatSession(context.sessionKey || context.sessionId)) {
    return;
  }
  if (!Array.isArray(context.bootstrapFiles) || context.bootstrapFiles.length === 0) {
    return;
  }
  context.bootstrapFiles = context.bootstrapFiles.filter(
    (file) => normalizeString(file?.name).toLowerCase() !== BOOTSTRAP_FILENAME.toLowerCase(),
  );
}
