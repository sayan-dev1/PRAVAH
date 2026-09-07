"""FastAPI application entry point."""

import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router, ws_router
from app.core.config import ALLOWED_ORIGINS
from app.services.stream_worker import stream


@asynccontextmanager
async def lifespan(_: FastAPI):
    worker = asyncio.create_task(stream.run())
    yield
    worker.cancel()
    await asyncio.gather(worker, return_exceptions=True)


app = FastAPI(title="PRAVAH API", version="1.0.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=ALLOWED_ORIGINS, allow_credentials=True,
                   allow_methods=["*"], allow_headers=["*"])
app.include_router(api_router)
app.include_router(ws_router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
