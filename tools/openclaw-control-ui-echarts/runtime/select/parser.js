import { normalizeText } from "../framework/shared.js";

export const SELECT_LANGUAGE_ALIASES = new Set([
  "single-select",
  "single_select",
  "singleselect",
  "radio",
  "multi-select",
  "multi_select",
  "multiselect",
  "checkbox",
  "checkboxes",
]);

const SINGLE_SELECT_ALIASES = new Set([
  "single-select",
  "single_select",
  "singleselect",
  "radio",
]);

const MULTI_SELECT_ALIASES = new Set([
  "multi-select",
  "multi_select",
  "multiselect",
  "checkbox",
  "checkboxes",
]);

function normalizeAlias(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function normalizeScalarText(value) {
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

function firstNonEmpty(...values) {
  for (const value of values) {
    const normalized = normalizeScalarText(value);
    if (normalized) {
      return normalized;
    }
  }
  return "";
}

function clampInteger(value, min, max, fallback) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  const integer = Math.trunc(numeric);
  return Math.min(Math.max(integer, min), max);
}

function normalizeStringArray(value) {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeScalarText(item)).filter(Boolean);
  }
  const single = normalizeScalarText(value);
  return single ? [single] : [];
}

function normalizeParserWhitespace(text) {
  return String(text || "")
    .replace(/\u00a0/g, " ")
    .replace(/\u202f/g, " ")
    .replace(/[\u200b\u200c\u200d\ufeff]/g, "");
}

function normalizeSelectSource(raw, mode) {
  let text = normalizeParserWhitespace(normalizeText(raw));
  if (!text) {
    return text;
  }

  text = text
    .replace(/^```[a-z0-9_-]*\s*\n/i, "")
    .replace(/\n```$/i, "")
    .trim();

  const wrappers = [
    /^(?:const|let|var)\s+(?:singleSelect|single_select|multiSelect|multi_select|select|choice|choices)\s*=\s*/i,
    /^export\s+default\s+/i,
    /^return\s+/i,
  ];

  for (const pattern of wrappers) {
    if (pattern.test(text)) {
      text = text.replace(pattern, "").trim();
    }
  }

  if (mode === "single") {
    text = text
      .replace(/^(?:single-select|single_select|singleselect|radio)\s+/i, "")
      .trim();
  } else if (mode === "multi") {
    text = text
      .replace(/^(?:multi-select|multi_select|multiselect|checkbox|checkboxes)\s+/i, "")
      .trim();
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

function parseStructuredInput(text, json5) {
  if (!/^\{/.test(text)) {
    throw new Error("Select blocks must use an object payload.");
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
  throw new Error(`Could not parse the select block. ${detail}`);
}

function normalizeOption(option, index) {
  if (
    typeof option === "string" ||
    typeof option === "number" ||
    typeof option === "boolean" ||
    typeof option === "bigint"
  ) {
    const label = normalizeScalarText(option);
    if (!label) {
      throw new Error("Select option labels cannot be empty.");
    }
    return {
      value: label,
      label,
      description: "",
      prompt: "",
      disabled: false,
      index,
    };
  }

  if (!option || typeof option !== "object" || Array.isArray(option)) {
    throw new Error("Select options must be strings or objects.");
  }

  const label = firstNonEmpty(
    option.label,
    option.text,
    option.title,
    option.name,
    option.value,
    option.id,
    option.key,
  );
  if (!label) {
    throw new Error("Select option labels cannot be empty.");
  }

  const value = firstNonEmpty(option.value, option.id, option.key, label);
  if (!value) {
    throw new Error("Select option values cannot be empty.");
  }

  return {
    value,
    label,
    description: firstNonEmpty(
      option.description,
      option.desc,
      option.hint,
      option.summary,
    ),
    prompt: firstNonEmpty(
      option.prompt,
      option.message,
      option.request,
      option.instruction,
    ),
    disabled: option.disabled === true,
    index,
  };
}

function resolveOptions(parsed) {
  const rawOptions =
    parsed?.options ??
    parsed?.choices ??
    parsed?.items ??
    parsed?.list;

  if (!Array.isArray(rawOptions) || rawOptions.length === 0) {
    throw new Error("Select payload must include a non-empty options array.");
  }

  const options = rawOptions.map((option, index) => normalizeOption(option, index));
  const uniqueValues = new Set();

  for (const option of options) {
    const normalizedValue = normalizeAlias(option.value);
    if (uniqueValues.has(normalizedValue)) {
      throw new Error("Select option values must be unique.");
    }
    uniqueValues.add(normalizedValue);
  }

  if (!options.some((option) => !option.disabled)) {
    throw new Error("Select payload must include at least one enabled option.");
  }

  return options;
}

function isKnownOptionValue(options, value) {
  const normalizedValue = normalizeAlias(value);
  return options.some(
    (option) => normalizeAlias(option.value) === normalizedValue && !option.disabled,
  );
}

function resolveSingleDefaultValue(parsed, options) {
  const explicitValue = firstNonEmpty(
    parsed?.defaultValue,
    parsed?.default,
    parsed?.selectedValue,
  );
  if (explicitValue && isKnownOptionValue(options, explicitValue)) {
    return explicitValue;
  }
  return "";
}

function resolveMultiDefaults(parsed, options) {
  const enabledOptions = options.filter((option) => !option.disabled);
  const enabledCount = enabledOptions.length;
  const required = parsed?.required !== false;
  const minSelected = clampInteger(
    parsed?.minSelected,
    0,
    enabledCount,
    required ? 1 : 0,
  );
  const maxSelected = clampInteger(
    parsed?.maxSelected,
    minSelected,
    enabledCount,
    enabledCount,
  );
  const defaults = [];

  for (const value of normalizeStringArray(
    parsed?.defaultValues ?? parsed?.defaults ?? parsed?.selectedValues,
  )) {
    const normalizedValue = normalizeAlias(value);
    const match = enabledOptions.find(
      (option) => normalizeAlias(option.value) === normalizedValue,
    );
    if (!match) {
      continue;
    }
    if (defaults.some((item) => normalizeAlias(item) === normalizedValue)) {
      continue;
    }
    defaults.push(match.value);
    if (defaults.length >= maxSelected) {
      break;
    }
  }

  return {
    defaultValues: defaults,
    minSelected,
    maxSelected,
  };
}

export function detectSelectMode(raw, explicitLanguage = "") {
  const normalizedLanguage = normalizeAlias(explicitLanguage);
  if (SINGLE_SELECT_ALIASES.has(normalizedLanguage)) {
    return "single";
  }
  if (MULTI_SELECT_ALIASES.has(normalizedLanguage)) {
    return "multi";
  }

  const text = normalizeText(raw);
  const firstLine = String(text.split("\n", 1)[0] || "");
  const alias = normalizeAlias(firstLine.split(/\s+/, 1)[0] || "");
  if (SINGLE_SELECT_ALIASES.has(alias)) {
    return "single";
  }
  if (MULTI_SELECT_ALIASES.has(alias)) {
    return "multi";
  }

  return "";
}

export function parseSelectPayload(raw, json5, mode) {
  if (mode !== "single" && mode !== "multi") {
    throw new Error("Unknown select mode.");
  }

  const normalized = normalizeSelectSource(raw, mode);
  if (!normalized) {
    throw new Error("The select code block is empty.");
  }

  const parsed = parseStructuredInput(normalized, json5);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Select blocks must be an object payload.");
  }

  const options = resolveOptions(parsed);
  const payload = {
    kind: mode,
    title: firstNonEmpty(parsed.title, parsed.question, parsed.label),
    description: firstNonEmpty(
      parsed.description,
      parsed.desc,
      parsed.hint,
      parsed.helperText,
    ),
    submitLabel: firstNonEmpty(
      parsed.submitLabel,
      parsed.actionLabel,
      parsed.buttonLabel,
      parsed.ctaLabel,
    ),
    options,
  };

  if (mode === "single") {
    return {
      ...payload,
      defaultValue: resolveSingleDefaultValue(parsed, options),
    };
  }

  return {
    ...payload,
    ...resolveMultiDefaults(parsed, options),
  };
}

export function localizeErrorMessage(detail) {
  let message = normalizeText(detail);
  if (!message) {
    return "未知错误。";
  }

  const exactMessages = new Map([
    ["The select code block is empty.", "选项代码块为空。"],
    ["Unknown select mode.", "未知的选项类型。"],
    ["Select blocks must use an object payload.", "选项代码块必须使用对象格式。"],
    ["Select blocks must be an object payload.", "选项代码块必须使用对象格式。"],
    ["Select payload must include a non-empty options array.", "选项代码块里需要提供非空 options 数组。"],
    ["Select payload must include at least one enabled option.", "选项代码块里至少要有一个可用选项。"],
    ["Select option labels cannot be empty.", "选项的 label 不能为空。"],
    ["Select option values cannot be empty.", "选项的 value 不能为空。"],
    ["Select option values must be unique.", "选项的 value 不能重复。"],
    ["Select options must be strings or objects.", "选项项只能是字符串或对象。"],
  ]);

  if (exactMessages.has(message)) {
    return exactMessages.get(message);
  }

  if (/^Could not parse the select block\.\s*/i.test(message)) {
    return "无法解析选项代码块，请检查括号、引号和字段格式。";
  }

  return /[A-Za-z]/.test(message)
    ? "选项代码块格式不正确，请检查对象结构和 options 字段。"
    : message;
}
