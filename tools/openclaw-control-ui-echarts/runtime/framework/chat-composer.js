import { waitForFrame } from "./shared.js";

function findChatComposerElements() {
  const textarea = document.querySelector(".agent-chat__input > textarea");
  const sendButton = Array.from(
    document.querySelectorAll(".agent-chat__toolbar-right .chat-send-btn"),
  ).find((button) => !button.classList.contains("chat-send-btn--stop"));
  return { textarea, sendButton };
}

function setComposerDraft(textarea, value) {
  const descriptor = Object.getOwnPropertyDescriptor(
    window.HTMLTextAreaElement.prototype,
    "value",
  );
  if (descriptor?.set) {
    descriptor.set.call(textarea, value);
  } else {
    textarea.value = value;
  }
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
  textarea.dispatchEvent(new Event("change", { bubbles: true }));
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

  const current = textarea.value || "";
  const next = current.trim()
    ? `${current.replace(/\s+$/, "")}\n\n${promptText}`
    : promptText;
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

  const previousDraft = textarea.value || "";
  setComposerDraft(textarea, promptText);
  focusComposer(textarea);
  await waitForFrame(2);

  const refreshed = findChatComposerElements();
  if (
    !(refreshed.sendButton instanceof HTMLButtonElement) ||
    refreshed.sendButton.disabled
  ) {
    setComposerDraft(
      textarea,
      previousDraft.trim()
        ? `${previousDraft.replace(/\s+$/, "")}\n\n${promptText}`
        : promptText,
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
