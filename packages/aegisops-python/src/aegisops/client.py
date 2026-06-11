from __future__ import annotations

import atexit
import json
import os
import sys
import threading
import time
import urllib.error
import urllib.request
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, Iterable, List, Optional


def _env_bool(name: str, default: bool) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() not in {"0", "false", "no", "off"}


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


@dataclass
class AegisOpsConfig:
    enabled: bool = True
    api_url: str = "http://localhost:8080"
    api_key: Optional[str] = None
    project_key: Optional[str] = None
    service_name: Optional[str] = None
    environment: str = "development"
    capture_request_body: bool = False
    capture_response_body: bool = False
    capture_headers: bool = False
    ignored_routes: List[str] = field(default_factory=lambda: ["/health", "/metrics", "/favicon.ico"])
    slow_request_threshold_ms: int = 1000
    flush_interval_ms: int = 5000
    batch_size: int = 20
    debug: bool = False
    timeout_ms: int = 1500

    @classmethod
    def from_env(cls) -> "AegisOpsConfig":
        return cls(
            enabled=_env_bool("AEGISOPS_ENABLED", True),
            api_url=os.getenv("AEGISOPS_API_URL", "http://localhost:8080"),
            api_key=os.getenv("AEGISOPS_API_KEY"),
            project_key=os.getenv("AEGISOPS_PROJECT_KEY"),
            service_name=os.getenv("AEGISOPS_SERVICE_NAME"),
            environment=os.getenv("AEGISOPS_ENVIRONMENT", os.getenv("ENVIRONMENT", "development")),
        )


_clients: List["AegisOpsClient"] = []


class AegisOpsClient:
    def __init__(self, config: Optional[AegisOpsConfig] = None):
        self.config = config or AegisOpsConfig.from_env()
        self.config.api_url = self.config.api_url.rstrip("/")
        self._metrics: List[Dict[str, Any]] = []
        self._lock = threading.RLock()
        self._stop = threading.Event()
        self._thread: Optional[threading.Thread] = None
        _clients.append(self)

        if self.config.enabled and self.config.flush_interval_ms > 0:
            self._thread = threading.Thread(target=self._flush_loop, name="aegisops-flush", daemon=True)
            self._thread.start()

    def can_send(self) -> bool:
        return bool(
            self.config.enabled
            and self.config.api_key
            and self.config.project_key
            and self.config.service_name
        )

    def should_ignore_route(self, path: str) -> bool:
        return any(path == route or path.startswith(f"{route}/") for route in self.config.ignored_routes)

    def send_log(self, log: Dict[str, Any]) -> None:
        if not self.can_send():
            self._debug("log dropped because SDK is disabled or config is incomplete")
            return
        payload = {
            "projectKey": self.config.project_key,
            "serviceName": self.config.service_name,
            "environment": self.config.environment,
            "level": log.get("level", "info"),
            "message": log["message"],
            "traceId": log.get("traceId"),
            "requestId": log.get("requestId"),
            "route": log.get("route"),
            "method": log.get("method"),
            "statusCode": log.get("statusCode"),
            "durationMs": log.get("durationMs"),
            "timestamp": log.get("timestamp", _utc_now()),
            "metadata": log.get("metadata", {}),
        }
        self._post_json("/ingest/logs", payload)

    def send_metric(self, metric: Dict[str, Any]) -> None:
        self.send_batch_metrics([metric])

    def send_batch_metrics(self, metrics: Iterable[Dict[str, Any]]) -> None:
        if not self.can_send():
            self._debug("metrics dropped because SDK is disabled or config is incomplete")
            return
        normalized = []
        for metric in metrics:
            normalized.append(
                {
                    "metricName": metric["metricName"],
                    "value": metric["value"],
                    "labels": metric.get("labels", {}),
                    "timestamp": metric.get("timestamp", _utc_now()),
                }
            )
        if not normalized:
            return
        with self._lock:
            self._metrics.extend(normalized)
            should_flush = len(self._metrics) >= self.config.batch_size
        if should_flush:
            self.flush()

    def flush(self) -> None:
        if not self.can_send():
            return
        while True:
            with self._lock:
                if not self._metrics:
                    return
                batch = self._metrics[: self.config.batch_size]
                del self._metrics[: self.config.batch_size]
            self._post_json(
                "/metrics-api/metrics/batch",
                {
                    "projectKey": self.config.project_key,
                    "serviceName": self.config.service_name,
                    "environment": self.config.environment,
                    "metrics": batch,
                },
            )

    def shutdown(self) -> None:
        self._stop.set()
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=1)
        self.flush()

    def _flush_loop(self) -> None:
        interval = max(self.config.flush_interval_ms / 1000.0, 0.1)
        while not self._stop.wait(interval):
            self.flush()

    def _post_json(self, path: str, payload: Dict[str, Any]) -> None:
        body = json.dumps(payload, separators=(",", ":")).encode("utf-8")
        request = urllib.request.Request(
            f"{self.config.api_url}{path}",
            data=body,
            method="POST",
            headers={
                "Authorization": f"Bearer {self.config.api_key}",
                "Content-Type": "application/json",
            },
        )
        timeout = max(self.config.timeout_ms / 1000.0, 0.1)
        for attempt in range(1, 4):
            try:
                with urllib.request.urlopen(request, timeout=timeout) as response:
                    if 200 <= response.status < 300:
                        return
                    raise urllib.error.HTTPError(request.full_url, response.status, "AegisOps error", response.headers, None)
            except Exception as exc:  # noqa: BLE001 - SDK must never crash the host app.
                if attempt == 3:
                    self._debug(f"dropping telemetry after {attempt} failed attempts to {path}: {exc}")
                    return
                time.sleep(0.1 * (2 ** (attempt - 1)))

    def _debug(self, message: str) -> None:
        if self.config.debug:
            print(f"[aegisops] {message}", file=sys.stderr)


_default_client: Optional[AegisOpsClient] = None


def create_aegisops_client(config: Optional[AegisOpsConfig] = None) -> AegisOpsClient:
    return AegisOpsClient(config)


def _client() -> AegisOpsClient:
    global _default_client
    if _default_client is None:
        _default_client = AegisOpsClient()
    return _default_client


def send_log(log: Dict[str, Any]) -> None:
    _client().send_log(log)


def send_metric(metric: Dict[str, Any]) -> None:
    _client().send_metric(metric)


def send_batch_metrics(metrics: Iterable[Dict[str, Any]]) -> None:
    _client().send_batch_metrics(metrics)


@atexit.register
def _flush_at_exit() -> None:
    for client in list(_clients):
        client.shutdown()
