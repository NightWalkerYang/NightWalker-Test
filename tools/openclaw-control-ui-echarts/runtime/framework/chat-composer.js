import { findChatComposerTextarea, findChatSendButton, isSendButtonElement } from "./dom-compat.js";
import { waitForFrame } from "./shared.js";

function sanitizeComposerText(value) {
  const normalized = String(value ?? "")
    .replace(/\r\n?/g, "\n")
    .normalize("NFC");

  let output = "";
  for (const char of normalized) {
    const code = char.charCodeAt(0);
    if (code === 9 || code === 10 || (code >= 32 && code !== 127)) {
      output += char;
    }
  }
  return output;
}

function findChatComposerElements() {
  const textarea = findChatComposerTextarea(document);
  const sendButton = findChatSendButton(document);
  return { textarea, sendButton };
}

function setComposerDraft(textarea, value) {
  const nextValue = sanitizeComposerText(value);
  const descriptor = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value");
  if (descriptor?.set) {
    descriptor.set.call(textarea, nextValue);
  } else {
    textarea.value = nextValue;
  }
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
  textarea.dispatchEvent(new Event("change", { bubbles: true }));
}

function isControlDisabled(control) {
  if (!(control instanceof HTMLElement)) {
    return true;
  }

  if ("disabled" in control && control.disabled) {
    return true;
  }

  if (control.getAttribute("aria-disabled") === "true") {
    return true;
  }

  return control.classList.contains("disabled");
}

function focusComposer(textarea) {
  textarea.focus();
  const end = textarea.value.length;
  try {
    textarea.setSelectionRange(end, end);
  } catch {
    // Ignore unsupported selection operations.
  }
}

export async function insertPromptIntoChatBox(promptText) {
  const { textarea } = findChatComposerElements();
  if (!(textarea instanceof HTMLTextAreaElement)) {
    return false;
  }

  const sanitizedPrompt = sanitizeComposerText(promptText);
  if (!sanitizedPrompt.trim()) {
    return false;
  }

  const current = textarea.value || "";
  const next = current.trim()
    ? `${current.replace(/\s+$/, "")}\n\n${sanitizedPrompt}`
    : sanitizedPrompt;
  setComposerDraft(textarea, next);
  focusComposer(textarea);
  await waitForFrame(1);
  return true;
}

export async function sendPromptToChat(promptText) {
  const { textarea } = findChatComposerElements();
  if (!(textarea instanceof HTMLTextAreaElement)) {
    return false;
  }

  const sanitizedPrompt = sanitizeComposerText(promptText);
  if (!sanitizedPrompt.trim()) {
    return false;
  }

  const previousDraft = textarea.value || "";
  setComposerDraft(textarea, sanitizedPrompt);
  focusComposer(textarea);
  await waitForFrame(2);

  const refreshed = findChatComposerElements();
  if (!isSendButtonElement(refreshed.sendButton) || isControlDisabled(refreshed.sendButton)) {
    setComposerDraft(
      textarea,
      previousDraft.trim()
        ? `${previousDraft.replace(/\s+$/, "")}\n\n${sanitizedPrompt}`
        : sanitizedPrompt,
    );
    focusComposer(textarea);
    return false;
  }

  refreshed.sendButton.click();

  if (previousDraft.trim()) {
    await new Promise((resolve) => setTimeout(resolve, 80));
    const latest = findChatComposerElements().textarea;
    if (latest instanceof HTMLTextAreaElement && !latest.value.trim()) {
      setComposerDraft(latest, previousDraft);
    }
  }

  return true;
}
