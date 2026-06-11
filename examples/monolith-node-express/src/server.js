const express = require("express");
require("dotenv/config");
const { aegisopsMiddleware, aegisopsErrorHandler, sendLog } = require("@aegisops/node");

const app = express();
const port = Number(process.env.PORT || 7001);
const orders = [
  { id: "ord_1001", sku: "starter-plan", quantity: 1, status: "paid" },
  { id: "ord_1002", sku: "ops-seat", quantity: 3, status: "processing" }
];

app.use(express.json());
app.use(
  aegisopsMiddleware({
    slowRequestThresholdMs: 1000
  })
);

app.get("/health", (req, res) => {
  res.json({ ok: true, service: process.env.AEGISOPS_SERVICE_NAME || "orders-api" });
});

app.get("/api/orders", (req, res) => {
  res.json({ orders });
});

app.post("/api/orders", (req, res) => {
  const order = {
    id: `ord_${Date.now()}`,
    sku: req.body.sku || "unknown",
    quantity: Number(req.body.quantity || 1),
    status: "created"
  };
  orders.push(order);
  void sendLog({
    level: "info",
    message: "order created",
    route: "/api/orders",
    method: "POST",
    statusCode: 201,
    metadata: { orderId: order.id, sku: order.sku }
  }).catch(() => undefined);
  res.status(201).json({ order });
});

app.get("/api/orders/:id", (req, res) => {
  const order = orders.find((item) => item.id === req.params.id);
  if (!order) {
    res.status(404).json({ error: "order not found" });
    return;
  }
  res.json({ order });
});

app.get("/api/slow", async (req, res) => {
  await new Promise((resolve) => setTimeout(resolve, 1500));
  res.json({ ok: true, delayedMs: 1500 });
});

app.get("/api/error", (req, res, next) => {
  next(new Error("Intentional example error"));
});

app.get("/api/random", async (req, res, next) => {
  const value = Math.random();
  if (value < 0.2) {
    res.status(400).json({ error: "random validation failure" });
    return;
  }
  if (value < 0.35) {
    next(new Error("Random dependency failure"));
    return;
  }
  if (value < 0.55) {
    await new Promise((resolve) => setTimeout(resolve, 1600));
  }
  res.json({ ok: true, value: Number(value.toFixed(4)) });
});

app.use(aegisopsErrorHandler());

app.use((err, req, res, next) => {
  if (res.headersSent) {
    next(err);
    return;
  }
  res.status(500).json({ error: err.message });
});

app.listen(port, () => {
  console.log(`AegisOps example app listening on http://localhost:${port}`);
});
