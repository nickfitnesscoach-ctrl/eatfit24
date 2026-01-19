"""
test_adapter.py — unit tests for normalize_proxy_response.

Covers:
- Wrapped AI Proxy format (result: {items, total, ...})
- Flat fallback format (items, total at root level)
- Edge cases (empty items, missing fields)
"""

from __future__ import annotations

from apps.ai_proxy.adapter import normalize_proxy_response


class TestNormalizeProxyResponse:
    """Tests for normalize_proxy_response()."""

    def test_wrapped_format_extracts_items_from_result(self):
        """
        Test: AI Proxy возвращает API-формат с обёрткой result
        Expected: items корректно извлекаются из result.items
        """
        raw = {
            "status": "success",
            "is_food": True,
            "confidence": 0.95,
            "trace_id": "trace-123",
            "result": {
                "items": [
                    {
                        "food_name_ru": "Пицца Маргарита",
                        "portion_weight_g": 250,
                        "calories": 590,
                        "protein_g": 23.5,
                        "fat_g": 22.0,
                        "carbs_g": 72.0,
                    }
                ],
                "total": {
                    "calories": 590,
                    "protein_g": 23.5,
                    "fat_g": 22.0,
                    "carbs_g": 72.0,
                },
                "model_notes": "Итальянская пицца на тонком тесте",
            },
        }

        result = normalize_proxy_response(raw, request_id="test-req")

        # Items extracted correctly
        assert len(result["items"]) == 1
        item = result["items"][0]
        assert item["name"] == "Пицца Маргарита"
        assert item["grams"] == 250
        assert item["calories"] == 590
        assert item["protein"] == 23.5
        assert item["fat"] == 22.0
        assert item["carbohydrates"] == 72.0

        # Totals extracted
        assert result["totals"]["calories"] == 590

        # Meta includes root-level fields
        assert result["meta"]["request_id"] == "test-req"
        assert result["meta"]["confidence"] == 0.95
        assert result["meta"]["is_food"] is True
        assert result["meta"]["trace_id"] == "trace-123"
        assert result["meta"]["model_notes"] == "Итальянская пицца на тонком тесте"

    def test_flat_format_fallback_works(self):
        """
        Test: Legacy/test format with items at root level
        Expected: items корректно читаются с root-уровня
        """
        raw = {
            "items": [
                {
                    "food_name_ru": "Банан",
                    "portion_weight_g": 120,
                    "calories": 108,
                    "protein_g": 1.3,
                    "fat_g": 0.4,
                    "carbs_g": 27.0,
                }
            ],
            "total": {
                "calories": 108,
                "protein_g": 1.3,
                "fat_g": 0.4,
                "carbs_g": 27.0,
            },
            "model_notes": "Спелый банан",
        }

        result = normalize_proxy_response(raw, request_id="flat-test")

        # Items extracted correctly from root
        assert len(result["items"]) == 1
        item = result["items"][0]
        assert item["name"] == "Банан"
        assert item["grams"] == 120
        assert item["calories"] == 108

        # Totals extracted
        assert result["totals"]["calories"] == 108

        # Meta
        assert result["meta"]["request_id"] == "flat-test"
        assert result["meta"]["model_notes"] == "Спелый банан"

    def test_wrapped_format_with_multiple_items(self):
        """
        Test: AI Proxy returns multiple items in wrapped format
        Expected: All items are normalized correctly
        """
        raw = {
            "status": "success",
            "confidence": 1.0,
            "result": {
                "items": [
                    {"food_name_ru": "Рис", "portion_weight_g": 150, "calories": 195},
                    {"food_name_ru": "Курица", "portion_weight_g": 100, "calories": 165},
                ],
                "total": {"calories": 360},
            },
        }

        result = normalize_proxy_response(raw)

        assert len(result["items"]) == 2
        assert result["items"][0]["name"] == "Рис"
        assert result["items"][1]["name"] == "Курица"

    def test_empty_result_in_wrapped_format(self):
        """
        Test: AI Proxy returns success but empty items in result
        Expected: items=[] is preserved
        """
        raw = {
            "status": "success",
            "confidence": 0.3,
            "zone": "yellow",
            "result": {
                "items": [],
                "total": {},
            },
        }

        result = normalize_proxy_response(raw)

        assert len(result["items"]) == 0
        assert result["meta"]["confidence"] == 0.3
        assert result["meta"]["zone"] == "yellow"

    def test_non_dict_returns_empty_with_warning(self):
        """
        Test: AI Proxy returns non-dict (null, string, etc.)
        Expected: empty items with warning
        """
        result = normalize_proxy_response(None, request_id="null-test")

        assert result["items"] == []
        assert result["meta"]["warning"] == "non-object-json"
        assert result["meta"]["request_id"] == "null-test"

    def test_model_notes_from_result_takes_priority(self):
        """
        Test: model_notes exists in both result and root
        Expected: result.model_notes takes priority
        """
        raw = {
            "model_notes": "Root level notes",
            "result": {
                "items": [],
                "model_notes": "Inner notes (priority)",
            },
        }

        result = normalize_proxy_response(raw)

        assert result["meta"]["model_notes"] == "Inner notes (priority)"

    def test_model_notes_fallback_to_root(self):
        """
        Test: model_notes only at root level (no result.model_notes)
        Expected: root model_notes is used
        """
        raw = {
            "model_notes": "Root level notes",
            "result": {
                "items": [],
            },
        }

        result = normalize_proxy_response(raw)

        assert result["meta"]["model_notes"] == "Root level notes"
