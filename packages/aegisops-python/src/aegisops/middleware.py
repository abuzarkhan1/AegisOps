from __future__ import annotations

import time
import uuid
from typing import Any, Dict, Iterable, Optional, Tuple

from .client import AegisOpsClient, AegisOpsConfig, create_aegisops_client


HeaderList = Iterable[Tuple[bytes, bytes]]


class AegisOpsMiddleware:
    def __init__(
        self,
        app,
        config: Optional[AegisOpsConfig] = None,
        client: Optional[AegisOpsClient] = None,
    ):
        self.app = app
        self.client = client or create_aegisops_client(config)

    async def __call__(self, scope: Dict[str, Any], receive, send):
        if scope.get("type") != "http":
            await self.app(scope, receive, send)
            return

        path = scope.get("path", "")
        if self.client.should_ignore_route(path):
            await self.app(scope, receive, send)
            return

        started = time.perf_counter()
        headers = _headers(scope.get("headers", []))
        request_id = headers.get("x-request-id") or headers.get("x-correlation-id") or str(uuid.uuid4())
        trace_id = headers.get("x-trace-id") or headers.get("traceparent") or str(uuid.uuid4())
        method = scope.get("method", "GET")
        route = path
        status_code = 500

        async def wrapped_send(message):
            nonlocal status_code
            if message.get("type") == "http.response.start":
                status_code = int(message.get("status", status_code))
                response_headers = list(message.get("headers", []))
                lower_names = {name.lower() for name, _value in response_headers}
                if b"x-request-id" not in lower_names:
                    response_headers.append((b"x-request-id", request_id.encode("utf-8")))
                if b"x-trace-id" not in lower_names:
                    response_headers.append((b"x-trace-id", trace_id.encode("utf-8")))
                message = {**message, "headers": response_headers}
            await send(message)

        try:
            await self.app(scope, receive, wrapped_send)
        except Exception as exc:
            duration_ms = _duration_ms(started)
            labels = _labels(method, route, 500)
            self.client.send_batch_metrics(
                [
                    {"metricName": "http_requests_total", "value": 1, "labels": labels},
                    {"metricName": "http_request_duration_ms", "value": duration_ms, "labels": labels},
                    {"metricName": "http_errors_total", "value": 1, "labels": labels},
                    {"metricName": "http_5xx_total", "value": 1, "labels": labels},
                    {"metricName": "exceptions_total", "value": 1, "labels": labels},
                ]
            )
            self.client.send_log(
                {
                    "level": "error",
                    "message": str(exc) or exc.__class__.__name__,
                    "requestId": request_id,
                    "traceId": trace_id,
                    "route": route,
                    "method": method,
                    "statusCode": 500,
                    "durationMs": duration_ms,
                    "metadata": _metadata(scope, route, 500, duration_ms, request_id, trace_id, self.client.config),
                }
            )
            raise

        duration_ms = _duration_ms(started)
        labels = _labels(method, route, status_code)
        metrics = [
            {"metricName": "http_requests_total", "value": 1, "labels": labels},
            {"metricName": "http_request_duration_ms", "value": duration_ms, "labels": labels},
        ]
        if status_code >= 400:
            metrics.append({"metricName": "http_errors_total", "value": 1, "labels": labels})
        if status_code >= 500:
            metrics.append({"metricName": "http_5xx_total", "value": 1, "labels": labels})
        elif status_code >= 400:
            metrics.append({"metricName": "http_4xx_total", "value": 1, "labels": labels})
        if duration_ms >= self.client.config.slow_request_threshold_ms:
            metrics.append({"metricName": "slow_requests_total", "value": 1, "labels": labels})
        self.client.send_batch_metrics(metrics)

        metadata = _metadata(scope, route, status_code, duration_ms, request_id, trace_id, self.client.config)
        if duration_ms >= self.client.config.slow_request_threshold_ms:
            self.client.send_log(
                {
                    "level": "warn",
                    "message": f"Slow request {method} {route}",
                    "requestId": request_id,
                    "traceId": trace_id,
                    "route": route,
                    "method": method,
                    "statusCode": status_code,
                    "durationMs": duration_ms,
                    "metadata": metadata,
                }
            )
        if status_code >= 500:
            self.client.send_log(
                {
                    "level": "error",
                    "message": f"HTTP {status_code} {method} {route}",
                    "requestId": request_id,
                    "traceId": trace_id,
                    "route": route,
                    "method": method,
                    "statusCode": status_code,
                    "durationMs": duration_ms,
                    "metadata": metadata,
                }
            )


def _headers(raw_headers: HeaderList) -> Dict[str, str]:
    return {
        name.decode("latin-1").lower(): value.decode("latin-1")
        for name, value in raw_headers
    }


def _labels(method: str, route: str, status_code: int) -> Dict[str, str]:
    return {"method": method, "route": route, "statusCode": str(status_code)}


def _duration_ms(started: float) -> float:
    return (time.perf_counter() - started) * 1000


def _metadata(
    scope: Dict[str, Any],
    route: str,
    status_code: int,
    duration_ms: float,
    request_id: str,
    trace_id: str,
    config: AegisOpsConfig,
) -> Dict[str, Any]:
    client = scope.get("client") or (None, None)
    headers = _headers(scope.get("headers", []))
    return {
        "route": route,
        "method": scope.get("method", "GET"),
        "statusCode": status_code,
        "durationMs": duration_ms,
        "requestId": request_id,
        "traceId": trace_id,
        "userAgent": headers.get("user-agent"),
        "ip": client[0],
        "projectKey": config.project_key,
        "serviceName": config.service_name,
        "environment": config.environment,
    }
