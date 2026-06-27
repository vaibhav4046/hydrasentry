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

from fastapi import Depends, FastAPI, Header, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, PlainTextResponse
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

import mcp_gateway
import model_router
import ota
import real_graph
import real_run
import scenario_engine
import scenario_loader
import scheduler
import skillmake_marketplace
import skillmake_scanner
import storage
from auth import api_keys as api_key_svc
from auth.identity import Identity, current_identity, require_user
from config import key_status, settings
from db import persistence

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("hydrasentry.main")


def _init_app_db() -> None:
    """Bring the Postgres app DB up to schema and seed the demo tenant.

    Fail-soft at startup: if the app DB is unreachable the service still boots
    (the legacy sqlite/runs path and the real value path keep working), and the
    error is logged. Persistence then fails closed per-request, surfacing the
    error in the response -- it is never silently faked.
    """
    try:
        from db import migrate

        migrate.upgrade()
        migrate.seed()
        logger.info("app DB migrated + seeded (demo tenant)")
    except Exception as exc:  # noqa: BLE001 -- boot even if app DB is down
        logger.warning(
            "app DB init skipped (%s): persistence will fail closed per-request",
            type(exc).__name__,
        )


@asynccontextmanager
async def lifespan(_app: FastAPI):
    storage.init_db()
    scheduler.seed_agents()
    _init_app_db()
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


class ApiKeyCreateBody(BaseModel):
    name: Optional[str] = None


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


@app.post("/runs/real")
async def runs_real(
    identity: Identity = Depends(current_identity),
) -> JSONResponse:
    """Genuinely-real run: live HydraDB context (clean + poisoned sub-tenants) +
    real Groq agent answers + a computed risk score (rules + real Groq judge).

    Defined before the parametrised ``/runs/{scenario_id}`` so the literal wins.
    Forces the real path itself (does NOT flip APP_MODE), so the canonical
    deterministic ``/runs/judge-demo`` (87 / HIGH) and ``/graph/real-query`` stay
    untouched. Hard ~9s wall-clock cap: on any HydraDB/Groq failure or overrun it
    returns the deterministic result labelled ``mode:"deterministic_fallback"``
    as HTTP 200 — never a 500, never a hang.

    Auth is additive (Phase 2): the run persists to the AUTHENTICATED caller's
    own tenant (Supabase JWT or API key), or to the shared ``demo`` tenant when
    unauthenticated -- so the public showcase still works and an API-key agent's
    run lands in its user's tenant (connect-your-agent). A present-but-invalid
    credential is already a 401 from the dependency (fail-closed). Persistence is
    fail-closed: if the app DB is down the run still returns with a
    ``persistence`` block surfacing the error -- never silently faked.
    """
    try:
        result = await asyncio.to_thread(real_run.run_real)
    except Exception as exc:  # noqa: BLE001 -- belt-and-braces, never-500 contract
        logger.warning("runs/real endpoint error: %s", type(exc).__name__)
        return JSONResponse(
            {"ok": True, "real": False, "mode": "deterministic_fallback",
             "fallback_reason": f"endpoint error: {type(exc).__name__}"},
            status_code=200,
        )

    if identity.tenant_id:
        persist = await asyncio.to_thread(
            persistence.persist_run_for_tenant,
            result, identity.tenant_id, identity.tenant_slug, "runs_real",
        )
    else:
        # Demo fallback with no resolved tenant id (app DB blip): provision the
        # demo tenant by slug so the public showcase still persists.
        persist = await asyncio.to_thread(
            persistence.persist_run, result,
            identity.tenant_slug or persistence.DEFAULT_TENANT_SLUG, "runs_real",
        )
    result["persistence"] = persist
    result["auth_method"] = identity.auth_method
    return JSONResponse(result, status_code=200)


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


# --- Tenant-scoped incidents (Postgres app store) ---------------------------
# Every read here goes through the BOLA-safe tenant-scoped repo. The tenant comes
# from current_identity: the authenticated user's own tenant (JWT or API key), or
# the shared 'demo' tenant when unauthenticated. A row owned by another tenant is
# invisible -- GET /incidents/{id} returns 404, never the data -- so tenant
# isolation now holds under real auth, not just an unauthenticated header.

def _incident_dto(inc: Any) -> dict[str, Any]:
    return {
        "id": inc.id,
        "tenant_id": inc.tenant_id,
        "scenario": inc.scenario,
        "risk_score": inc.risk_score,
        "band": inc.band,
        "decision": inc.decision,
        "attack_type": inc.attack_type,
        "graph_source": inc.graph_source,
        "confidence": inc.confidence,
        "llm_provider": inc.llm_provider,
        "mode": inc.mode,
        "baseline_answer": inc.baseline_answer,
        "poisoned_answer": inc.poisoned_answer,
        "created_at": inc.created_at.isoformat() if inc.created_at else None,
    }


@app.get("/incidents")
async def list_incidents(
    identity: Identity = Depends(current_identity),
) -> JSONResponse:
    """Tenant-scoped incident list, newest first. The tenant is the caller's own
    (JWT / API key) or the demo tenant when unauthenticated. Fail-closed if the
    DB is down. A present-but-invalid credential 401s in the dependency."""
    try:
        from db.repo import AuditLogRepo, IncidentRepo

        if not identity.tenant_id:
            return ok([])
        rows = await asyncio.to_thread(IncidentRepo.list, identity.tenant_id)
        await asyncio.to_thread(
            AuditLogRepo.create, identity.tenant_id,
            action="list_incidents", actor=identity.auth_method,
            detail={"count": len(rows)},
        )
        return ok([_incident_dto(r) for r in rows])
    except Exception as exc:  # noqa: BLE001 -- fail closed, surface honestly
        logger.warning("list_incidents failed: %s", type(exc).__name__)
        return err("incident store unavailable", status=503,
                   kind=type(exc).__name__)


@app.get("/incidents/{incident_id}")
async def get_incident(
    incident_id: str,
    identity: Identity = Depends(current_identity),
) -> JSONResponse:
    """Tenant-scoped single incident. 404 if not in this tenant (BOLA gate)."""
    try:
        from db.repo import AuditLogRepo, IncidentRepo

        if not identity.tenant_id:
            return err(f"incident '{incident_id}' not found", status=404)
        inc = await asyncio.to_thread(
            IncidentRepo.get, identity.tenant_id, incident_id
        )
        if inc is None:
            # Either the id does not exist or it belongs to a different tenant.
            # Both collapse to 404 so cross-tenant probing leaks nothing.
            await asyncio.to_thread(
                AuditLogRepo.create, identity.tenant_id,
                action="get_incident_denied", actor=identity.auth_method,
                detail={"incident_id": incident_id},
            )
            return err(f"incident '{incident_id}' not found", status=404)
        await asyncio.to_thread(
            AuditLogRepo.create, identity.tenant_id,
            action="get_incident", actor=identity.auth_method,
            detail={"incident_id": incident_id},
        )
        return ok(_incident_dto(inc))
    except Exception as exc:  # noqa: BLE001 -- fail closed, surface honestly
        logger.warning("get_incident failed: %s", type(exc).__name__)
        return err("incident store unavailable", status=503,
                   kind=type(exc).__name__)


# --- Auth: user sync + per-user API keys (JWT required) ---------------------
# These are the USER-DATA management endpoints: default-deny. They depend on
# ``require_user`` (Depends), which runs BEFORE the handler body and 401s anyone
# who is not a verified Supabase user -- a forged/expired token, the demo
# fallback, or an API-key agent (an agent must not mint/list keys for the user).

def _api_key_dto(row: Any) -> dict[str, Any]:
    """A safe, RAW-key-free view of an API key for listing."""
    return {
        "id": row.id,
        "name": row.name,
        "prefix": row.prefix,
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "last_used_at": row.last_used_at.isoformat() if row.last_used_at else None,
        "revoked_at": row.revoked_at.isoformat() if row.revoked_at else None,
        "revoked": row.revoked_at is not None,
    }


@app.post("/auth/sync")
async def auth_sync(
    identity: Identity = Depends(require_user),
) -> JSONResponse:
    """Idempotent sign-in sync. Verifies the JWT (in ``require_user``), gets-or-
    creates the user + personal tenant, and returns the tenant. Safe to call on
    every web sign-in. 401 (from the dependency) if the token is
    missing/forged/expired or the caller is not a real user."""
    return ok({
        "user_id": identity.user_id,
        "email": identity.email,
        "tenant_id": identity.tenant_id,
        "tenant_slug": identity.tenant_slug,
        "auth_method": identity.auth_method,
    })


@app.get("/api-keys")
async def list_api_keys(
    identity: Identity = Depends(require_user),
) -> JSONResponse:
    """List the caller's API keys (no raw secrets). JWT required."""
    try:
        from db.repo import ApiKeyRepo

        rows = await asyncio.to_thread(ApiKeyRepo.list_for_user, identity.user_id)
        return ok([_api_key_dto(r) for r in rows])
    except Exception as exc:  # noqa: BLE001 -- fail closed, surface honestly
        logger.warning("list_api_keys failed: %s", type(exc).__name__)
        return err("api key store unavailable", status=503,
                   kind=type(exc).__name__)


@app.post("/api-keys")
async def create_api_key(
    body: ApiKeyCreateBody,
    identity: Identity = Depends(require_user),
) -> JSONResponse:
    """Create an API key for the caller. The RAW key is returned exactly ONCE
    here and is never stored or shown again. JWT required."""
    try:
        from db.repo import ApiKeyRepo

        generated = api_key_svc.new_key()
        row = await asyncio.to_thread(
            ApiKeyRepo.create,
            user_id=identity.user_id,
            tenant_id=identity.tenant_id,
            name=(body.name or "").strip()[:120],
            key_hash=generated.key_hash,
            prefix=generated.prefix,
        )
        payload = _api_key_dto(row)
        # The ONLY time the raw key is ever returned.
        payload["raw_key"] = generated.raw
        return ok(payload)
    except Exception as exc:  # noqa: BLE001 -- fail closed, surface honestly
        logger.warning("create_api_key failed: %s", type(exc).__name__)
        return err("api key store unavailable", status=503,
                   kind=type(exc).__name__)


@app.delete("/api-keys/{key_id}")
async def revoke_api_key(
    key_id: str,
    identity: Identity = Depends(require_user),
) -> JSONResponse:
    """Revoke one of the caller's API keys. 404 if it is not the caller's key
    (no cross-user revoke). JWT required."""
    try:
        from db.repo import ApiKeyRepo

        row = await asyncio.to_thread(
            ApiKeyRepo.revoke, identity.user_id, key_id
        )
        if row is None:
            return err(f"api key '{key_id}' not found", status=404)
        return ok(_api_key_dto(row))
    except Exception as exc:  # noqa: BLE001 -- fail closed, surface honestly
        logger.warning("revoke_api_key failed: %s", type(exc).__name__)
        return err("api key store unavailable", status=503,
                   kind=type(exc).__name__)


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


# --- Real HydraDB live graph (fast query-only path) -------------------------

async def _real_query_graph_response() -> JSONResponse:
    """Shared handler for the live real HydraDB query endpoint.

    Queries the PRE-WARMED stable owned tenant
    (``hydrasentry-owned-test:live_demo_support_agent``) and returns a GENUINE
    HydraDB ``query_paths`` graph in ~2-3s. The slow provision/ingest is done out
    of band, so this only issues the fast /query.

    Honest + additive + fail-closed:
    * Uses the real HydraDB key from env directly; it does NOT flip APP_MODE, so
      the canonical deterministic judge-demo (87 / HIGH / demo) stays untouched.
    * Labels ``real:true`` / ``graph_source:"real_query_paths"`` ONLY when real
      triplets actually parse (the same honesty gate as the rest of the engine).
    * Hard ~8s timeout. On any timeout/error/empty graph it returns a clean
      ``{ok:false, error, fallback:"captured"}`` envelope as HTTP 200 -- never a
      500, never a hang. The frontend can then fall back to the captured sample.
    """
    try:
        result = await asyncio.to_thread(real_graph.real_query_graph)
    except Exception as exc:  # noqa: BLE001 -- belt-and-braces, never-500 contract
        logger.warning("real-query endpoint error: %s", type(exc).__name__)
        return JSONResponse(
            {"ok": False, "error": "real query error",
             "fallback": "captured", "kind": type(exc).__name__},
            status_code=200,
        )
    # Always HTTP 200: success and the fail-closed fallback both return 200 so
    # the caller never has to handle a 4xx/5xx for the expected offline path.
    return JSONResponse(result, status_code=200)


@app.post("/graph/real-query")
async def graph_real_query_post() -> JSONResponse:
    return await _real_query_graph_response()


@app.get("/graph/real-query")
async def graph_real_query_get() -> JSONResponse:
    return await _real_query_graph_response()


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
