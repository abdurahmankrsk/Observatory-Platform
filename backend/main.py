"""
AstroObservatory FastAPI Backend
Entry point — configures app, middleware, routers, and error handlers.
"""
from __future__ import annotations

import os
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from dotenv import load_dotenv

from routers import exoplanets, asteroids, search


# Load environment variables
load_dotenv()

# Configure structured logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger("astro-observatory")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown lifecycle events."""
    logger.info("AstroObservatory backend starting up...")
    nasa_key = os.getenv("NASA_API_KEY", "DEMO_KEY")
    if nasa_key == "DEMO_KEY":
        logger.warning(
            "Using DEMO_KEY for NASA API — rate limits apply. "
            "Get a free key at https://api.nasa.gov/"
        )
    else:
        logger.info(f"NASA API key configured (ends with ...{nasa_key[-4:]})")
    yield
    logger.info("AstroObservatory backend shutting down.")


app = FastAPI(
    title="AstroObservatory API",
    description=(
        "Backend for AstroObservatory — serving exoplanet data, "
        "near-Earth asteroid tracking, and astronomical object search."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# CORS — allow frontend dev server and production Vercel deployment
ALLOWED_ORIGINS = [
    "http://localhost:5173",  # Vite dev server
    "http://localhost:3000",
    "https://*.vercel.app",
    os.getenv("FRONTEND_URL", "http://localhost:5173"),
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


# ── Custom exception handlers ─────────────────────────────────────────────────

@app.exception_handler(404)
async def not_found_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=404,
        content={"error": "Not Found", "detail": str(exc), "code": 404},
    )


@app.exception_handler(500)
async def server_error_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled error: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal Server Error",
            "detail": "An unexpected error occurred. Please try again.",
            "code": 500,
        },
    )


# ── Request logging middleware ─────────────────────────────────────────────────

@app.middleware("http")
async def log_requests(request: Request, call_next):
    logger.info(f"→ {request.method} {request.url.path}")
    response = await call_next(request)
    logger.info(f"← {response.status_code} {request.url.path}")
    return response


# ── Routers ───────────────────────────────────────────────────────────────────

app.include_router(search.router)
app.include_router(exoplanets.router)
app.include_router(asteroids.router)


# ── Health check ──────────────────────────────────────────────────────────────

@app.get("/health", tags=["system"])
async def health_check():
    """Health check endpoint for deployment platforms."""
    return {
        "status": "operational",
        "service": "AstroObservatory API",
        "version": "1.0.0",
        "nasa_key_configured": os.getenv("NASA_API_KEY", "DEMO_KEY") != "DEMO_KEY",
    }


@app.get("/", tags=["system"])
async def root():
    """Root endpoint — API documentation link."""
    return {
        "message": "AstroObservatory API",
        "docs": "/docs",
        "health": "/health",
    }
