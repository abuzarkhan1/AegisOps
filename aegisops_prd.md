# AegisOps — AI DevOps Incident Manager / SRE Copilot

## Product Requirements Document (PRD)

**Version:** 1.0  
**Project Type:** Production-Level Polyglot Microservices SaaS  
**Target Users:** DevOps Engineers, Backend Engineers, SRE Teams, Startup Engineering Teams, Technical Founders  
**Primary Goal:** Build an AI-powered DevOps incident management platform that collects logs, metrics, deployments, and service health data, detects incidents, analyzes root causes using AI, and provides complete observability through dashboards, alerts, traces, and reports.

---

## 1. Product Overview

AegisOps is a production-grade AI DevOps Incident Manager and SRE Copilot. It helps engineering teams monitor services, ingest logs, collect metrics, detect production issues, correlate failures with deployments, and generate AI-powered root cause analysis reports.

The system is designed as a real-world organization-level microservices platform using multiple languages and production DevOps tools.

The platform will use:

- **Nginx** as API Gateway and reverse proxy
- **Node.js Express TypeScript** for Core API, Worker Orchestrator, and Deployment Tracker
- **Go** for high-performance log ingestion and metrics collection
- **Python FastAPI** for AI Root Cause Analysis
- **Java Spring Boot** for notification and escalation workflows
- **PostgreSQL** for business data
- **Redis** for organization-level caching and rate limiting
- **Kafka** for high-volume event streaming
- **RabbitMQ** for reliable background task queues
- **Elasticsearch** for searchable logs and events
- **Kibana** for log exploration
- **Fluent Bit** for container log collection
- **Prometheus** for metrics scraping
- **Grafana** for monitoring dashboards
- **Docker Compose** for local production-like orchestration

---

## 2. Product Vision

AegisOps should feel like a serious DevOps/SRE platform, not a simple CRUD dashboard.

The product should answer questions like:

- Which service is failing?
- When did the issue start?
- Did the failure start after a deployment?
- Which endpoint, log pattern, or stack trace is responsible?
- Is the issue caused by database latency, API failures, queue failures, or deployment changes?
- What should the engineer do next?
- Should the team roll back the deployment?
- What should be written in the postmortem?

The platform should make incident response faster, clearer, and more professional.

---

## 3. Core Objectives

### 3.1 Business Objectives

- Build a portfolio-grade production microservices project.
- Demonstrate real-world backend, DevOps, observability, AI, and distributed systems skills.
- Create a system that can be expanded into a real SaaS platform.
- Provide organization-level monitoring and incident management features.

### 3.2 Technical Objectives

- Implement polyglot microservices using the best language for each service.
- Use Kafka for event streaming.
- Use RabbitMQ for task-based background processing.
- Use Redis for caching, API key validation cache, rate limiting, and dashboard cache.
- Use Elasticsearch, Kibana, and Fluent Bit for centralized logging.
- Use Prometheus and Grafana for metrics monitoring.
- Run all services locally using one Docker Compose command.
- Design the system to be ready for future Kubernetes deployment.

---

## 4. Target Users

### 4.1 DevOps Engineer

Needs:

- View service health
- Monitor incidents
- Check logs and metrics
- Analyze deployments
- Receive alerts
- Investigate failures quickly

### 4.2 Backend Engineer

Needs:

- Understand API failures
- Find stack traces
- Correlate errors with code/deployments
- View endpoint-level latency and errors
- Get AI fix suggestions

### 4.3 SRE Engineer

Needs:

- Incident timeline
- SLA/SLO tracking
- Error rate monitoring
- Postmortem generation
- Escalation workflows
- Reliability reports

### 4.4 Engineering Manager

Needs:

- Weekly reliability reports
- Incident summaries
- Service stability overview
- Deployment impact reports
- Team response metrics

---

## 5. Problem Statement

Modern applications are distributed across multiple services. When something breaks in production, engineers often need to manually check logs, metrics, deployment history, traces, and alert systems separately.

This creates problems:

- Logs are scattered.
- Metrics are hard to correlate with deployments.
- Incident root cause analysis takes time.
- Alert noise becomes difficult to manage.
- Teams lack clear incident timelines.
- Postmortems are written manually.
- Junior engineers struggle to understand what caused the issue.

AegisOps solves this by combining logging, metrics, deployment tracking, incident management, and AI root cause analysis in one platform.

---

## 6. Solution Summary

AegisOps will collect logs, metrics, deployment events, and service health events from applications. It will stream events through Kafka, store logs in Elasticsearch, store business data in PostgreSQL, cache organization-level data in Redis, and use RabbitMQ for reliable background processing tasks.

When an incident is detected, the platform will:

1. Create an incident.
2. Build an incident timeline.
3. Collect related logs and metrics.
4. Check recent deployments.
5. Send analysis request to the AI RCA service.
6. Generate root cause summary.
7. Suggest fixes and rollback recommendation.
8. Notify relevant users.
9. Generate postmortem draft.

---

## 7. System Architecture

```text
                         ┌─────────────────────┐
                         │   React Dashboard   │
                         └──────────┬──────────┘
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │   Nginx API Gateway │
                         └──────────┬──────────┘
                                    │
              ┌─────────────────────┼─────────────────────┐
              │                     │                     │
              ▼                     ▼                     ▼
   ┌──────────────────┐   ┌──────────────────┐   ┌──────────────────┐
   │ Node Core API    │   │ Go Log Ingester  │   │ Go Metrics Svc   │
   │ Auth/RBAC/Orgs   │   │ Logs ingestion   │   │ Metrics collect  │
   └────────┬─────────┘   └────────┬─────────┘   └────────┬─────────┘
            │                      │                      │
            ▼                      ▼                      ▼
   ┌──────────────────┐   ┌────────────────────────────────────┐
   │ PostgreSQL       │   │              Kafka                 │
   │ Business Data    │   │ logs / metrics / incidents stream  │
   └──────────────────┘   └─────────────────┬──────────────────┘
            │                                │
            ▼                                ▼
   ┌──────────────────┐            ┌──────────────────┐
   │ Redis Cache      │            │ Worker Service   │
   │ Org/API/Dash     │            │ Node TypeScript  │
   └──────────────────┘            └────────┬─────────┘
                                            │
                                            ▼
                                  ┌──────────────────┐
                                  │ RabbitMQ Tasks   │
                                  └───────┬──────────┘
                                          │
                    ┌─────────────────────┼─────────────────────┐
                    │                     │                     │
                    ▼                     ▼                     ▼
          ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
          │ Python AI RCA    │  │ Java Notify Svc  │  │ Report Worker    │
          │ FastAPI          │  │ Spring Boot      │  │ Node/Python      │
          └──────────────────┘  └──────────────────┘  └──────────────────┘

Observability:
Docker Logs → Fluent Bit → Elasticsearch → Kibana
App Metrics → Prometheus → Grafana
```

---

## 8. Technology Stack

### 8.1 Frontend

- React Vite
- TypeScript
- Tailwind CSS
- React Query
- Zustand
- Recharts or Apache ECharts
- WebSocket/SSE for real-time updates

### 8.2 API Gateway

- Nginx
- Reverse proxy routing
- Central entry point for local and production traffic
- Request ID forwarding
- Basic rate limiting at gateway level later

### 8.3 Core API

- Node.js
- Express.js
- TypeScript
- PostgreSQL
- Redis
- Kafka producer
- JWT authentication
- RBAC
- OpenAPI/Swagger

### 8.4 Worker Orchestrator

- Node.js
- TypeScript
- Kafka consumers
- RabbitMQ producers/consumers
- Incident workflow orchestration
- Retry handling
- Dead-letter queues

### 8.5 Log Ingester

- Go
- High-throughput HTTP API
- API key validation
- Redis cache lookup
- Kafka producer
- Prometheus metrics endpoint

### 8.6 Metrics Service

- Go
- Custom metrics ingestion
- Metrics aggregation
- Kafka producer
- Prometheus `/metrics` endpoint

### 8.7 AI RCA Service

- Python
- FastAPI
- LLM integration later
- Log summarization
- Root cause analysis
- Anomaly explanation
- Postmortem generation

### 8.8 Notification Service

- Java Spring Boot
- RabbitMQ consumer
- Email notifications
- Slack notifications
- Discord notifications
- Escalation policies
- Notification history

### 8.9 Data and Infrastructure

- PostgreSQL
- Redis
- Kafka
- RabbitMQ
- Elasticsearch
- Kibana
- Fluent Bit
- Prometheus
- Grafana
- Docker Compose

---

## 9. Microservices and Responsibilities

## 9.1 Nginx API Gateway

### Responsibilities

- Route dashboard traffic to frontend.
- Route `/api/*` requests to Core API.
- Route `/ingest/*` requests to Log Ingester.
- Route `/metrics-api/*` requests to Metrics Service.
- Route `/ai/*` requests to AI RCA Service.
- Route `/notify/*` requests to Notification Service.
- Route `/deployments/*` requests to Deployment Tracker.
- Add request headers such as `X-Request-ID`.

### Required Routes

| Route | Target Service |
|---|---|
| `/` | React Dashboard |
| `/api/*` | Core API |
| `/ingest/*` | Log Ingester |
| `/metrics-api/*` | Metrics Service |
| `/ai/*` | AI RCA Service |
| `/notify/*` | Notification Service |
| `/deployments/*` | Deployment Tracker |
| `/health` | Gateway Health |

---

## 9.2 Core API Service

**Language:** Node.js Express TypeScript

### Responsibilities

- Authentication
- Refresh token management
- Organizations
- Teams
- Users
- Role-based access control
- Projects
- Services
- API keys
- Alert rules
- Incidents
- Incident timeline
- Dashboard APIs
- Audit logs
- Kafka event publishing
- Redis cache management

### Main Modules

- Auth Module
- Organization Module
- User Module
- Team Module
- Project Module
- Service Module
- API Key Module
- Alert Rule Module
- Incident Module
- Deployment Module
- Dashboard Module
- Audit Log Module
- Cache Module

### Required APIs

```http
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/refresh
POST   /api/auth/logout
GET    /api/auth/me

GET    /api/organizations
POST   /api/organizations
GET    /api/organizations/:orgId
PATCH  /api/organizations/:orgId

GET    /api/organizations/:orgId/users
POST   /api/organizations/:orgId/users/invite
PATCH  /api/organizations/:orgId/users/:userId/role
DELETE /api/organizations/:orgId/users/:userId

GET    /api/projects
POST   /api/projects
GET    /api/projects/:projectId
PATCH  /api/projects/:projectId
DELETE /api/projects/:projectId

GET    /api/projects/:projectId/services
POST   /api/projects/:projectId/services
GET    /api/services/:serviceId
PATCH  /api/services/:serviceId
DELETE /api/services/:serviceId

POST   /api/services/:serviceId/api-keys
GET    /api/services/:serviceId/api-keys
DELETE /api/api-keys/:apiKeyId

GET    /api/incidents
POST   /api/incidents
GET    /api/incidents/:incidentId
PATCH  /api/incidents/:incidentId
POST   /api/incidents/:incidentId/assign
POST   /api/incidents/:incidentId/resolve
GET    /api/incidents/:incidentId/timeline
GET    /api/incidents/:incidentId/ai-analysis

GET    /api/alert-rules
POST   /api/alert-rules
PATCH  /api/alert-rules/:ruleId
DELETE /api/alert-rules/:ruleId

GET    /api/dashboard/summary
GET    /api/dashboard/service-health
GET    /api/dashboard/recent-incidents
GET    /api/dashboard/error-trends

GET    /api/audit-logs
GET    /api/health
GET    /metrics
```

---

## 9.3 Log Ingester Service

**Language:** Go

### Responsibilities

- Receive application logs.
- Validate API key.
- Check API key from Redis cache.
- Fallback to Core API/PostgreSQL validation if cache miss occurs.
- Normalize log payload.
- Add trace ID and request ID.
- Publish logs to Kafka topic `logs.received`.
- Optionally write directly to Elasticsearch for local development.
- Expose Prometheus metrics.

### API

```http
POST /ingest/logs
POST /ingest/logs/batch
GET  /health
GET  /metrics
```

### Single Log Payload

```json
{
  "serviceName": "payment-service",
  "level": "error",
  "message": "MongoDB timeout after 5000ms",
  "timestamp": "2026-06-10T12:30:00Z",
  "traceId": "req_abc123",
  "metadata": {
    "route": "/api/payments",
    "method": "POST",
    "statusCode": 500,
    "userId": "user_123"
  }
}
```

### Batch Log Payload

```json
{
  "logs": [
    {
      "serviceName": "core-api",
      "level": "info",
      "message": "Request completed",
      "timestamp": "2026-06-10T12:30:00Z",
      "traceId": "trace_123",
      "metadata": {
        "route": "/api/projects",
        "statusCode": 200
      }
    }
  ]
}
```

---

## 9.4 Metrics Service

**Language:** Go

### Responsibilities

- Receive custom metrics from services.
- Collect service health snapshots.
- Publish metrics to Kafka topic `metrics.received`.
- Provide metrics aggregation APIs.
- Expose Prometheus `/metrics` endpoint.

### API

```http
POST /metrics-api/ingest
POST /metrics-api/health-snapshot
GET  /metrics-api/services/:serviceId/summary
GET  /health
GET  /metrics
```

### Metric Payload

```json
{
  "serviceName": "core-api",
  "timestamp": "2026-06-10T12:30:00Z",
  "metrics": {
    "requestCount": 1200,
    "errorCount": 31,
    "avgLatencyMs": 180,
    "p95LatencyMs": 720,
    "cpuUsage": 61.2,
    "memoryUsage": 74.4
  }
}
```

---

## 9.5 AI RCA Service

**Language:** Python FastAPI

### Responsibilities

- Analyze incident logs.
- Summarize error patterns.
- Compare pre-deployment and post-deployment logs.
- Generate likely root cause.
- Provide confidence score.
- Provide evidence-based recommendations.
- Generate postmortem draft.
- Expose health and metrics endpoints.

### APIs

```http
POST /ai/analyze-incident
POST /ai/summarize-logs
POST /ai/generate-postmortem
POST /ai/deployment-impact
GET  /health
GET  /metrics
```

### AI Analysis Request

```json
{
  "incidentId": "inc_123",
  "organizationId": "org_123",
  "serviceId": "svc_123",
  "logs": [],
  "metricsSummary": {},
  "deployment": {},
  "alertRule": {}
}
```

### AI Analysis Response

```json
{
  "summary": "Payment service error rate increased after deployment v1.4.2.",
  "likelyRootCause": "A database timeout started after a new aggregation query was deployed.",
  "confidenceScore": 0.82,
  "severityExplanation": "High severity because the error rate crossed 10% for a customer-facing payment endpoint.",
  "evidence": [
    "87% of errors came from POST /api/payments",
    "First error appeared 3 minutes after deployment",
    "Stack trace points to payment.repository.ts",
    "Database timeout increased from 200ms to 5000ms"
  ],
  "recommendedActions": [
    "Check the new aggregation query",
    "Add compound index on userId and createdAt",
    "Reduce query payload",
    "Rollback deployment if error rate stays above 10%"
  ],
  "rollbackRecommendation": "Rollback is recommended if error rate does not recover within 10 minutes.",
  "postmortemDraft": "A customer-facing payment incident occurred after deployment v1.4.2..."
}
```

---

## 9.6 Notification Service

**Language:** Java Spring Boot

### Responsibilities

- Consume notification tasks from RabbitMQ.
- Send email alerts.
- Send Slack alerts.
- Send Discord alerts.
- Manage escalation policies.
- Store notification history.
- Provide notification settings APIs.
- Expose Spring Boot Actuator and Prometheus metrics.

### APIs

```http
POST /notify/email
POST /notify/slack
POST /notify/discord
GET  /notify/settings/:orgId
PATCH /notify/settings/:orgId
GET  /notify/history
GET  /actuator/health
GET  /actuator/prometheus
```

### RabbitMQ Queues Consumed

```text
notification.email.send
notification.slack.send
notification.discord.send
incident.escalate
```

---

## 9.7 Worker Orchestrator Service

**Language:** Node.js TypeScript

### Responsibilities

- Consume Kafka events.
- Process incident workflows.
- Publish RabbitMQ tasks.
- Coordinate AI analysis.
- Coordinate notifications.
- Coordinate report generation.
- Handle retries and dead-letter queues.
- Process deployment impact analysis.

### Kafka Topics Consumed

```text
logs.received
metrics.received
deployments.created
incidents.created
incidents.updated
alerts.triggered
```

### RabbitMQ Queues Produced

```text
ai.analysis.requested
ai.postmortem.generate
notification.email.send
notification.slack.send
notification.discord.send
report.daily.generate
report.weekly.generate
deployment.impact.analyze
```

---

## 9.8 Deployment Tracker Service

**Language:** Node.js Express TypeScript

### Responsibilities

- Receive GitHub deployment webhooks.
- Receive GitLab deployment webhooks.
- Store deployment records in PostgreSQL.
- Publish deployment events to Kafka.
- Correlate deployments with incidents.
- Provide deployment history APIs.

### APIs

```http
POST /deployments/github
POST /deployments/gitlab
GET  /deployments
GET  /deployments/:deploymentId
GET  /deployments/:deploymentId/impact
GET  /health
GET  /metrics
```

---

## 10. Kafka Design

Kafka will be used for high-volume event streaming.

### Kafka Topics

```text
logs.received
logs.enriched
metrics.received
metrics.aggregated
alerts.triggered
incidents.created
incidents.updated
incidents.resolved
deployments.created
deployments.completed
deployment.impact.generated
service.health.changed
audit.events
```

### Kafka Event Example: `logs.received`

```json
{
  "eventId": "evt_123",
  "eventType": "logs.received",
  "timestamp": "2026-06-10T12:30:00Z",
  "organizationId": "org_123",
  "projectId": "proj_123",
  "serviceId": "svc_123",
  "payload": {
    "level": "error",
    "message": "MongoDB timeout after 5000ms",
    "traceId": "trace_123",
    "metadata": {
      "route": "/api/payments",
      "statusCode": 500
    }
  }
}
```

### Kafka Event Example: `incidents.created`

```json
{
  "eventId": "evt_456",
  "eventType": "incidents.created",
  "timestamp": "2026-06-10T12:35:00Z",
  "organizationId": "org_123",
  "incidentId": "inc_123",
  "serviceId": "svc_123",
  "severity": "critical",
  "payload": {
    "title": "Payment service error rate above threshold",
    "triggeredBy": "alert_rule",
    "errorRate": 12.4
  }
}
```

---

## 11. RabbitMQ Design

RabbitMQ will be used for reliable background tasks.

### RabbitMQ Queues

```text
ai.analysis.requested
ai.postmortem.generate
notification.email.send
notification.slack.send
notification.discord.send
report.daily.generate
report.weekly.generate
incident.escalate
deployment.impact.analyze
```

### Retry Rules

| Queue | Attempts | Backoff | DLQ |
|---|---:|---|---|
| `ai.analysis.requested` | 3 | Exponential | `ai.analysis.failed` |
| `notification.email.send` | 5 | Exponential | `notification.email.failed` |
| `notification.slack.send` | 5 | Exponential | `notification.slack.failed` |
| `report.weekly.generate` | 3 | Fixed | `report.weekly.failed` |
| `deployment.impact.analyze` | 3 | Exponential | `deployment.impact.failed` |

### RabbitMQ Task Example

```json
{
  "taskId": "task_123",
  "taskType": "ai.analysis.requested",
  "createdAt": "2026-06-10T12:36:00Z",
  "organizationId": "org_123",
  "incidentId": "inc_123",
  "priority": "high",
  "payload": {
    "serviceId": "svc_123",
    "logWindowMinutes": 30,
    "includeDeploymentContext": true
  }
}
```

---

## 12. Redis Caching Design

Redis will be used only for caching, rate limiting, and fast lookups. Redis will not be used as the main queue system.

### Cache Key Strategy

```text
org:{orgId}:profile
org:{orgId}:settings
org:{orgId}:members
org:{orgId}:projects
org:{orgId}:services
org:{orgId}:alert-rules
org:{orgId}:dashboard-summary
org:{orgId}:recent-incidents
org:{orgId}:api-key:{keyHash}
user:{userId}:permissions
service:{serviceId}:config
service:{serviceId}:health
rate-limit:{apiKey}:{minute}
deployment:{deploymentId}:impact
incident:{incidentId}:summary
```

### Cache TTL Rules

| Cache | TTL |
|---|---:|
| Organization profile | 10 minutes |
| Organization settings | 10 minutes |
| Organization projects | 5 minutes |
| Organization services | 5 minutes |
| Alert rules | 2 minutes |
| API key validation | 15 minutes |
| User permissions | 5 minutes |
| Dashboard summary | 30 seconds |
| Recent incidents | 60 seconds |
| Service health | 30 seconds |
| Deployment impact | 10 minutes |
| Incident summary | 2 minutes |
| Rate limit keys | 60 seconds |

### Cache Invalidation Rules

```text
Update organization settings
→ delete org:{orgId}:settings
→ delete org:{orgId}:dashboard-summary

Update alert rule
→ delete org:{orgId}:alert-rules

Create/update/delete service
→ delete org:{orgId}:services
→ delete service:{serviceId}:config

Change user role
→ delete user:{userId}:permissions
→ delete org:{orgId}:members

Create/resolve incident
→ delete org:{orgId}:recent-incidents
→ delete org:{orgId}:dashboard-summary
→ delete incident:{incidentId}:summary

New deployment impact generated
→ delete deployment:{deploymentId}:impact
```

---

## 13. Database Design

## 13.1 PostgreSQL Tables

### `users`

| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| name | VARCHAR | User name |
| email | VARCHAR | Unique |
| password_hash | TEXT | Hashed password |
| status | VARCHAR | active, inactive |
| created_at | TIMESTAMP | Created time |
| updated_at | TIMESTAMP | Updated time |

### `organizations`

| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| name | VARCHAR | Organization name |
| slug | VARCHAR | Unique slug |
| plan | VARCHAR | free, pro, enterprise |
| created_at | TIMESTAMP | Created time |
| updated_at | TIMESTAMP | Updated time |

### `organization_members`

| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| organization_id | UUID | FK |
| user_id | UUID | FK |
| role | VARCHAR | owner, admin, engineer, viewer |
| created_at | TIMESTAMP | Created time |

### `projects`

| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| organization_id | UUID | FK |
| name | VARCHAR | Project name |
| description | TEXT | Optional |
| environment | VARCHAR | prod, staging, dev |
| created_at | TIMESTAMP | Created time |
| updated_at | TIMESTAMP | Updated time |

### `services`

| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| organization_id | UUID | FK |
| project_id | UUID | FK |
| name | VARCHAR | Service name |
| service_type | VARCHAR | api, frontend, worker, db, queue |
| language | VARCHAR | node, go, python, java |
| status | VARCHAR | healthy, degraded, down, unknown |
| created_at | TIMESTAMP | Created time |
| updated_at | TIMESTAMP | Updated time |

### `api_keys`

| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| organization_id | UUID | FK |
| service_id | UUID | FK |
| key_hash | TEXT | Hashed API key |
| prefix | VARCHAR | Visible prefix |
| status | VARCHAR | active, revoked |
| last_used_at | TIMESTAMP | Last used |
| created_at | TIMESTAMP | Created time |

### `alert_rules`

| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| organization_id | UUID | FK |
| service_id | UUID | FK |
| name | VARCHAR | Rule name |
| metric | VARCHAR | error_rate, latency, cpu, memory |
| operator | VARCHAR | gt, lt, eq |
| threshold | NUMERIC | Threshold value |
| duration_seconds | INTEGER | Evaluation window |
| severity | VARCHAR | critical, high, medium, low |
| enabled | BOOLEAN | Active/inactive |
| created_at | TIMESTAMP | Created time |
| updated_at | TIMESTAMP | Updated time |

### `incidents`

| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| organization_id | UUID | FK |
| project_id | UUID | FK |
| service_id | UUID | FK |
| title | VARCHAR | Incident title |
| description | TEXT | Description |
| severity | VARCHAR | critical, high, medium, low |
| status | VARCHAR | open, investigating, resolved |
| assigned_to | UUID | User FK |
| started_at | TIMESTAMP | Incident start |
| resolved_at | TIMESTAMP | Resolution time |
| created_at | TIMESTAMP | Created time |
| updated_at | TIMESTAMP | Updated time |

### `incident_timeline_events`

| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| incident_id | UUID | FK |
| event_type | VARCHAR | created, updated, ai_analysis, notification |
| message | TEXT | Timeline message |
| metadata | JSONB | Extra data |
| created_at | TIMESTAMP | Event time |

### `ai_analysis_results`

| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| incident_id | UUID | FK |
| summary | TEXT | AI summary |
| likely_root_cause | TEXT | RCA |
| confidence_score | NUMERIC | 0 to 1 |
| evidence | JSONB | Evidence list |
| recommended_actions | JSONB | Actions |
| rollback_recommendation | TEXT | Rollback advice |
| postmortem_draft | TEXT | Draft |
| created_at | TIMESTAMP | Created time |

### `deployments`

| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| organization_id | UUID | FK |
| project_id | UUID | FK |
| service_id | UUID | FK |
| provider | VARCHAR | github, gitlab |
| repository | VARCHAR | Repo name |
| commit_hash | VARCHAR | Commit hash |
| branch | VARCHAR | Branch |
| author | VARCHAR | Commit/deploy author |
| status | VARCHAR | started, completed, failed |
| deployed_at | TIMESTAMP | Deployment time |
| metadata | JSONB | Extra webhook data |

### `notification_settings`

| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| organization_id | UUID | FK |
| channel | VARCHAR | email, slack, discord |
| config | JSONB | Channel config |
| enabled | BOOLEAN | Active/inactive |
| created_at | TIMESTAMP | Created time |

### `audit_logs`

| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| organization_id | UUID | FK |
| actor_user_id | UUID | User FK |
| action | VARCHAR | Action name |
| resource_type | VARCHAR | Resource type |
| resource_id | UUID | Resource ID |
| metadata | JSONB | Extra data |
| created_at | TIMESTAMP | Created time |

---

## 13.2 Elasticsearch Indices

### `aegisops-logs-*`

Stores application logs.

Main fields:

```text
@timestamp
organizationId
projectId
serviceId
serviceName
level
message
traceId
requestId
route
method
statusCode
userId
metadata
```

### `aegisops-events-*`

Stores platform events.

Main fields:

```text
@timestamp
eventId
eventType
organizationId
projectId
serviceId
incidentId
deploymentId
payload
```

---

## 14. Observability Requirements

## 14.1 Prometheus

Prometheus must scrape metrics from:

- Core API
- Log Ingester
- Metrics Service
- AI RCA Service
- Notification Service
- Deployment Tracker
- Prometheus itself

Each service must expose either:

```http
GET /metrics
```

or for Spring Boot:

```http
GET /actuator/prometheus
```

Required application metrics:

```text
http_requests_total
http_request_duration_seconds
service_errors_total
service_health_status
kafka_events_published_total
kafka_events_consumed_total
rabbitmq_tasks_published_total
rabbitmq_tasks_failed_total
redis_cache_hits_total
redis_cache_misses_total
incidents_created_total
ai_analysis_duration_seconds
notifications_sent_total
```

---

## 14.2 Grafana

Grafana dashboards required:

1. System Overview Dashboard
2. Service Health Dashboard
3. API Latency Dashboard
4. Error Rate Dashboard
5. Kafka Events Dashboard
6. RabbitMQ Task Dashboard
7. Redis Cache Dashboard
8. Incident Dashboard
9. AI RCA Performance Dashboard
10. Notification Delivery Dashboard

---

## 14.3 Elasticsearch + Kibana

Elasticsearch stores logs and searchable events.

Kibana must allow:

- Search logs by service
- Search logs by level
- Search logs by trace ID
- Search logs by route
- Search logs by status code
- View error trends
- View incident-related logs
- Build saved searches and dashboards

Required Kibana data views:

```text
aegisops-logs-*
aegisops-events-*
```

---

## 14.4 Fluent Bit

Fluent Bit must:

- Tail Docker container logs
- Parse Docker JSON logs
- Add environment metadata
- Add platform metadata
- Forward logs to Elasticsearch

Required metadata fields:

```text
environment=local
platform=aegisops
container_name
container_id
```

---

## 15. Main Product Features

## 15.1 Authentication and Authorization

### Requirements

- Register user
- Login user
- Refresh token
- Logout
- Password hashing
- JWT access token
- JWT refresh token
- Organization-based access
- Role-based permissions

### Roles

| Role | Permissions |
|---|---|
| Owner | Full access |
| Admin | Manage projects, services, incidents, users |
| Engineer | View services, handle incidents, view logs |
| Viewer | Read-only access |

---

## 15.2 Organization Management

### Requirements

- Create organization
- Update organization settings
- Invite members
- Change member roles
- Remove members
- View organization dashboard
- Cache organization data in Redis

---

## 15.3 Project Management

### Requirements

- Create project
- Update project
- Delete project
- Add services under project
- Filter projects by environment
- View project health

---

## 15.4 Service Management

### Requirements

- Create service
- Update service
- Delete service
- Assign service type
- Assign service language
- Generate API key
- View service logs
- View service metrics
- View service incidents
- View service deployments

Service types:

```text
api
frontend
worker
database
queue
cache
external
```

---

## 15.5 Log Ingestion

### Requirements

- API key protected ingestion
- Single log ingestion
- Batch log ingestion
- Log normalization
- Kafka publishing
- Elasticsearch indexing
- Redis API key cache
- Rate limiting
- Prometheus metrics

### Log Levels

```text
debug
info
warn
error
fatal
```

---

## 15.6 Logs Explorer

### Requirements

- Search logs by service
- Filter by log level
- Filter by time range
- Filter by route
- Filter by status code
- Filter by trace ID
- View raw JSON log
- Open logs related to incident
- Export filtered logs later

---

## 15.7 Metrics Monitoring

### Requirements

- Ingest custom metrics
- Show service-level metrics
- Show latency trends
- Show error trends
- Show request volume
- Show CPU and memory usage
- Show Prometheus metrics
- Show Grafana dashboard links

---

## 15.8 Alert Rules

### Requirements

- Create alert rule
- Update alert rule
- Enable/disable alert rule
- Delete alert rule
- Evaluate error rate
- Evaluate latency
- Evaluate CPU usage
- Evaluate memory usage
- Evaluate service health
- Trigger incident on threshold breach

### Alert Rule Example

```json
{
  "name": "High API Error Rate",
  "metric": "error_rate",
  "operator": "gt",
  "threshold": 5,
  "durationSeconds": 300,
  "severity": "critical",
  "enabled": true
}
```

---

## 15.9 Incident Management

### Requirements

- Automatically create incidents from alert rules
- Manually create incidents
- Assign incident to engineer
- Change incident status
- Resolve incident
- Add timeline events
- Attach logs
- Attach metrics summary
- Attach deployment context
- Attach AI analysis
- Notify team

### Incident Statuses

```text
open
investigating
identified
monitoring
resolved
```

### Incident Severities

```text
critical
high
medium
low
```

---

## 15.10 AI Root Cause Analysis

### Requirements

- Analyze related logs
- Analyze metrics summary
- Analyze deployment information
- Generate incident summary
- Generate likely root cause
- Generate confidence score
- Generate evidence list
- Generate recommended actions
- Generate rollback recommendation
- Generate postmortem draft

### AI Output Must Be Evidence-Based

AI must not return generic text only. It must reference:

- Affected service
- Affected endpoint
- Error pattern
- Stack trace pattern
- Time window
- Deployment correlation
- Metrics change

---

## 15.11 Deployment Tracking

### Requirements

- Receive GitHub deployment webhook
- Receive GitLab deployment webhook
- Store deployment record
- Link deployment to project/service
- Publish deployment event to Kafka
- Compare pre-deployment and post-deployment metrics
- Attach deployment impact to incident

### Deployment Data

```text
repository
branch
commit_hash
author
status
deployed_at
changed_files
environment
```

---

## 15.12 Notifications

### Requirements

- Email alert
- Slack alert
- Discord alert
- Notification preferences
- Escalation policy
- Notification history
- Retry failed notifications
- Dead-letter failed notification tasks

### Notification Events

```text
incident_created
incident_updated
incident_resolved
ai_analysis_completed
deployment_impact_detected
weekly_report_ready
```

---

## 15.13 Reports

### Requirements

- Daily reliability report
- Weekly reliability report
- Incident summary report
- Service health report
- Deployment impact report
- Export as PDF later
- Export as CSV later

Report metrics:

```text
Total incidents
Critical incidents
Average resolution time
Most unstable service
Top error patterns
Most affected endpoints
Deployment-related incidents
AI recommended fixes
```

---

## 16. Frontend Dashboard Requirements

## 16.1 Pages

```text
1. Login
2. Register
3. Organization Setup
4. Overview Dashboard
5. Projects
6. Project Detail
7. Services
8. Service Detail
9. Logs Explorer
10. Metrics Dashboard
11. Alert Rules
12. Incidents
13. Incident Detail
14. AI RCA Report
15. Deployments
16. Deployment Detail
17. Notifications
18. Reports
19. Team Members
20. Settings
```

---

## 16.2 Overview Dashboard

Must show:

- Total services
- Healthy services
- Degraded services
- Down services
- Open incidents
- Critical incidents
- Error rate trend
- Latency trend
- Recent incidents
- Recent deployments
- Kafka event status
- RabbitMQ task status
- Redis cache hit/miss summary

---

## 16.3 Incident Detail Page

This is the most important page.

Must show:

- Incident title
- Severity
- Status
- Affected service
- Started time
- Resolved time
- Assigned engineer
- Error rate graph
- Latency graph
- Related logs
- Related deployment
- AI root cause analysis
- Evidence list
- Recommended actions
- Rollback recommendation
- Timeline
- Notifications sent
- Postmortem draft

---

## 16.4 Logs Explorer Page

Must show:

- Search input
- Time range selector
- Service filter
- Level filter
- Route filter
- Status code filter
- Trace ID filter
- Logs table
- JSON drawer
- Related incident link

---

## 16.5 Metrics Dashboard Page

Must show:

- Request rate chart
- Error rate chart
- Latency p50/p95/p99 chart
- CPU usage chart
- Memory usage chart
- Queue status chart
- Service health cards

---

## 17. Local Docker Compose Requirement

The project must run locally using one command:

```bash
docker compose up --build
```

The local environment must start:

- Nginx API Gateway
- React Dashboard
- Core API
- Worker Service
- Log Ingester
- Metrics Service
- AI RCA Service
- Notification Service
- Deployment Tracker
- PostgreSQL
- Redis
- Kafka
- Kafka UI
- RabbitMQ
- Elasticsearch
- Kibana
- Fluent Bit
- Prometheus
- Grafana

---

## 18. Local Service URLs

| Service | URL |
|---|---|
| Gateway | `http://localhost:8080` |
| React Dashboard | `http://localhost:5173` |
| Core API | `http://localhost:4000` |
| Log Ingester | `http://localhost:5001` |
| Metrics Service | `http://localhost:5002` |
| AI RCA Service | `http://localhost:8000` |
| Notification Service | `http://localhost:8085` |
| Deployment Tracker | `http://localhost:4010` |
| RabbitMQ UI | `http://localhost:15672` |
| Kafka UI | `http://localhost:8090` |
| Elasticsearch | `http://localhost:9200` |
| Kibana | `http://localhost:5601` |
| Prometheus | `http://localhost:9090` |
| Grafana | `http://localhost:3000` |

Default credentials:

```text
RabbitMQ: aegisops / aegisops
Grafana: admin / admin
```

---

## 19. Health Check Requirements

Every service must expose health endpoints.

| Service | Health Endpoint |
|---|---|
| Gateway | `/health` |
| Core API | `/api/health` |
| Log Ingester | `/health` |
| Metrics Service | `/health` |
| AI RCA Service | `/health` |
| Notification Service | `/actuator/health` |
| Deployment Tracker | `/health` |

Health response format:

```json
{
  "status": "ok",
  "service": "core-api",
  "timestamp": "2026-06-10T12:30:00Z",
  "dependencies": {
    "postgres": "ok",
    "redis": "ok",
    "kafka": "ok",
    "rabbitmq": "ok"
  }
}
```

---

## 20. Security Requirements

### Authentication

- JWT access tokens
- Refresh tokens
- Password hashing with bcrypt/argon2
- Logout and token revocation

### Authorization

- Organization-level authorization
- Role-based access control
- Service-level permissions later

### API Key Security

- API keys must be generated securely.
- Only API key prefix should be visible.
- Full API key should be shown only once.
- API keys must be hashed before storing.
- API key validation should be cached in Redis.
- Revoked API keys must invalidate Redis cache.

### API Security

- Input validation
- Request size limits
- Rate limiting
- CORS configuration
- Helmet/security headers in Node services
- Audit logging for sensitive actions

---

## 21. Rate Limiting Requirements

Rate limits should be implemented using Redis.

### Suggested Limits

| Endpoint Type | Limit |
|---|---:|
| Auth login | 5 requests/minute/IP |
| Log ingestion | 1000 requests/minute/API key |
| Batch log ingestion | 300 requests/minute/API key |
| Metrics ingestion | 500 requests/minute/API key |
| Dashboard APIs | 120 requests/minute/user |

Redis key format:

```text
rate-limit:{scope}:{identifier}:{window}
```

Example:

```text
rate-limit:ingest:aegis_live_xxx:202606101230
```

---

## 22. Audit Logging Requirements

Audit logs must be created for:

- User login
- User logout
- Organization update
- User invited
- User role changed
- Project created/updated/deleted
- Service created/updated/deleted
- API key created/revoked
- Alert rule created/updated/deleted
- Incident created/updated/resolved
- Notification settings changed

Audit event format:

```json
{
  "organizationId": "org_123",
  "actorUserId": "user_123",
  "action": "api_key.created",
  "resourceType": "api_key",
  "resourceId": "key_123",
  "metadata": {
    "serviceId": "svc_123"
  }
}
```

---

## 23. Incident Detection Logic

Initial version should support rule-based detection.

### Detection Inputs

- Logs from Kafka
- Metrics from Kafka
- Alert rules from PostgreSQL/Redis
- Service configuration from Redis

### Detection Examples

```text
If error rate > 5% for 5 minutes → create high severity incident
If p95 latency > 2000ms for 5 minutes → create medium severity incident
If service health is down for 2 minutes → create critical incident
If same error appears more than 100 times in 10 minutes → create high severity incident
```

### Duplicate Incident Prevention

If same service and same rule already has an open incident, do not create duplicate incident.

Instead:

- Add timeline event
- Update incident counters
- Increase severity if needed

---

## 24. AI RCA Logic Requirements

AI RCA should receive structured context.

### Input Context

```text
Incident details
Service details
Alert rule
Recent logs
Error patterns
Metrics before incident
Metrics during incident
Deployment before incident
Stack traces
Previous similar incidents later
```

### Output Fields

```text
summary
likelyRootCause
confidenceScore
severityExplanation
evidence
recommendedActions
rollbackRecommendation
postmortemDraft
```

### AI Safety Rule

AI must not pretend certainty. It should use words like:

- likely
- possible
- based on available evidence
- confidence score

AI must always include evidence.

---

## 25. Deployment Impact Analysis

Deployment impact should compare service behavior before and after deployment.

### Compare Windows

```text
Before deployment: 30 minutes
After deployment: 30 minutes
```

### Compare Metrics

```text
Error rate
Request volume
Average latency
p95 latency
Top error messages
Affected routes
Service health
```

### Output Example

```json
{
  "deploymentId": "dep_123",
  "impactDetected": true,
  "summary": "API error rate increased by 47% after deployment.",
  "before": {
    "errorRate": 1.2,
    "p95LatencyMs": 340
  },
  "after": {
    "errorRate": 8.4,
    "p95LatencyMs": 1200
  },
  "recommendation": "Investigate changes in payment.service.ts and consider rollback."
}
```

---

## 26. Non-Functional Requirements

### Performance

- Log ingester should handle high-volume log ingestion.
- Dashboard summary should be cached.
- API key validation should not hit database on every request.
- Kafka publishing should be asynchronous.
- Elasticsearch queries should be paginated.

### Reliability

- RabbitMQ tasks must support retries.
- Failed tasks must go to dead-letter queues.
- Services must expose health checks.
- Docker Compose should start services in correct dependency order.

### Scalability

- Log Ingester can be horizontally scaled.
- Metrics Service can be horizontally scaled.
- Worker Service can be scaled by consumer group.
- Kafka topics should use multiple partitions.
- Redis cache should use structured keys.

### Maintainability

- Each service must have a clear responsibility.
- Shared contracts should be documented.
- API schemas must be validated.
- All services should use structured logging.
- Environment variables must be documented.

### Observability

- Every service must expose metrics.
- Every service must log structured JSON.
- Every request must have request ID/trace ID.
- Errors must be searchable in Kibana.
- Metrics must be visible in Grafana.

---

## 27. Acceptance Criteria

### 27.1 Local Infrastructure

The project is accepted when:

- `docker compose up --build` starts all services.
- PostgreSQL is healthy.
- Redis responds with `PONG`.
- Kafka UI opens successfully.
- RabbitMQ UI opens successfully.
- Elasticsearch responds on port 9200.
- Kibana opens successfully.
- Prometheus opens and shows targets.
- Grafana opens and has Prometheus datasource.
- Fluent Bit forwards logs to Elasticsearch.

### 27.2 Core Platform

The project is accepted when:

- User can register and login.
- User can create organization.
- User can create project.
- User can create service.
- User can generate API key.
- User can create alert rule.
- User can view dashboard summary.

### 27.3 Log Pipeline

The project is accepted when:

- Service can send logs to Log Ingester.
- Log Ingester validates API key.
- API key validation uses Redis cache.
- Log event is published to Kafka.
- Log becomes searchable in Elasticsearch/Kibana.
- Log ingestion metrics appear in Prometheus.

### 27.4 Incident Pipeline

The project is accepted when:

- Alert rule detects threshold breach.
- Incident is created.
- Incident event is published to Kafka.
- Worker creates AI analysis task in RabbitMQ.
- AI RCA service generates analysis.
- Notification task is created.
- Notification service processes task.
- Incident detail page shows AI analysis and timeline.

### 27.5 Observability

The project is accepted when:

- Prometheus scrapes all application services.
- Grafana displays service metrics.
- Fluent Bit sends Docker logs to Elasticsearch.
- Kibana shows application logs.
- Health endpoints work for every service.

---

## 28. Development Phases

## Phase 1 — Monorepo and Local Infrastructure

Deliverables:

- Monorepo structure
- Docker Compose
- Nginx config
- PostgreSQL
- Redis
- Kafka
- Kafka UI
- RabbitMQ
- Elasticsearch
- Kibana
- Fluent Bit
- Prometheus
- Grafana
- Basic health checks

## Phase 2 — Core API

Deliverables:

- Auth
- Organizations
- Users
- RBAC
- Projects
- Services
- API keys
- Redis cache module
- PostgreSQL schema
- Swagger docs

## Phase 3 — Log Ingestion Pipeline

Deliverables:

- Go Log Ingester
- API key validation
- Redis API key cache
- Kafka log publishing
- Elasticsearch indexing consumer
- Logs Explorer UI

## Phase 4 — Metrics Pipeline

Deliverables:

- Go Metrics Service
- Custom metrics ingestion
- Kafka metrics publishing
- Prometheus metrics exposure
- Grafana dashboard
- Metrics Dashboard UI

## Phase 5 — Alert and Incident System

Deliverables:

- Alert rules
- Rule evaluation
- Incident creation
- Incident timeline
- Incident dashboard
- Duplicate incident prevention

## Phase 6 — AI RCA System

Deliverables:

- Python FastAPI AI RCA service
- AI analysis endpoint
- Postmortem generation
- Evidence-based RCA
- Incident detail AI panel

## Phase 7 — RabbitMQ Task System

Deliverables:

- RabbitMQ exchanges/queues
- Worker Orchestrator
- AI analysis tasks
- Notification tasks
- Report tasks
- Retry and DLQ handling

## Phase 8 — Notification Service

Deliverables:

- Java Spring Boot notification service
- Email alerts
- Slack alerts
- Discord alerts
- Notification settings
- Notification history

## Phase 9 — Deployment Tracking

Deliverables:

- GitHub webhook
- GitLab webhook
- Deployment records
- Kafka deployment events
- Deployment impact analysis
- Deployment detail UI

## Phase 10 — Reports and Production Hardening

Deliverables:

- Daily reliability report
- Weekly reliability report
- Security hardening
- Rate limiting
- Audit logs
- Tests
- CI/CD
- Production Docker Compose
- Kubernetes manifests later

---

## 29. Recommended Repository Structure

```text
aegisops/
│
├── apps/
│   └── web-dashboard/
│
├── services/
│   ├── core-api/
│   ├── worker-service/
│   ├── log-ingester/
│   ├── metrics-service/
│   ├── ai-rca-service/
│   ├── notification-service/
│   └── deployment-tracker/
│
├── packages/
│   ├── shared-types/
│   ├── api-contracts/
│   └── eslint-config/
│
├── infra/
│   ├── nginx/
│   ├── prometheus/
│   ├── grafana/
│   ├── fluent-bit/
│   ├── elasticsearch/
│   └── k8s/
│
├── docs/
│   ├── PRD.md
│   ├── ARCHITECTURE.md
│   ├── API_SPEC.md
│   ├── DATABASE_DESIGN.md
│   ├── KAFKA_DESIGN.md
│   ├── RABBITMQ_DESIGN.md
│   ├── REDIS_CACHING.md
│   ├── OBSERVABILITY.md
│   └── DEPLOYMENT.md
│
├── docker-compose.yml
├── docker-compose.dev.yml
├── docker-compose.prod.yml
├── README.md
└── .env.example
```

---

## 30. Out of Scope for First Version

These features are not required in the first version:

- Multi-region deployment
- Kubernetes production deployment
- Paid billing system
- Mobile app
- OpenTelemetry distributed tracing
- Advanced anomaly detection models
- SSO/SAML login
- On-call scheduling
- PagerDuty integration
- Terraform cloud infrastructure

These can be added after the core system is working.

---

## 31. Future Enhancements

- Kubernetes manifests
- Helm charts
- OpenTelemetry tracing
- Jaeger integration
- PagerDuty integration
- Microsoft Teams integration
- WhatsApp alerts
- Mobile app with push notifications
- AI chat assistant for incident questions
- Historical incident similarity search
- Vector database for incident memory
- Billing and subscription plans
- Multi-tenant enterprise isolation
- SLO/SLA tracking
- Status page
- Public incident communication page

---

## 32. Success Metrics

The project will be successful when:

- All local infrastructure runs using one Docker Compose command.
- Logs flow from application to Kafka and Elasticsearch.
- Metrics appear in Prometheus and Grafana.
- Incidents are created from alert rules.
- AI RCA generates useful evidence-based reports.
- Notifications are sent through RabbitMQ workflows.
- Dashboard gives a clear view of system health.
- Redis caching improves repeated dashboard/API key/permission lookups.
- The architecture clearly demonstrates production-level backend and DevOps engineering.

---

## 33. Final Product Positioning

AegisOps should be presented as:

> A production-grade AI-powered DevOps incident management platform built with polyglot microservices, Kafka event streaming, RabbitMQ task queues, Redis organization-level caching, centralized logging with Elasticsearch/Kibana/Fluent Bit, and real-time monitoring with Prometheus/Grafana.

This project demonstrates:

- Backend engineering
- Microservices architecture
- Event-driven systems
- Kafka
- RabbitMQ
- Redis caching
- API Gateway design
- Observability
- AI integration
- DevOps tooling
- Production Docker Compose
- Multi-language service design

---

## 34. Final Stack Summary

| Layer | Technology |
|---|---|
| Frontend | React Vite + TypeScript |
| API Gateway | Nginx |
| Core API | Node.js Express TypeScript |
| Worker Orchestrator | Node.js TypeScript |
| Log Ingester | Go |
| Metrics Service | Go |
| AI RCA Service | Python FastAPI |
| Notification Service | Java Spring Boot |
| Deployment Tracker | Node.js Express TypeScript |
| Main Database | PostgreSQL |
| Cache | Redis |
| Streaming | Kafka |
| Task Queue | RabbitMQ |
| Logs Storage | Elasticsearch |
| Logs UI | Kibana |
| Log Forwarder | Fluent Bit |
| Metrics | Prometheus |
| Dashboards | Grafana |
| Local Runtime | Docker Compose |
| Future Runtime | Kubernetes |

---

## 35. Implementation Rule

Build in this order:

```text
1. Infrastructure first
2. Core API second
3. Log ingestion third
4. Metrics fourth
5. Incident system fifth
6. Kafka/RabbitMQ workflows sixth
7. AI RCA seventh
8. Notification service eighth
9. Dashboard polish ninth
10. Production hardening last
```

Do not start with UI only. The power of this project is the backend architecture, event flow, observability, and AI incident analysis.

