export function normalizeSessionTitleValue(value) {
  return String(value ?? "").trim();
}

export function isGeneratedTimestampTitle(value) {
  const normalized = normalizeSessionTitleValue(value);
  if (!normalized) {
    return false;
  }
  return (
    /^\[[A-Za-z]{3}\s+\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}/.test(normalized) ||
    /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/.test(normalized)
  );
}

export function isProvisionalSessionTitle(value) {
  const normalized = normalizeSessionTitleValue(value);
  if (!normalized) {
    return true;
  }
  return normalized === "新会话" || isGeneratedTimestampTitle(normalized);
}
