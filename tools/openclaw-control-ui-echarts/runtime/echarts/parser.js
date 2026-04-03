import { escapeHtml, normalizeText } from "../framework/shared.js";

export const ECHARTS_LANGUAGE_ALIASES = new Set([
  "echarts",
  "echart",
  "chart",
  "echarts-option",
  "echartsoption",
]);

const JS_PLACEHOLDER_PREFIX = "__OC_ECHARTS_JS__";

function normalizeOptionSource(raw) {
  let text = normalizeText(raw);
  if (!text) {
    return text;
  }

  text = text
    .replace(/^```[a-z0-9_-]*\s*\n/i, "")
    .replace(/\n```$/i, "")
    .trim();

  const wrappers = [
    /^(?:const|let|var)\s+option\s*=\s*/i,
    /^option\s*=\s*/i,
    /^return\s+/i,
    /^export\s+default\s+/i,
  ];

  for (const pattern of wrappers) {
    if (pattern.test(text)) {
      text = text.replace(pattern, "").trim();
    }
  }

  text = text.replace(/;\s*$/, "").trim();

  if (text.startsWith("(") && text.endsWith(")")) {
    const inner = text.slice(1, -1).trim();
    if (inner.startsWith("{") && inner.endsWith("}")) {
      text = inner;
    }
  }

  return text;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function unwrapParsedPayload(parsed) {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("ECharts option must be an object literal.");
  }

  const heightOverride =
    typeof parsed.height === "number" && Number.isFinite(parsed.height)
      ? clamp(parsed.height, 280, 960)
      : null;

  if (
    parsed.option &&
    typeof parsed.option === "object" &&
    !Array.isArray(parsed.option) &&
    Object.keys(parsed).every((key) => key === "option" || key === "height")
  ) {
    return { option: parsed.option, heightOverride };
  }

  return { option: parsed, heightOverride };
}

function wrapBareObjectLiteral(source) {
  const trimmed = source.trim();
  if (!trimmed) {
    return trimmed;
  }

  if (trimmed.startsWith("{")) {
    return trimmed;
  }

  return `{\n${trimmed}\n}`;
}

function isIdentifierStart(char) {
  return /^[A-Za-z_$]$/.test(char || "");
}

function isIdentifierChar(char) {
  return /^[A-Za-z0-9_$]$/.test(char || "");
}

function skipWhitespace(source, index) {
  let cursor = index;
  while (cursor < source.length && /\s/.test(source[cursor])) {
    cursor += 1;
  }
  return cursor;
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
    throw new Error("Unterminated block comment in echarts block.");
  }
  return endIndex + 2;
}

function scanTemplateLiteral(source, start) {
  let cursor = start + 1;
  while (cursor < source.length) {
    const char = source[cursor];
    if (char === "\\") {
      cursor += 2;
      continue;
    }
    if (char === "`") {
      return cursor + 1;
    }
    if (char === "$" && source[cursor + 1] === "{") {
      cursor = scanBalanced(source, cursor + 1, "{", "}");
      continue;
    }
    cursor += 1;
  }
  throw new Error("Unterminated template literal in echarts block.");
}

function scanQuotedString(source, start, quote) {
  if (quote === "`") {
    return scanTemplateLiteral(source, start);
  }

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
  throw new Error("Unterminated string literal in echarts block.");
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

  throw new Error(`Unterminated ${openChar}${closeChar} pair in echarts block.`);
}

function scanFunctionExpression(source, start) {
  let cursor = start + "function".length;
  cursor = skipWhitespace(source, cursor);

  if (source[cursor] === "*") {
    cursor += 1;
    cursor = skipWhitespace(source, cursor);
  }

  if (isIdentifierStart(source[cursor])) {
    cursor += 1;
    while (cursor < source.length && isIdentifierChar(source[cursor])) {
      cursor += 1;
    }
    cursor = skipWhitespace(source, cursor);
  }

  if (source[cursor] !== "(") {
    throw new Error("Unsupported function syntax in echarts block.");
  }
  cursor = scanBalanced(source, cursor, "(", ")");
  cursor = skipWhitespace(source, cursor);

  if (source[cursor] !== "{") {
    throw new Error("Unsupported function body syntax in echarts block.");
  }
  return scanBalanced(source, cursor, "{", "}");
}

function scanGraphicConstructor(source, start) {
  const prefix = "new echarts.graphic.";
  let cursor = start + prefix.length;

  if (!isIdentifierStart(source[cursor])) {
    throw new Error("Unsupported echarts.graphic constructor in echarts block.");
  }

  cursor += 1;
  while (cursor < source.length && isIdentifierChar(source[cursor])) {
    cursor += 1;
  }
  cursor = skipWhitespace(source, cursor);

  if (source[cursor] !== "(") {
    throw new Error("Unsupported echarts.graphic constructor call in echarts block.");
  }

  return scanBalanced(source, cursor, "(", ")");
}

function createJsPlaceholder(index) {
  return `${JS_PLACEHOLDER_PREFIX}${index}__`;
}

function scanSupportedArrayExpression(source, start) {
  if (source[start] !== "[") {
    return null;
  }

  let cursor = scanBalanced(source, start, "[", "]");
  let matched = false;

  while (cursor < source.length) {
    let nextCursor = skipWhitespace(source, cursor);
    if (source[nextCursor] !== ".") {
      break;
    }

    nextCursor += 1;
    const nameStart = nextCursor;
    if (!isIdentifierStart(source[nextCursor])) {
      break;
    }

    nextCursor += 1;
    while (nextCursor < source.length && isIdentifierChar(source[nextCursor])) {
      nextCursor += 1;
    }

    const methodName = source.slice(nameStart, nextCursor);
    nextCursor = skipWhitespace(source, nextCursor);
    if (source[nextCursor] !== "(") {
      break;
    }

    const callEnd = scanBalanced(source, nextCursor, "(", ")");
    const argsSource = source.slice(nextCursor + 1, callEnd - 1).trim();
    if (methodName !== "reverse" || argsSource) {
      break;
    }

    cursor = callEnd;
    matched = true;
  }

  return matched ? cursor : null;
}

function extractJsOnlyConstructs(source) {
  let result = "";
  let cursor = 0;
  const placeholders = new Map();

  while (cursor < source.length) {
    const char = source[cursor];
    const next = source[cursor + 1];

    if (char === "'" || char === '"' || char === "`") {
      const endIndex = scanQuotedString(source, cursor, char);
      result += source.slice(cursor, endIndex);
      cursor = endIndex;
      continue;
    }

    if (char === "/" && next === "/") {
      const endIndex = scanLineComment(source, cursor);
      result += source.slice(cursor, endIndex);
      cursor = endIndex;
      continue;
    }

    if (char === "/" && next === "*") {
      const endIndex = scanBlockComment(source, cursor);
      result += source.slice(cursor, endIndex);
      cursor = endIndex;
      continue;
    }

    if (
      source.startsWith("function", cursor) &&
      !isIdentifierChar(source[cursor - 1]) &&
      !isIdentifierChar(source[cursor + "function".length])
    ) {
      const endIndex = scanFunctionExpression(source, cursor);
      const token = createJsPlaceholder(placeholders.size);
      placeholders.set(token, {
        type: "function",
        source: source.slice(cursor, endIndex),
      });
      result += JSON.stringify(token);
      cursor = endIndex;
      continue;
    }

    if (source.startsWith("new echarts.graphic.", cursor)) {
      const endIndex = scanGraphicConstructor(source, cursor);
      const token = createJsPlaceholder(placeholders.size);
      placeholders.set(token, {
        type: "graphic-constructor",
        source: source.slice(cursor, endIndex),
      });
      result += JSON.stringify(token);
      cursor = endIndex;
      continue;
    }

    if (char === "[") {
      const endIndex = scanSupportedArrayExpression(source, cursor);
      if (endIndex !== null) {
        const token = createJsPlaceholder(placeholders.size);
        placeholders.set(token, {
          type: "expression",
          source: source.slice(cursor, endIndex),
        });
        result += JSON.stringify(token);
        cursor = endIndex;
        continue;
      }
    }

    result += char;
    cursor += 1;
  }

  return { sanitizedSource: result, placeholders };
}

function countLeadingIndent(text) {
  let indent = 0;
  while (indent < text.length && /\s/.test(text[indent])) {
    indent += 1;
  }
  return indent;
}

function looksLikePropertyLine(text) {
  return /^(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[A-Za-z_$][\w$-]*)\s*:/.test(text);
}

function matchingCloserFor(openChar) {
  if (openChar === "{") {
    return "}";
  }
  if (openChar === "[") {
    return "]";
  }
  return "";
}

function findNextSignificantTrimmedLine(lines, startIndex) {
  for (let index = startIndex; index < lines.length; index += 1) {
    const trimmed = lines[index].trimStart();
    if (trimmed) {
      return trimmed;
    }
  }
  return "";
}

function popInlineClosers(stack, currentIndent, lineIndex) {
  let closers = "";

  while (stack.length > 0) {
    const top = stack[stack.length - 1];
    if (top.kind === "(" || top.indent < currentIndent || top.lineIndex > lineIndex) {
      break;
    }

    const closer = matchingCloserFor(top.kind);
    if (!closer) {
      break;
    }

    closers += closer;
    stack.pop();
  }

  return closers;
}

function repairLikelyMissingClosers(source) {
  const lines = source.split("\n");
  const repairedLines = [];
  const stack = [];
  let changed = false;

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const rawLine = lines[lineIndex];
    const trimmedStart = rawLine.trimStart();
    const indent = countLeadingIndent(rawLine);

    if (trimmedStart && looksLikePropertyLine(trimmedStart)) {
      let closers = "";
      while (stack.length > 0) {
        const top = stack[stack.length - 1];
        if (top.lineIndex === lineIndex || !top.openedAfterColon || top.indent < indent) {
          break;
        }
        const closer = matchingCloserFor(top.kind);
        if (!closer) {
          break;
        }
        closers += closer;
        stack.pop();
      }

      if (closers) {
        repairedLines.push(`${" ".repeat(indent)}${closers},`);
        changed = true;
      }
    }

    let cursor = 0;
    let repairedLine = "";
    let lastSignificantChar = "";

    while (cursor < rawLine.length) {
      const char = rawLine[cursor];
      const next = rawLine[cursor + 1];

      if (char === "'" || char === '"' || char === "`") {
        const endIndex = scanQuotedString(rawLine, cursor, char);
        repairedLine += rawLine.slice(cursor, endIndex);
        lastSignificantChar = char;
        cursor = endIndex;
        continue;
      }

      if (char === "/" && next === "/") {
        repairedLine += rawLine.slice(cursor);
        cursor = rawLine.length;
        continue;
      }

      if (char === "/" && next === "*") {
        const endIndex = scanBlockComment(rawLine, cursor);
        repairedLine += rawLine.slice(cursor, endIndex);
        cursor = endIndex;
        continue;
      }

      if (char === "{" || char === "[" || char === "(") {
        stack.push({
          kind: char,
          indent,
          lineIndex,
          openedAfterColon: lastSignificantChar === ":",
        });
        repairedLine += char;
        lastSignificantChar = char;
        cursor += 1;
        continue;
      }

      if (char === "}" || char === "]" || char === ")") {
        while (stack.length > 0) {
          const top = stack[stack.length - 1];
          const expectedCloser = matchingCloserFor(top.kind) || (top.kind === "(" ? ")" : "");
          if (expectedCloser === char) {
            stack.pop();
            break;
          }

          if (!expectedCloser) {
            break;
          }

          repairedLine += expectedCloser;
          stack.pop();
          changed = true;
        }

        repairedLine += char;
        lastSignificantChar = char;
        cursor += 1;
        continue;
      }

      repairedLine += char;
      if (!/\s/.test(char)) {
        lastSignificantChar = char;
      }
      cursor += 1;
    }

    const nextTrimmed = findNextSignificantTrimmedLine(lines, lineIndex + 1);
    const shouldCloseBeforeSibling =
      /,\s*$/.test(repairedLine) && /^[{\[]/.test(nextTrimmed);
    const shouldCloseBeforeContainerEnd = /^[\]}]/.test(nextTrimmed);

    if (shouldCloseBeforeSibling || shouldCloseBeforeContainerEnd) {
      const closers = popInlineClosers(stack, indent, lineIndex);
      if (closers) {
        if (shouldCloseBeforeSibling) {
          repairedLine = repairedLine.replace(/,\s*$/, `${closers},`);
        } else {
          repairedLine += closers;
        }
        changed = true;
      }
    }

    repairedLines.push(repairedLine);
  }

  let trailingClosers = "";
  while (stack.length > 0) {
    const top = stack.pop();
    const closer = matchingCloserFor(top.kind);
    if (!closer) {
      continue;
    }
    trailingClosers += closer;
    changed = true;
  }

  if (trailingClosers) {
    repairedLines.push(trailingClosers);
  }

  return changed ? repairedLines.join("\n") : source;
}

function splitTopLevelCommaSeparated(source) {
  const parts = [];
  let start = 0;
  let cursor = 0;
  let parenDepth = 0;
  let braceDepth = 0;
  let bracketDepth = 0;

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

    if (char === "(") {
      parenDepth += 1;
    } else if (char === ")") {
      parenDepth -= 1;
    } else if (char === "{") {
      braceDepth += 1;
    } else if (char === "}") {
      braceDepth -= 1;
    } else if (char === "[") {
      bracketDepth += 1;
    } else if (char === "]") {
      bracketDepth -= 1;
    } else if (
      char === "," &&
      parenDepth === 0 &&
      braceDepth === 0 &&
      bracketDepth === 0
    ) {
      const part = source.slice(start, cursor).trim();
      if (part) {
        parts.push(part);
      }
      start = cursor + 1;
    }

    cursor += 1;
  }

  const tail = source.slice(start).trim();
  if (tail) {
    parts.push(tail);
  }
  return parts;
}

function buildGenericTooltipFormatter() {
  return function genericTooltipFormatter(params) {
    const rows = Array.isArray(params) ? params : [params];
    const visibleRows = rows.filter(Boolean);
    if (visibleRows.length === 0) {
      return "";
    }

    const title =
      visibleRows[0].axisValueLabel ??
      visibleRows[0].axisValue ??
      visibleRows[0].name ??
      "";
    const body = visibleRows
      .map((row) => {
        const marker = typeof row.marker === "string" ? row.marker : "";
        const label = row.seriesName ?? row.name ?? "";
        let value = row.value;
        if (Array.isArray(value)) {
          value = value.join(", ");
        }
        return `${marker}${escapeHtml(String(label))}: ${escapeHtml(String(value ?? ""))}`;
      })
      .join("<br/>");

    return title ? `${escapeHtml(String(title))}<br/>${body}` : body;
  };
}

function compileSimpleFunctionFallback(source, path) {
  const propertyName = String(path[path.length - 1] ?? "");

  if (propertyName === "formatter") {
    return buildGenericTooltipFormatter();
  }

  if (propertyName !== "symbolSize") {
    return undefined;
  }

  const directPattern =
    /^function(?:\s+\w+)?\s*\(\s*([A-Za-z_$][\w$]*)\s*\)\s*\{\s*return\s+\(?\s*\1\s*\[\s*(\d+)\s*\]\s*([*\/+\-])\s*(-?\d+(?:\.\d+)?)\s*\)?\s*;?\s*\}$/s;
  const inversePattern =
    /^function(?:\s+\w+)?\s*\(\s*([A-Za-z_$][\w$]*)\s*\)\s*\{\s*return\s+\(?\s*(-?\d+(?:\.\d+)?)\s*([*\/+\-])\s*\1\s*\[\s*(\d+)\s*\]\s*\)?\s*;?\s*\}$/s;

  let match = source.match(directPattern);
  let inverse = false;
  if (!match) {
    match = source.match(inversePattern);
    inverse = true;
  }
  if (!match) {
    return undefined;
  }

  const index = Number(inverse ? match[4] : match[2]);
  const operator = match[3];
  const scalar = Number(inverse ? match[2] : match[4]);

  return function compiledSymbolSize(value) {
    const sample = Array.isArray(value) ? Number(value[index]) : Number.NaN;
    if (!Number.isFinite(sample)) {
      return undefined;
    }

    switch (operator) {
      case "*":
        return inverse ? scalar * sample : sample * scalar;
      case "/":
        return inverse ? scalar / sample : sample / scalar;
      case "+":
        return inverse ? scalar + sample : sample + scalar;
      case "-":
        return inverse ? scalar - sample : sample - scalar;
      default:
        return undefined;
    }
  };
}

function parseLooseJsValue(source, json5, echarts) {
  const trimmed = source.trim();
  if (!trimmed) {
    return undefined;
  }

  const { sanitizedSource, placeholders } = extractJsOnlyConstructs(trimmed);
  let parsedValue;
  try {
    parsedValue = json5.parse(sanitizedSource);
  } catch (error) {
    const detail =
      error && typeof error.message === "string"
        ? error.message
        : String(error || "Unknown error");
    throw new Error(`Could not parse JavaScript-style ECharts value. ${detail}`);
  }

  return reviveJsPlaceholders(parsedValue, placeholders, echarts, json5, []);
}

function materializeSimpleExpression(source, json5, echarts) {
  const trimmed = source.trim();
  const literalEnd = scanBalanced(trimmed, 0, "[", "]");
  const literalSource = trimmed.slice(0, literalEnd);
  let cursor = literalEnd;
  const operations = [];

  while (cursor < trimmed.length) {
    cursor = skipWhitespace(trimmed, cursor);
    if (trimmed[cursor] !== ".") {
      break;
    }

    cursor += 1;
    const nameStart = cursor;
    while (cursor < trimmed.length && isIdentifierChar(trimmed[cursor])) {
      cursor += 1;
    }
    const methodName = trimmed.slice(nameStart, cursor);
    cursor = skipWhitespace(trimmed, cursor);
    if (trimmed[cursor] !== "(") {
      break;
    }

    const callEnd = scanBalanced(trimmed, cursor, "(", ")");
    const argsSource = trimmed.slice(cursor + 1, callEnd - 1).trim();
    if (methodName !== "reverse" || argsSource) {
      break;
    }

    operations.push(methodName);
    cursor = callEnd;
  }

  let value = parseLooseJsValue(literalSource, json5, echarts);
  for (const methodName of operations) {
    if (methodName === "reverse" && Array.isArray(value)) {
      value = [...value].reverse();
    }
  }
  return value;
}

function materializeGraphicConstructor(source, echarts, json5) {
  const prefix = "new echarts.graphic.";
  if (!source.startsWith(prefix)) {
    throw new Error("Unsupported echarts.graphic constructor.");
  }

  let cursor = prefix.length;
  while (cursor < source.length && isIdentifierChar(source[cursor])) {
    cursor += 1;
  }

  const constructorName = source.slice(prefix.length, cursor);
  cursor = skipWhitespace(source, cursor);
  if (!constructorName || source[cursor] !== "(") {
    throw new Error("Unsupported echarts.graphic constructor syntax.");
  }

  const endIndex = scanBalanced(source, cursor, "(", ")");
  const argsSource = source.slice(cursor + 1, endIndex - 1);
  const ctor = echarts?.graphic?.[constructorName];
  if (typeof ctor !== "function") {
    throw new Error(`echarts.graphic.${constructorName} is unavailable.`);
  }

  const args = splitTopLevelCommaSeparated(argsSource).map((part) =>
    parseLooseJsValue(part, json5, echarts),
  );
  return new ctor(...args);
}

function reviveJsPlaceholders(value, placeholders, echarts, json5, path) {
  if (Array.isArray(value)) {
    return value.map((item, index) =>
      reviveJsPlaceholders(item, placeholders, echarts, json5, [...path, index]),
    );
  }

  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      const revived = reviveJsPlaceholders(child, placeholders, echarts, json5, [
        ...path,
        key,
      ]);
      if (typeof revived === "undefined") {
        delete value[key];
        continue;
      }
      value[key] = revived;
    }
    return value;
  }

  if (typeof value !== "string") {
    return value;
  }

  const placeholder = placeholders.get(value);
  if (!placeholder) {
    return value;
  }

  if (placeholder.type === "function") {
    return compileSimpleFunctionFallback(placeholder.source, path);
  }
  if (placeholder.type === "expression") {
    return materializeSimpleExpression(placeholder.source, json5, echarts);
  }
  if (placeholder.type === "graphic-constructor") {
    return materializeGraphicConstructor(placeholder.source, echarts, json5);
  }
  return value;
}

export function parseEchartsPayload(raw, json5, echarts) {
  const normalized = normalizeOptionSource(raw);
  if (!normalized) {
    throw new Error("The echarts code block is empty.");
  }

  const preparedSource = wrapBareObjectLiteral(normalized);
  const { sanitizedSource, placeholders } = extractJsOnlyConstructs(preparedSource);
  const repairedSource = repairLikelyMissingClosers(sanitizedSource);
  const sourceVariants =
    repairedSource === sanitizedSource ? [sanitizedSource] : [sanitizedSource, repairedSource];

  let lastError = null;
  for (const candidateSource of sourceVariants) {
    const parsers = [() => JSON.parse(candidateSource), () => json5.parse(candidateSource)];
    for (const parse of parsers) {
      try {
        const payload = unwrapParsedPayload(parse());
        payload.option = reviveJsPlaceholders(payload.option, placeholders, echarts, json5, []);
        return payload;
      } catch (error) {
        lastError = error;
      }
    }
  }

  const detail =
    lastError && typeof lastError.message === "string"
      ? lastError.message
      : String(lastError);
  throw new Error(`Could not parse the echarts block. ${detail}`);
}

export function resolveChartHeight(payload) {
  if (payload.heightOverride !== null) {
    return payload.heightOverride;
  }

  const option = payload.option;
  if (Array.isArray(option.grid) && option.grid.length > 1) {
    return clamp(260 + option.grid.length * 120, 320, 960);
  }

  if (Array.isArray(option.series) && option.series.length >= 8) {
    return 520;
  }

  return 420;
}

export function localizeErrorMessage(detail) {
  let message = normalizeText(detail);
  if (!message) {
    return "未知错误。";
  }

  const exactMessages = new Map([
    ["The echarts code block is empty.", "图表代码块为空。"],
    ["ECharts option must be an object literal.", "图表配置必须是对象字面量。"],
    ["Unterminated block comment in echarts block.", "图表代码块中的块注释未闭合。"],
    ["Unterminated template literal in echarts block.", "图表代码块中的模板字符串未闭合。"],
    ["Unterminated string literal in echarts block.", "图表代码块中的字符串未闭合。"],
    ["Unsupported function syntax in echarts block.", "图表代码块中的函数语法暂不支持。"],
    ["Unsupported function body syntax in echarts block.", "图表代码块中的函数体语法暂不支持。"],
    [
      "Unsupported echarts.graphic constructor in echarts block.",
      "图表代码块中的图形渐变构造器暂不支持。",
    ],
    [
      "Unsupported echarts.graphic constructor call in echarts block.",
      "图表代码块中的图形渐变调用暂不支持。",
    ],
    ["Unsupported echarts.graphic constructor.", "不支持的图形渐变构造器。"],
    ["Unsupported echarts.graphic constructor syntax.", "不支持的图形渐变构造语法。"],
  ]);

  if (exactMessages.has(message)) {
    return exactMessages.get(message);
  }

  const transforms = [
    {
      pattern: /^Could not parse the echarts block\.\s*/i,
      replace: "无法解析图表代码块。",
    },
    {
      pattern: /^Could not parse JavaScript-style ECharts value\.\s*/i,
      replace: "无法解析 JavaScript 风格的图表配置值。",
    },
    { pattern: /^JSON5:\s*/i, replace: "JSON5 解析错误：" },
    {
      pattern: /^Loaded .+ but window\.(\w+) is unavailable\.?$/i,
      replace: (_, globalName) => `资源已加载，但 window.${globalName} 不可用。`,
    },
    {
      pattern: /^Failed to load (.+)$/i,
      replace: (_, url) => `资源加载失败：${url}`,
    },
    {
      pattern: /^echarts\.graphic\.(\w+) is unavailable\.?$/i,
      replace: (_, constructorName) =>
        `当前图表运行时不支持 ${constructorName} 渐变构造器。`,
    },
    {
      pattern: /^Unterminated ([^\s]+) pair in echarts block\.?$/i,
      replace: (_, pair) => `图表代码块中的 ${pair} 结构未闭合。`,
    },
  ];

  for (const { pattern, replace } of transforms) {
    if (pattern.test(message)) {
      message = message.replace(pattern, replace);
    }
  }

  message = message
    .replace(/Functions are intentionally not supported\./gi, "出于安全考虑，不支持直接执行函数。")
    .replace(/Unknown error/gi, "未知错误");

  return /[A-Za-z]/.test(message)
    ? "请检查图表配置是否完整，确认括号、引号和代码块都已闭合。"
    : message;
}
