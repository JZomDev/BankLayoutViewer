import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))

import item_meta  # noqa: E402


class BuildItemMetaTests(unittest.TestCase):
    def test_names_and_placeholders_only_for_wanted_ids(self):
        items = [{"id": 10}, {"id": 20}]
        itemsmin = [
            {"id": 10, "name": "Ten"},
            {"id": 99, "name": "Other", "placeholderId": 20},
            {"id": 30, "name": "Unwanted"},
            {"id": 31, "name": "Points at unwanted", "placeholderId": 77},
        ]
        meta = item_meta.build_item_meta(items, itemsmin)
        self.assertEqual(meta, {"names": {10: "Ten"}, "placeholders": {20: 99}})

    def test_first_entry_wins_like_array_find(self):
        items = [{"id": 10}]
        itemsmin = [
            {"id": 10, "name": "First", "placeholderId": 10},
            {"id": 10, "name": "Second", "placeholderId": 10},
        ]
        meta = item_meta.build_item_meta(items, itemsmin)
        self.assertEqual(meta["names"], {10: "First"})
        self.assertEqual(meta["placeholders"], {10: 10})

    def test_items_without_an_integer_id_are_ignored(self):
        meta = item_meta.build_item_meta([{"name": "x"}, {"id": "5"}], [{"id": 5, "name": "Five"}])
        self.assertEqual(meta, {"names": {}, "placeholders": {}})


class OddDataTests(unittest.TestCase):
    def test_bool_float_and_missing_ids_are_ignored(self):
        items = [{"id": 1}, {"id": 10}]
        itemsmin = [
            {"id": True, "name": "bool", "placeholderId": 1},
            {"id": 10.0, "name": "float"},
            {"name": "no id", "placeholderId": 10},
            {"id": 3, "name": "ok", "placeholderId": 10.0},
        ]
        meta = item_meta.build_item_meta(items, itemsmin)
        self.assertEqual(meta, {"names": {}, "placeholders": {}})


class GeneratedFileTests(unittest.TestCase):
    def test_itemmeta_json_is_in_sync_with_its_sources(self):
        items = json.loads(item_meta.ITEMS_PATH.read_text(encoding="utf-8"))
        itemsmin = json.loads(item_meta.ITEMSMIN_PATH.read_text(encoding="utf-8"))
        expected = item_meta.build_item_meta(items, itemsmin)
        committed = json.loads(item_meta.META_PATH.read_text(encoding="utf-8"))
        # JSON object keys are strings, so compare through a round trip
        self.assertEqual(committed, json.loads(json.dumps(expected)), "run: python scripts/item_meta.py")


if __name__ == "__main__":
    unittest.main()
