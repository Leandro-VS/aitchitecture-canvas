from fastapi import FastAPI

from .routers import archetypes, diagrams, health, me


def create_app() -> FastAPI:
    app = FastAPI(title="Blueprint API", version="0.1.0")
    app.include_router(health.router)
    app.include_router(me.router)
    app.include_router(archetypes.router)
    app.include_router(diagrams.router)
    return app


app = create_app()
