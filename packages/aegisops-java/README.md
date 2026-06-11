# AegisOps Java SDK

Java client and servlet filter for Spring Boot applications.

```java
import com.aegisops.sdk.AegisOpsClient;
import com.aegisops.sdk.AegisOpsConfig;
import com.aegisops.sdk.AegisOpsFilter;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
class AegisOpsTelemetryConfig {
  @Bean
  FilterRegistrationBean<AegisOpsFilter> aegisOpsFilter() {
    AegisOpsClient client = AegisOpsClient.fromEnv();
    FilterRegistrationBean<AegisOpsFilter> bean = new FilterRegistrationBean<>(new AegisOpsFilter(client));
    bean.addUrlPatterns("/*");
    return bean;
  }
}
```

Environment:

```bash
AEGISOPS_ENABLED=true
AEGISOPS_API_URL=http://localhost:8080
AEGISOPS_API_KEY=YOUR_API_KEY
AEGISOPS_PROJECT_KEY=loan-tracker
AEGISOPS_SERVICE_NAME=loan-tracker-api
AEGISOPS_ENVIRONMENT=production
```

The SDK batches metrics, retries failed sends, adds request/trace IDs, and never lets telemetry failures crash the monitored app.
