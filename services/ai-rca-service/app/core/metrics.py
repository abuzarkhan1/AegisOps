from prometheus_client import Counter


analysis_requests_total = Counter(
    "aegisops_ai_rca_analysis_requests_total",
    "Total incident analysis requests received",
)

postmortem_requests_total = Counter(
    "aegisops_ai_rca_postmortem_requests_total",
    "Total postmortem generation requests received",
)

log_summary_requests_total = Counter(
    "aegisops_ai_rca_log_summary_requests_total",
    "Total log summarization requests received",
)

deployment_impact_requests_total = Counter(
    "aegisops_ai_rca_deployment_impact_requests_total",
    "Total deployment impact analysis requests received",
)
