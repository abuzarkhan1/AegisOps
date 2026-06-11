package com.aegisops.sdk;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

public final class AegisOpsClient implements AutoCloseable {
    private final AegisOpsConfig config;
    private final HttpClient httpClient;
    private final TelemetryBatcher batcher;
    private final ScheduledExecutorService scheduler;

    public AegisOpsClient(AegisOpsConfig config) {
        this.config = config;
        this.httpClient = HttpClient.newBuilder().connectTimeout(config.timeout).build();
        this.batcher = new TelemetryBatcher(config.batchSize);
        this.scheduler = Executors.newSingleThreadScheduledExecutor(runnable -> {
            Thread thread = new Thread(runnable, "aegisops-flush");
            thread.setDaemon(true);
            return thread;
        });
        if (config.enabled && !config.flushInterval.isZero() && !config.flushInterval.isNegative()) {
            scheduler.scheduleAtFixedRate(this::flush, config.flushInterval.toMillis(), config.flushInterval.toMillis(), TimeUnit.MILLISECONDS);
        }
    }

    public static AegisOpsClient fromEnv() {
        return new AegisOpsClient(AegisOpsConfig.fromEnv());
    }

    public AegisOpsConfig config() {
        return config;
    }

    public boolean canSend() {
        return config.enabled && config.apiKey != null && config.projectKey != null && config.serviceName != null;
    }

    public boolean shouldIgnoreRoute(String path) {
        return config.ignoredRoutes.stream().anyMatch(route -> path.equals(route) || path.startsWith(route.endsWith("/") ? route : route + "/"));
    }

    public void sendLog(TelemetryLog log) {
        if (!canSend()) {
            debug("log dropped because SDK is disabled or config is incomplete");
            return;
        }
        postJson("/ingest/logs", log.toMap(config));
    }

    public void sendMetric(TelemetryMetric metric) {
        sendBatchMetrics(List.of(metric));
    }

    public void sendBatchMetrics(List<TelemetryMetric> metrics) {
        if (!canSend()) {
            debug("metrics dropped because SDK is disabled or config is incomplete");
            return;
        }
        if (batcher.add(metrics)) flush();
    }

    public void flush() {
        if (!canSend()) return;
        while (true) {
            List<TelemetryMetric> batch = batcher.nextBatch();
            if (batch.isEmpty()) return;
            List<Map<String, Object>> metrics = batch.stream().map(TelemetryMetric::toMap).toList();
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("projectKey", config.projectKey);
            payload.put("serviceName", config.serviceName);
            payload.put("environment", config.environment);
            payload.put("metrics", metrics);
            postJson("/metrics-api/metrics/batch", payload);
        }
    }

    private void postJson(String path, Map<String, Object> payload) {
        String body = JsonUtil.toJson(payload);
        for (int attempt = 1; attempt <= 3; attempt++) {
            try {
                HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(config.apiUrl + path))
                    .timeout(config.timeout)
                    .header("Authorization", "Bearer " + config.apiKey)
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(body))
                    .build();
                HttpResponse<Void> response = httpClient.send(request, HttpResponse.BodyHandlers.discarding());
                if (response.statusCode() >= 200 && response.statusCode() < 300) return;
                throw new IllegalStateException("HTTP " + response.statusCode());
            } catch (Exception exception) {
                if (attempt == 3) {
                    debug("dropping telemetry after " + attempt + " failed attempts to " + path + ": " + exception.getMessage());
                    return;
                }
                sleep(Duration.ofMillis(100L * (1L << (attempt - 1))));
            }
        }
    }

    private void debug(String message) {
        if (config.debug) {
            System.err.println("[aegisops] " + message);
        }
    }

    private void sleep(Duration duration) {
        try {
            Thread.sleep(duration.toMillis());
        } catch (InterruptedException interrupted) {
            Thread.currentThread().interrupt();
        }
    }

    @Override
    public void close() {
        scheduler.shutdownNow();
        flush();
    }
}
