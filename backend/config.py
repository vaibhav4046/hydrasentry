"""Configuration and secret-masking for HydraSentry.

Secrets are NEVER hardcoded and NEVER printed. Any key is exposed to the
frontend only through ``key_status`` which returns a masked fingerprint
(sha256 of the first 10 hex chars) plus length, never the value itself.
"""
from __future__ import annotations

import hashlib
import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

try:
    from dotenv import load_dotenv
except Exception:  # pragma: no cover - dotenv always present in requirements
    def load_dotenv(*_args, **_kwargs):  # type: ignore
        return False

# Resolve repo paths relative to this file so imports work from any cwd.
BACKEND_DIR = Path(__file__).resolve().parent
REPO_ROOT = BACKEND_DIR.parent
ENV_PATH = BACKEND_DIR / ".env"
RUNS_DIR = REPO_ROOT / "runs"

# Load backend/.env if present. Never fails if absent (e.g. CI).
load_dotenv(dotenv_path=ENV_PATH, override=False)

DEFAULT_TENANT = "hydrasentry-owned-test"


def _env(name: str, default: str = "") -> str:
    value = os.getenv(name)
    return value if value is not None and value != "" else default


def key_status(value: Optional[str]) -> dict:
    """Return a masked status for a secret value.

    Shape: {configured: bool, fingerprint: "sha256:<first10hex>"|None, length: int}.
    The raw value is hashed and never revealed.
    """
    if not value:
        return {"configured": False, "fingerprint": None, "length": 0}
    digest = hashlib.sha256(value.encode("utf-8")).hexdigest()
    return {
        "configured": True,
        "fingerprint": f"sha256:{digest[:10]}",
        "length": len(value),
    }


@dataclass(frozen=True)
class ProviderConfig:
    """Resolved configuration for a single model provider."""

    name: str
    label: str
    role: str
    base_url: str
    model: str
    env_key: str
    get_key_url: str

    @property
    def api_key(self) -> str:
        return _env(self.env_key)

    @property
    def configured(self) -> bool:
        return bool(self.api_key) or self.name == "local"

    def masked(self) -> dict:
        return {
            "name": self.name,
            "label": self.label,
            "role": self.role,
            "model": self.model,
            "base_url": self.base_url,
            "get_key_url": self.get_key_url,
            "key": key_status(self.api_key),
            "configured": self.configured,
        }


# Catalog of providers and the role each plays. Keys are read lazily from env.
PROVIDERS: dict[str, ProviderConfig] = {
    "anthropic": ProviderConfig(
        name="anthropic",
        label="Anthropic Claude",
        role="report_writer",
        base_url=_env("ANTHROPIC_BASE_URL", "https://api.anthropic.com/v1"),
        model=_env("ANTHROPIC_MODEL", "claude-3-5-sonnet-latest"),
        env_key="ANTHROPIC_API_KEY",
        get_key_url="https://console.anthropic.com/settings/keys",
    ),
    "gemini": ProviderConfig(
        name="gemini",
        label="Google Gemini",
        role="long_context_analysis",
        base_url=_env("GEMINI_BASE_URL", "https://generativelanguage.googleapis.com/v1beta"),
        model=_env("GEMINI_MODEL", "gemini-2.5-flash-lite"),
        env_key="GEMINI_API_KEY",
        get_key_url="https://aistudio.google.com/app/apikey",
    ),
    "groq": ProviderConfig(
        name="groq",
        label="Groq",
        role="replay_judge",
        base_url=_env("GROQ_BASE_URL", "https://api.groq.com/openai/v1"),
        model=_env("GROQ_MODEL", "qwen/qwen3-32b"),
        env_key="GROQ_API_KEY",
        get_key_url="https://console.groq.com/keys",
    ),
    "openrouter": ProviderConfig(
        name="openrouter",
        label="OpenRouter",
        role="fallback_reasoning",
        base_url=_env("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1"),
        model=_env("OPENROUTER_MODEL", "deepseek/deepseek-chat-v3.1:free"),
        env_key="OPENROUTER_API_KEY",
        get_key_url="https://openrouter.ai/keys",
    ),
    "openai": ProviderConfig(
        name="openai",
        label="OpenAI",
        role="fallback_reasoning",
        base_url=_env("OPENAI_BASE_URL", "https://api.openai.com/v1"),
        model=_env("OPENAI_MODEL", "gpt-4o-mini"),
        env_key="OPENAI_API_KEY",
        get_key_url="https://platform.openai.com/api-keys",
    ),
    "local": ProviderConfig(
        name="local",
        label="Local Risk Classifier",
        role="local_risk_classifier",
        base_url=_env("LOCAL_MODEL_BASE_URL", "http://localhost:11434/v1"),
        model=_env("LOCAL_MODEL_NAME", "hydrasentry-risk-judge"),
        env_key="LOCAL_MODEL_API_KEY",
        get_key_url="https://ollama.com/download",
    ),
}

# Role -> ordered provider preference. First configured provider wins.
ROLE_PREFERENCE: dict[str, list[str]] = {
    "report_writer": ["anthropic", "gemini"],
    "long_context_analysis": ["gemini"],
    "replay_judge": ["groq"],
    "fallback_reasoning": ["openrouter", "openai"],
    "local_risk_classifier": ["local"],
    "demo_mode": [],
}


@dataclass(frozen=True)
class HydraConfig:
    api_key: str
    base_url: str
    version: str
    tenant_id: str
    sub_tenant_id: str

    def masked(self) -> dict:
        return {
            "base_url": self.base_url,
            "version": self.version,
            "tenant_id": self.tenant_id,
            "sub_tenant_id": self.sub_tenant_id,
            "key": key_status(self.api_key),
        }


@dataclass(frozen=True)
class Settings:
    app_mode: str
    hydra: HydraConfig
    mcp_shared_secret: str
    database_url: str
    frontend_url: str
    backend_url: str
    cors_origins: list[str] = field(default_factory=list)

    @property
    def is_real_mode(self) -> bool:
        return self.app_mode.lower() == "real" and bool(self.hydra.api_key)

    def provider(self, name: str) -> Optional[ProviderConfig]:
        return PROVIDERS.get(name)

    def db_path(self) -> Path:
        """Resolve the sqlite file path from DATABASE_URL (sqlite:///...)."""
        url = self.database_url
        prefix = "sqlite:///"
        if url.startswith(prefix):
            raw = url[len(prefix):]
            p = Path(raw)
            if not p.is_absolute():
                p = (BACKEND_DIR / raw).resolve()
            return p
        return (BACKEND_DIR / "hydrasentry.db").resolve()


def _cors_list(raw: str) -> list[str]:
    return [o.strip() for o in raw.split(",") if o.strip()]


def load_settings() -> Settings:
    """Build a Settings object from the current environment."""
    hydra = HydraConfig(
        api_key=_env("HYDRA_DB_API_KEY"),
        base_url=_env("HYDRA_DB_API_BASE_URL", "https://api.hydradb.com"),
        version=_env("HYDRA_DB_API_VERSION", "2"),
        tenant_id=_env("HYDRA_DB_TENANT_ID", DEFAULT_TENANT),
        sub_tenant_id=_env("HYDRA_DB_SUB_TENANT_ID", "hydrasentry-demo"),
    )
    return Settings(
        app_mode=_env("APP_MODE", "demo"),
        hydra=hydra,
        mcp_shared_secret=_env("MCP_SHARED_SECRET"),
        database_url=_env("DATABASE_URL", "sqlite:///./hydrasentry.db"),
        frontend_url=_env("FRONTEND_URL", "http://localhost:3000"),
        backend_url=_env("BACKEND_URL", "http://localhost:8000"),
        cors_origins=_cors_list(_env("CORS_ORIGINS", "http://localhost:3000")),
    )


# Singleton settings used across the app.
settings = load_settings()
