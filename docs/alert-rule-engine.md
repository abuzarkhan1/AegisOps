# Alert Rule Engine

The Alert Rule Engine validates incoming telemetry (both metrics and logs) against user-defined alert thresholds to generate incidents.

## Alert Rules Structure

```json
{
  "id": "rule_uuid",
  "organizationId": "org_uuid",
  "serviceId": "service_uuid",
  "name": "High latency alert",
  "metric": "http_request_duration_ms",
  "operator": "gt",
  "threshold": 1000,
  "durationSeconds": 60,
  "severity": "high",
  "enabled": true
}
```

## Evaluation Logic

1. **Metrics Alerts**:
   Evaluated against incoming metric values. The engine computes whether the ingested value satisfies the operator (`gt`, `lt`, `gte`, `lte`, `eq`) against the threshold.
   
2. **Log Alerts**:
   Triggered on log patterns (e.g. `level = 'error'`) or status code breaches (e.g. `statusCode >= 500`).

## Incident Creation

When a breach is detected:
1. The alert engine checks if there is already an open incident for this service/rule.
2. If not, a new `Incident` record is created, and an alert event is published to Kafka.
3. Incidents persist until resolved via the UI or solved automatically.
