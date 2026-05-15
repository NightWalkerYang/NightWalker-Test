import { findChatComposerTextarea } from "../framework/dom-compat.js";

function normalizePromptText(value) {
  return String(value ?? "")
    .replace(/\r\n?/g, "\n")
    .trim();
}

function setTextareaValue(textarea, value) {
  const descriptor = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value");
  if (descriptor?.set) {
    descriptor.set.call(textarea, value);
    return;
  }
  textarea.value = value;
}

function normalizeAnnotationText(annotation) {
  return normalizePromptText(
    annotation?.thread?.[0]?.text || annotation?.text || annotation?.content || annotation?.message || "",
  );
}

export function formatSingleAnnotationPrompt(annotation) {
  const text = normalizeAnnotationText(annotation);
  return text ? `请处理这条标注反馈：${text}` : "";
}

export function formatMultiAnnotationPrompt(annotations) {
  const unresolved = Array.isArray(annotations)
    ? annotations.filter((annotation) => String(annotation?.status || "open").trim() !== "resolved")
    : [];
  const lines = unresolved
    .map((annotation) => normalizeAnnotationText(annotation))
    .filter(Boolean)
    .map((text, index) => `${index + 1}. ${text}`);
  return lines.length > 0 ? ["请一起处理这些未解决的标注反馈：", ...lines].join("\n") : "";
}

export function backfillChatComposerPrompt(prompt, root = document) {
  const textarea = findChatComposerTextarea(root);
  const nextPrompt = normalizePromptText(prompt);
  if (!(textarea instanceof HTMLTextAreaElement) || !nextPrompt) {
    return false;
  }
  setTextareaValue(textarea, nextPrompt);
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
  textarea.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
}
