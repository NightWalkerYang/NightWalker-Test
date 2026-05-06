/**
 * @vitest-environment jsdom
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { showTransientFeedbackToast } from "../../../tools/openclaw-control-ui-echarts/runtime/tenant/feedback-toast.js";

afterEach(() => {
  document.body.innerHTML = "";
  document.head.innerHTML = "";
  vi.useRealTimers();
});

describe("feedback toast", () => {
  it("injects shared toast styles only once before rendering", () => {
    showTransientFeedbackToast(document.body, "第一次提示。");
    showTransientFeedbackToast(document.body, "第二次提示。", true);

    const styles = document.head.querySelectorAll("[data-oc-tenant-feedback-toast-style]");
    expect(styles).toHaveLength(1);
    expect(styles[0]?.textContent).toContain(".oc-tenant-feedback-toast-root");
    expect(document.body.querySelector("[data-oc-tenant-feedback-toast]")?.textContent).toContain(
      "第二次提示。",
    );
  });

  it("auto-dismisses the floating toast", () => {
    vi.useFakeTimers();

    showTransientFeedbackToast(document.body, "成员已禁用。");

    expect(document.body.querySelector("[data-oc-tenant-feedback-toast]")?.textContent).toContain(
      "成员已禁用。",
    );

    vi.advanceTimersByTime(1200);

    expect(document.body.querySelector("[data-oc-tenant-feedback-toast]")).toBeNull();
    expect(document.body.querySelector("[data-oc-tenant-feedback-toast-root]")).toBeNull();
  });
});
