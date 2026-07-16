from fastapi import FastAPI

from .routers import archetypes, corpus, diagrams, health, judges, me, simulation


def create_app() -> FastAPI:
    app = FastAPI(title="Blueprint API", version="0.1.0")
    app.include_router(health.router)
    app.include_router(me.router)
    app.include_router(archetypes.router)
    app.include_router(diagrams.router)
    app.include_router(simulation.router)
    app.include_router(corpus.router)
    app.include_router(judges.router)
    return app


app = create_app()
