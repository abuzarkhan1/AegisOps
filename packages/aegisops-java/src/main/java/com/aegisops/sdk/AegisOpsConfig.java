package com.aegisops.sdk;

import java.time.Duration;
import java.util.Arrays;
import java.util.List;
import java.util.Properties;

public final class AegisOpsConfig {
    public final boolean enabled;
    public final String apiUrl;
    public final String apiKey;
    public final String projectKey;
    public final String serviceName;
    public final String environment;
    public final boolean captureRequestBody;
    public final boolean captureResponseBody;
    public final boolean captureHeaders;
    public final List<String> ignoredRoutes;
    public final Duration slowRequestThreshold;
    public final Duration flushInterval;
    public final int batchSize;
    public final boolean debug;
    public final Duration timeout;

    private AegisOpsConfig(Builder builder) {
        this.enabled = builder.enabled;
        this.apiUrl = trimRight(builder.apiUrl == null || builder.apiUrl.isBlank() ? "http://localhost:8080" : builder.apiUrl, "/");
        this.apiKey = emptyToNull(builder.apiKey);
        this.projectKey = emptyToNull(builder.projectKey);
        this.serviceName = emptyToNull(builder.serviceName);
        this.environment = builder.environment == null || builder.environment.isBlank() ? "development" : builder.environment;
        this.captureRequestBody = builder.captureRequestBody;
        this.captureResponseBody = builder.captureResponseBody;
        this.captureHeaders = builder.captureHeaders;
        this.ignoredRoutes = builder.ignoredRoutes == null ? List.of("/health", "/metrics", "/favicon.ico") : List.copyOf(builder.ignoredRoutes);
        this.slowRequestThreshold = builder.slowRequestThreshold == null ? Duration.ofSeconds(1) : builder.slowRequestThreshold;
        this.flushInterval = builder.flushInterval == null ? Duration.ofSeconds(5) : builder.flushInterval;
        this.batchSize = builder.batchSize <= 0 ? 20 : builder.batchSize;
        this.debug = builder.debug;
        this.timeout = builder.timeout == null ? Duration.ofMillis(1500) : builder.timeout;
    }

    public static Builder builder() {
        return new Builder();
    }

    public static AegisOpsConfig fromEnv() {
        return builder()
            .enabled(envBool("AEGISOPS_ENABLED", true))
            .apiUrl(env("AEGISOPS_API_URL", "http://localhost:8080"))
            .apiKey(System.getenv("AEGISOPS_API_KEY"))
            .projectKey(System.getenv("AEGISOPS_PROJECT_KEY"))
            .serviceName(System.getenv("AEGISOPS_SERVICE_NAME"))
            .environment(env("AEGISOPS_ENVIRONMENT", env("ENVIRONMENT", "development")))
            .ignoredRoutes(csvList(env("AEGISOPS_IGNORED_ROUTES", "/health,/metrics,/favicon.ico")))
            .slowRequestThreshold(Duration.ofMillis(envLong("AEGISOPS_SLOW_REQUEST_THRESHOLD_MS", 1000)))
            .flushInterval(Duration.ofMillis(envLong("AEGISOPS_FLUSH_INTERVAL_MS", 5000)))
            .batchSize((int) envLong("AEGISOPS_BATCH_SIZE", 20))
            .debug(envBool("AEGISOPS_DEBUG", false))
            .build();
    }

    public static AegisOpsConfig fromProperties(Properties properties) {
        Properties source = properties == null ? new Properties() : properties;
        return builder()
            .enabled(propBool(source, "aegisops.enabled", true))
            .apiUrl(prop(source, "aegisops.api-url", "http://localhost:8080"))
            .apiKey(source.getProperty("aegisops.api-key"))
            .projectKey(source.getProperty("aegisops.project-key"))
            .serviceName(source.getProperty("aegisops.service-name"))
            .environment(prop(source, "aegisops.environment", "development"))
            .ignoredRoutes(csvList(prop(source, "aegisops.ignored-routes", "/health,/metrics,/favicon.ico")))
            .slowRequestThreshold(Duration.ofMillis(propLong(source, "aegisops.slow-request-threshold-ms", 1000)))
            .flushInterval(Duration.ofMillis(propLong(source, "aegisops.flush-interval-ms", 5000)))
            .batchSize((int) propLong(source, "aegisops.batch-size", 20))
            .debug(propBool(source, "aegisops.debug", false))
            .build();
    }

    private static boolean envBool(String key, boolean fallback) {
        String value = System.getenv(key);
        if (value == null || value.isBlank()) return fallback;
        String normalized = value.trim().toLowerCase();
        return !List.of("0", "false", "no", "off").contains(normalized);
    }

    private static String env(String key, String fallback) {
        String value = System.getenv(key);
        return value == null || value.isBlank() ? fallback : value.trim();
    }

    private static long envLong(String key, long fallback) {
        String value = System.getenv(key);
        if (value == null || value.isBlank()) return fallback;
        try {
            return Long.parseLong(value.trim());
        } catch (NumberFormatException ignored) {
            return fallback;
        }
    }

    private static String prop(Properties properties, String key, String fallback) {
        String value = properties.getProperty(key);
        return value == null || value.isBlank() ? fallback : value.trim();
    }

    private static boolean propBool(Properties properties, String key, boolean fallback) {
        String value = properties.getProperty(key);
        if (value == null || value.isBlank()) return fallback;
        String normalized = value.trim().toLowerCase();
        return !List.of("0", "false", "no", "off").contains(normalized);
    }

    private static long propLong(Properties properties, String key, long fallback) {
        String value = properties.getProperty(key);
        if (value == null || value.isBlank()) return fallback;
        try {
            return Long.parseLong(value.trim());
        } catch (NumberFormatException ignored) {
            return fallback;
        }
    }

    private static List<String> csvList(String value) {
        if (value == null || value.isBlank()) return List.of();
        return Arrays.stream(value.split(","))
            .map(String::trim)
            .filter(item -> !item.isBlank())
            .toList();
    }

    private static String emptyToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private static String trimRight(String value, String suffix) {
        while (value.endsWith(suffix)) {
            value = value.substring(0, value.length() - suffix.length());
        }
        return value;
    }

    public static final class Builder {
        private boolean enabled = true;
        private String apiUrl = "http://localhost:8080";
        private String apiKey;
        private String projectKey;
        private String serviceName;
        private String environment = "development";
        private boolean captureRequestBody;
        private boolean captureResponseBody;
        private boolean captureHeaders;
        private List<String> ignoredRoutes;
        private Duration slowRequestThreshold = Duration.ofSeconds(1);
        private Duration flushInterval = Duration.ofSeconds(5);
        private int batchSize = 20;
        private boolean debug;
        private Duration timeout = Duration.ofMillis(1500);

        public Builder enabled(boolean enabled) { this.enabled = enabled; return this; }
        public Builder apiUrl(String apiUrl) { this.apiUrl = apiUrl; return this; }
        public Builder apiKey(String apiKey) { this.apiKey = apiKey; return this; }
        public Builder projectKey(String projectKey) { this.projectKey = projectKey; return this; }
        public Builder serviceName(String serviceName) { this.serviceName = serviceName; return this; }
        public Builder environment(String environment) { this.environment = environment; return this; }
        public Builder captureRequestBody(boolean captureRequestBody) { this.captureRequestBody = captureRequestBody; return this; }
        public Builder captureResponseBody(boolean captureResponseBody) { this.captureResponseBody = captureResponseBody; return this; }
        public Builder captureHeaders(boolean captureHeaders) { this.captureHeaders = captureHeaders; return this; }
        public Builder ignoredRoutes(List<String> ignoredRoutes) { this.ignoredRoutes = ignoredRoutes; return this; }
        public Builder slowRequestThreshold(Duration slowRequestThreshold) { this.slowRequestThreshold = slowRequestThreshold; return this; }
        public Builder flushInterval(Duration flushInterval) { this.flushInterval = flushInterval; return this; }
        public Builder batchSize(int batchSize) { this.batchSize = batchSize; return this; }
        public Builder debug(boolean debug) { this.debug = debug; return this; }
        public Builder timeout(Duration timeout) { this.timeout = timeout; return this; }
        public AegisOpsConfig build() { return new AegisOpsConfig(this); }
    }
}
