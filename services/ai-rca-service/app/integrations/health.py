import socket
import urllib.parse

from redis import Redis

from app.core.settings import settings


def check_tcp(host: str, port: int) -> dict[str, str]:
    try:
        with socket.create_connection((host, port), timeout=1.5):
            return {"status": "ok"}
    except OSError as exc:
        return {"status": "degraded", "detail": str(exc)}


def check_redis() -> dict[str, str]:
    try:
        Redis.from_url(settings.redis_url, socket_connect_timeout=1.5, socket_timeout=1.5).ping()
        return {"status": "ok"}
    except Exception as exc:  # noqa: BLE001
        return {"status": "degraded", "detail": str(exc)}


def check_rabbitmq() -> dict[str, str]:
    parsed = urllib.parse.urlparse(settings.rabbitmq_url)
    host = parsed.hostname or "rabbitmq"
    port = parsed.port or 5672
    return check_tcp(host, port)


def dependency_checks() -> dict[str, dict[str, str]]:
    return {
        "redis": check_redis(),
        "rabbitmq": check_rabbitmq(),
    }
