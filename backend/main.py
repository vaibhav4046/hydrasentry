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
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, PlainTextResponse
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

import mcp_gateway
import model_router
import ota
import scenario_engine
import scenario_loader
import scheduler
import skillmake_marketplace
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


# --- Never-500 contract -----------------------------------------------------
# Every error leaves the service as the project envelope ``{ok: false, error}``
# with a 4xx status, never a bare FastAPI/Starlette 500 with a stack trace.
# Three handlers cover the surface: request validation (malformed body/params),
# explicit HTTP errors raised inside handlers, and any other unhandled
# exception. The detail string is kept short and non-sensitive.

@app.exception_handler(RequestValidationError)
async def _on_validation_error(_request: Request,
                               exc: RequestValidationError) -> JSONResponse:
    # 422 -> 400 with a compact, safe summary of what failed to validate.
    problems = [
        {"loc": ".".join(str(p) for p in e.get("loc", [])), "msg": e.get("msg", "")}
        for e in exc.errors()[:8]
    ]
    return err("invalid request payload", status=400, problems=problems)


@app.exception_handler(StarletteHTTPException)
async def _on_http_error(_request: Request,
                         exc: StarletteHTTPException) -> JSONResponse:
    detail = exc.detail if isinstance(exc.detail, str) else "request failed"
    status = exc.status_code if 400 <= exc.status_code < 600 else 400
    return err(detail, status=status)


@app.exception_handler(Exception)
async def _on_unhandled_error(request: Request, exc: Exception) -> JSONResponse:
    # Fail closed: log the real cause server-side, return a generic envelope.
    logger.exception("unhandled error on %s %s: %s",
                     request.method, request.url.path, exc)
    return err("internal error", status=400, kind=type(exc).__name__)


# --- Request models ---------------------------------------------------------

class SkillScanBody(BaseModel):
    content: str
    name: Optional[str] = None


class SkillScanUrlBody(BaseModel):
    name: str  # marketplace slug, e.g. "firecrawl-mcp"


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


class LocalMemory(BaseModel):
    text: str
    id: Optional[str] = None
    trust: Optional[str] = None
    kind: Optional[str] = None
    relations: Optional[list[dict[str, Any]]] = None


class LocalScanBody(BaseModel):
    """Payload for the zero-setup local scan (no HydraDB key required)."""
    memories: list[LocalMemory]
    task: Optional[str] = None
    policy: Optional[str] = None
    attack_type: Optional[str] = None
    forbidden_markers: Optional[list[str]] = None
    safe_markers: Optional[list[str]] = None


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
    try:
        artifact = await asyncio.to_thread(scenario_engine.run_judge_demo)
    except Exception as exc:  # noqa: BLE001 -- never-500 contract
        logger.exception("judge-demo run failed: %s", exc)
        return err("judge-demo run failed", status=400, kind=type(exc).__name__)
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
    try:
        scan = skillmake_scanner.scan_skill(body.content, name=body.name)
        storage.save_skill_scan(scan)
    except Exception as exc:  # noqa: BLE001 -- never-500 contract
        logger.exception("skill scan failed: %s", exc)
        return err("skill scan failed", status=400, kind=type(exc).__name__)
    return ok(scan)


@app.post("/skillmake/scan-url")
async def skillmake_scan_url(body: SkillScanUrlBody) -> JSONResponse:
    """Pull a real SKILL.md from skillmake.xyz by slug, then scan it.

    OPT-IN and additive: this is never on the canonical /runs/judge-demo path.
    The fetch fails closed (a clean JSON error, never a 500) and falls back to a
    pre-cached real fixture so the live demo survives offline. The fetched text
    is piped through the same deterministic scanner that powers /skillmake/scan.
    """
    fetched = await asyncio.to_thread(skillmake_marketplace.fetch_skill, body.name)
    if not fetched.get("ok"):
        return ok({
            "fetch_ok": False,
            "slug": fetched.get("slug"),
            "source": fetched.get("source", "none"),
            "url": fetched.get("url"),
            "error": fetched.get("error", "fetch failed"),
            "scan": None,
        })
    content = fetched["content"]
    scan = skillmake_scanner.scan_skill(content, name=fetched["slug"])
    storage.save_skill_scan(scan)
    return ok({
        "fetch_ok": True,
        "slug": fetched["slug"],
        "source": fetched["source"],  # "live" or "cache"
        "url": fetched["url"],
        "content": content,
        "scan": scan,
    })


@app.get("/skillmake/examples")
async def skillmake_examples() -> JSONResponse:
    """Real, validated marketplace slugs the UI can offer as one-click pulls."""
    return ok({"slugs": skillmake_marketplace.EXAMPLE_SLUGS})


@app.get("/results/summary")
async def results_summary() -> JSONResponse:
    return ok(storage.results_summary())


# Outer bound on accepted memories at the HTTP edge. The local_scan engine caps
# again internally; this rejects an obviously oversized batch before any work so
# the endpoint cannot be used as a CPU sink. Generous vs the engine cap (200).
_SCAN_LOCAL_MAX_MEMORIES = 500


@app.post("/scan/local")
async def scan_local(body: LocalScanBody) -> JSONResponse:
    """Zero-setup local scan: run the full pipeline on caller-supplied memories
    with NO HydraDB key, account, or network. The graph is a transparent local
    heuristic graph (``local_graph``), never presented as real HydraDB. Additive
    and isolated from the canonical demo and the Real/Demo adapters.

    Fails closed: malformed, oversized, or garbage payloads return a clean
    ``{ok: false, error}`` envelope (4xx), never a bare 500. Pydantic validates
    the body shape; this adds a size guard and a defensive catch so an
    unexpected engine error still surfaces as a clean error.
    """
    from adapters.local_scan import run_local_scan

    if len(body.memories) > _SCAN_LOCAL_MAX_MEMORIES:
        return err(
            f"too many memories: {len(body.memories)} "
            f"(max {_SCAN_LOCAL_MAX_MEMORIES})",
            status=413,
        )

    payload = body.model_dump(exclude_none=True)
    try:
        result = await asyncio.to_thread(run_local_scan, payload)
    except Exception as exc:  # noqa: BLE001 -- never-500 contract, log + envelope
        logger.exception("local scan failed: %s", exc)
        return err("local scan failed", status=400, kind=type(exc).__name__)
    return ok(result)


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
