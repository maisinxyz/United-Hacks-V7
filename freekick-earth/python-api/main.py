"""
FreeKick Earth — FastAPI Backend
Placeholder entry point. Full endpoints will be built in Phase 3.
"""

from fastapi import FastAPI

app = FastAPI(
    title="FreeKick Earth API",
    description="Physics simulation backend for the FreeKick Earth game.",
    version="0.1.0",
)


@app.get("/")
async def root():
    """Health-check endpoint."""
    return {"status": "ok", "message": "FreeKick Earth API is running."}
