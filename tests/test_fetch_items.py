import contextlib
import io
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

import requests

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))

import fetch_items  # noqa: E402


class FakeResponse:
    def __init__(self, payload=None, content=b"", status=200):
        self._payload = payload
        self.content = content
        self.status_code = status

    def json(self):
        return self._payload

    def raise_for_status(self):
        if self.status_code >= 400:
            raise requests.HTTPError(f"status {self.status_code}")


class GetTests(unittest.TestCase):
    def test_retries_then_succeeds(self):
        calls = [requests.ConnectionError("down"), FakeResponse({"ok": 1})]
        with mock.patch("requests.get", side_effect=calls) as get, mock.patch("time.sleep"):
            self.assertEqual(fetch_items.get("http://x").json(), {"ok": 1})
        self.assertEqual(get.call_count, 2)

    def test_gives_up_after_the_retry_limit(self):
        with mock.patch("requests.get", side_effect=requests.ConnectionError("down")) as get, mock.patch("time.sleep"):
            with self.assertRaises(requests.ConnectionError):
                fetch_items.get("http://x")
        self.assertEqual(get.call_count, fetch_items.RETRIES)

    def test_every_request_has_a_timeout(self):
        with mock.patch("requests.get", return_value=FakeResponse({})) as get:
            fetch_items.get("http://x")
        self.assertEqual(get.call_args.kwargs["timeout"], fetch_items.TIMEOUT)

    def test_http_error_status_raises(self):
        with mock.patch("requests.get", return_value=FakeResponse(status=500)), mock.patch("time.sleep"):
            with self.assertRaises(requests.HTTPError):
                fetch_items.get("http://x")


class EquipmentDataTests(unittest.TestCase):
    def test_pages_are_combined(self):
        pages = [FakeResponse({"bucket": [{}] * 500}), FakeResponse({"bucket": [{}] * 3})]
        with mock.patch("requests.get", side_effect=pages):
            self.assertEqual(len(fetch_items.getEquipmentData()), 503)

    def test_a_failed_page_aborts_instead_of_returning_partial_data(self):
        pages = [FakeResponse({"bucket": [{}] * 500})] + [FakeResponse(status=503)] * fetch_items.RETRIES
        with mock.patch("requests.get", side_effect=pages), mock.patch("time.sleep"):
            with self.assertRaises(requests.HTTPError):
                fetch_items.getEquipmentData()

    def test_a_reply_without_bucket_data_aborts(self):
        with mock.patch("requests.get", return_value=FakeResponse({"error": "x"})):
            with self.assertRaises(RuntimeError):
                fetch_items.getEquipmentData()


class SanityTests(unittest.TestCase):
    def test_too_few_items_aborts(self):
        with self.assertRaises(RuntimeError):
            fetch_items.check_item_count(fetch_items.MIN_ITEMS - 1)
        fetch_items.check_item_count(fetch_items.MIN_ITEMS)

    def test_image_failures_abort_only_once_clearly_widespread(self):
        fetch_items.check_image_failures(failed=5, attempted=10)  # too small a sample to judge
        fetch_items.check_image_failures(failed=2, attempted=1000)
        with self.assertRaises(RuntimeError):
            fetch_items.check_image_failures(failed=200, attempted=1000)


class ImageNameTests(unittest.TestCase):
    def test_html_escapes_in_the_wiki_image_name_are_decoded(self):
        row = {'image': ['File:Perseriya&#39;s medallion.png']}
        self.assertEqual(fetch_items.image_name(row), "Perseriya's medallion.png")

    def test_file_prefix_is_dropped_and_the_last_image_is_used(self):
        row = {'image': ['File:Old.png', 'File:New.png']}
        self.assertEqual(fetch_items.image_name(row), 'New.png')

    def test_missing_image_is_an_empty_string(self):
        self.assertEqual(fetch_items.image_name({}), '')
        self.assertEqual(fetch_items.image_name({'image': []}), '')

    def test_local_file_name_replaces_unsafe_characters(self):
        self.assertEqual(fetch_items.image_path("Perseriya's medallion.png"), 'Perseriya_s medallion.png')


class MainLoggingTests(unittest.TestCase):
    def test_only_items_not_already_in_items_json_are_logged_as_processing(self):
        def wiki_row(page, name, item_id):
            return {'page_name_sub': page, 'item_name': name, 'item_id': [str(item_id)], 'image': []}

        known = {'name': 'Known item', 'id': 1, 'image': '', 'imagepath': ''}
        with tempfile.TemporaryDirectory() as tmp:
            items_path = Path(tmp) / 'items.json'
            items_path.write_text(json.dumps([known]))
            rows = [wiki_row('Known item', 'Known item', 1), wiki_row('New item', 'New item', 2)]
            out = io.StringIO()
            with mock.patch.object(fetch_items, 'FILE_NAME', str(items_path)), \
                    mock.patch.object(fetch_items, 'getEquipmentData', return_value=rows), \
                    mock.patch.object(fetch_items, 'check_item_count'), \
                    mock.patch.object(fetch_items, 'download_itemsmin'), \
                    mock.patch.object(fetch_items.item_meta, 'write_item_meta'), \
                    contextlib.redirect_stdout(out):
                fetch_items.main()
        log = out.getvalue()
        self.assertIn('Processing New item', log)
        self.assertNotIn('Processing Known item', log)


class DownloadItemsminTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.out = Path(self.tmp.name) / "itemsmin.js"

    def test_strips_the_prefix_and_writes_valid_json(self):
        body = b"PREFIX" + json.dumps([{"id": 1}]).encode()
        with mock.patch("requests.get", return_value=FakeResponse(content=body)):
            fetch_items.download_itemsmin("http://x", self.out)
        self.assertEqual(json.loads(self.out.read_text()), [{"id": 1}])

    def test_unparseable_download_raises_and_keeps_the_old_file(self):
        self.out.write_text("old")
        with mock.patch("requests.get", return_value=FakeResponse(content=b"PREFIX<html>oops")):
            with self.assertRaises(RuntimeError):
                fetch_items.download_itemsmin("http://x", self.out)
        self.assertEqual(self.out.read_text(), "old")

    def test_empty_list_is_rejected(self):
        with mock.patch("requests.get", return_value=FakeResponse(content=b"PREFIX[]")):
            with self.assertRaises(RuntimeError):
                fetch_items.download_itemsmin("http://x", self.out)

    def test_failed_request_raises(self):
        self.out.write_text("old")
        with mock.patch("requests.get", return_value=FakeResponse(status=404)), mock.patch("time.sleep"):
            with self.assertRaises(requests.HTTPError):
                fetch_items.download_itemsmin("http://x", self.out)
        self.assertEqual(self.out.read_text(), "old")


if __name__ == "__main__":
    unittest.main()
