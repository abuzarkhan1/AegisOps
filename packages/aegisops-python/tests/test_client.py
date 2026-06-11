import json
import threading
import unittest
from http.server import BaseHTTPRequestHandler, HTTPServer

from aegisops import AegisOpsClient, AegisOpsConfig


class Collector(BaseHTTPRequestHandler):
    requests = []

    def do_POST(self):
        length = int(self.headers.get("content-length", "0"))
        body = self.rfile.read(length).decode("utf-8")
        Collector.requests.append({"path": self.path, "body": json.loads(body)})
        self.send_response(202)
        self.end_headers()
        self.wfile.write(b"{}")

    def log_message(self, *_args):
        return


class ClientTests(unittest.TestCase):
    def setUp(self):
        Collector.requests = []
        self.server = HTTPServer(("127.0.0.1", 0), Collector)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.url = f"http://127.0.0.1:{self.server.server_port}"

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()

    def config(self, **patch):
        values = dict(
            api_url=self.url,
            api_key="aeg_test",
            project_key="project",
            service_name="service",
            environment="test",
            batch_size=2,
            flush_interval_ms=0,
        )
        values.update(patch)
        return AegisOpsConfig(**values)

    def test_batching_flushes_by_batch_size(self):
        client = AegisOpsClient(self.config())
        client.send_metric({"metricName": "one", "value": 1})
        self.assertEqual(Collector.requests, [])
        client.send_metric({"metricName": "two", "value": 2})
        self.assertEqual(Collector.requests[0]["path"], "/metrics-api/metrics/batch")
        self.assertEqual(len(Collector.requests[0]["body"]["metrics"]), 2)
        client.shutdown()

    def test_disabled_client_sends_nothing(self):
        client = AegisOpsClient(self.config(enabled=False))
        client.send_log({"message": "disabled"})
        client.send_metric({"metricName": "disabled", "value": 1})
        client.flush()
        self.assertEqual(Collector.requests, [])
        client.shutdown()


if __name__ == "__main__":
    unittest.main()
