import asyncio
import random
import time

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from aegisops import add_aegisops_middleware, send_log


app = FastAPI(title="AegisOps FastAPI Example")
add_aegisops_middleware(app)

orders = [
    {"id": "ord_1001", "sku": "starter-plan", "quantity": 1, "status": "paid"},
    {"id": "ord_1002", "sku": "ops-seat", "quantity": 3, "status": "processing"},
]


class OrderInput(BaseModel):
    sku: str = "unknown"
    quantity: int = 1


@app.get("/health")
async def health():
    return {"ok": True, "service": "fastapi-service"}


@app.get("/api/orders")
async def list_orders():
    return {"orders": orders}


@app.post("/api/orders", status_code=201)
async def create_order(payload: OrderInput):
    order = {
        "id": f"ord_{int(time.time() * 1000)}",
        "sku": payload.sku,
        "quantity": payload.quantity,
        "status": "created",
    }
    orders.append(order)
    send_log(
        {
            "level": "info",
            "message": "order created",
            "route": "/api/orders",
            "method": "POST",
            "statusCode": 201,
            "metadata": {"orderId": order["id"], "sku": order["sku"]},
        }
    )
    return {"order": order}


@app.get("/api/slow")
async def slow_route():
    await asyncio.sleep(1.5)
    return {"ok": True, "delayedMs": 1500}


@app.get("/api/error")
async def error_route():
    raise RuntimeError("Intentional FastAPI example error")


@app.get("/api/random")
async def random_route():
    value = random.random()
    if value < 0.2:
        raise HTTPException(status_code=400, detail="random validation failure")
    if value < 0.35:
        raise RuntimeError("Random dependency failure")
    if value < 0.55:
        await asyncio.sleep(1.6)
    return {"ok": True, "value": round(value, 4)}
