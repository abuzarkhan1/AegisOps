package com.aegisops.examples;

import com.aegisops.sdk.AegisOpsClient;
import com.aegisops.sdk.TelemetryLog;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Random;

@RestController
public class OrdersController {
    private final AegisOpsClient aegisOpsClient;
    private final List<Order> orders = new ArrayList<>(List.of(
        new Order("ord_1001", "starter-plan", 1, "paid"),
        new Order("ord_1002", "ops-seat", 3, "processing")
    ));
    private final Random random = new Random();

    public OrdersController(AegisOpsClient aegisOpsClient) {
        this.aegisOpsClient = aegisOpsClient;
    }

    @GetMapping("/health")
    public Map<String, Object> health() {
        return Map.of("ok", true, "service", "springboot-service");
    }

    @GetMapping("/api/orders")
    public Map<String, Object> listOrders() {
        return Map.of("orders", orders);
    }

    @PostMapping("/api/orders")
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, Object> createOrder(@RequestBody OrderInput input) {
        Order order = new Order("ord_" + System.currentTimeMillis(), input.sku(), input.quantity() <= 0 ? 1 : input.quantity(), "created");
        orders.add(order);
        aegisOpsClient.sendLog(TelemetryLog.info(
            "order created",
            null,
            null,
            "/api/orders",
            "POST",
            201,
            0,
            Map.of("orderId", order.id(), "sku", order.sku())
        ));
        return Map.of("order", order);
    }

    @GetMapping("/api/slow")
    public Map<String, Object> slow() throws InterruptedException {
        Thread.sleep(1500);
        return Map.of("ok", true, "delayedMs", 1500);
    }

    @GetMapping("/api/error")
    public Map<String, Object> error() {
        throw new IllegalStateException("Intentional Spring Boot example error");
    }

    @GetMapping("/api/random")
    public Map<String, Object> random() throws InterruptedException {
        double value = random.nextDouble();
        if (value < 0.2) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "random validation failure");
        }
        if (value < 0.35) {
            throw new IllegalStateException("Random dependency failure");
        }
        if (value < 0.55) {
            Thread.sleep(1600);
        }
        return Map.of("ok", true, "value", value);
    }

    public record Order(String id, String sku, int quantity, String status) {}
    public record OrderInput(String sku, int quantity) {}
}
