"""Native stdio Model Context Protocol server for HydraSentry.

Implements the MCP JSON-RPC 2.0 protocol directly over stdin/stdout (one JSON
object per line), so it works without the optional ``mcp`` Python SDK being
installed. If the SDK is present it is NOT required -- this server is a complete,
spec-compliant stdio implementation of the methods an MCP client needs to
discover and call tools:

  * ``initialize``            -> server info + capabilities + protocolVersion
  * ``notifications/initialized`` (notification, no response)
  * ``tools/list``            -> the HydraSentry tool schemas
  * ``tools/call``            -> run a real tool, return content blocks
  * ``ping``                  -> {}

Each tool call routes to ``tools.py``, which calls the real HydraSentry backend
modules. Results are returned as MCP ``content`` (a text block of JSON) plus the
raw object in ``structuredContent``. Errors inside a tool are returned as a
tool result with ``isError: true`` (so the client sees the message), not as a
JSON-RPC protocol error, matching MCP conventions.

The request router ``handle_message`` is a pure function (message dict in,
response dict or None out) so it can be unit-tested without a subprocess.
"""
from __future__ import annotations

import hmac
import json
import logging
import os
import sys
from pathlib import Path
from typing import Any, Optional

# Make the backend engine modules importable regardless of the cwd the MCP
# client launches us from. This package lives at backend/hydrasentry_mcp, so the
# backend dir is the parent. Insert it before importing the schema/tool layer.
_BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(_BACKEND_DIR))

from . import __version__, schemas  # noqa: E402

logger = logging.getLogger("hydrasentry.mcp_server")

SERVER_NAME = "hydrasentry-mcp"
# MCP protocol revision this server speaks. Clients negotiate against this.
PROTOCOL_VERSION = "2024-11-05"

# Env var holding the shared secret that authorises WRITE tools (real outbound
# work / real spend). stdio MCP has no per-request headers, so the secret comes
# from the server's own environment -- the launching client sets it.
_MCP_SECRET_ENV = "HYDRASENTRY_MCP_SECRET"


def _mcp_secret() -> str:
    return os.getenv(_MCP_SECRET_ENV, "")


def _authorize_write(name: Optional[str], arguments: dict[str, Any]) -> Optional[str]:
    """Authorise a write tool. Returns None if allowed, or an error string.

    Fail-closed (operating rule #3): a write tool is refused when
    HYDRASENTRY_MCP_SECRET is UNSET, and otherwise requires a matching ``secret``
    argument compared in constant time (``hmac.compare_digest``). Read tools are
    always allowed (return None). The matched ``secret`` is popped from
    ``arguments`` by the caller so it never reaches the tool handler.
    """
    if name not in schemas.WRITE_TOOLS:
        return None
    expected = _mcp_secret()
    if not expected:
        return (f"write tool {name!r} refused: {_MCP_SECRET_ENV} not configured "
                "(fail-closed)")
    provided = arguments.get("secret") or ""
    if isinstance(provided, str) and provided and hmac.compare_digest(provided, expected):
        return None
    return f"write tool {name!r} refused: invalid or missing 'secret' argument"

# JSON-RPC error codes (subset we use).
_PARSE_ERROR = -32700
_INVALID_REQUEST = -32600
_METHOD_NOT_FOUND = -32601
_INTERNAL_ERROR = -32603


def _result(req_id: Any, result: dict[str, Any]) -> dict[str, Any]:
    return {"jsonrpc": "2.0", "id": req_id, "result": result}


def _error(req_id: Any, code: int, message: str) -> dict[str, Any]:
    return {"jsonrpc": "2.0", "id": req_id, "error": {"code": code, "message": message}}


def _initialize_result() -> dict[str, Any]:
    return {
        "protocolVersion": PROTOCOL_VERSION,
        "capabilities": {"tools": {"listChanged": False}},
        "serverInfo": {"name": SERVER_NAME, "version": __version__},
        "instructions": (
            "HydraSentry context-integrity tools. Use scan_skill / scan_skill_url "
            "to vet a SKILL.md, scan_context to check agent memories for poisoning, "
            "query_memory_graph / run_memory_attack for the live HydraDB+agent path "
            "(needs keys), and generate_certificate / verify_certificate for a "
            "tamper-evident Memory Integrity Certificate."
        ),
    }


def _call_tool(params: dict[str, Any]) -> dict[str, Any]:
    """Run a tools/call. Returns an MCP tool-result (content + structuredContent).

    A tool that returns ``{"ok": false, ...}`` or raises is reported with
    ``isError: true`` and an honest message, never silently dropped.
    """
    name = params.get("name")
    arguments = dict(params.get("arguments") or {})
    handler = schemas.get_handler(name)
    if handler is None:
        return _tool_error(f"unknown tool: {name!r}")

    # Fail-closed write-tool authorisation. The ``secret`` argument (if any) is
    # consumed here and never forwarded to the handler.
    denied = _authorize_write(name, arguments)
    if denied is not None:
        logger.warning("write tool %s refused", name)
        return _tool_error(denied)
    arguments.pop("secret", None)

    try:
        output = handler(arguments)
    except Exception as exc:  # noqa: BLE001 -- surface honestly to the client
        logger.warning("tool %s raised %s", name, type(exc).__name__)
        return _tool_error(f"tool {name} failed: {type(exc).__name__}: {exc}")

    text = json.dumps(output, indent=2, ensure_ascii=False)
    is_error = isinstance(output, dict) and output.get("ok") is False
    return {
        "content": [{"type": "text", "text": text}],
        "structuredContent": output if isinstance(output, dict) else {"value": output},
        "isError": is_error,
    }


def _tool_error(message: str) -> dict[str, Any]:
    return {
        "content": [{"type": "text", "text": message}],
        "structuredContent": {"ok": False, "error": message},
        "isError": True,
    }


def handle_message(message: dict[str, Any]) -> Optional[dict[str, Any]]:
    """Route one JSON-RPC message. Returns a response dict, or None for a
    notification (no id) that needs no reply. Pure -- no I/O."""
    if not isinstance(message, dict) or message.get("jsonrpc") != "2.0":
        return _error(message.get("id") if isinstance(message, dict) else None,
                      _INVALID_REQUEST, "invalid JSON-RPC 2.0 message")

    method = message.get("method")
    req_id = message.get("id")
    params = message.get("params") or {}
    is_notification = "id" not in message

    if method == "initialize":
        return _result(req_id, _initialize_result())
    if method in ("notifications/initialized", "initialized"):
        return None  # notification, no response
    if method == "ping":
        return _result(req_id, {})
    if method == "tools/list":
        return _result(req_id, {"tools": schemas.tool_list()})
    if method == "tools/call":
        return _result(req_id, _call_tool(params))

    if is_notification:
        return None  # ignore unknown notifications silently per JSON-RPC
    return _error(req_id, _METHOD_NOT_FOUND, f"method not found: {method!r}")


def _read_loop(stdin: Any, stdout: Any) -> None:
    """Line-delimited JSON-RPC loop over the given streams."""
    for raw in stdin:
        line = raw.strip()
        if not line:
            continue
        try:
            message = json.loads(line)
        except json.JSONDecodeError:
            _write(stdout, _error(None, _PARSE_ERROR, "parse error: invalid JSON"))
            continue
        try:
            response = handle_message(message)
        except Exception as exc:  # noqa: BLE001 -- never crash the server loop
            logger.exception("handler crashed")
            response = _error(message.get("id") if isinstance(message, dict) else None,
                              _INTERNAL_ERROR, f"internal error: {type(exc).__name__}")
        if response is not None:
            _write(stdout, response)


def _write(stdout: Any, obj: dict[str, Any]) -> None:
    stdout.write(json.dumps(obj, ensure_ascii=False) + "\n")
    stdout.flush()


def main() -> int:
    """Console entry point (``hydrasentry-mcp``). Serves MCP over stdio."""
    logging.basicConfig(
        level=logging.WARNING,
        stream=sys.stderr,  # logs to stderr so stdout stays pure JSON-RPC
        format="%(asctime)s %(name)s %(levelname)s %(message)s",
    )
    # Ensure UTF-8 line-buffered text streams.
    try:
        sys.stdin.reconfigure(encoding="utf-8")  # type: ignore[attr-defined]
        sys.stdout.reconfigure(encoding="utf-8")  # type: ignore[attr-defined]
    except (AttributeError, ValueError):  # pragma: no cover - older/odd streams
        pass
    logger.info("hydrasentry-mcp %s serving over stdio", __version__)
    try:
        _read_loop(sys.stdin, sys.stdout)
    except KeyboardInterrupt:  # pragma: no cover
        return 0
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
