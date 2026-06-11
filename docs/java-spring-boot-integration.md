# Java Spring Boot Integration

Use `packages/aegisops-java` to monitor Spring Boot or Servlet services with request metrics, slow-request metrics, error logs, and exception telemetry.

## 1. Create Project

Open `/connect-project`, choose a project type, and create the project.

## 2. Create Service

Add a service with language `Java Spring Boot`. Use the service name exactly as it will appear in `aegisops.service-name`.

## 3. Generate API Key

Generate a service API key in the wizard. SDK requests use:

```txt
Authorization: Bearer YOUR_API_KEY
```

## 4. Install SDK

Build the local SDK:

```bash
cd packages/aegisops-java
mvn install
```

Add the dependency:

```xml
<dependency>
  <groupId>com.aegisops</groupId>
  <artifactId>aegisops-java</artifactId>
  <version>0.1.0</version>
</dependency>
```

## 5. Add Properties

```properties
aegisops.enabled=true
aegisops.api-url=http://localhost:8080
aegisops.api-key=YOUR_API_KEY
aegisops.project-key=loan-tracker
aegisops.service-name=loan-tracker-springboot
aegisops.environment=production
aegisops.slow-request-threshold-ms=1000
aegisops.flush-interval-ms=5000
aegisops.batch-size=20
aegisops.debug=false
```

Environment variables with `AEGISOPS_*` names are also supported through `AegisOpsClient.fromEnv()`.

## 6. Add Filter

```java
import com.aegisops.sdk.AegisOpsClient;
import com.aegisops.sdk.AegisOpsFilter;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
class AegisOpsTelemetryConfig {
  @Bean
  FilterRegistrationBean<AegisOpsFilter> aegisOpsFilter() {
    FilterRegistrationBean<AegisOpsFilter> bean =
        new FilterRegistrationBean<>(new AegisOpsFilter(AegisOpsClient.fromEnv()));
    bean.addUrlPatterns("/*");
    return bean;
  }
}
```

For property-backed configuration, build `AegisOpsConfig.fromProperties(properties)` and pass it to `new AegisOpsFilter(config)`.

## 7. Run App

```bash
mvn spring-boot:run
```

Or run the included example:

```bash
cd examples/springboot-service
cp src/main/resources/application.properties.example src/main/resources/application.properties
mvn spring-boot:run
```

## 8. Hit Routes

```bash
curl http://localhost:7004/health
curl http://localhost:7004/api/orders
curl -X POST http://localhost:7004/api/orders -H "Content-Type: application/json" -d '{"sku":"premium-plan","quantity":2}'
curl http://localhost:7004/api/slow
curl http://localhost:7004/api/error
curl http://localhost:7004/api/random
```

## 9. Verify

Refresh the service in Connect Project. Then open Logs and Metrics and check for:

```txt
http_requests_total
http_request_duration_ms
http_errors_total
http_4xx_total
http_5xx_total
slow_requests_total
exceptions_total
```

## 10. Troubleshooting

- `not_connected`: hit a real app route after generating the service API key.
- Missing metrics: wait for the flush interval or lower `aegisops.batch-size`.
- 401/403: verify `aegisops.api-key`, `aegisops.project-key`, and `aegisops.service-name`.
- App should keep running if AegisOps is down; telemetry is retried and dropped safely.
- Health routes are ignored by default: `/health`, `/metrics`, `/favicon.ico`.
