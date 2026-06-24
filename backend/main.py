"""HydraSentry FastAPI application.

Wires the deterministic context-integrity engine to HTTP + SSE endpoints.
CORS comes from settings; the DB, scheduled agents, and OTA packs are
initialised on startup. All responses use a consistent JSON envelope and
errors are handled explicitly.
"""
from __future__ import annotations

import asyncio
import json
import logging
from contextlib import asynccontextmanager
from typing import Any, Optional

from fastapi import FastAPI, Header, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, PlainTextResponse
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse

import mcp_gateway
import model_router
import ota
import scenario_engine
import scenario_loader
import scheduler
import skillmake_scanner
import storage
from config import key_status, settings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("hydrasentry.main")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    storage.init_db()
    scheduler.seed_agents()
    # Touch OTA packs so they are present/validated at startup.
    ota.list_packs()
    logger.info("HydraSentry startup complete (mode=%s)", settings.app_mode)
    yield


app = FastAPI(title="HydraSentry", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def ok(data: Any, **extra: Any) -> JSONResponse:
    payload = {"ok": True, "data": data}
    payload.update(extra)
    return JSONResponse(payload)


def err(message: str, status: int = 400, **extra: Any) -> JSONResponse:
    payload = {"ok": False, "error": message}
    payload.update(extra)
    return JSONResponse(payload, status_code=status)


# --- Request models ---------------------------------------------------------

class SkillScanBody(BaseModel):
    content: str
    name: Optional[str] = None


class ProviderTestBody(BaseModel):
    provider: str


class McpScenarioBody(BaseModel):
    scenario_id: str


class McpSkillBody(BaseModel):
    content: str
    name: Optional[str] = None


class McpQuarantineBody(BaseModel):
    chunk_id: str
    tenant_id: Optional[str] = None
    sub_tenant_id: Optional[str] = None


class McpReportBody(BaseModel):
    run_id: str


class McpScheduleBody(BaseModel):
    name: str


# --- Core endpoints ---------------------------------------------------------

@app.get("/health")
async def health() -> JSONResponse:
    return ok({"status": "healthy", "mode": settings.app_mode,
               "service": "hydrasentry", "version": "1.0.0"})


@app.get("/config/status")
async def config_status() -> JSONResponse:
    return ok({
        "app_mode": settings.app_mode,
        "is_real_mode": settings.is_real_mode,
        "hydra": settings.hydra.masked(),
        "mcp_shared_secret": key_status(settings.mcp_shared_secret),
        "providers": model_router.provider_status(),
        "cors_origins": settings.cors_origins,
        "frontend_url": settings.frontend_url,
    })


@app.get("/scenarios")
async def get_scenarios() -> JSONResponse:
    return ok(scenario_loader.list_scenarios())


@app.post("/runs/judge-demo")
async def judge_demo() -> JSONResponse:
    # Defined before the parametrised /runs/{scenario_id} so the literal wins.
    artifact = await asyncio.to_thread(scenario_engine.run_judge_demo)
    return ok(artifact)


@app.post("/runs/{scenario_id}")
async def create_run(scenario_id: str) -> JSONResponse:
    if scenario_id == "judge-demo":
        artifact = await asyncio.to_thread(scenario_engine.run_judge_demo)
        return ok(artifact)
    try:
        scenario_loader.get_scenario(scenario_id)
    except KeyError:
        return err(f"unknown scenario '{scenario_id}'", status=404)
    artifact = await asyncio.to_thread(
        scenario_engine.run_scenario, scenario_id, True, True, True
    )
    return ok(artifact)


@app.get("/runs/{run_id}")
async def get_run(run_id: str) -> JSONResponse:
    artifact = storage.load_run(run_id)
    if artifact is None:
        return err(f"run '{run_id}' not found", status=404)
    return ok(artifact)


@app.get("/runs/{run_id}/report")
async def get_run_report(run_id: str) -> Response:
    artifact = storage.load_run(run_id)
    if artifact is None:
        return PlainTextResponse(f"run '{run_id}' not found", status_code=404)
    return PlainTextResponse(artifact.get("report_markdown", ""), media_type="text/markdown")


@app.get("/runs/{run_id}/stream")
async def stream_run(run_id: str) -> EventSourceResponse:
    """SSE stream of pipeline stages. ``run_id`` is treated as a scenario id to
    run live; if it is an existing run it is replayed from its scenario."""
    scenario_id = run_id
    existing = storage.load_run(run_id)
    if existing is not None:
        scenario_id = existing.get("scenario_id", run_id)
    try:
        scenario_loader.get_scenario(scenario_id)
    except KeyError:
        async def err_gen():
            yield {"event": "error",
                   "data": json.dumps({"error": f"unknown scenario '{scenario_id}'"})}
        return EventSourceResponse(err_gen())

    async def event_gen():
        for event in scenario_engine.stream_stages(scenario_id):
            yield {"event": "stage", "data": json.dumps(event)}
            await asyncio.sleep(0.15)
    return EventSourceResponse(event_gen())


@app.post("/runs/{run_id}/quarantine")
async def quarantine_run(run_id: str) -> JSONResponse:
    artifact = storage.load_run(run_id)
    if artifact is None:
        return err(f"run '{run_id}' not found", status=404)
    quarantine = artifact.get("quarantine", {})
    mem_id = quarantine.get("memory_id")
    if not mem_id:
        # derive from graph tainted source if absent
        for n in artifact.get("graph", {}).get("nodes", []):
            if n.get("status") == "tainted" and n.get("source_chunk_id"):
                mem_id = n["source_chunk_id"]
                break
    new_state = {"memory_id": mem_id, "status": "quarantined" if mem_id else "no_target"}
    artifact["quarantine"] = new_state
    storage.save_run(artifact)
    return ok({"run_id": run_id, "quarantine": new_state})


@app.get("/findings")
async def get_findings() -> JSONResponse:
    return ok(storage.list_findings())


@app.get("/scheduled-agents")
async def get_scheduled_agents() -> JSONResponse:
    return ok(scheduler.list_agents())


@app.post("/scheduled-agents/{agent_id}/toggle")
async def toggle_scheduled_agent(agent_id: str) -> JSONResponse:
    result = scheduler.toggle(agent_id)
    if result is None:
        return err(f"agent '{agent_id}' not found", status=404)
    return ok(result)


@app.post("/skillmake/scan")
async def skillmake_scan(body: SkillScanBody) -> JSONResponse:
    scan = skillmake_scanner.scan_skill(body.content, name=body.name)
    storage.save_skill_scan(scan)
    return ok(scan)


@app.get("/results/summary")
async def results_summary() -> JSONResponse:
    return ok(storage.results_summary())


@app.get("/settings/providers")
async def settings_providers() -> JSONResponse:
    return ok(model_router.provider_status())


@app.post("/settings/providers/test")
async def settings_providers_test(body: ProviderTestBody) -> JSONResponse:
    return ok(model_router.test_connection(body.provider))


# --- MCP endpoints ----------------------------------------------------------

@app.get("/mcp/manifest")
async def mcp_manifest() -> JSONResponse:
    return ok(mcp_gateway.manifest())


@app.get("/mcp/resources")
async def mcp_resources() -> JSONResponse:
    return ok(mcp_gateway.resources())


def _mcp(tool: str, args: dict[str, Any], secret: Optional[str]) -> JSONResponse:
    result = mcp_gateway.call_tool(tool, args, provided_secret=secret)
    status = 200 if result.get("ok") else (
        401 if result.get("error") == "unauthorized" else 400
    )
    return JSONResponse(result, status_code=status)


@app.post("/mcp/scan_context")
async def mcp_scan_context(body: McpScenarioBody) -> JSONResponse:
    return _mcp("scan_context", body.model_dump(), None)


@app.post("/mcp/replay_attack")
async def mcp_replay_attack(
    body: McpScenarioBody, x_mcp_secret: Optional[str] = Header(default=None)
) -> JSONResponse:
    return _mcp("replay_attack", body.model_dump(), x_mcp_secret)


@app.post("/mcp/verify_skill")
async def mcp_verify_skill(
    body: McpSkillBody, x_mcp_secret: Optional[str] = Header(default=None)
) -> JSONResponse:
    return _mcp("verify_skill", body.model_dump(), x_mcp_secret)


@app.post("/mcp/quarantine_memory")
async def mcp_quarantine_memory(
    body: McpQuarantineBody, x_mcp_secret: Optional[str] = Header(default=None)
) -> JSONResponse:
    return _mcp("quarantine_memory", body.model_dump(), x_mcp_secret)


@app.post("/mcp/generate_report")
async def mcp_generate_report(
    body: McpReportBody, x_mcp_secret: Optional[str] = Header(default=None)
) -> JSONResponse:
    return _mcp("generate_report", body.model_dump(), x_mcp_secret)


@app.post("/mcp/schedule_scan")
async def mcp_schedule_scan(
    body: McpScheduleBody, x_mcp_secret: Optional[str] = Header(default=None)
) -> JSONResponse:
    return _mcp("schedule_scan", body.model_dump(), x_mcp_secret)
