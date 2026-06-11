package com.aegisops.sdk;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

public record TelemetryLog(
    String level,
    String message,
    String traceId,
    String requestId,
    String route,
    String method,
    int statusCode,
    double durationMs,
    String timestamp,
    Map<String, Object> metadata
) {
    public static TelemetryLog error(String message, String traceId, String requestId, String route, String method, int statusCode, double durationMs, Map<String, Object> metadata) {
        return new TelemetryLog("error", message, traceId, requestId, route, method, statusCode, durationMs, Instant.now().toString(), metadata);
    }

    public static TelemetryLog warn(String message, String traceId, String requestId, String route, String method, int statusCode, double durationMs, Map<String, Object> metadata) {
        return new TelemetryLog("warn", message, traceId, requestId, route, method, statusCode, durationMs, Instant.now().toString(), metadata);
    }

    Map<String, Object> toMap(AegisOpsConfig config) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("projectKey", config.projectKey);
        out.put("serviceName", config.serviceName);
        out.put("environment", config.environment);
        out.put("level", level == null ? "info" : level);
        out.put("message", message);
        out.put("traceId", traceId);
        out.put("requestId", requestId);
        out.put("route", route);
        out.put("method", method);
        out.put("statusCode", statusCode == 0 ? null : statusCode);
        out.put("durationMs", durationMs);
        out.put("timestamp", timestamp == null ? Instant.now().toString() : timestamp);
        out.put("metadata", metadata == null ? Map.of() : metadata);
        return out;
    }
}
