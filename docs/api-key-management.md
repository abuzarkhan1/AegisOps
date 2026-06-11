# API Key Management

AegisOps API keys authenticate telemetry ingestion from monitored services. Keys can be scoped to a single service or to an organization, and only newly created or rotated keys return the raw secret.

## Dashboard

Use `/api-keys` in the web dashboard to:

- Create organization-wide or service-scoped ingestion keys.
- View masked key prefixes, status, creation time, and last-used time.
- Copy the raw key immediately after create or rotate.
- Rotate an active key.
- Revoke an active key.
- Check service connection status for service-scoped keys.

## API Surface

```http
POST /api/v1/services/:serviceId/api-keys
GET /api/v1/services/:serviceId/api-keys
POST /api/api-keys
GET /api/api-keys?organizationId=:organizationId&serviceId=:serviceId
POST /api/api-keys/:apiKeyId/rotate
DELETE /api/api-keys/:apiKeyId
POST /api/api-keys/validate
```

## Security Behavior

- Key hashes are stored in PostgreSQL and are not returned by API responses.
- Raw keys are returned once after creation or rotation.
- Revoked keys are rejected by validation and ingestion flows.
- Rotating a key revokes the previous key and issues a replacement in one database transaction.
- API-key resource routes participate in organization scoping before revoke or rotate.
- Validation checks project and service context, then caches active key context in Redis for short-lived ingestion performance.

## Operational Notes

- Last-used timestamps update when a key validates successfully.
- Rotation clears Redis cache entries for the previous key.
- Create, rotate, and revoke operations write audit log events under `resourceType=api_key`.
- Existing monitored services must be redeployed with the new raw key after rotation.
