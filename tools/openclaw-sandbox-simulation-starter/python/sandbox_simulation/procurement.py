from __future__ import annotations

from dataclasses import dataclass
import math


@dataclass(frozen=True)
class ProcurementInputs:
    forecast_demand_qty: float
    confirmed_sales_order_qty: float
    inventory_available_qty: float
    purchase_in_transit_qty: float
    production_in_transit_qty: float
    reserved_qty: float
    safety_stock_qty: float
    reorder_min_qty: float
    order_multiple_qty: float
    scrap_rate: float
    unit_purchase_cost: float


@dataclass(frozen=True)
class ProcurementRecommendation:
    gross_requirement_qty: float
    available_supply_qty: float
    net_requirement_qty: float
    scrap_adjusted_requirement_qty: float
    recommended_order_qty: float
    estimated_purchase_cost: float


def round_up_to_multiple(quantity: float, multiple: float) -> float:
    normalized_quantity = max(float(quantity), 0.0)
    normalized_multiple = float(multiple)
    if normalized_multiple <= 0:
        return normalized_quantity
    return math.ceil(normalized_quantity / normalized_multiple) * normalized_multiple


def build_procurement_recommendation(inputs: ProcurementInputs) -> ProcurementRecommendation:
    gross_requirement_qty = max(inputs.forecast_demand_qty, inputs.confirmed_sales_order_qty) + max(
        inputs.safety_stock_qty, 0.0
    )
    available_supply_qty = max(
        inputs.inventory_available_qty
        + inputs.purchase_in_transit_qty
        + inputs.production_in_transit_qty
        - inputs.reserved_qty,
        0.0,
    )
    net_requirement_qty = max(gross_requirement_qty - available_supply_qty, 0.0)
    scrap_adjusted_requirement_qty = net_requirement_qty * (1 + max(inputs.scrap_rate, 0.0))
    rounded_requirement_qty = round_up_to_multiple(
        scrap_adjusted_requirement_qty,
        inputs.order_multiple_qty,
    )
    recommended_order_qty = max(rounded_requirement_qty, max(inputs.reorder_min_qty, 0.0))
    estimated_purchase_cost = recommended_order_qty * max(inputs.unit_purchase_cost, 0.0)

    return ProcurementRecommendation(
        gross_requirement_qty=gross_requirement_qty,
        available_supply_qty=available_supply_qty,
        net_requirement_qty=net_requirement_qty,
        scrap_adjusted_requirement_qty=scrap_adjusted_requirement_qty,
        recommended_order_qty=recommended_order_qty,
        estimated_purchase_cost=estimated_purchase_cost,
    )
