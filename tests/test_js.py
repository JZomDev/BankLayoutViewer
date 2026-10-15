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
        node_tests = sorted(str(p.relative_to(ROOT)) for p in (ROOT / "tests").glob("*.test.js"))
        result = subprocess.run(
            [node, "--test", *node_tests], cwd=ROOT, capture_output=True, text=True
        )
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)


if __name__ == "__main__":
    unittest.main()
