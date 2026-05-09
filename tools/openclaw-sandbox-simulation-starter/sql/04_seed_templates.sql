INSERT INTO sandbox_v1.scenario_template (
    template_code,
    display_name,
    description,
    default_params
)
VALUES
    (
        'next_month_purchase',
        '下月采购量推演',
        '基于历史销售/在途/库存预测下月采购量，按资金预算约束筛选',
        '{"cash_budget": 500000}'::jsonb
    ),
    (
        'supplier_delay',
        '供应商延期冲击推演',
        '指定供应商 lead_time 延后 N 天，评估缺料传导链',
        '{"delay_days": 7}'::jsonb
    ),
    (
        'sales_surge',
        '销量突增推演',
        '指定产品需求上浮 N%，BOM 展开后评估子件缺口',
        '{"surge_pct": 0.15}'::jsonb
    ),
    (
        'price_lock',
        '价格上涨锁价推演',
        '指定物料价格上涨 N%，建议锁价数量与节省金额',
        '{"price_shock_pct": 0.08, "n_months_lock": 3}'::jsonb
    )
ON CONFLICT (template_code) DO NOTHING;
