import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))

import item_updates  # noqa: E402


def item(item_id, name=None, image="a.png"):
    return {"name": name or f"item {item_id}", "id": item_id, "image": image, "imagepath": image}


class LimitUpdatesTests(unittest.TestCase):
    def test_no_limit_returns_the_new_list(self):
        old = [item(1)]
        new = [item(1), item(2)]
        result = item_updates.limit_updates(old, new, None)
        self.assertEqual(result.items, new)
        self.assertEqual((result.applied, result.pending), (1, 0))
        self.assertEqual(result.changed, [item(2)])

    def test_only_the_first_n_changed_ids_are_applied(self):
        old = []
        new = [item(3), item(1), item(2)]
        result = item_updates.limit_updates(old, new, 2)
        self.assertEqual({i["id"] for i in result.items}, {1, 2})  # ids ascending, 3 waits
        self.assertEqual((result.applied, result.pending), (2, 1))

    def test_unchanged_items_do_not_count(self):
        old = [item(1), item(2)]
        new = [item(1), item(2), item(3)]
        result = item_updates.limit_updates(old, new, 1)
        self.assertEqual({i["id"] for i in result.items}, {1, 2, 3})
        self.assertEqual((result.applied, result.pending), (1, 0))

    def test_an_edit_counts_once_and_applies_whole(self):
        old = [item(1, "Old name", "old.png")]
        new = [item(1, "New name", "new.png")]
        result = item_updates.limit_updates(old, new, 1)
        self.assertEqual(result.items, new)  # old entry is gone, not duplicated
        self.assertEqual(result.applied, 1)

    def test_an_edit_past_the_cap_keeps_the_old_entry(self):
        old = [item(1, "A old"), item(2, "B old")]
        new = [item(1, "A new"), item(2, "B new")]
        result = item_updates.limit_updates(old, new, 1)
        self.assertEqual([i["name"] for i in result.items], ["A new", "B old"])
        self.assertEqual(result.pending, 1)

    def test_removals_count_and_apply(self):
        old = [item(1), item(2)]
        new = [item(1)]
        result = item_updates.limit_updates(old, new, 5)
        self.assertEqual(result.items, new)
        self.assertEqual(result.changed, [])  # nothing new to download images for

    def test_items_sharing_an_id_move_together(self):
        old = []
        new = [item(7, "Variant a", "a.png"), item(7, "Variant b", "b.png"), item(8)]
        result = item_updates.limit_updates(old, new, 1)
        self.assertEqual(sorted(i["name"] for i in result.items), ["Variant a", "Variant b"])

    def test_items_without_an_id_group_by_name(self):
        old = []
        new = [item(None, "No id one"), item(None, "No id two")]
        result = item_updates.limit_updates(old, new, 1)
        self.assertEqual(len(result.items), 1)
        self.assertEqual(result.pending, 1)

    def test_output_is_sorted_by_name_like_the_full_list(self):
        new = [item(1, "Zed"), item(2, "Alpha")]
        result = item_updates.limit_updates([], new, None)
        self.assertEqual([i["name"] for i in result.items], ["Alpha", "Zed"])


if __name__ == "__main__":
    unittest.main()
