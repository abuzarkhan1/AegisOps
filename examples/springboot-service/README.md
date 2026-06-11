# AegisOps Spring Boot Example

Small Spring Boot app wired to `packages/aegisops-java`.

## Run

1. Build the local Java SDK:

```bash
cd ../../packages/aegisops-java
mvn install
```

2. Return to this example, copy `src/main/resources/application.properties.example` to `src/main/resources/application.properties`, and set the service API key.
3. Start the app:

```bash
mvn spring-boot:run
```

4. Hit routes:

```bash
curl http://localhost:7004/health
curl http://localhost:7004/api/orders
curl -X POST http://localhost:7004/api/orders -H "Content-Type: application/json" -d '{"sku":"premium-plan","quantity":2}'
curl http://localhost:7004/api/slow
curl http://localhost:7004/api/error
curl http://localhost:7004/api/random
```

5. Refresh the service connection status in AegisOps and open Logs/Metrics.

## Routes

```text
GET  /health
GET  /api/orders
POST /api/orders
GET  /api/slow
GET  /api/error
GET  /api/random
```
