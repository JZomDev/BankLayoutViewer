import os
import shutil
import subprocess
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def find_node():
    local = sorted((ROOT / "tests" / ".node").glob("*/bin/node"))
    return os.environ.get("NODE") or shutil.which("node") or (str(local[0]) if local else None)


class JsTests(unittest.TestCase):
    def test_node_tests_pass(self):
        node = find_node()
        if node is None:
            self.skipTest("node not found")
        result = subprocess.run(
            [node, "--test", "tests/migrate.test.js"], cwd=ROOT, capture_output=True, text=True
        )
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)


if __name__ == "__main__":
    unittest.main()
