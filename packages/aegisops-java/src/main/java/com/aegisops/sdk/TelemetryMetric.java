package com.aegisops.sdk;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

public record TelemetryMetric(String metricName, double value, Map<String, String> labels, String timestamp) {
    public TelemetryMetric(String metricName, double value, Map<String, String> labels) {
        this(metricName, value, labels, Instant.now().toString());
    }

    Map<String, Object> toMap() {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("metricName", metricName);
        out.put("value", value);
        out.put("labels", labels == null ? Map.of() : labels);
        out.put("timestamp", timestamp == null ? Instant.now().toString() : timestamp);
        return out;
    }
}
