import json
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))

import build_stored_layouts  # noqa: E402


class StoredLayoutsFolderTests(unittest.TestCase):
    def test_index_lists_the_layout_files_but_not_itself(self):
        with tempfile.TemporaryDirectory() as tmp:
            for name in ("b.json", "a.json", "index.json", "notes.txt"):
                (Path(tmp) / name).write_text("{}")
            self.assertEqual(build_stored_layouts.layout_files(tmp), ["a.json", "b.json"])

    def test_committed_index_matches_the_folder(self):
        index = json.loads((build_stored_layouts.FOLDER / "index.json").read_text(encoding="utf-8"))
        self.assertEqual(index, build_stored_layouts.layout_files(), "run: make layouts")


if __name__ == "__main__":
    unittest.main()
