-- ============================================================================
-- D-1: sandbox_v1 schema + 映射视图
-- 不修改任何 *_current 业务表
-- 视图保留 src_row_key 可回溯
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS sandbox_v1;
COMMENT ON SCHEMA sandbox_v1 IS 'OpenClaw 经营沙盒 v1 隔离 schema';

DROP VIEW IF EXISTS sandbox_v1.v_sales_outstock;
DROP VIEW IF EXISTS sandbox_v1.v_sales_order;
DROP VIEW IF EXISTS sandbox_v1.v_sales_delivery_notice;
DROP VIEW IF EXISTS sandbox_v1.v_purchase_order;
DROP VIEW IF EXISTS sandbox_v1.v_purchase_receive;
DROP VIEW IF EXISTS sandbox_v1.v_inventory_snapshot;
DROP VIEW IF EXISTS sandbox_v1.v_instock;
DROP VIEW IF EXISTS sandbox_v1.v_bom;
DROP VIEW IF EXISTS sandbox_v1.v_purchase_request;
DROP VIEW IF EXISTS sandbox_v1.v_purchase_mr_app;

DROP VIEW IF EXISTS sandbox_v1.v_src_purchase_order_line;
DROP VIEW IF EXISTS sandbox_v1.v_src_purchase_receive_line;
DROP VIEW IF EXISTS sandbox_v1.v_src_inventory_snapshot;
DROP VIEW IF EXISTS sandbox_v1.v_src_instock_line;
DROP VIEW IF EXISTS sandbox_v1.v_src_bom_line;
DROP VIEW IF EXISTS sandbox_v1.v_src_purchase_requisition_line;
DROP VIEW IF EXISTS sandbox_v1.v_src_purchase_mrapp_line;

CREATE OR REPLACE VIEW sandbox_v1.v_sales_outstock
WITH (security_barrier = true) AS
SELECT
    'demo-tenant'::text AS tenant_id,
    COALESCE(NULLIF(base.sale_org_id, ''), NULLIF(base.sale_org_number, ''), 'demo-org')::text AS org_id,
    base.material_number::text AS material_id,
    base.material_number::text AS material_code,
    base.material_name::text AS material_name,
    base.customer_number::text AS customer_id,
    base.bill_date::date AS biz_date,
    base.qty::numeric(18, 4) AS qty,
    base.line_amount::numeric(18, 4) AS amount,
    base.row_key::text AS src_row_key
FROM public.sales_outstock_current AS base
WHERE base.material_number IS NOT NULL
  AND base.qty IS NOT NULL;

COMMENT ON VIEW sandbox_v1.v_sales_outstock IS 'Sandbox v1 销售出库映射视图';

CREATE OR REPLACE VIEW sandbox_v1.v_sales_order
WITH (security_barrier = true) AS
SELECT
    'demo-tenant'::text AS tenant_id,
    COALESCE(NULLIF(base.sale_org_id, ''), NULLIF(base.sale_org_number, ''), 'demo-org')::text AS org_id,
    base.material_number::text AS material_id,
    base.material_number::text AS material_code,
    base.material_name::text AS material_name,
    base.customer_number::text AS customer_id,
    base.bill_date::date AS biz_date,
    base.qty::numeric(18, 4) AS qty,
    base.line_amount::numeric(18, 4) AS amount,
    COALESCE(NULLIF(base.bill_no, ''), NULLIF(base.source_order_no, ''))::text AS order_no,
    NULL::date AS due_date,
    base.row_key::text AS src_row_key
FROM public.sales_order_current AS base
WHERE base.material_number IS NOT NULL
  AND base.qty IS NOT NULL;

COMMENT ON VIEW sandbox_v1.v_sales_order IS 'Sandbox v1 销售订单映射视图';

CREATE OR REPLACE VIEW sandbox_v1.v_sales_delivery_notice
WITH (security_barrier = true) AS
SELECT
    'demo-tenant'::text AS tenant_id,
    COALESCE(NULLIF(base.sale_org_id, ''), NULLIF(base.sale_org_number, ''), 'demo-org')::text AS org_id,
    base.material_number::text AS material_id,
    base.customer_number::text AS customer_id,
    base.bill_date::date AS biz_date,
    base.qty::numeric(18, 4) AS qty,
    base.row_key::text AS src_row_key
FROM public.sales_delivery_notice_current AS base
WHERE base.material_number IS NOT NULL
  AND base.qty IS NOT NULL;

COMMENT ON VIEW sandbox_v1.v_sales_delivery_notice IS 'Sandbox v1 销售发货通知映射视图';

CREATE OR REPLACE VIEW sandbox_v1.v_purchase_order
WITH (security_barrier = true) AS
SELECT
    COALESCE(NULLIF(base.document_json ->> 'tenant_id', ''), 'demo-tenant')::text AS tenant_id,
    COALESCE(
        NULLIF(base.document_json ->> 'FPurchaseOrgId', ''),
        NULLIF(base.document_json ->> 'FReceiveOrgId', ''),
        'demo-org'
    )::text AS org_id,
    NULLIF(base.document_json ->> 'FMaterialId', '')::text AS material_id,
    COALESCE(
        NULLIF(base.document_json ->> 'FSupplierId', ''),
        NULLIF(base.document_json ->> 'FProviderId', '')
    )::text AS supplier_id,
    NULL::text AS supplier_name,
    (NULLIF(base.document_json ->> 'FDate', ''))::timestamp::date AS biz_date,
    (NULLIF(base.document_json ->> 'FQty', ''))::numeric(18, 4) AS qty,
    COALESCE(
        (NULLIF(base.document_json ->> 'FTaxPrice', ''))::numeric(18, 4),
        (NULLIF(base.document_json ->> 'FPrice', ''))::numeric(18, 4)
    ) AS unit_price,
    COALESCE(
        (NULLIF(base.document_json ->> 'FPREARRIVALDATE', ''))::timestamp::date,
        (NULLIF(base.document_json ->> 'FDeliveryDate', ''))::timestamp::date
    ) AS expected_arrival_date,
    base.row_key::text AS src_row_key
FROM public.pur_purchaseorder_current AS base
WHERE base.document_json IS NOT NULL
  AND NULLIF(base.document_json ->> 'FMaterialId', '') IS NOT NULL
  AND NULLIF(base.document_json ->> 'FQty', '') IS NOT NULL;

COMMENT ON VIEW sandbox_v1.v_purchase_order IS 'Sandbox v1 采购订单映射视图';

CREATE OR REPLACE VIEW sandbox_v1.v_purchase_receive
WITH (security_barrier = true) AS
SELECT
    COALESCE(NULLIF(base.document_json ->> 'tenant_id', ''), 'demo-tenant')::text AS tenant_id,
    COALESCE(NULLIF(base.document_json ->> 'FStockOrgId', ''), 'demo-org')::text AS org_id,
    NULLIF(base.document_json ->> 'FMaterialId', '')::text AS material_id,
    NULLIF(base.document_json ->> 'FSupplierId', '')::text AS supplier_id,
    (NULLIF(base.document_json ->> 'FDate', ''))::timestamp::date AS biz_date,
    COALESCE(
        (NULLIF(base.document_json ->> 'FActReceiveQty', ''))::numeric(18, 4),
        (NULLIF(base.document_json ->> 'FInStockQty', ''))::numeric(18, 4),
        (NULLIF(base.document_json ->> 'FStockQty', ''))::numeric(18, 4),
        (NULLIF(base.document_json ->> 'FReceiveQty', ''))::numeric(18, 4)
    ) AS qty,
    base.row_key::text AS src_row_key
FROM public.pur_receivebill_current AS base
WHERE base.document_json IS NOT NULL
  AND NULLIF(base.document_json ->> 'FMaterialId', '') IS NOT NULL;

COMMENT ON VIEW sandbox_v1.v_purchase_receive IS 'Sandbox v1 采购收料映射视图';

CREATE OR REPLACE VIEW sandbox_v1.v_inventory_snapshot
WITH (security_barrier = true) AS
SELECT
    COALESCE(NULLIF(base.document_json ->> 'tenant_id', ''), 'demo-tenant')::text AS tenant_id,
    COALESCE(NULLIF(base.document_json ->> 'FStockOrgId', ''), 'demo-org')::text AS org_id,
    NULLIF(base.document_json ->> 'FStockId', '')::text AS warehouse_id,
    NULLIF(base.document_json ->> 'FMaterialId', '')::text AS material_id,
    (NULLIF(base.document_json ->> 'FUpdateTime', ''))::timestamp::date AS snapshot_date,
    (NULLIF(base.document_json ->> 'FQty', ''))::numeric(18, 4) AS qty,
    base.row_key::text AS src_row_key
FROM public.stk_inventory_current AS base
WHERE base.document_json IS NOT NULL
  AND NULLIF(base.document_json ->> 'FMaterialId', '') IS NOT NULL;

COMMENT ON VIEW sandbox_v1.v_inventory_snapshot IS 'Sandbox v1 库存快照映射视图';

CREATE OR REPLACE VIEW sandbox_v1.v_instock
WITH (security_barrier = true) AS
SELECT
    COALESCE(NULLIF(base.document_json ->> 'tenant_id', ''), 'demo-tenant')::text AS tenant_id,
    COALESCE(
        NULLIF(base.document_json ->> 'FPurchaseOrgId', ''),
        NULLIF(base.document_json ->> 'FStockOrgId', ''),
        NULLIF(base.document_json ->> 'FDemandOrgId', ''),
        'demo-org'
    )::text AS org_id,
    NULLIF(base.document_json ->> 'FMaterialId', '')::text AS material_id,
    NULLIF(base.document_json ->> 'FSupplierId', '')::text AS supplier_id,
    (NULLIF(base.document_json ->> 'FDate', ''))::timestamp::date AS biz_date,
    COALESCE(
        (NULLIF(base.document_json ->> 'FRealQty', ''))::numeric(18, 4),
        (NULLIF(base.document_json ->> 'FQty', ''))::numeric(18, 4),
        (NULLIF(base.document_json ->> 'FBaseUnitQty', ''))::numeric(18, 4)
    ) AS qty,
    base.row_key::text AS src_row_key
FROM public.stk_instock_current AS base
WHERE base.document_json IS NOT NULL
  AND NULLIF(base.document_json ->> 'FMaterialId', '') IS NOT NULL;

COMMENT ON VIEW sandbox_v1.v_instock IS 'Sandbox v1 入库单映射视图';

CREATE OR REPLACE VIEW sandbox_v1.v_bom
WITH (security_barrier = true) AS
SELECT
    COALESCE(NULLIF(base.document_json ->> 'tenant_id', ''), 'demo-tenant')::text AS tenant_id,
    NULLIF(base.document_json ->> 'FMATERIALID', '')::text AS parent_material_id,
    NULLIF(base.document_json ->> 'FMATERIALIDCHILD', '')::text AS child_material_id,
    (NULLIF(base.document_json ->> 'FQty', ''))::numeric(18, 4) AS qty_per,
    COALESCE((NULLIF(base.document_json ->> 'FFIXSCRAPQTY', ''))::numeric(18, 4), 0::numeric(18, 4)) AS scrap_rate,
    COALESCE(
        (NULLIF(base.document_json ->> 'FEFFECTDATE', ''))::timestamp::date,
        DATE '1900-01-01'
    ) AS valid_from,
    COALESCE(
        (NULLIF(base.document_json ->> 'FEXPIREDATE', ''))::timestamp::date,
        DATE '9999-12-31'
    ) AS valid_to,
    base.row_key::text AS src_row_key
FROM public.eng_bom_current AS base
WHERE base.document_json IS NOT NULL
  AND NULLIF(base.document_json ->> 'FMATERIALID', '') IS NOT NULL
  AND NULLIF(base.document_json ->> 'FMATERIALIDCHILD', '') IS NOT NULL
  AND COALESCE((NULLIF(base.document_json ->> 'FQty', ''))::numeric, 0) > 0;

COMMENT ON VIEW sandbox_v1.v_bom IS 'Sandbox v1 BOM 映射视图';

CREATE OR REPLACE VIEW sandbox_v1.v_purchase_request
WITH (security_barrier = true) AS
SELECT
    COALESCE(NULLIF(base.document_json ->> 'tenant_id', ''), 'demo-tenant')::text AS tenant_id,
    COALESCE(NULLIF(base.document_json ->> 'ApplicationOrgId_Id', ''), 'demo-org')::text AS org_id,
    NULLIF(entry.item ->> 'MaterialId_Id', '')::text AS material_id,
    (NULLIF(base.document_json ->> 'ApplicationDate', ''))::timestamp::date AS biz_date,
    (NULLIF(entry.item ->> 'ReqQty', ''))::numeric(18, 4) AS qty,
    (base.row_key || '#' || entry.ordinality::text)::text AS src_row_key
FROM public.pur_requisition_current AS base
CROSS JOIN LATERAL jsonb_array_elements(base.document_json -> 'ReqEntry') WITH ORDINALITY AS entry(item, ordinality)
WHERE base.document_json IS NOT NULL
  AND NULLIF(entry.item ->> 'MaterialId_Id', '') IS NOT NULL
  AND NULLIF(entry.item ->> 'ReqQty', '') IS NOT NULL;

COMMENT ON VIEW sandbox_v1.v_purchase_request IS 'Sandbox v1 采购申请映射视图';

CREATE OR REPLACE VIEW sandbox_v1.v_purchase_mr_app
WITH (security_barrier = true) AS
SELECT
    COALESCE(NULLIF(base.document_json ->> 'tenant_id', ''), 'demo-tenant')::text AS tenant_id,
    COALESCE(NULLIF(base.document_json ->> 'APPORGID_Id', ''), 'demo-org')::text AS org_id,
    NULLIF(entry.item ->> 'MATERIALID_Id', '')::text AS material_id,
    (NULLIF(base.document_json ->> 'FDate', ''))::timestamp::date AS biz_date,
    (NULLIF(entry.item ->> 'MRQTY', ''))::numeric(18, 4) AS qty,
    (base.row_key || '#' || entry.ordinality::text)::text AS src_row_key
FROM public.pur_mrapp_current AS base
CROSS JOIN LATERAL jsonb_array_elements(base.document_json -> 'PUR_MRAPPENTRY') WITH ORDINALITY AS entry(item, ordinality)
WHERE base.document_json IS NOT NULL
  AND NULLIF(entry.item ->> 'MATERIALID_Id', '') IS NOT NULL
  AND NULLIF(entry.item ->> 'MRQTY', '') IS NOT NULL;

COMMENT ON VIEW sandbox_v1.v_purchase_mr_app IS 'Sandbox v1 退料申请映射视图';
