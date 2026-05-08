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

const LOOSE_OBJECT_PREFIX_PATTERN =
  /^(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[A-Za-z_$][\w$-]*)\s*:/;

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
    .replace(/[\u200b\u200c\u200d\ufeff]/g, "")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'");
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
    throw new Error("Unterminated block comment in select block.");
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
  throw new Error("Unterminated string literal in select block.");
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

  throw new Error(`Unterminated ${openChar}${closeChar} pair in select block.`);
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

  for (const value of [...candidates]) {
    if (value.startsWith("[")) {
      pushCandidate(`{ options: ${value} }`);
    }
    if (!value.startsWith("{") && LOOSE_OBJECT_PREFIX_PATTERN.test(value)) {
      pushCandidate(`{ ${value} }`);
    }
  }

  return [...candidates];
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
  const sourceVariants = buildStructuredParseCandidates(text);
  if (sourceVariants.length === 0) {
    throw new Error("Select blocks must use an object payload.");
  }
  let lastError = null;
  const parsers = [JSON.parse];
  if (json5?.parse) {
    parsers.push(json5.parse.bind(json5));
  }

  for (const source of sourceVariants) {
    for (const parse of parsers) {
      try {
        const parsed = parse(source);
        if (Array.isArray(parsed)) {
          return { options: parsed };
        }
        if (
          typeof parsed === "string" ||
          typeof parsed === "number" ||
          typeof parsed === "boolean"
        ) {
          return { options: [parsed] };
        }
        if (parsed && typeof parsed === "object") {
          return parsed;
        }
      } catch (error) {
        lastError = error;
      }
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
      return null;
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
    return null;
  }

  const label = firstNonEmpty(
    option.label,
    option.text,
    option.title,
    option.name,
    option.value,
    option.id,
    option.key,
    option.prompt,
    option.message,
  );
  if (!label) {
    return null;
  }

  const value = firstNonEmpty(
    option.value,
    option.id,
    option.key,
    label,
    `option-${index + 1}`,
  );
  if (!value) {
    return null;
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

function toOptionCandidates(rawOptions) {
  if (Array.isArray(rawOptions)) {
    return rawOptions;
  }

  if (typeof rawOptions === "string") {
    return rawOptions
      .split(/\r?\n|[;,，、]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  if (rawOptions && typeof rawOptions === "object") {
    return Object.entries(rawOptions).map(([key, value]) => {
      if (value && typeof value === "object" && !Array.isArray(value)) {
        return {
          value: firstNonEmpty(value.value, key),
          label: firstNonEmpty(
            value.label,
            value.text,
            value.title,
            value.name,
            key,
          ),
          description: firstNonEmpty(
            value.description,
            value.desc,
            value.hint,
            value.summary,
          ),
          prompt: firstNonEmpty(
            value.prompt,
            value.message,
            value.request,
            value.instruction,
          ),
          disabled: value.disabled === true,
        };
      }

      const scalarLabel = firstNonEmpty(value, key);
      return { value: key, label: scalarLabel || key };
    });
  }

  return [];
}

function resolveOptions(parsed) {
  const rawOptions =
    (Array.isArray(parsed) ? parsed : null) ??
    parsed?.options ??
    parsed?.choices ??
    parsed?.items ??
    parsed?.list ??
    parsed?.data;

  const candidates = toOptionCandidates(rawOptions);
  if (candidates.length === 0) {
    throw new Error("Select payload must include a non-empty options array.");
  }

  const options = [];
  const uniqueValues = new Set();

  for (let index = 0; index < candidates.length; index += 1) {
    const option = normalizeOption(candidates[index], index);
    if (!option) {
      continue;
    }
    const normalizedValue = normalizeAlias(option.value);
    if (!normalizedValue || uniqueValues.has(normalizedValue)) {
      continue;
    }
    uniqueValues.add(normalizedValue);
    options.push(option);
  }

  if (options.length === 0) {
    throw new Error("Select payload must include a non-empty options array.");
  }

  if (!options.some((option) => !option.disabled)) {
    options[0] = {
      ...options[0],
      disabled: false,
    };
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

  const normalized = normalizeParserWhitespace(text).toLowerCase();
  if (/\b(minselected|maxselected|defaultvalues|selectedvalues)\b/.test(normalized)) {
    return "multi";
  }
  if (/\b(defaultvalue|selectedvalue)\b/.test(normalized)) {
    return "single";
  }

  return "";
}

export function parseSelectPayload(raw, json5, mode) {
  const resolvedMode =
    mode === "single" || mode === "multi"
      ? mode
      : detectSelectMode(raw);
  const effectiveMode = resolvedMode || "single";

  const normalized = normalizeSelectSource(raw, effectiveMode);
  if (!normalized) {
    throw new Error("The select code block is empty.");
  }

  const parsed = parseStructuredInput(normalized, json5);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Select blocks must be an object payload.");
  }

  const options = resolveOptions(parsed);
  const payload = {
    kind: effectiveMode,
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

  if (effectiveMode === "single") {
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
