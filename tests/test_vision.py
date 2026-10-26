import json
import sys
import tempfile
import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "vision"))
from logic import can_publish, send_counts, summarize
from prepare_data import check_label, prepare


class Tests(unittest.TestCase):
    def test_rate_zero_and_missing_targets(self):
        counts = summarize([0]*18+[1]*2)
        self.assertEqual(counts["germination_pct"], 90)
        self.assertTrue(can_publish(counts, 20))
        self.assertFalse(can_publish(counts, 21))
        self.assertIsNone(summarize([])["germination_pct"])
        self.assertFalse(can_publish(summarize([])))
        with self.assertRaises(ValueError):
            summarize([2])

    def test_splits_and_labels(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            (root / "images").mkdir()
            (root / "labels").mkdir()
            for i in range(20):
                (root / "images" / f"{i}.jpg").write_bytes(b"fixture")
                (root / "labels" / f"{i}.txt").write_text("0 0.5 0.5 0.2 0.2\n")
            self.assertEqual(prepare(root, root / "split"), {"val": 2, "test": 4, "train": 14})
            sets = [set((root / "split" / f"{s}.txt").read_text().splitlines()) for s in ["train", "val", "test"]]
            self.assertFalse(sets[0] & sets[1] or sets[1] & sets[2] or sets[0] & sets[2])
            label = root / "labels/0.txt"
            label.write_text("1 0.1 0.1 0.8 0.8")
            with self.assertRaises(ValueError):
                check_label(label)

    def test_cloud_request_uses_detected_denominator(self):
        captured = {}
        class Handler(BaseHTTPRequestHandler):
            def log_message(self, *args):
                pass
            def do_POST(self):
                captured.update(path=self.path, auth=self.headers.get("Authorization"), body=json.loads(self.rfile.read(int(self.headers["Content-Length"]))))
                body = b'{"id":1,"state":"sent"}'
                self.send_response(202)
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
        server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            self.assertEqual(send_counts(summarize([0]*18+[1]*2), f"http://127.0.0.1:{server.server_port}", "test-key")["id"], 1)
            self.assertEqual(captured, {"path": "/api/germination", "auth": "Bearer test-key", "body": {"germinated": 18, "total": 20}})
        finally:
            server.shutdown()
            server.server_close()
            thread.join()


if __name__ == "__main__":
    unittest.main(verbosity=2)
