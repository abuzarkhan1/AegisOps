import unittest

from aegisops import AegisOpsConfig, AegisOpsMiddleware


class FakeClient:
    def __init__(self):
        self.config = AegisOpsConfig(
            api_key="aeg_test",
            project_key="project",
            service_name="service",
            environment="test",
            slow_request_threshold_ms=60_000,
            flush_interval_ms=0,
        )
        self.batch_metrics = []
        self.metrics = []
        self.logs = []

    def should_ignore_route(self, _path):
        return False

    def send_batch_metrics(self, metrics):
        self.batch_metrics.extend(metrics)

    def send_metric(self, metric):
        self.metrics.append(metric)

    def send_log(self, log):
        self.logs.append(log)


async def call_asgi(app, path="/api/orders", headers=None):
    messages = []
    scope = {
        "type": "http",
        "method": "GET",
        "path": path,
        "headers": headers or [],
        "client": ("127.0.0.1", 43210),
    }

    async def receive():
        return {"type": "http.request", "body": b"", "more_body": False}

    async def send(message):
        messages.append(message)

    await app(scope, receive, send)
    return messages


class MiddlewareTests(unittest.IsolatedAsyncioTestCase):
    async def test_middleware_captures_successful_request(self):
        client = FakeClient()

        async def app(_scope, _receive, send):
            await send({"type": "http.response.start", "status": 200, "headers": []})
            await send({"type": "http.response.body", "body": b"{}"})

        middleware = AegisOpsMiddleware(app, client=client)
        messages = await call_asgi(middleware, headers=[(b"x-request-id", b"req_1")])
        response_start = messages[0]
        response_headers = dict(response_start["headers"])

        self.assertEqual(response_headers[b"x-request-id"], b"req_1")
        self.assertIn(b"x-trace-id", response_headers)
        metric_names = {item["metricName"] for item in client.batch_metrics}
        self.assertIn("http_requests_total", metric_names)
        self.assertIn("http_request_duration_ms", metric_names)

    async def test_middleware_captures_exception_telemetry(self):
        client = FakeClient()

        async def app(_scope, _receive, _send):
            raise RuntimeError("boom")

        middleware = AegisOpsMiddleware(app, client=client)
        with self.assertRaises(RuntimeError):
            await call_asgi(middleware, path="/api/error")

        self.assertEqual(client.metrics[0]["metricName"], "exceptions_total")
        self.assertEqual(client.logs[0]["level"], "error")


if __name__ == "__main__":
    unittest.main()
