# D-1 source columns and mappings

探查时间：2026-05-01
数据库：`kingdee_analytics@127.0.0.1:65432`
schema：`public`

## 1. information_schema.columns 原始结果

### `sales_outstock_current`

| ordinal | column_name | data_type |
| --- | --- | --- |
| 1 | row_key | text |
| 2 | source_row_number | integer |
| 3 | source_object_id | text |
| 4 | source_modify_time | timestamp with time zone |
| 5 | bill_no | text |
| 6 | bill_date | date |
| 7 | document_status | text |
| 8 | sale_org_name | text |
| 9 | customer_number | text |
| 10 | customer_name | text |
| 11 | material_number | text |
| 12 | material_name | text |
| 13 | qty | double precision |
| 14 | tax_price | double precision |
| 15 | line_amount | double precision |
| 16 | src_bill_no | text |
| 17 | src_type | text |
| 18 | source_order_no | text |
| 19 | source_order_entry_id | bigint |
| 20 | is_formal | boolean |
| 21 | sync_batch_id | text |
| 22 | updated_at | timestamp with time zone |
| 23 | sale_org_id | text |
| 24 | sale_org_number | text |

### `sales_order_current`

| ordinal | column_name | data_type |
| --- | --- | --- |
| 1 | row_key | text |
| 2 | source_row_number | integer |
| 3 | source_object_id | text |
| 4 | source_modify_time | timestamp with time zone |
| 5 | bill_no | text |
| 6 | bill_date | date |
| 7 | document_status | text |
| 8 | sale_org_name | text |
| 9 | customer_number | text |
| 10 | customer_name | text |
| 11 | material_number | text |
| 12 | material_name | text |
| 13 | qty | double precision |
| 14 | tax_price | double precision |
| 15 | line_amount | double precision |
| 16 | src_bill_no | text |
| 17 | src_type | text |
| 18 | source_order_no | text |
| 19 | source_order_entry_id | bigint |
| 20 | is_formal | boolean |
| 21 | sync_batch_id | text |
| 22 | updated_at | timestamp with time zone |
| 23 | sale_org_id | text |
| 24 | sale_org_number | text |

### `sales_delivery_notice_current`

| ordinal | column_name | data_type |
| --- | --- | --- |
| 1 | row_key | text |
| 2 | source_row_number | integer |
| 3 | source_object_id | text |
| 4 | source_modify_time | timestamp with time zone |
| 5 | bill_no | text |
| 6 | bill_date | date |
| 7 | document_status | text |
| 8 | sale_org_name | text |
| 9 | customer_number | text |
| 10 | customer_name | text |
| 11 | material_number | text |
| 12 | material_name | text |
| 13 | qty | double precision |
| 14 | tax_price | double precision |
| 15 | line_amount | double precision |
| 16 | src_bill_no | text |
| 17 | src_type | text |
| 18 | source_order_no | text |
| 19 | source_order_entry_id | bigint |
| 20 | is_formal | boolean |
| 21 | sync_batch_id | text |
| 22 | updated_at | timestamp with time zone |
| 23 | sale_org_id | text |
| 24 | sale_org_number | text |

### `pur_purchaseorder_current`

| ordinal | column_name | data_type |
| --- | --- | --- |
| 1 | row_key | text |
| 2 | source_row_number | integer |
| 3 | source_object_id | text |
| 4 | document_json | jsonb |
| 5 | sync_batch_id | text |
| 6 | updated_at | timestamp with time zone |

### `pur_receivebill_current`

| ordinal | column_name | data_type |
| --- | --- | --- |
| 1 | row_key | text |
| 2 | source_row_number | integer |
| 3 | source_object_id | text |
| 4 | document_json | jsonb |
| 5 | sync_batch_id | text |
| 6 | updated_at | timestamp with time zone |

### `stk_inventory_current`

| ordinal | column_name | data_type |
| --- | --- | --- |
| 1 | row_key | text |
| 2 | source_row_number | integer |
| 3 | source_object_id | text |
| 4 | document_json | jsonb |
| 5 | sync_batch_id | text |
| 6 | updated_at | timestamp with time zone |

### `stk_instock_current`

| ordinal | column_name | data_type |
| --- | --- | --- |
| 1 | row_key | text |
| 2 | source_row_number | integer |
| 3 | source_object_id | text |
| 4 | document_json | jsonb |
| 5 | sync_batch_id | text |
| 6 | updated_at | timestamp with time zone |

### `eng_bom_current`

| ordinal | column_name | data_type |
| --- | --- | --- |
| 1 | row_key | text |
| 2 | source_row_number | integer |
| 3 | source_object_id | text |
| 4 | document_json | jsonb |
| 5 | sync_batch_id | text |
| 6 | updated_at | timestamp with time zone |

### `pur_requisition_current`

| ordinal | column_name | data_type |
| --- | --- | --- |
| 1 | row_key | text |
| 2 | source_row_number | integer |
| 3 | source_object_id | text |
| 4 | document_json | jsonb |
| 5 | sync_batch_id | text |
| 6 | updated_at | timestamp with time zone |

### `pur_mrapp_current`

| ordinal | column_name | data_type |
| --- | --- | --- |
| 1 | row_key | text |
| 2 | source_row_number | integer |
| 3 | source_object_id | text |
| 4 | document_json | jsonb |
| 5 | sync_batch_id | text |
| 6 | updated_at | timestamp with time zone |

## 2. D-1 关键映射

### 2.1 扁平表

| final view field | `sales_outstock_current` / `sales_order_current` / `sales_delivery_notice_current` source |
| --- | --- |
| tenant_id | 源表无 `tenant_id`，固定兜底 `'demo-tenant'` |
| org_id | `sale_org_id`，空时兜底 `sale_org_number`，再兜底 `'demo-org'` |
| material_id | 源表无独立物料主键，使用 `material_number` 代理 |
| material_code | `material_number` |
| material_name | `material_name` |
| customer_id | `customer_number` |
| biz_date | `bill_date` |
| qty | `qty` |
| amount | `line_amount` |
| src_row_key | `row_key` |
| order_no (`v_sales_order`) | `bill_no` |
| due_date (`v_sales_order`) | 源表无对应列，视图中置 `NULL::date` |

### 2.2 JSON 表

#### `pur_purchaseorder_current` -> `v_purchase_order`

- `tenant_id`: `$.tenant_id` 不存在，固定兜底 `'demo-tenant'`
- `org_id`: `$.FPurchaseOrgId`
- `material_id`: `$.FMaterialId`
- `supplier_id`: `COALESCE($.FSupplierId, $.FProviderId)`
- `supplier_name`: 源样本未见稳定名字字段，置 `NULL`
- `biz_date`: `$.FDate`
- `qty`: `$.FQty`
- `unit_price`: `COALESCE($.FTaxPrice, $.FPrice)`
- `expected_arrival_date`: `COALESCE($.FPREARRIVALDATE, $.FDeliveryDate)`
- `src_row_key`: `row_key`

#### `pur_receivebill_current` -> `v_purchase_receive`

- `tenant_id`: 兜底 `'demo-tenant'`
- `org_id`: `$.FStockOrgId`
- `material_id`: `$.FMaterialId`
- `supplier_id`: `$.FSupplierId`
- `biz_date`: `$.FDate`
- `qty`: `COALESCE($.FActReceiveQty, $.FInStockQty, $.FStockQty, $.FReceiveQty)`
- `src_row_key`: `row_key`

#### `stk_inventory_current` -> `v_inventory_snapshot`

- `tenant_id`: 兜底 `'demo-tenant'`
- `org_id`: `$.FStockOrgId`
- `warehouse_id`: `$.FStockId`
- `material_id`: `$.FMaterialId`
- `snapshot_date`: `$.FUpdateTime`
- `qty`: `$.FQty`
- `src_row_key`: `row_key`

#### `stk_instock_current` -> `v_instock`

- `tenant_id`: 兜底 `'demo-tenant'`
- `org_id`: `COALESCE($.FPurchaseOrgId, $.FStockOrgId, $.FDemandOrgId)`
- `material_id`: `$.FMaterialId`
- `supplier_id`: `$.FSupplierId`
- `biz_date`: `$.FDate`
- `qty`: `COALESCE($.FRealQty, $.FQty, $.FBaseUnitQty)`
- `src_row_key`: `row_key`

#### `eng_bom_current` -> `v_bom`

- `tenant_id`: 兜底 `'demo-tenant'`
- `parent_material_id`: `$.FMATERIALID`
- `child_material_id`: `$.FMATERIALIDCHILD`
- `qty_per`: `$.FQty`
- `scrap_rate`: 源里没有百分比字段，使用 `COALESCE($.FFIXSCRAPQTY, 0)` 作为最接近字段
- `valid_from`: `COALESCE($.FEFFECTDATE, '1900-01-01')`
- `valid_to`: `COALESCE($.FEXPIREDATE, '9999-12-31')`
- `src_row_key`: `row_key`

#### `pur_requisition_current` -> `v_purchase_request`

- Header `biz_date`: `$.ApplicationDate`
- Header `org_id`: `$.ApplicationOrgId_Id`
- Line array: `$.ReqEntry[*]`
- `material_id`: `$.ReqEntry[*].MaterialId_Id`
- `qty`: `$.ReqEntry[*].ReqQty`
- `src_row_key`: `row_key || '#' || line ordinal`

#### `pur_mrapp_current` -> `v_purchase_mr_app`

- Header `biz_date`: `$.FDate`
- Header `org_id`: `$.APPORGID_Id`
- Supplier: `$.SUPPLIERID_Id`
- Line array: `$.PUR_MRAPPENTRY[*]`
- `material_id`: `$.PUR_MRAPPENTRY[*].MATERIALID_Id`
- `qty`: `$.PUR_MRAPPENTRY[*].MRQTY`
- `src_row_key`: `row_key || '#' || line ordinal`

## 3. 偏差和风险

1. 三张销售表都没有独立 `material_id`，只能用 `material_number` 作为 `material_id` 代理键。
2. `sales_order_current` 不存在 `due_date`，`v_sales_order.due_date` 只能显式输出 `NULL::date`。
3. `pur_purchaseorder_current` 样本中没有稳定的供应商名称字段，`v_purchase_order.supplier_name` 先置 `NULL`。
4. `eng_bom_current` 没有百分比语义的 `scrap_rate`，只有 `FFIXSCRAPQTY` 等固定损耗量字段；D-1 视图中先映射为 `scrap_rate` 并在使用方继续确认语义。
5. `pur_requisition_current` 和 `pur_mrapp_current` 是头行一体 JSON，必须通过 `jsonb_array_elements` 展开明细行。
