from typing import Any

from pydantic import BaseModel, Field


class IncidentAnalysisRequest(BaseModel):
    incidentId: str = Field(default="local-incident")
    organizationId: str | None = None
    serviceId: str | None = None
    serviceName: str = Field(default="payment-api")
    environment: str = Field(default="production")
    severity: str | None = None
    symptoms: list[str] = Field(default_factory=list)
    logs: list[dict[str, Any]] = Field(default_factory=list)
    metrics: dict[str, Any] = Field(default_factory=dict)
    metricsSummary: dict[str, Any] = Field(default_factory=dict)
    deployment: dict[str, Any] | None = None
    alertRule: dict[str, Any] | None = None


class LogSummaryRequest(BaseModel):
    organizationId: str | None = None
    serviceId: str | None = None
    serviceName: str = Field(default="unknown-service")
    logs: list[dict[str, Any]] = Field(default_factory=list)


class PostmortemRequest(BaseModel):
    incidentId: str
    summary: str | None = None
    timeline: list[dict[str, Any]] = Field(default_factory=list)
    rootCause: str | None = None
    actions: list[str] = Field(default_factory=list)


class DeploymentImpactRequest(BaseModel):
    deploymentId: str = Field(default="dep_local")
    serviceName: str = Field(default="payment-api")
    beforeMetrics: dict[str, float] = Field(default_factory=dict)
    afterMetrics: dict[str, float] = Field(default_factory=dict)
