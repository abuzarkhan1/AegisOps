package com.aegisops.sdk;

import com.sun.net.httpserver.HttpServer;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class AegisOpsFilterTest {
    private HttpServer server;
    private final List<String> paths = Collections.synchronizedList(new ArrayList<>());
    private final List<String> bodies = Collections.synchronizedList(new ArrayList<>());

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
    void filterCapturesServerErrorTelemetry() throws Exception {
        AegisOpsClient client = new AegisOpsClient(configBuilder().batchSize(1).build());
        AegisOpsFilter filter = new AegisOpsFilter(client);
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/error");
        request.addHeader("x-request-id", "req_java");
        MockHttpServletResponse response = new MockHttpServletResponse();
        FilterChain chain = (_request, servletResponse) -> ((HttpServletResponse) servletResponse).sendError(500);

        filter.doFilter(request, response, chain);
        client.close();

        assertEquals("req_java", response.getHeader("x-request-id"));
        assertTrue(paths.contains("/metrics-api/metrics/batch"));
        assertTrue(paths.contains("/ingest/logs"));
        assertTrue(bodies.stream().anyMatch(body -> body.contains("http_5xx_total")));
    }

    @Test
    void filterCapturesExceptionTelemetry() {
        AegisOpsClient client = new AegisOpsClient(configBuilder().batchSize(1).build());
        AegisOpsFilter filter = new AegisOpsFilter(client);
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/boom");
        MockHttpServletResponse response = new MockHttpServletResponse();
        FilterChain chain = (_request, _response) -> {
            throw new ServletException("boom");
        };

        assertThrows(ServletException.class, () -> filter.doFilter(request, response, chain));
        client.close();

        assertTrue(paths.contains("/metrics-api/metrics/batch"));
        assertTrue(paths.contains("/ingest/logs"));
        assertTrue(bodies.stream().anyMatch(body -> body.contains("exceptions_total")));
    }

    private AegisOpsConfig.Builder configBuilder() {
        return AegisOpsConfig.builder()
            .enabled(true)
            .apiUrl("http://127.0.0.1:" + server.getAddress().getPort())
            .apiKey("aeg_test")
            .projectKey("project")
            .serviceName("service")
            .environment("test")
            .slowRequestThreshold(Duration.ofHours(1))
            .flushInterval(Duration.ofHours(1))
            .timeout(Duration.ofSeconds(1));
    }
}
