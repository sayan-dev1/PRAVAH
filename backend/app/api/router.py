"""Aggregated API router."""

from fastapi import APIRouter

from app.api.routes import evacuation, simulation, telemetry, villages

api_router = APIRouter(prefix="/api")
api_router.include_router(telemetry.router)
api_router.include_router(villages.router)
api_router.include_router(simulation.router)
api_router.include_router(evacuation.router)
ws_router = telemetry.ws_router

