from pathlib import Path
import sys


REPO_ROOT = Path(__file__).resolve().parents[3]
PYTHON_ROOT = REPO_ROOT / "tools" / "openclaw-sandbox-simulation-starter" / "python"
if str(PYTHON_ROOT) not in sys.path:
    sys.path.insert(0, str(PYTHON_ROOT))

from sandbox_simulation.procurement import (
    ProcurementInputs,
    build_procurement_recommendation,
    round_up_to_multiple,
)


def test_round_up_to_multiple_keeps_exact_multiple():
    assert round_up_to_multiple(120, 10) == 120


def test_round_up_to_multiple_rounds_up_fractional_quantity():
    assert round_up_to_multiple(121, 10) == 130


def test_build_procurement_recommendation_calculates_net_requirement_and_cost():
    result = build_procurement_recommendation(
        ProcurementInputs(
            forecast_demand_qty=150,
            confirmed_sales_order_qty=130,
            inventory_available_qty=40,
            purchase_in_transit_qty=20,
            production_in_transit_qty=10,
            reserved_qty=5,
            safety_stock_qty=30,
            reorder_min_qty=50,
            order_multiple_qty=10,
            scrap_rate=0.05,
            unit_purchase_cost=8.5,
        )
    )

    assert result.gross_requirement_qty == 180
    assert result.available_supply_qty == 65
    assert result.net_requirement_qty == 115
    assert result.recommended_order_qty == 130
    assert result.estimated_purchase_cost == 1105.0
