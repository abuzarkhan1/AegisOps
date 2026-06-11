# Redis Caching Strategy

Redis is used exclusively for organization-level caching of hot dashboard queries to optimize latency and performance under high traffic.

## Cached Resources and TTLs

| Cache Scope | Key Pattern | TTL |
|---|---|---|
| Dashboard Summary | `org:{orgId}:dashboard-summary` | 30 seconds |
| Project Detail | `project:{projectId}:detail-summary:{orgId}:{env}:{from}:{to}` | 30 seconds |
| Service Detail | `service:{serviceId}:detail-summary:{orgId}:{env}:{from}:{to}` | 30 seconds |
| Route Performance | `route-performance:{projectId}:{serviceId}:{orgId}:{env}:{from}:{to}:{sortBy}:{limit}` | 30 seconds |
| Recent Logs | `recent-logs:{orgId}:{projectId}:{serviceId}:...` | 15 seconds |
| Recent Incidents | `org:{orgId}:recent-incidents` | 30 seconds |
| Metric Aggregates | `metric-chart-data:{orgId}:{projectId}:*` | 30 seconds |

## Cache Invalidation Rules

To keep dashboard views synchronized, caches are immediately purged on the following mutations:

1. **New Incident**: Invalidates `dashboard-summary` and `recent-incidents`.
2. **Alert Rule Changes**: Clears `dashboard-summary`.
3. **Service Update**: Deletes `service-detail-summary` and clears org/project caches.
4. **Project Update**: Deletes `project-detail-summary` and clears org/project list caches.
5. **Deployment Created**: Purges project dashboard caches and route performance caches through the deployment workflow.
6. **Threshold Breach**: Clears dashboard, project, service, route, recent-log, and metric chart caches so anomalies surface quickly.
