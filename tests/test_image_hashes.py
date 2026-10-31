import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))

import image_hashes  # noqa: E402


class Reply:
    def __init__(self, payload):
        self._payload = payload

    def json(self):
        return self._payload


def api_reply(hashes, normalized=None):
    pages = {str(i): {"title": t, "imageinfo": [{"sha1": h}]} for i, (t, h) in enumerate(hashes.items())}
    pages["-1"] = {"title": "File:Gone.png", "missing": ""}
    query = {"pages": pages}
    if normalized:
        query["normalized"] = [{"from": a, "to": b} for a, b in normalized.items()]
    return Reply({"query": query})


class FetchHashesTests(unittest.TestCase):
    def test_returns_the_sha1_for_each_wiki_file_name(self):
        get = mock.Mock(return_value=api_reply({"File:Abyssal whip.png": "aaa"}))
        result = image_hashes.fetch_hashes(get, ["Abyssal whip.png", "Gone.png"])
        self.assertEqual(result, {"Abyssal whip.png": "aaa"})  # a missing file is left out

    def test_names_are_asked_for_in_batches(self):
        names = [f"n{i}.png" for i in range(image_hashes.BATCH + 1)]
        get = mock.Mock(side_effect=lambda *a, **k: api_reply({}))
        with mock.patch("time.sleep"):
            image_hashes.fetch_hashes(get, names)
        self.assertEqual(get.call_count, 2)
        first = get.call_args_list[0].kwargs["params"]["titles"].split("|")
        self.assertEqual(len(first), image_hashes.BATCH)

    def test_a_normalised_title_maps_back_to_the_name_we_asked_for(self):
        get = mock.Mock(return_value=api_reply({"File:Abyssal whip.png": "aaa"}, {"File:Abyssal_whip.png": "File:Abyssal whip.png"}))
        result = image_hashes.fetch_hashes(get, ["Abyssal_whip.png"])
        self.assertEqual(result, {"Abyssal_whip.png": "aaa"})


class StaleTests(unittest.TestCase):
    wanted = {"1.png": "A.png", "2.png": "B.png", "3.png": "C.png", "4.png": "D.png"}

    def test_decisions(self):
        stored = {"1.png": "old", "2.png": "same"}
        wiki = {"A.png": "new", "B.png": "same", "C.png": "x", "D.png": "y"}
        on_disk = {"1.png", "2.png", "3.png"}  # 4.png is missing
        stale, adopted = image_hashes.stale(self.wanted, stored, wiki, on_disk.__contains__)
        self.assertEqual(stale, {"1.png"})  # changed on the wiki
        self.assertEqual(adopted, {"3.png": "x"})  # on disk, never hashed: trusted and recorded
        # 2.png is unchanged; 4.png is missing, which the normal download loop already handles

    def test_a_file_the_wiki_gave_no_hash_for_is_left_alone(self):
        stale, adopted = image_hashes.stale({"1.png": "A.png"}, {"1.png": "old"}, {}, lambda p: True)
        self.assertEqual((stale, adopted), (set(), {}))


class StoreTests(unittest.TestCase):
    def test_load_of_a_missing_file_is_empty_and_save_round_trips(self):
        with tempfile.TemporaryDirectory() as d:
            path = Path(d) / "image-hashes.json"
            self.assertEqual(image_hashes.load(path), {})
            image_hashes.save(path, {"2.png": "b", "1.png": "a"})
            self.assertEqual(image_hashes.load(path), {"1.png": "a", "2.png": "b"})
            self.assertEqual(list(json.loads(path.read_text())), ["1.png", "2.png"])  # sorted: stable diffs


if __name__ == "__main__":
    unittest.main()
