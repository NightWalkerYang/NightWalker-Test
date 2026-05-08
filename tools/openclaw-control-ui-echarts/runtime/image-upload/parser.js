import { normalizeText } from "../framework/shared.js";

export const IMAGE_UPLOAD_LANGUAGE_ALIASES = new Set([
  "image-upload",
  "image_upload",
  "imageupload",
]);

const ALLOWED_IMAGE_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
]);

const ALLOWED_IMAGE_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
]);

const DEFAULT_SUCCESS_PROMPT =
  "素材已上传：{{uploadedList}}。请继续修改页面，并优先使用 ./assets 下的相对路径。";

function normalizeScalar(value) {
  if (typeof value === "string") {
    return value.trim();
  }
  if (
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "bigint"
  ) {
    return String(value).trim();
  }
  return "";
}

function normalizePathSeparators(value) {
  return String(value || "")
    .replace(/\\/g, "/")
    .replace(/\/+/g, "/")
    .trim();
}

function isAbsolutePath(value) {
  return /^(?:\/|[A-Za-z]:\/|\\\\)/.test(String(value || "").trim());
}

function normalizeSafeRelativePath(rawPath, messagePrefix) {
  const normalized = normalizePathSeparators(rawPath).replace(/^\.\/+/, "");
  if (!normalized) {
    throw new Error(`${messagePrefix}不能为空。`);
  }
  if (isAbsolutePath(normalized)) {
    throw new Error(`${messagePrefix}不支持绝对路径。`);
  }
  const segments = normalized.split("/").filter(Boolean);
  if (segments.length === 0) {
    throw new Error(`${messagePrefix}不能为空。`);
  }
  const nextSegments = [];
  for (const segment of segments) {
    if (segment === ".") {
      continue;
    }
    if (segment === "..") {
      throw new Error(`${messagePrefix}不能包含上级目录(..)。`);
    }
    nextSegments.push(segment);
  }
  if (nextSegments.length === 0) {
    throw new Error(`${messagePrefix}不能为空。`);
  }
  return nextSegments.join("/");
}

function normalizeTargetDir(targetDir) {
  const normalized = normalizeSafeRelativePath(targetDir, "targetDir");
  if (!(normalized === "Echarts" || normalized.startsWith("Echarts/"))) {
    throw new Error("targetDir 必须落在 Echarts/ 目录下。");
  }
  return normalized;
}

function parseMaybeJson(source, json5) {
  const parsers = [JSON.parse];
  if (json5?.parse) {
    parsers.push(json5.parse.bind(json5));
  }

  let lastError = null;
  for (const parse of parsers) {
    try {
      return parse(source);
    } catch (error) {
      lastError = error;
    }
  }
  const detail =
    lastError && typeof lastError.message === "string"
      ? lastError.message
      : String(lastError || "Unknown error");
  throw new Error(`无法解析 image-upload 配置。${detail}`);
}

function extractObjectSource(raw) {
  const openIndex = raw.indexOf("{");
  const closeIndex = raw.lastIndexOf("}");
  if (openIndex === -1 || closeIndex === -1 || closeIndex <= openIndex) {
    return "";
  }
  return raw.slice(openIndex, closeIndex + 1).trim();
}

function normalizeParserSource(raw) {
  let text = normalizeText(raw);
  if (!text) {
    return text;
  }

  text = text
    .replace(/^```[a-z0-9_-]*\s*\n/i, "")
    .replace(/\n```$/i, "")
    .trim();

  text = text
    .replace(/^image-upload\s+/i, "")
    .replace(/^image_upload\s+/i, "")
    .replace(/^imageupload\s+/i, "")
    .replace(/^export\s+default\s+/i, "")
    .replace(/^return\s+/i, "")
    .trim();

  text = text.replace(/;\s*$/, "").trim();
  if (text.startsWith("(") && text.endsWith(")")) {
    const inner = text.slice(1, -1).trim();
    if (inner) {
      text = inner;
    }
  }

  return text;
}

function isAllowedAcceptEntry(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) {
    return false;
  }
  if (ALLOWED_IMAGE_MIME_TYPES.has(normalized)) {
    return true;
  }
  if (ALLOWED_IMAGE_EXTENSIONS.has(normalized)) {
    return true;
  }
  return false;
}

function normalizeAcceptList(rawAccept) {
  if (rawAccept == null) {
    return [...ALLOWED_IMAGE_MIME_TYPES];
  }
  if (!Array.isArray(rawAccept)) {
    throw new Error("slot.accept 必须是数组。");
  }
  const items = rawAccept
    .map((item) => String(item || "").trim().toLowerCase())
    .filter(Boolean);
  if (items.length === 0) {
    return [...ALLOWED_IMAGE_MIME_TYPES];
  }
  for (const entry of items) {
    if (!isAllowedAcceptEntry(entry)) {
      throw new Error(`slot.accept 仅支持 png/jpeg/webp，收到: ${entry}`);
    }
  }
  return [...new Set(items)];
}

function normalizeSlot(slot, index, targetDir) {
  if (!slot || typeof slot !== "object" || Array.isArray(slot)) {
    throw new Error(`slots[${index}] 必须是对象。`);
  }

  const id = normalizeScalar(slot.id);
  const label = normalizeScalar(slot.label);
  const path = normalizeSafeRelativePath(slot.path, `slots[${index}].path`);

  if (!id) {
    throw new Error(`slots[${index}].id 不能为空。`);
  }
  if (!label) {
    throw new Error(`slots[${index}].label 不能为空。`);
  }

  const workspacePath = `${targetDir}/${path}`;
  const normalizedWorkspacePath = normalizeSafeRelativePath(
    workspacePath,
    `slots[${index}].path`,
  );
  if (!(normalizedWorkspacePath === "Echarts" || normalizedWorkspacePath.startsWith("Echarts/"))) {
    throw new Error(`slots[${index}] 上传路径必须落在 Echarts/ 下。`);
  }

  let maxBytes = Number(slot.maxBytes);
  if (!Number.isFinite(maxBytes) || maxBytes <= 0) {
    maxBytes = 0;
  } else {
    maxBytes = Math.trunc(maxBytes);
  }

  return {
    id,
    label,
    hint: normalizeScalar(slot.hint),
    path,
    workspacePath: normalizedWorkspacePath,
    accept: normalizeAcceptList(slot.accept),
    required: slot.required === true,
    maxBytes,
  };
}

export function parseImageUploadPayload(raw, json5) {
  const source = normalizeParserSource(raw);
  if (!source) {
    throw new Error("image-upload 代码块为空。");
  }

  const objectSource = source.startsWith("{") ? source : extractObjectSource(source);
  if (!objectSource) {
    throw new Error("image-upload 代码块必须是 JSON/JSON5 对象。");
  }

  const parsed = parseMaybeJson(objectSource, json5);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("image-upload 配置必须是对象。");
  }

  const targetDir = normalizeTargetDir(parsed.targetDir);
  if (!Array.isArray(parsed.slots) || parsed.slots.length < 1) {
    throw new Error("slots 必须是至少一项的数组。");
  }

  const slots = parsed.slots.map((slot, index) => normalizeSlot(slot, index, targetDir));
  const uniqueIds = new Set();
  for (const slot of slots) {
    const key = slot.id.toLowerCase();
    if (uniqueIds.has(key)) {
      throw new Error(`slots.id 不能重复：${slot.id}`);
    }
    uniqueIds.add(key);
  }

  return {
    title: normalizeScalar(parsed.title) || "上传素材",
    description: normalizeScalar(parsed.description),
    targetDir,
    submitLabel: normalizeScalar(parsed.submitLabel) || "上传完成并继续",
    successPrompt: normalizeScalar(parsed.successPrompt) || DEFAULT_SUCCESS_PROMPT,
    slots,
  };
}

export function localizeErrorMessage(detail) {
  const message = normalizeText(detail);
  if (!message) {
    return "上传卡片配置不正确。";
  }
  return /[A-Za-z]/.test(message) ? `上传卡片配置错误：${message}` : message;
}

