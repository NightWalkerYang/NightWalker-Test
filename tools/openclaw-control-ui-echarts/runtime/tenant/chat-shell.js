export function readSelectedTenantAgentId() {
  const url = new URL(window.location.href);
  return url.searchParams.get("tenantAgentId")?.trim() || "";
}

