package com.aegisops.sdk;

import jakarta.servlet.Filter;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletRequest;
import jakarta.servlet.ServletResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpServletResponseWrapper;

import java.io.IOException;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public final class AegisOpsFilter implements Filter {
    private final AegisOpsClient client;

    public AegisOpsFilter(AegisOpsClient client) {
        this.client = client;
    }

    public AegisOpsFilter(AegisOpsConfig config) {
        this(new AegisOpsClient(config));
    }

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain) throws IOException, ServletException {
        if (!(request instanceof HttpServletRequest httpRequest) || !(response instanceof HttpServletResponse httpResponse)) {
            chain.doFilter(request, response);
            return;
        }

        String route = httpRequest.getRequestURI();
        if (client.shouldIgnoreRoute(route)) {
            chain.doFilter(request, response);
            return;
        }

        long started = System.nanoTime();
        String requestId = firstNonEmpty(httpRequest.getHeader("x-request-id"), httpRequest.getHeader("x-correlation-id"), UUID.randomUUID().toString());
        String traceId = firstNonEmpty(httpRequest.getHeader("x-trace-id"), httpRequest.getHeader("traceparent"), UUID.randomUUID().toString());
        httpResponse.setHeader("x-request-id", requestId);
        httpResponse.setHeader("x-trace-id", traceId);

        StatusResponseWrapper wrapped = new StatusResponseWrapper(httpResponse);
        try {
            chain.doFilter(request, wrapped);
        } catch (Throwable throwable) {
            double durationMs = durationMs(started);
            wrapped.setStatus(500);
            Map<String, String> labels = labels(httpRequest.getMethod(), route, 500);
            client.sendMetric(new TelemetryMetric("exceptions_total", 1, labels));
            client.sendLog(TelemetryLog.error(
                throwable.getMessage() == null ? throwable.getClass().getSimpleName() : throwable.getMessage(),
                traceId,
                requestId,
                route,
                httpRequest.getMethod(),
                500,
                durationMs,
                metadata(httpRequest, route, 500, durationMs, requestId, traceId)
            ));
            if (throwable instanceof IOException ioException) throw ioException;
            if (throwable instanceof ServletException servletException) throw servletException;
            if (throwable instanceof RuntimeException runtimeException) throw runtimeException;
            throw new ServletException(throwable);
        } finally {
            int statusCode = wrapped.statusCode();
            double durationMs = durationMs(started);
            Map<String, String> labels = labels(httpRequest.getMethod(), route, statusCode);
            List<TelemetryMetric> metrics = new ArrayList<>();
            metrics.add(new TelemetryMetric("http_requests_total", 1, labels));
            metrics.add(new TelemetryMetric("http_request_duration_ms", durationMs, labels));
            if (statusCode >= 400) metrics.add(new TelemetryMetric("http_errors_total", 1, labels));
            if (statusCode >= 500) metrics.add(new TelemetryMetric("http_5xx_total", 1, labels));
            else if (statusCode >= 400) metrics.add(new TelemetryMetric("http_4xx_total", 1, labels));
            if (Duration.ofNanos(System.nanoTime() - started).compareTo(client.config().slowRequestThreshold) >= 0) {
                metrics.add(new TelemetryMetric("slow_requests_total", 1, labels));
                client.sendLog(TelemetryLog.warn(
                    "Slow request " + httpRequest.getMethod() + " " + route,
                    traceId,
                    requestId,
                    route,
                    httpRequest.getMethod(),
                    statusCode,
                    durationMs,
                    metadata(httpRequest, route, statusCode, durationMs, requestId, traceId)
                ));
            }
            client.sendBatchMetrics(metrics);
            if (statusCode >= 500) {
                client.sendLog(TelemetryLog.error(
                    "HTTP " + statusCode + " " + httpRequest.getMethod() + " " + route,
                    traceId,
                    requestId,
                    route,
                    httpRequest.getMethod(),
                    statusCode,
                    durationMs,
                    metadata(httpRequest, route, statusCode, durationMs, requestId, traceId)
                ));
            }
        }
    }

    private static Map<String, String> labels(String method, String route, int statusCode) {
        return Map.of("method", method, "route", route, "statusCode", String.valueOf(statusCode));
    }

    private Map<String, Object> metadata(HttpServletRequest request, String route, int statusCode, double durationMs, String requestId, String traceId) {
        Map<String, Object> metadata = new LinkedHashMap<>();
        metadata.put("route", route);
        metadata.put("method", request.getMethod());
        metadata.put("statusCode", statusCode);
        metadata.put("durationMs", durationMs);
        metadata.put("requestId", requestId);
        metadata.put("traceId", traceId);
        metadata.put("userAgent", request.getHeader("user-agent"));
        metadata.put("ip", request.getRemoteAddr());
        metadata.put("projectKey", client.config().projectKey);
        metadata.put("serviceName", client.config().serviceName);
        metadata.put("environment", client.config().environment);
        return metadata;
    }

    private static double durationMs(long started) {
        return (System.nanoTime() - started) / 1_000_000.0;
    }

    private static String firstNonEmpty(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank()) return value.trim();
        }
        return "";
    }

    private static final class StatusResponseWrapper extends HttpServletResponseWrapper {
        private int statusCode = 200;

        StatusResponseWrapper(HttpServletResponse response) {
            super(response);
        }

        int statusCode() {
            return statusCode;
        }

        @Override
        public void setStatus(int sc) {
            statusCode = sc;
            super.setStatus(sc);
        }

        @Override
        public void sendError(int sc) throws IOException {
            statusCode = sc;
            super.sendError(sc);
        }

        @Override
        public void sendError(int sc, String msg) throws IOException {
            statusCode = sc;
            super.sendError(sc, msg);
        }
    }
}
