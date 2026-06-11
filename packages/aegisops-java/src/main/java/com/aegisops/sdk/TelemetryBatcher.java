package com.aegisops.sdk;

import java.util.ArrayList;
import java.util.List;

public final class TelemetryBatcher {
    private final int batchSize;
    private final List<TelemetryMetric> queue = new ArrayList<>();

    public TelemetryBatcher(int batchSize) {
        this.batchSize = batchSize <= 0 ? 20 : batchSize;
    }

    public boolean add(List<TelemetryMetric> metrics) {
        if (metrics == null || metrics.isEmpty()) return false;
        synchronized (queue) {
            queue.addAll(metrics);
            return queue.size() >= batchSize;
        }
    }

    public List<TelemetryMetric> nextBatch() {
        synchronized (queue) {
            if (queue.isEmpty()) return List.of();
            int count = Math.min(batchSize, queue.size());
            List<TelemetryMetric> batch = new ArrayList<>(queue.subList(0, count));
            queue.subList(0, count).clear();
            return batch;
        }
    }

    public int size() {
        synchronized (queue) {
            return queue.size();
        }
    }
}
