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

  return text;
}

function isStructuredInput(text) {
  return /^[{\["']/.test(text);
}

function parseStructuredInput(text, json5) {
  if (!isStructuredInput(text)) {
    return null;
  }

  let lastError = null;
  const parsers = [() => JSON.parse(text)];
  if (json5?.parse) {
    parsers.push(() => json5.parse(text));
  }

  for (const parse of parsers) {
    try {
      return parse();
    } catch (error) {
      lastError = error;
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

function toWorkspaceRelativePath(rawPath) {
  const decoded = normalizePathSeparators(decodeFileUrlPath(rawPath));
  const segments = decoded.split("/").filter(Boolean);
  const workspaceIndex = segments.lastIndexOf("workspace");
  if (workspaceIndex === -1 || workspaceIndex === segments.length - 1) {
    throw new Error("Absolute file paths must stay inside the workspace.");
  }

  return normalizeWorkspaceRelativePath(segments.slice(workspaceIndex + 1).join("/"));
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
  const rawValue = normalizeText(candidate);
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
      actionLabel: "下载",
      secondaryActionLabel: "复制链接",
      rawValue,
    };
  }

  if (rawValue.includes("\n")) {
    throw new Error("File blocks must contain one URL or one workspace path.");
  }

  const relativePath = looksLikeAbsolutePath(rawValue)
    ? toWorkspaceRelativePath(rawValue)
    : normalizeWorkspaceRelativePath(rawValue);
  const inferredName = inferNameFromPath(relativePath);
  const name = firstNonEmpty(fields.name, inferredName);
  const extension = inferExtension(name) === "FILE" ? inferExtension(inferredName) : inferExtension(name);

  return {
    kind: "path",
    path: relativePath,
    rawPath: rawValue,
    name,
    extension,
    description: firstNonEmpty(fields.description),
    sizeLabel: normalizeSizeLabel(fields.size),
    sourceLabel: "workspace",
    actionLabel: "复制路径",
    secondaryActionLabel: "",
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

  const structured = parseStructuredInput(normalized, json5);
  if (structured !== null) {
    return unwrapStructuredPayload(structured);
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
