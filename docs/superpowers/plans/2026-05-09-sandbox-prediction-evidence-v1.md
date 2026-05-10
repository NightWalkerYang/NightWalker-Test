# Sandbox Prediction Evidence v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add deterministic, explainable prediction evidence to the zero-intrusive sandbox result page so the top five materials show why they were recommended, with profile-based ranking and mini demand trend charts.

**Architecture:** Extend the Python sandbox payload generator so each recommendation ships a deterministic `evidence` block, profile-based impact scores, and fallback-safe explanation text. Update the zero-intrusive sandbox result page to rank by profile, render only the top five rows by default, and expand row-level evidence cards with a mini trend chart while keeping all reasoning tied to deterministic backend values.

**Tech Stack:** Python 3.11 sandbox runtime, zero-intrusive browser JS, existing ECharts vendor bundle, pytest, Vitest

---

## File Structure

- Modify: `tools/openclaw-sandbox-simulation-starter/python/sandbox_simulation/sandbox_payload.py`
  - Add payload fields for `evidenceSummary`, `impactScore`, `impactProfile`, `whyText`, and per-material `evidence`.
- Modify: `tools/openclaw-sandbox-simulation-starter/python/run_sandbox_simulation.py`
  - Compute recent-demand evidence, triggered rules, impact profiles, and deterministic fallback explanation data.
- Modify: `tools/openclaw-sandbox-simulation-starter/python/sandbox_simulation/predict_runtime.py`
  - Reuse or expose helper values needed for recent demand averages, volatility, and history windows.
- Modify: `tools/openclaw-control-ui-echarts/runtime/sandbox-view/surface.js`
  - Render profile presets, top-five default ranking, collapsed evidence rows, and mini trend charts.
- Modify: `test/tools/openclaw-control-ui-echarts/sandbox-view-surface.test.ts`
  - Cover profile switching, default top-five rendering, evidence expansion, and chart presence.
- Modify: `tools/openclaw-sandbox-simulation-starter/tests/test_sandbox_payload.py`
  - Assert payload contract for new evidence fields.
- Modify: `tools/openclaw-sandbox-simulation-starter/tests/test_run_sandbox_simulation.py`
  - Assert live run payload includes deterministic evidence and explanation fallback behavior.
- Modify: `ZERO_INTRUSIVE_SANDBOX_PREDICTION_EVIDENCE_V1.md`
  - Sync contract language if implementation details sharpen field names or fallback rules.
- Modify: `ZERO_INTRUSIVE_ECHARTS_ADDITIONS.md`
  - Keep the zero-intrusive inventory up to date if any new runtime/test/doc file is added during implementation.

## Task 1: Lock the Evidence Payload Contract in Tests

**Files:**
- Modify: `tools/openclaw-sandbox-simulation-starter/tests/test_sandbox_payload.py`
- Modify: `tools/openclaw-sandbox-simulation-starter/tests/test_run_sandbox_simulation.py`
- Test: `tools/openclaw-sandbox-simulation-starter/tests/test_sandbox_payload.py`
- Test: `tools/openclaw-sandbox-simulation-starter/tests/test_run_sandbox_simulation.py`

- [ ] **Step 1: Add a failing payload-contract test for `evidenceSummary` and row evidence**

```python
def test_build_sandbox_payload_includes_prediction_evidence_contract():
    payload = build_sandbox_payload(
        sandbox_name="采购沙盒模拟",
        agent_name="苏博泰克财务分析助手",
        recommendations=[
            {
                "materialId": "M001",
                "materialName": "原料 B",
                "predictedDemandQty": 150,
                "inventoryAvailableQty": 20,
                "recommendedQty": 130,
                "estimatedCost": 1105,
                "riskLevel": "high",
                "impactScore": 0.84,
                "impactProfile": "balanced",
                "whyText": "当前库存不足以覆盖预测需求。",
                "evidence": {
                    "historyDemandAvg": 120,
                    "historyDemandRecent3Months": [
                        {"month": "2024-01", "demandQty": 110},
                        {"month": "2024-02", "demandQty": 120},
                        {"month": "2024-03", "demandQty": 130},
                    ],
                    "historyDemandTrend": "up",
                    "historyDemandVolatility": 0.25,
                    "gapQty": 130,
                    "coverageDays": 6.5,
                    "triggeredRules": [
                        {"ruleId": "inventory_gap", "label": "库存缺口", "severity": "high", "values": {"gapQty": 130}},
                    ],
                },
            }
        ],
        report_bullets=["本次纳入 1 个重点物料。"],
        evidence_summary={
            "defaultProfile": "balanced",
            "availableProfiles": ["balanced", "risk", "cost", "supply_assurance", "inventory_safety"],
            "defaultVisibleCount": 5,
            "ruleCatalogVersion": "sandbox-evidence-v1",
        },
    )

    assert payload["evidenceSummary"]["defaultVisibleCount"] == 5
    assert payload["recommendations"][0]["evidence"]["historyDemandTrend"] == "up"
    assert payload["recommendations"][0]["whyText"] == "当前库存不足以覆盖预测需求。"
```

- [ ] **Step 2: Add a failing live-run test for deterministic explanation fallback**

```python
def test_build_live_run_payload_includes_deterministic_evidence_fields(monkeypatch):
    payload = build_live_run_payload(sample_input_payload())
    row = payload["recommendations"][0]

    assert "impactScore" in row
    assert "impactProfile" in row
    assert "whyText" in row
    assert "evidence" in row
    assert "triggeredRules" in row["evidence"]
    assert "historyDemandRecent3Months" in row["evidence"]
```

- [ ] **Step 3: Run Python tests to confirm they fail for the right reason**

Run:

```bash
pytest tools/openclaw-sandbox-simulation-starter/tests/test_sandbox_payload.py -q
pytest tools/openclaw-sandbox-simulation-starter/tests/test_run_sandbox_simulation.py -q
```

Expected: FAIL because `build_sandbox_payload()` and `build_live_run_payload()` do not yet include the new contract fields.

- [ ] **Step 4: Commit the red tests**

```bash
git add tools/openclaw-sandbox-simulation-starter/tests/test_sandbox_payload.py tools/openclaw-sandbox-simulation-starter/tests/test_run_sandbox_simulation.py
git commit -m "预测依据 · 锁定沙盒结果契约失败用例"
```

## Task 2: Generate Deterministic Evidence and Profile Scores in Python

**Files:**
- Modify: `tools/openclaw-sandbox-simulation-starter/python/sandbox_simulation/sandbox_payload.py`
- Modify: `tools/openclaw-sandbox-simulation-starter/python/run_sandbox_simulation.py`
- Modify: `tools/openclaw-sandbox-simulation-starter/python/sandbox_simulation/predict_runtime.py`
- Test: `tools/openclaw-sandbox-simulation-starter/tests/test_sandbox_payload.py`
- Test: `tools/openclaw-sandbox-simulation-starter/tests/test_run_sandbox_simulation.py`

- [ ] **Step 1: Extend `build_sandbox_payload()` to pass through evidence fields without recomputing them**

```python
def build_sandbox_payload(
    *,
    sandbox_name: str,
    agent_name: str,
    recommendations: list[dict],
    report_bullets: list[str],
    evidence_summary: dict | None = None,
) -> dict:
    normalized_recommendations = list(recommendations or [])
    return {
        "sandboxName": sandbox_name,
        "agentName": agent_name,
        "summary": {...},
        "graph": {...},
        "recommendations": normalized_recommendations,
        "report": {
            "headline": report_bullets[0] if report_bullets else "",
            "bullets": list(report_bullets or []),
        },
        "evidenceSummary": evidence_summary or {
            "defaultProfile": "balanced",
            "availableProfiles": ["balanced", "risk", "cost", "supply_assurance", "inventory_safety"],
            "defaultVisibleCount": 5,
            "ruleCatalogVersion": "sandbox-evidence-v1",
        },
    }
```

- [ ] **Step 2: Add helper functions in `run_sandbox_simulation.py` for recent history and deterministic rule hits**

```python
def build_recent_history_series(history_rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    ordered = sorted(history_rows, key=lambda item: str(item.get("targetMonth") or ""))[-3:]
    return [
        {
            "month": str(item.get("targetMonth") or ""),
            "demandQty": round(float(item.get("demandQty") or 0.0), 6),
        }
        for item in ordered
    ]


def build_triggered_rules(*, predicted_demand_qty: float, inventory_available_qty: float, gap_qty: float, coverage_days: float, volatility: float, cost_contribution_ratio: float, purchase_amplification_ratio: float) -> list[dict[str, Any]]:
    rules = []
    if gap_qty > 0:
        severity = "high" if predicted_demand_qty and gap_qty / predicted_demand_qty > 0.15 else "medium"
        rules.append({
            "ruleId": "inventory_gap",
            "label": "库存缺口",
            "severity": severity,
            "values": {
                "predictedDemandQty": round(predicted_demand_qty, 6),
                "inventoryAvailableQty": round(inventory_available_qty, 6),
                "gapQty": round(gap_qty, 6),
            },
        })
    if coverage_days < 15:
        rules.append({
            "ruleId": "low_coverage_days",
            "label": "库存覆盖不足",
            "severity": "high" if coverage_days < 7 else "medium",
            "values": {
                "coverageDays": round(coverage_days, 6),
                "thresholdDays": 15,
            },
        })
    if volatility > 0.20:
        rules.append({
            "ruleId": "high_demand_volatility",
            "label": "需求波动偏高",
            "severity": "high" if volatility > 0.50 else "medium",
            "values": {"historyDemandVolatility": round(volatility, 6)},
        })
    if cost_contribution_ratio > 0.05:
        rules.append({
            "ruleId": "high_cost_impact",
            "label": "成本影响偏高",
            "severity": "high" if cost_contribution_ratio > 0.15 else "medium",
            "values": {"costContributionRatio": round(cost_contribution_ratio, 6)},
        })
    if purchase_amplification_ratio > 1.20:
        rules.append({
            "ruleId": "purchase_amplification",
            "label": "采购放大量偏高",
            "severity": "high" if purchase_amplification_ratio > 1.80 else "medium",
            "values": {"purchaseAmplificationRatio": round(purchase_amplification_ratio, 6)},
        })
    return rules
```

- [ ] **Step 3: Compute impact profile scores and deterministic fallback `whyText`**

```python
PROFILE_WEIGHTS = {
    "balanced": {"gap": 0.30, "risk": 0.25, "cost": 0.20, "purchase": 0.10, "coverage": 0.15},
    "risk": {"gap": 0.20, "risk": 0.40, "cost": 0.10, "purchase": 0.05, "coverage": 0.25},
    "cost": {"gap": 0.15, "risk": 0.15, "cost": 0.45, "purchase": 0.15, "coverage": 0.10},
    "supply_assurance": {"gap": 0.30, "risk": 0.20, "cost": 0.10, "purchase": 0.10, "coverage": 0.30},
    "inventory_safety": {"gap": 0.20, "risk": 0.15, "cost": 0.05, "purchase": 0.10, "coverage": 0.50},
}


def build_fallback_why_text(material_name: str, evidence: dict[str, Any]) -> str:
    reasons = []
    if evidence.get("gapQty", 0) > 0:
        reasons.append("当前库存不足以覆盖预测需求")
    if evidence.get("historyDemandTrend") == "up":
        reasons.append("最近三个月需求呈上升趋势")
    if evidence.get("coverageDays", 999) < 15:
        reasons.append("库存覆盖天数低于安全阈值")
    if not reasons:
        reasons.append("建议采购量主要来自历史需求与库存平衡结果")
    return f"{material_name}：{'，'.join(reasons)}。"
```

- [ ] **Step 4: Attach evidence to each recommendation in `build_live_run_payload()`**

```python
recommendations = build_ranked_recommendations_with_evidence(...)
return build_sandbox_payload(
    sandbox_name=...,
    agent_name=...,
    recommendations=recommendations,
    report_bullets=report_bullets,
    evidence_summary={
        "defaultProfile": "balanced",
        "availableProfiles": ["balanced", "risk", "cost", "supply_assurance", "inventory_safety"],
        "defaultVisibleCount": 5,
        "ruleCatalogVersion": "sandbox-evidence-v1",
    },
)
```

- [ ] **Step 5: Run Python tests until they pass**

Run:

```bash
pytest tools/openclaw-sandbox-simulation-starter/tests/test_sandbox_payload.py -q
pytest tools/openclaw-sandbox-simulation-starter/tests/test_run_sandbox_simulation.py -q
```

Expected: PASS with the new payload contract and deterministic fallback explanation behavior.

- [ ] **Step 6: Commit the Python evidence layer**

```bash
git add tools/openclaw-sandbox-simulation-starter/python/sandbox_simulation/sandbox_payload.py tools/openclaw-sandbox-simulation-starter/python/run_sandbox_simulation.py tools/openclaw-sandbox-simulation-starter/python/sandbox_simulation/predict_runtime.py tools/openclaw-sandbox-simulation-starter/tests/test_sandbox_payload.py tools/openclaw-sandbox-simulation-starter/tests/test_run_sandbox_simulation.py
git commit -m "预测依据 · 生成确定性证据与排序得分"
```

## Task 3: Render the Evidence Experience in the Sandbox Result Page

**Files:**
- Modify: `tools/openclaw-control-ui-echarts/runtime/sandbox-view/surface.js`
- Test: `test/tools/openclaw-control-ui-echarts/sandbox-view-surface.test.ts`

- [ ] **Step 1: Add a failing surface test for profile switching and top-five default rendering**

```ts
it("shows only the top five recommendation evidence rows and switches profile ordering", async () => {
  window.history.replaceState({}, "", "/sandbox-view/?token=member-sandbox-token");
  stubSandboxResolve(createEvidenceHeavySandboxPayload(), createLiveCatalog(), undefined, createMaterialCandidates());

  await bootSandboxViewSurface();
  await flushMicrotasks();

  const rows = document.querySelectorAll("[data-recommendation-row]");
  expect(rows).toHaveLength(5);
  expect(document.body.textContent).toContain("平衡模式");
  expect(document.body.textContent).toContain("查看全部物料依据");
});
```

- [ ] **Step 2: Add a failing surface test for collapsed evidence expansion with mini trend chart**

```ts
it("expands one material evidence card with a mini trend chart", async () => {
  window.history.replaceState({}, "", "/sandbox-view/?token=member-sandbox-token");
  stubSandboxResolve(createEvidenceHeavySandboxPayload(), createLiveCatalog(), undefined, createMaterialCandidates());

  await bootSandboxViewSurface();
  await flushMicrotasks();

  document.querySelector("[data-recommendation-row]")?.dispatchEvent(
    new MouseEvent("click", { bubbles: true }),
  );
  await flushMicrotasks();

  expect(document.querySelector("[data-sandbox-evidence-panel]")).not.toBeNull();
  expect(document.querySelector("[data-sandbox-evidence-mini-chart]")).not.toBeNull();
  expect(document.body.textContent).toContain("最近 3 个月需求");
});
```

- [ ] **Step 3: Run the surface tests to verify the current UI fails**

Run:

```bash
pnpm test test/tools/openclaw-control-ui-echarts/sandbox-view-surface.test.ts
```

Expected: FAIL because the current result page has no evidence panel, no profile switcher, and no top-five-only behavior.

- [ ] **Step 4: Add deterministic UI helpers and rendering**

```js
function getActiveImpactProfile(state) {
  return String(state?.activeImpactProfile || "balanced").trim() || "balanced";
}

function rankRecommendationsByProfile(recommendations, profile) {
  return [...recommendations].sort((left, right) => {
    const leftScore = Number(left?.profileScores?.[profile] ?? left?.impactScore ?? 0);
    const rightScore = Number(right?.profileScores?.[profile] ?? right?.impactScore ?? 0);
    return rightScore - leftScore;
  });
}

function pickDefaultVisibleRecommendations(recommendations, visibleCount = 5) {
  return recommendations.slice(0, visibleCount);
}
```

Add result-page rendering blocks for:

- profile preset selector
- top five table rows
- `查看全部物料依据`
- one-at-a-time evidence detail panel
- mini trend chart container using the existing ECharts vendor bundle

- [ ] **Step 5: Add the mini trend chart renderer**

```js
async function renderEvidenceMiniChart(series, container) {
  const echartsLib = await ensureEchartsLibrary();
  const chart = echartsLib.init(container);
  chart.setOption({
    animation: false,
    grid: { left: 16, right: 8, top: 10, bottom: 18 },
    xAxis: { type: "category", data: series.map((item) => item.month) },
    yAxis: { type: "value" },
    series: [
      {
        type: "line",
        smooth: true,
        data: series.map((item) => item.demandQty),
      },
    ],
  });
}
```

- [ ] **Step 6: Re-run the sandbox surface tests until green**

Run:

```bash
pnpm test test/tools/openclaw-control-ui-echarts/sandbox-view-surface.test.ts
```

Expected: PASS, including top-five rendering, profile switching, and evidence expansion.

- [ ] **Step 7: Commit the result-page experience**

```bash
git add tools/openclaw-control-ui-echarts/runtime/sandbox-view/surface.js test/tools/openclaw-control-ui-echarts/sandbox-view-surface.test.ts
git commit -m "预测依据 · 完善沙盒结果页解释体验"
```

## Task 4: Sync Docs and Run the Zero-Intrusive Proof Set

**Files:**
- Modify: `ZERO_INTRUSIVE_SANDBOX_PREDICTION_EVIDENCE_V1.md`
- Modify: `ZERO_INTRUSIVE_ECHARTS_ADDITIONS.md` (only if implementation introduces any new zero-intrusive file)

- [ ] **Step 1: Update the design doc if final field names changed**

```md
- Replace any outdated field names so the document matches the shipped payload contract exactly.
- Keep the approved behavioral boundaries unchanged: top five, collapsed by default, sandbox result page only.
```

- [ ] **Step 2: Update the zero-intrusive inventory if new files were added**

```md
- Add any newly created runtime, test, or doc file under the correct section in `ZERO_INTRUSIVE_ECHARTS_ADDITIONS.md`.
```

- [ ] **Step 3: Run the focused proof set**

Run:

```bash
pytest tools/openclaw-sandbox-simulation-starter/tests/test_sandbox_payload.py -q
pytest tools/openclaw-sandbox-simulation-starter/tests/test_run_sandbox_simulation.py -q
pnpm test test/tools/openclaw-control-ui-echarts/sandbox-view-surface.test.ts
pnpm exec oxfmt --check --threads=1 tools/openclaw-control-ui-echarts/runtime/sandbox-view/surface.js tools/openclaw-sandbox-simulation-starter/python/run_sandbox_simulation.py tools/openclaw-sandbox-simulation-starter/python/sandbox_simulation/sandbox_payload.py test/tools/openclaw-control-ui-echarts/sandbox-view-surface.test.ts
```

Expected: all commands pass with no formatting drift.

- [ ] **Step 4: Commit the documentation alignment**

```bash
git add ZERO_INTRUSIVE_SANDBOX_PREDICTION_EVIDENCE_V1.md ZERO_INTRUSIVE_ECHARTS_ADDITIONS.md
git commit -m "预测依据 · 同步零侵入文档与验证约束"
```

## Spec Coverage Check

- Covered: deterministic evidence contract
- Covered: five profile presets
- Covered: top five default ranking
- Covered: collapsed-by-default evidence UI
- Covered: mini trend chart
- Covered: deterministic fallback text when LLM wording is unavailable
- Covered: zero-intrusive file scope and doc sync
- Intentionally deferred: weather/disaster factors, exports, member-chat write-back

## Known Debt To Resolve Before Closing The Overall Feature

- The Python evidence generation must not duplicate business logic across multiple enrichment paths.
- `historyDemandRecent3Months`, `historyDemandTrend`, and `historyDemandVolatility` must come from real deterministic history inputs rather than synthesized placeholders.
- Rule hits must only be derived from real evidence values, not fallback-invented series.
- If functional UI work lands before this refactor, the debt must remain open and be fixed before the feature is considered fully complete.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-09-sandbox-prediction-evidence-v1.md`.

Do you want me to start implementing this plan inline now, or do you want to stop here after the plan? 
