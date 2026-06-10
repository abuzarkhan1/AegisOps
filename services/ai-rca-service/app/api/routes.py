import time
from typing import Any

from fastapi import APIRouter, Response
from prometheus_client import CONTENT_TYPE_LATEST, generate_latest

from app.core.metrics import (
    analysis_requests_total,
    deployment_impact_requests_total,
    log_summary_requests_total,
    postmortem_requests_total,
)
from app.core.settings import settings
from app.integrations.health import dependency_checks
from app.schemas.analysis import DeploymentImpactRequest, IncidentAnalysisRequest, LogSummaryRequest, PostmortemRequest
from app.services.rca_service import analyze_deployment_impact, analyze_incident, generate_postmortem, summarize_logs

router = APIRouter()


@router.get("/health")
def health() -> dict[str, Any]:
    checks = dependency_checks()
    status = "degraded" if any(check["status"] != "ok" for check in checks.values()) else "ok"

    return {
        "status": status,
        "healthStatus": "degraded" if status == "degraded" else "healthy",
        "service": settings.service_name,
        "mode": "local",
        "dependencies": {
            "postgres": "not_required",
            "redis": "healthy" if checks["redis"]["status"] == "ok" else "degraded",
            "kafka": "not_required",
            "rabbitmq": "healthy" if checks["rabbitmq"]["status"] == "ok" else "degraded",
        },
        "checks": checks,
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }


@router.get("/metrics")
def metrics() -> Response:
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)


@router.post("/analyze-incident")
def analyze_incident_route(payload: IncidentAnalysisRequest) -> dict[str, Any]:
    analysis_requests_total.inc()
    return analyze_incident(payload)


@router.post("/summarize-logs")
def summarize_logs_route(payload: LogSummaryRequest) -> dict[str, Any]:
    log_summary_requests_total.inc()
    return summarize_logs(payload)


@router.post("/generate-postmortem")
def generate_postmortem_route(payload: PostmortemRequest) -> dict[str, Any]:
    postmortem_requests_total.inc()
    return generate_postmortem(payload)


@router.post("/deployment-impact")
def deployment_impact_route(payload: DeploymentImpactRequest) -> dict[str, Any]:
    deployment_impact_requests_total.inc()
    return analyze_deployment_impact(payload)
