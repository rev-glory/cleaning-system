import torch
# Safety allowlist for YOLO models in PyTorch 2.6+
torch.serialization.add_safe_globals([
    "ultralytics.nn.tasks.DetectionModel", 
    "ultralytics.nn.tasks.SegmentationModel"
])

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
from app.database import connect_db, close_db
from app.routes import auth, zones, analyze

@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_db()
    yield
    await close_db()

app = FastAPI(
    title="Cleaning Detection System",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173","http://127.0.0.1:5173", "https://cleaning-system-zeta.vercel.app"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    import traceback
    traceback.print_exc()
    return JSONResponse(status_code=500, content={"detail": str(exc)})

app.include_router(auth.router)
app.include_router(zones.router)
app.include_router(analyze.router)

@app.get("/health")
async def health():
    return {
        "status": "ok",
        "service": "cleaning-system-api"
    }