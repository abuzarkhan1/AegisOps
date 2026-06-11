package com.aegisops.sdk;

import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class AegisOpsClientTest {
    private HttpServer server;
    private final List<String> paths = new ArrayList<>();
    private final List<String> bodies = new ArrayList<>();

    @BeforeEach
    void startServer() throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/", exchange -> {
            paths.add(exchange.getRequestURI().getPath());
            bodies.add(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            exchange.sendResponseHeaders(202, 2);
            exchange.getResponseBody().write("{}".getBytes(StandardCharsets.UTF_8));
            exchange.close();
        });
        server.start();
    }

    @AfterEach
    void stopServer() {
        server.stop(0);
    }

    @Test
    void batchingFlushesByBatchSize() {
        AegisOpsClient client = new AegisOpsClient(configBuilder().batchSize(2).flushInterval(Duration.ofHours(1)).build());
        client.sendMetric(new TelemetryMetric("one", 1, Map.of()));
        assertEquals(0, paths.size());
        client.sendMetric(new TelemetryMetric("two", 2, Map.of()));
        assertEquals(List.of("/metrics-api/metrics/batch"), paths);
        assertTrue(bodies.get(0).contains("\"metricName\":\"one\""));
        client.close();
    }

    @Test
    void disabledClientSendsNothing() {
        AegisOpsClient client = new AegisOpsClient(configBuilder().enabled(false).build());
        client.sendLog(TelemetryLog.error("disabled", "trace", "request", "/x", "GET", 500, 1, Map.of()));
        client.sendMetric(new TelemetryMetric("disabled", 1, Map.of()));
        client.flush();
        assertEquals(0, paths.size());
        client.close();
    }

    private AegisOpsConfig.Builder configBuilder() {
        return AegisOpsConfig.builder()
            .enabled(true)
            .apiUrl("http://127.0.0.1:" + server.getAddress().getPort())
            .apiKey("aeg_test")
            .projectKey("project")
            .serviceName("service")
            .environment("test")
            .timeout(Duration.ofSeconds(1));
    }
}
