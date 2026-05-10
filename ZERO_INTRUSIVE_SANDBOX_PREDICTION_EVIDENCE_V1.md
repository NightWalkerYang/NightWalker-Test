# Zero-Intrusive Sandbox Prediction Evidence v1

## Status

- Scope: sandbox prediction evidence only
- Layer: zero-intrusive runtime + sandbox starter
- Audience: Codex / maintainers implementing the next iteration
- Approved direction:
  - weather/disaster factor: deferred
  - evidence surface: sandbox result page only
  - explanation source: deterministic evidence first, LLM wording second
  - default focus list: top 5 materials
  - ranking: impact score with user-selectable profile presets
  - detail expansion: collapsed by default
  - recent history: mini trend chart

## Goal

The sandbox result page must answer two questions at the same time:

1. What should we buy?
2. Why did the system recommend that?

v1 must make the answer traceable to deterministic numeric inputs. LLM output is allowed only as a wording layer on top of deterministic evidence and must never invent quantities, thresholds, or rule hits.

## Non-goals

- No weather or disaster factor in v1
- No export file in v1
- No write-back into member chat in v1
- No editable rule threshold UI in v1
- No changes to upstream OpenClaw `src/`, `ui/`, `apps/`, or `extensions/`

## Current Baseline

Current sandbox payloads already return:

- `summary`
- `graph`
- `recommendations`
- `report.headline`
- `report.bullets`

This is sufficient for a lightweight result page, but not enough for a convincing "why" layer because:

- recommendation rows do not expose the raw decision inputs
- risk levels are visible but not justified
- users cannot see recent demand movement for a material
- there is no structured breakdown of why a material was ranked into the default top list

## Proposed Payload Contract

### Top-level additions

Add a new top-level object:

```json
{
  "evidenceSummary": {
    "defaultProfile": "balanced",
    "availableProfiles": [
      "balanced",
      "risk",
      "cost",
      "supply_assurance",
      "inventory_safety"
    ],
    "defaultVisibleCount": 5,
    "ruleCatalogVersion": "sandbox-evidence-v1"
  }
}
```

### Recommendation-level additions

Each item in `recommendations[]` must add:

```json
{
  "impactScore": 0.84,
  "impactProfile": "balanced",
  "whyText": "当前库存不足以覆盖预测需求，且最近三个月需求持续抬升，因此建议优先采购。",
  "evidence": {
    "historyDemandAvg": 12450.0,
    "historyDemandRecent3Months": [
      { "month": "2024-01", "demandQty": 11800.0 },
      { "month": "2024-02", "demandQty": 12950.0 },
      { "month": "2024-03", "demandQty": 13600.0 }
    ],
    "historyDemandTrend": "up",
    "historyDemandVolatility": 0.26,
    "inventoryAvailableQty": 3200.0,
    "predictedDemandQty": 14800.0,
    "recommendedQty": 12650.0,
    "estimatedCost": 592000.0,
    "gapQty": 11600.0,
    "coverageDays": 6.5,
    "costContributionRatio": 0.18,
    "purchaseAmplificationRatio": 1.72,
    "triggeredRules": [
      {
        "ruleId": "inventory_gap",
        "label": "库存缺口",
        "severity": "high",
        "values": {
          "predictedDemandQty": 14800.0,
          "inventoryAvailableQty": 3200.0,
          "gapQty": 11600.0
        }
      },
      {
        "ruleId": "low_coverage_days",
        "label": "库存覆盖不足",
        "severity": "high",
        "values": {
          "coverageDays": 6.5,
          "thresholdDays": 15
        }
      }
    ]
  }
}
```

## Deterministic Evidence Rules

### Rule model

Rules are not a separate scoring engine service in v1. They are generated inline during sandbox result construction from deterministic business values.

Each triggered rule must contain:

- `ruleId`
- `label`
- `severity`
- `values`

### v1 rule set

1. `inventory_gap`
- Trigger when `predictedDemandQty > inventoryAvailableQty`
- Severity:
  - `low`: gap ratio <= 0.05
  - `medium`: gap ratio > 0.05 and <= 0.15
  - `high`: gap ratio > 0.15

2. `low_coverage_days`
- Trigger when `coverageDays < thresholdDays`
- Default `thresholdDays = 15`
- Severity:
  - `medium`: `7 <= coverageDays < 15`
  - `high`: `coverageDays < 7`

3. `high_demand_volatility`
- Trigger when `historyDemandVolatility > threshold`
- Default threshold:
  - `medium`: `> 0.20`
  - `high`: `> 0.50`

4. `high_cost_impact`
- Trigger when `costContributionRatio > threshold`
- Default threshold:
  - `medium`: `> 0.05`
  - `high`: `> 0.15`

5. `purchase_amplification`
- Trigger when `purchaseAmplificationRatio > threshold`
- Default threshold:
  - `medium`: `> 1.20`
  - `high`: `> 1.80`

## Impact Score Profiles

### Profiles

v1 must expose exactly five profile presets:

- `balanced`
- `risk`
- `cost`
- `supply_assurance`
- `inventory_safety`

### Scoring inputs

Normalize the following inputs to `[0, 1]` per run:

- `gapScore`
- `riskScore`
- `costScore`
- `purchaseScore`
- `coverageRiskScore`

Suggested mapping:

- `gapScore = min(max(gapQty / max(predictedDemandQty, 1), 0), 1)`
- `riskScore = { low: 0.25, medium: 0.65, high: 1.0 }`
- `costScore = estimatedCost / maxEstimatedCost`
- `purchaseScore = recommendedQty / maxRecommendedQty`
- `coverageRiskScore = 1 - min(coverageDays / 30, 1)`

### Weight presets

`balanced`
- gap 0.30
- risk 0.25
- cost 0.20
- purchase 0.10
- coverage 0.15

`risk`
- gap 0.20
- risk 0.40
- cost 0.10
- purchase 0.05
- coverage 0.25

`cost`
- gap 0.15
- risk 0.15
- cost 0.45
- purchase 0.15
- coverage 0.10

`supply_assurance`
- gap 0.30
- risk 0.20
- cost 0.10
- purchase 0.10
- coverage 0.30

`inventory_safety`
- gap 0.20
- risk 0.15
- cost 0.05
- purchase 0.10
- coverage 0.50

The payload may compute and ship only the default profile score in v1, while the frontend recomputes alternate profile scores from deterministic evidence. That keeps the backend delta smaller and still preserves determinism.

## LLM Boundary

### Allowed

LLM can:

- rewrite deterministic evidence into short business-readable `whyText`
- summarize top-level bullets from deterministic evidence
- compress multi-rule hits into one plain-language sentence

### Forbidden

LLM cannot:

- invent forecast quantities
- invent stock values
- invent missing rule hits
- override deterministic `riskLevel`
- reorder top 5 materials independently from the chosen profile

### Fallback

If LLM is unavailable:

- generate `whyText` from templates
- generate `report.headline` and `report.bullets` from templates
- do not fail the sandbox result page

## Frontend Result Page Design

### Placement

Evidence stays inside `tools/openclaw-control-ui-echarts/runtime/sandbox-view/surface.js`.

### Layout

Keep the existing result page shell, then add:

1. profile preset switcher above the recommendation table
2. default top 5 recommendation rows sorted by the active profile
3. row-level accordion expansion
4. "查看全部物料依据" action below the default top 5

### Row summary

Each visible material row should show:

- material code
- material name
- recommended quantity
- estimated cost
- impact score
- risk badge

### Expanded evidence card

When expanded, show:

- mini trend chart for the last 3 months demand
- history average demand
- current inventory
- predicted demand
- recommended purchase quantity
- estimated cost
- gap quantity
- coverage days
- triggered rules
- `whyText`

### Default interaction

- all rows collapsed by default
- click a row or explicit button to expand
- only one expanded row at a time in v1

## Backend Generation Strategy

### Python runtime

Main files:

- `tools/openclaw-sandbox-simulation-starter/python/run_sandbox_simulation.py`
- `tools/openclaw-sandbox-simulation-starter/python/sandbox_simulation/predict_runtime.py`
- `tools/openclaw-sandbox-simulation-starter/python/sandbox_simulation/sandbox_payload.py`

### Required additions

1. extend live material row generation to collect:
- recent 3 months demand series
- historical mean demand
- volatility
- gap quantity
- coverage days
- cost contribution ratio
- purchase amplification ratio

2. derive triggered rules deterministically from those values

3. compute profile scores

4. generate top-level and per-material explanation text

### Minimal acceptable fallback

If some fields are unavailable:

- keep the material visible
- emit numeric fallbacks as `0` or `null` consistently
- still generate template `whyText`
- never break page rendering because one evidence field is missing

## Testing Plan

### Python

Add or extend tests under `tools/openclaw-sandbox-simulation-starter/tests/`:

- payload contains `evidenceSummary`
- recommendation contains deterministic `evidence`
- rule triggering works at threshold edges
- profile scoring order is stable
- fallback template text works without LLM

### Frontend

Extend `test/tools/openclaw-control-ui-echarts/sandbox-view-surface.test.ts`:

- top 5 default sorting
- profile switch changes ranking
- row expansion shows evidence card
- mini trend chart renders
- collapsed-by-default behavior
- "查看全部物料依据" reveals remaining rows
- fallback text appears when explanation fields are partial

## Zero-Intrusive File Scope

Expected implementation touch set for v1:

- `tools/openclaw-sandbox-simulation-starter/python/run_sandbox_simulation.py`
- `tools/openclaw-sandbox-simulation-starter/python/sandbox_simulation/predict_runtime.py`
- `tools/openclaw-sandbox-simulation-starter/python/sandbox_simulation/sandbox_payload.py`
- `tools/openclaw-control-ui-echarts/runtime/sandbox-view/surface.js`
- related tests under `test/tools/openclaw-control-ui-echarts/`
- related tests under `tools/openclaw-sandbox-simulation-starter/tests/`

If any new zero-intrusive files are added, `ZERO_INTRUSIVE_ECHARTS_ADDITIONS.md` must be updated in the same change.

## Rollout Note

This design intentionally does not change:

- build manifest
- docker runtime contract
- upstream OpenClaw DOM structure

If later iterations add exported reports or member-chat summaries, that must be handled as a separate design slice.
