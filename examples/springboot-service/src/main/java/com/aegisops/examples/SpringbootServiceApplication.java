package com.aegisops.examples;

import com.aegisops.sdk.AegisOpsConfig;
import com.aegisops.sdk.AegisOpsClient;
import com.aegisops.sdk.AegisOpsFilter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;

import java.util.Properties;

@SpringBootApplication
public class SpringbootServiceApplication {
    public static void main(String[] args) {
        SpringApplication.run(SpringbootServiceApplication.class, args);
    }

    @Bean
    AegisOpsConfig aegisOpsConfig(
        @Value("${aegisops.enabled:true}") String enabled,
        @Value("${aegisops.api-url:http://localhost:8080}") String apiUrl,
        @Value("${aegisops.api-key:}") String apiKey,
        @Value("${aegisops.project-key:}") String projectKey,
        @Value("${aegisops.service-name:}") String serviceName,
        @Value("${aegisops.environment:production}") String environment,
        @Value("${aegisops.slow-request-threshold-ms:1000}") String slowRequestThresholdMs,
        @Value("${aegisops.flush-interval-ms:5000}") String flushIntervalMs,
        @Value("${aegisops.batch-size:20}") String batchSize,
        @Value("${aegisops.debug:false}") String debug
    ) {
        Properties properties = new Properties();
        properties.setProperty("aegisops.enabled", enabled);
        properties.setProperty("aegisops.api-url", apiUrl);
        properties.setProperty("aegisops.api-key", apiKey);
        properties.setProperty("aegisops.project-key", projectKey);
        properties.setProperty("aegisops.service-name", serviceName);
        properties.setProperty("aegisops.environment", environment);
        properties.setProperty("aegisops.slow-request-threshold-ms", slowRequestThresholdMs);
        properties.setProperty("aegisops.flush-interval-ms", flushIntervalMs);
        properties.setProperty("aegisops.batch-size", batchSize);
        properties.setProperty("aegisops.debug", debug);

        return AegisOpsConfig.fromProperties(properties);
    }

    @Bean
    AegisOpsClient aegisOpsClient(AegisOpsConfig config) {
        return new AegisOpsClient(config);
    }

    @Bean
    FilterRegistrationBean<AegisOpsFilter> aegisOpsFilter(AegisOpsClient client) {
        FilterRegistrationBean<AegisOpsFilter> bean =
            new FilterRegistrationBean<>(new AegisOpsFilter(client));
        bean.addUrlPatterns("/*");
        return bean;
    }
}
