import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))

import item_variations  # noqa: E402


class BuildVariationsTests(unittest.TestCase):
    def test_maps_every_non_base_id_to_the_first_id_of_its_group(self):
        raw = {"glory": [1704, 1706, 1708], "toolkit": [1, 4051]}
        self.assertEqual(
            item_variations.build_variations(raw), {"1706": 1704, "1708": 1704, "4051": 1}
        )

    def test_single_item_groups_and_bad_entries_are_ignored(self):
        raw = {"one": [5], "empty": [], "bad": "x", "mixed": [7, "8", True, 9.5, 10]}
        self.assertEqual(item_variations.build_variations(raw), {"10": 7})

    def test_first_group_wins_when_an_id_is_in_two(self):
        raw = {"a": [1, 3], "b": [2, 3]}
        self.assertEqual(item_variations.build_variations(raw), {"3": 1})

    def test_rejects_something_that_is_not_a_group_object(self):
        with self.assertRaises(ValueError):
            item_variations.build_variations([1, 2])
        with self.assertRaises(ValueError):
            item_variations.build_variations({})


class GeneratedFileTests(unittest.TestCase):
    def test_committed_file_matches_runelite_semantics_for_the_glory(self):
        committed = json.loads(item_variations.VARIATIONS_PATH.read_text(encoding="utf-8"))
        self.assertEqual(committed["1712"], 1704)  # amulet of glory(4) -> glory (uncharged)
        self.assertNotIn("1704", committed)  # base ids are not keys


if __name__ == "__main__":
    unittest.main()
