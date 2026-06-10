from fastapi import FastAPI

from app.api.routes import router

app = FastAPI(title="AegisOps AI RCA Service", version="0.1.0")
app.include_router(router)
app.include_router(router, prefix="/ai")
