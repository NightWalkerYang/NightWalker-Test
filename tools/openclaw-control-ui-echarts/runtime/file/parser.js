import { normalizeText } from "../framework/shared.js";

export const FILE_LANGUAGE_ALIASES = new Set([
  "file",
  "download",
  "attachment",
  "artifact",
]);

const HTTP_URL_PATTERN = /^https?:\/\/\S+$/i;
const FILE_URL_PATTERN = /^file:\/\//i;
const ABSOLUTE_PATH_PATTERN = /^(?:[A-Za-z]:[\\/]|\\\\|\/)/;
const WORKSPACE_SEGMENT = "workspace";
const AGENT_WORKSPACES_SEGMENT = "workspace-agents";
const DERIVED_WORKSPACE_PREFIX = "workspace-";
const RESERVED_WORKSPACE_PREFIX_SEGMENTS = new Set([
  "workspace-downloads",
  "workspace-agent-downloads",
]);

function stripMatchingQuotes(value) {
  const text = String(value || "").trim();
  if (text.length < 2) {
    return text;
  }

  const first = text[0];
  const last = text[text.length - 1];
  if ((first === '"' || first === "'" || first === "`") && first === last) {
    return text.slice(1, -1).trim();
  }
  return text;
}

function scanLineComment(source, start) {
  let cursor = start + 2;
  while (cursor < source.length && source[cursor] !== "\n") {
    cursor += 1;
  }
  return cursor;
}

function scanBlockComment(source, start) {
  const endIndex = source.indexOf("*/", start + 2);
  if (endIndex === -1) {
    throw new Error("Unterminated block comment in file block.");
  }
  return endIndex + 2;
}

function scanQuotedString(source, start, quote) {
  let cursor = start + 1;
  while (cursor < source.length) {
    const char = source[cursor];
    if (char === "\\") {
      cursor += 2;
      continue;
    }
    if (char === quote) {
      return cursor + 1;
    }
    cursor += 1;
  }
  throw new Error("Unterminated string literal in file block.");
}

function scanBalanced(source, start, openChar, closeChar) {
  let depth = 1;
  let cursor = start + 1;

  while (cursor < source.length) {
    const char = source[cursor];
    const next = source[cursor + 1];
    if (char === "'" || char === '"' || char === "`") {
      cursor = scanQuotedString(source, cursor, char);
      continue;
    }
    if (char === "/" && next === "/") {
      cursor = scanLineComment(source, cursor);
      continue;
    }
    if (char === "/" && next === "*") {
      cursor = scanBlockComment(source, cursor);
      continue;
    }
    if (char === openChar) {
      depth += 1;
      cursor += 1;
      continue;
    }
    if (char === closeChar) {
      depth -= 1;
      cursor += 1;
      if (depth === 0) {
        return cursor;
      }
      continue;
    }
    cursor += 1;
  }

  throw new Error(`Unterminated ${openChar}${closeChar} pair in file block.`);
}

function extractBalancedSlice(source, openChar, closeChar) {
  const text = String(source || "").trim();
  if (!text) {
    return "";
  }
  const openIndex = text.indexOf(openChar);
  if (openIndex === -1) {
    return "";
  }
  try {
    const endIndex = scanBalanced(text, openIndex, openChar, closeChar);
    return text.slice(openIndex, endIndex).trim();
  } catch {
    return "";
  }
}

function buildStructuredParseCandidates(text) {
  const base = String(text || "").trim();
  if (!base) {
    return [];
  }

  const candidates = new Set();
  const pushCandidate = (value) => {
    const normalized = String(value || "").trim();
    if (normalized) {
      candidates.add(normalized);
    }
  };

  pushCandidate(base);
  if (base.startsWith("{")) {
    pushCandidate(extractBalancedSlice(base, "{", "}"));
  } else if (base.startsWith("[")) {
    pushCandidate(extractBalancedSlice(base, "[", "]"));
  } else {
    pushCandidate(extractBalancedSlice(base, "{", "}"));
    pushCandidate(extractBalancedSlice(base, "[", "]"));
  }

  return [...candidates];
}

function normalizeFileSource(raw) {
  let text = normalizeText(raw);
  if (!text) {
    return text;
  }

  text = text
    .replace(/^```[a-z0-9_-]*\s*\n/i, "")
    .replace(/\n```$/i, "")
    .trim();

  const wrappers = [
    /^(?:const|let|var)\s+(?:file|download|attachment|artifact)\s*=\s*/i,
    /^export\s+default\s+/i,
    /^return\s+/i,
    /^(?:file|download|attachment|artifact)\s+/i,
  ];

  for (const pattern of wrappers) {
    if (pattern.test(text)) {
      text = text.replace(pattern, "").trim();
    }
  }

  text = text.replace(/;\s*$/, "").trim();

  if (text.startsWith("(") && text.endsWith(")")) {
    const inner = text.slice(1, -1).trim();
    if (inner) {
      text = inner;
    }
  }

  text = text
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\u00a0/g, " ")
    .replace(/\u202f/g, " ")
    .replace(/[\u200b\u200c\u200d\ufeff]/g, "");

  return text;
}

function isStructuredInput(text) {
  return /^[{\["']/.test(text);
}

function parseStructuredInput(text, json5) {
  const shouldParseStructured = isStructuredInput(text) || /[{[]/.test(text);
  if (!shouldParseStructured) {
    return null;
  }
  const sourceVariants = buildStructuredParseCandidates(text);
  if (sourceVariants.length === 0) {
    return null;
  }

  let lastError = null;
  const parsers = [JSON.parse];
  if (json5?.parse) {
    parsers.push(json5.parse.bind(json5));
  }

  const candidates = sourceVariants.length > 0 ? sourceVariants : [text];
  for (const candidate of candidates) {
    for (const parse of parsers) {
      try {
        return parse(candidate);
      } catch (error) {
        lastError = error;
      }
    }
  }

  const detail =
    lastError && typeof lastError.message === "string"
      ? lastError.message
      : String(lastError || "Unknown error");
  throw new Error(`Could not parse the file block. ${detail}`);
}

function parseMarkdownLink(text) {
  const singleLine = text.replace(/\r\n?/g, "\n").trim();
  const match = singleLine.match(/^\[([^\]]+)\]\((.+)\)$/s);
  if (!match) {
    return null;
  }

  const name = normalizeText(match[1]);
  const destination = normalizeText(match[2]);
  if (!name || !destination) {
    return null;
  }

  const hrefMatch = destination.match(/^(.*?)(?:\s+["'][^"']*["'])?$/);
  const href = stripMatchingQuotes(hrefMatch?.[1] || destination)
    .replace(/^<|>$/g, "")
    .trim();
  if (!href) {
    return null;
  }

  return { name, url: href };
}

function firstNonEmpty(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
}

function normalizeSizeLabel(value) {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    const units = ["B", "KB", "MB", "GB", "TB"];
    let size = value;
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex += 1;
    }
    const digits = size >= 100 || unitIndex === 0 ? 0 : size >= 10 ? 1 : 2;
    return `${size.toFixed(digits).replace(/\.0+$/, "").replace(/(\.\d*[1-9])0+$/, "$1")} ${units[unitIndex]}`;
  }

  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  return "";
}

function looksLikeHttpUrl(text) {
  return HTTP_URL_PATTERN.test(text);
}

function looksLikeAbsolutePath(text) {
  return ABSOLUTE_PATH_PATTERN.test(text) || FILE_URL_PATTERN.test(text);
}

function decodeFileUrlPath(rawPath) {
  if (!FILE_URL_PATTERN.test(rawPath)) {
    return rawPath;
  }

  try {
    const url = new URL(rawPath);
    return decodeURIComponent(url.pathname || "");
  } catch {
    return rawPath.replace(FILE_URL_PATTERN, "");
  }
}

function normalizePathSeparators(pathValue) {
  return String(pathValue || "")
    .replace(/\\/g, "/")
    .replace(/\/+/g, "/")
    .trim();
}

function isDerivedWorkspaceSegment(segment) {
  const normalized = String(segment || "").trim().toLowerCase();
  if (!normalized.startsWith(DERIVED_WORKSPACE_PREFIX)) {
    return false;
  }
  if (normalized.length <= DERIVED_WORKSPACE_PREFIX.length) {
    return false;
  }
  if (RESERVED_WORKSPACE_PREFIX_SEGMENTS.has(normalized)) {
    return false;
  }
  return true;
}

function normalizeWorkspaceRelativePath(rawPath) {
  const normalized = normalizePathSeparators(stripMatchingQuotes(rawPath)).replace(/^\.\/+/, "");
  if (!normalized) {
    throw new Error("File path must point to a file inside the workspace.");
  }

  const segments = normalized.split("/").filter(Boolean);
  const nextSegments = [];
  for (const segment of segments) {
    if (segment === ".") {
      continue;
    }
    if (segment === "..") {
      throw new Error("File path escapes the workspace root.");
    }
    nextSegments.push(segment);
  }

  if (nextSegments.length === 0) {
    throw new Error("File path must point to a file inside the workspace.");
  }

  return nextSegments.join("/");
}

function toScopedRelativePath(rawPath) {
  const decoded = normalizePathSeparators(decodeFileUrlPath(rawPath));
  const segments = decoded.split("/").filter(Boolean);
  const workspaceIndex = segments.lastIndexOf(WORKSPACE_SEGMENT);
  if (workspaceIndex !== -1 && workspaceIndex < segments.length - 1) {
    return {
      scope: "workspace",
      path: normalizeWorkspaceRelativePath(segments.slice(workspaceIndex + 1).join("/")),
    };
  }

  const agentWorkspaceIndex = segments.lastIndexOf(AGENT_WORKSPACES_SEGMENT);
  if (agentWorkspaceIndex !== -1 && agentWorkspaceIndex < segments.length - 2) {
    return {
      scope: "agent-workspace",
      path: normalizeWorkspaceRelativePath(segments.slice(agentWorkspaceIndex + 1).join("/")),
    };
  }

  const derivedWorkspaceIndex = segments.findIndex(
    (segment) => isDerivedWorkspaceSegment(segment),
  );
  if (derivedWorkspaceIndex !== -1 && derivedWorkspaceIndex < segments.length - 1) {
    const derivedAgentId = segments[derivedWorkspaceIndex].slice(DERIVED_WORKSPACE_PREFIX.length);
    return {
      scope: "agent-workspace",
      path: normalizeWorkspaceRelativePath(
        [derivedAgentId, ...segments.slice(derivedWorkspaceIndex + 1)].join("/"),
      ),
    };
  }

  throw new Error("Absolute file paths must stay inside the workspace or agent workspace.");
}

function inferPathScope(rawValue) {
  const normalized = normalizePathSeparators(stripMatchingQuotes(rawValue)).replace(/^\.\/+/, "");
  if (!normalized) {
    return {
      scope: "workspace",
      path: normalized,
    };
  }

  const segments = normalized.split("/").filter(Boolean);
  if (
    segments[0] === AGENT_WORKSPACES_SEGMENT &&
    segments.length >= 3
  ) {
    return {
      scope: "agent-workspace",
      path: normalizeWorkspaceRelativePath(segments.slice(1).join("/")),
    };
  }

  if (
    isDerivedWorkspaceSegment(segments[0]) &&
    segments.length >= 2
  ) {
    const derivedAgentId = segments[0].slice(DERIVED_WORKSPACE_PREFIX.length);
    return {
      scope: "agent-workspace",
      path: normalizeWorkspaceRelativePath([derivedAgentId, ...segments.slice(1)].join("/")),
    };
  }

  return {
    scope: "workspace",
    path: normalizeWorkspaceRelativePath(normalized),
  };
}

function inferNameFromUrl(url) {
  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname || "";
    const lastSegment = pathname.split("/").filter(Boolean).pop();
    return decodeURIComponent(lastSegment || parsed.hostname || "download");
  } catch {
    return "download";
  }
}

function inferNameFromPath(pathValue) {
  const normalized = normalizePathSeparators(pathValue);
  const lastSegment = normalized.split("/").filter(Boolean).pop();
  return lastSegment || "file";
}

function inferExtension(name) {
  const match = String(name || "").match(/\.([A-Za-z0-9]{1,10})$/);
  return match ? match[1].toUpperCase() : "FILE";
}

function inferDomainLabel(url) {
  try {
    return new URL(url).hostname || "https";
  } catch {
    return "https";
  }
}

function normalizeDescriptor(candidate, fields = {}) {
  const rawValue = normalizeText(candidate)
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\u00a0/g, " ")
    .replace(/\u202f/g, " ")
    .replace(/[\u200b\u200c\u200d\ufeff]/g, "");
  if (!rawValue) {
    throw new Error("The file code block is empty.");
  }

  if (looksLikeHttpUrl(rawValue)) {
    const url = stripMatchingQuotes(rawValue);
    const inferredName = inferNameFromUrl(url);
    const name = firstNonEmpty(fields.name, inferredName);
    const extension = inferExtension(name) === "FILE" ? inferExtension(inferredName) : inferExtension(name);
    return {
      kind: "url",
      url,
      name,
      extension,
      description: firstNonEmpty(fields.description),
      sizeLabel: normalizeSizeLabel(fields.size),
      sourceLabel: inferDomainLabel(url),
      rawValue,
    };
  }

  if (rawValue.includes("\n")) {
    throw new Error("File blocks must contain one URL or one workspace path.");
  }

  const normalizedPath = looksLikeAbsolutePath(rawValue)
    ? toScopedRelativePath(rawValue)
    : inferPathScope(rawValue);
  const inferredName = inferNameFromPath(normalizedPath.path);
  const name = firstNonEmpty(fields.name, inferredName);
  const extension = inferExtension(name) === "FILE" ? inferExtension(inferredName) : inferExtension(name);

  return {
    kind: "path",
    scope: normalizedPath.scope,
    path: normalizedPath.path,
    rawPath: rawValue,
    name,
    extension,
    description: firstNonEmpty(fields.description),
    sizeLabel: normalizeSizeLabel(fields.size),
    sourceLabel: normalizedPath.scope === "agent-workspace" ? "agent workspace" : "workspace",
    rawValue,
  };
}

function unwrapStructuredPayload(parsed) {
  if (typeof parsed === "string") {
    return normalizeDescriptor(parsed);
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("File blocks must be a string or an object payload.");
  }

  const descriptor = firstNonEmpty(
    parsed.url,
    parsed.href,
    parsed.link,
    parsed.downloadUrl,
    parsed.path,
    parsed.file,
    parsed.filePath,
    parsed.storagePath,
    parsed.sourcePath,
    parsed.value,
  );

  if (!descriptor) {
    throw new Error("File payload must include a url or a path field.");
  }

  return normalizeDescriptor(descriptor, {
    name: firstNonEmpty(parsed.name, parsed.fileName, parsed.filename, parsed.title, parsed.label),
    description: firstNonEmpty(parsed.description, parsed.desc, parsed.hint, parsed.summary),
    size: parsed.size ?? parsed.bytes ?? parsed.fileSize,
  });
}

export function parseFilePayload(raw, json5) {
  const normalized = normalizeFileSource(raw);
  if (!normalized) {
    throw new Error("The file code block is empty.");
  }

  const markdownLink = parseMarkdownLink(normalized);
  if (markdownLink) {
    return normalizeDescriptor(markdownLink.url, {
      name: markdownLink.name,
    });
  }

  let structured = null;
  try {
    structured = parseStructuredInput(normalized, json5);
  } catch (error) {
    if (isStructuredInput(normalized)) {
      throw error;
    }
    structured = null;
  }
  if (structured !== null) {
    if (Array.isArray(structured)) {
      for (const entry of structured) {
        if (typeof entry !== "string" && (!entry || typeof entry !== "object")) {
          continue;
        }
        try {
          return unwrapStructuredPayload(entry);
        } catch {
          // Continue until a valid descriptor is found.
        }
      }
      throw new Error("File payload must include a url or a path field.");
    }
    return unwrapStructuredPayload(structured);
  }

  const extractedLink = normalized.match(/https?:\/\/\S+/i)?.[0];
  if (extractedLink) {
    return normalizeDescriptor(extractedLink);
  }

  return normalizeDescriptor(normalized);
}

export function localizeErrorMessage(detail) {
  let message = normalizeText(detail);
  if (!message) {
    return "未知错误。";
  }

  const exactMessages = new Map([
    ["The file code block is empty.", "文件代码块为空。"],
    ["File blocks must be a string or an object payload.", "文件卡片只支持字符串或对象格式。"],
    ["File payload must include a url or a path field.", "文件卡片对象里需要包含 url 或 path 字段。"],
    ["File blocks must contain one URL or one workspace path.", "文件卡片代码块只能包含一条链接或一条工作区路径。"],
    ["File path must point to a file inside the workspace.", "文件路径必须指向工作区内的具体文件。"],
    ["File path escapes the workspace root.", "文件路径超出了工作区范围。"],
    ["Absolute file paths must stay inside the workspace.", "绝对路径必须位于工作区目录内。"],
    ["Absolute file paths must stay inside the workspace or agent workspace.", "绝对路径必须位于工作区或 Agent 工作区目录内。"],
  ]);

  if (exactMessages.has(message)) {
    return exactMessages.get(message);
  }

  if (/^Could not parse the file block\.\s*/i.test(message)) {
    return "无法解析文件卡片配置，请检查括号、引号和字段格式。";
  }

  return /[A-Za-z]/.test(message)
    ? "文件卡片格式不正确，请提供链接或工作区内的文件路径。"
    : message;
}
