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

