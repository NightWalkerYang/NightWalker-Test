# D-2 runtime notes

1. `feature_supplier_lead_time` 当前沿用任务包的一阶简化：`v_purchase_order` 与 `v_purchase_receive` 仅按 `tenant_id + supplier_id + material_id + 180 days window` 配对。这样会在“一张 PO 对多次收货”时重复计入 lead time 样本。D-2 先接受该偏差，保证 MV 可落地；后续 v1.5 需要基于更稳定的单据链路键或分摊规则重做配对。
2. `public.bd_stockalert_current` 当前只有 `document_json` 结构列，且实测无样本行，无法安全确认真实 JSON key。D-2 第一版因此不猜字段名：`feature_safety_stock` 的 `from_alert` 分支保留目标列结构但稳定返回 0 行，正式结果全部走 `demand_std` fallback。待拿到真实 alert 样本后，再补 `document_json -> 业务字段` 的映射。
