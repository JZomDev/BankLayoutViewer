import subprocess
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MAX_LINES = 1000
SUFFIXES = {".py", ".html", ".js", ".css"}
GENERATED = ("cdn/",)


class FileSizeTest(unittest.TestCase):
    def test_hand_written_files_stay_under_cap(self):
        tracked = subprocess.run(
            ["git", "ls-files"], cwd=ROOT, capture_output=True, text=True, check=True
        ).stdout.splitlines()
        too_long = []
        for name in tracked:
            if name.startswith(GENERATED) or Path(name).suffix not in SUFFIXES:
                continue
            lines = len((ROOT / name).read_text(encoding="utf-8").splitlines())
            if lines > MAX_LINES:
                too_long.append(f"{name}: {lines}")
        self.assertEqual(too_long, [], "files over the cap; plan a split")


if __name__ == "__main__":
    unittest.main()
