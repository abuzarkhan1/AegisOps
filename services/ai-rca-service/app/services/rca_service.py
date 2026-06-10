from collections import Counter
from typing import Any

from app.schemas.analysis import DeploymentImpactRequest, IncidentAnalysisRequest, LogSummaryRequest, PostmortemRequest


def analyze_incident(payload: IncidentAnalysisRequest) -> dict:
    log_summary = summarize_logs(
        LogSummaryRequest(
            organizationId=payload.organizationId,
            serviceId=payload.serviceId,
            serviceName=payload.serviceName,
            logs=payload.logs,
        )
    )
    metrics = payload.metricsSummary or payload.metrics
    error_rate = float(metrics.get("errorRate", metrics.get("error_rate", 0)) or 0)
    p95_latency = float(metrics.get("p95LatencyMs", metrics.get("p95_latency_ms", 0)) or 0)
    deployment_version = ""
    if payload.deployment:
        deployment_version = str(payload.deployment.get("version") or payload.deployment.get("commitSha") or "")

    evidence = list(log_summary["topPatterns"])
    if error_rate:
        evidence.append(f"Error rate is {error_rate:.2f}%")
    if p95_latency:
        evidence.append(f"P95 latency is {p95_latency:.0f}ms")
    if deployment_version:
        evidence.append(f"Recent deployment context: {deployment_version}")
    if not evidence:
        evidence = ["No high-confidence evidence supplied yet"]

    confidence_score = 0.55
    if log_summary["errorCount"] > 0:
        confidence_score += 0.15
    if error_rate >= 5:
        confidence_score += 0.15
    if payload.deployment:
        confidence_score += 0.1
    confidence_score = min(confidence_score, 0.95)

    return {
        "incidentId": payload.incidentId,
        "organizationId": payload.organizationId,
        "serviceId": payload.serviceId,
        "serviceName": payload.serviceName,
        "environment": payload.environment,
        "summary": build_summary(payload, log_summary, error_rate),
        "logSummary": log_summary,
        "likelyRootCause": infer_root_cause(log_summary, metrics, payload.deployment),
        "severityExplanation": severity_explanation(payload.severity, error_rate),
        "confidenceScore": round(confidence_score, 2),
        "evidence": evidence,
        "recommendedActions": recommended_actions(log_summary, metrics, bool(payload.deployment)),
        "rollbackRecommendation": rollback_recommendation(error_rate, bool(payload.deployment)),
        "postmortemDraft": build_postmortem_draft(payload, evidence),
    }


def summarize_logs(payload: LogSummaryRequest) -> dict:
    level_counts: Counter[str] = Counter()
    message_counts: Counter[str] = Counter()
    route_counts: Counter[str] = Counter()

    for item in payload.logs:
        level = str(item.get("level") or "unknown").lower()
        message = str(item.get("message") or "").strip()
        metadata = item.get("metadata") if isinstance(item.get("metadata"), dict) else {}
        route = str(metadata.get("route") or metadata.get("path") or "").strip()

        level_counts[level] += 1
        if message:
            message_counts[message] += 1
        if route:
            route_counts[route] += 1

    error_count = sum(level_counts[level] for level in ("error", "fatal", "critical"))
    top_patterns = [
        f"{count}x {message}"
        for message, count in message_counts.most_common(5)
    ]

    return {
        "organizationId": payload.organizationId,
        "serviceId": payload.serviceId,
        "serviceName": payload.serviceName,
        "logCount": len(payload.logs),
        "errorCount": error_count,
        "levelCounts": dict(level_counts),
        "topPatterns": top_patterns,
        "topRoutes": [{"route": route, "count": count} for route, count in route_counts.most_common(5)],
    }


def generate_postmortem(payload: PostmortemRequest) -> dict:
    return {
        "incidentId": payload.incidentId,
        "title": f"Postmortem for {payload.incidentId}",
        "summary": payload.summary or "Incident summary pending final engineering review.",
        "rootCause": payload.rootCause or "Root cause is pending RCA confirmation.",
        "timeline": payload.timeline,
        "correctiveActions": payload.actions,
        "status": "draft",
    }


def analyze_deployment_impact(payload: DeploymentImpactRequest) -> dict:
    before_error_rate = payload.beforeMetrics.get("errorRate", 0)
    after_error_rate = payload.afterMetrics.get("errorRate", 0)
    increase = after_error_rate - before_error_rate
    return {
        "deploymentId": payload.deploymentId,
        "serviceName": payload.serviceName,
        "summary": f"Error rate changed by {increase:.2f} percentage points after deployment.",
        "risk": "high" if increase >= 5 else "medium" if increase > 0 else "low",
        "beforeMetrics": payload.beforeMetrics,
        "afterMetrics": payload.afterMetrics,
    }


def build_summary(payload: IncidentAnalysisRequest, log_summary: dict[str, Any], error_rate: float) -> str:
    parts = [f"{payload.serviceName} has {log_summary['errorCount']} error logs in the provided window."]
    if error_rate:
        parts.append(f"Reported error rate is {error_rate:.2f}%.")
    if payload.deployment:
        parts.append("Recent deployment context is present.")
    return " ".join(parts)


def infer_root_cause(log_summary: dict[str, Any], metrics: dict[str, Any], deployment: dict[str, Any] | None) -> str:
    patterns = " ".join(log_summary.get("topPatterns", [])).lower()
    if "timeout" in patterns:
        return "Repeated timeout errors suggest downstream dependency or database latency."
    if "connection refused" in patterns or "connection reset" in patterns:
        return "Connection failures suggest a network, service discovery, or dependency availability issue."
    if float(metrics.get("p95LatencyMs", 0) or 0) >= 1000:
        return "High tail latency suggests saturation or slow downstream calls."
    if deployment:
        return "The issue may be related to a recent deployment; compare changed code paths with failing routes."
    return "Root cause is inconclusive from the supplied evidence."


def severity_explanation(severity: str | None, error_rate: float) -> str:
    if severity:
        return f"Severity was supplied as {severity} by the incident source."
    if error_rate >= 10:
        return "High severity because error rate is above 10%."
    if error_rate >= 5:
        return "Medium severity because error rate is elevated."
    return "Severity is low until additional impact data is supplied."


def recommended_actions(log_summary: dict[str, Any], metrics: dict[str, Any], has_deployment: bool) -> list[str]:
    actions = ["Inspect the top error pattern and affected route."]
    patterns = " ".join(log_summary.get("topPatterns", [])).lower()
    if "timeout" in patterns:
        actions.append("Check database and external dependency latency.")
    if float(metrics.get("p95LatencyMs", 0) or 0) >= 1000:
        actions.append("Profile slow endpoints and check queue or connection pool saturation.")
    if has_deployment:
        actions.append("Compare recent deployment changes against the first failing timestamp.")
    actions.append("Update the incident timeline with confirmed evidence.")
    return actions


def rollback_recommendation(error_rate: float, has_deployment: bool) -> str:
    if has_deployment and error_rate >= 10:
        return "Rollback is recommended if the error rate does not recover within 10 minutes."
    if has_deployment:
        return "Prepare rollback, but confirm deployment correlation before executing."
    return "Rollback is not recommended without deployment correlation."


def build_postmortem_draft(payload: IncidentAnalysisRequest, evidence: list[str]) -> str:
    evidence_text = "; ".join(evidence[:3])
    return (
        f"Incident {payload.incidentId} affected {payload.serviceName}. "
        f"Initial evidence: {evidence_text}. "
        "Final root cause and corrective actions should be confirmed by the responder."
    )
