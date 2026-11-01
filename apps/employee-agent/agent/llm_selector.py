"""
Multi-provider LLM factory. Every model call in the service goes through get_llm().

Model ids are resolved in this order:
  1. an explicit override (for example from ``[llm_overrides]`` in ``agent.config.md``)
  2. the ``DEFAULT_LLM`` (writing) / ``REASONING_LLM`` (planning) environment variables
  3. the built-in defaults below

Supported id prefixes: ``gemini-*`` (Google), ``claude-*`` (Anthropic), ``gpt-*`` / ``o*``
(OpenAI) and ``ollama/<model>`` (a local Ollama server).

``PRIVACY_MODE=true`` routes every call to the local Ollama server regardless of the
requested id, so no prompt leaves the machine. Provider packages are imported lazily so
only the one you use needs valid credentials.
"""
import os

from langchain_core.language_models import BaseChatModel

DEFAULT_WRITE_MODEL = "gemini-3-flash-preview"
DEFAULT_REASON_MODEL = "gemini-3.1-pro-preview"
DEFAULT_OLLAMA_MODEL = "llama3.1:8b"

_OPENAI_PREFIXES = ("gpt-", "o1", "o3", "o4")


def privacy_mode_enabled() -> bool:
    return os.getenv("PRIVACY_MODE", "false").strip().lower() in ("1", "true", "yes", "on")


def resolve_model(role: str = "write", override: str | None = None) -> str:
    """Return the model id to use for ``role`` ("write" or "reason")."""
    if override:
        return override
    if role == "reason":
        return os.getenv("REASONING_LLM") or os.getenv("DEFAULT_LLM") or DEFAULT_REASON_MODEL
    return os.getenv("DEFAULT_LLM") or DEFAULT_WRITE_MODEL


def _ollama(model: str, **kwargs) -> BaseChatModel:
    from langchain_ollama import ChatOllama

    return ChatOllama(
        model=model,
        base_url=os.getenv("OLLAMA_BASE_URL", "http://ollama:11434"),
        **kwargs,
    )


def get_llm(override: str | None = None, role: str = "write", **kwargs) -> BaseChatModel:
    """
    Build a chat model.

    Args:
        override: explicit model id; wins over environment and defaults.
        role: "write" (fast, default) or "reason" (planning / complex tasks).
        **kwargs: passed to the provider class (temperature, max_tokens, ...).
    """
    if privacy_mode_enabled():
        return _ollama(os.getenv("OLLAMA_MODEL", DEFAULT_OLLAMA_MODEL), **kwargs)

    model_id = resolve_model(role, override)

    if model_id.startswith("ollama/"):
        return _ollama(model_id.split("/", 1)[1], **kwargs)

    if model_id.startswith("gemini"):
        from langchain_google_genai import ChatGoogleGenerativeAI

        return ChatGoogleGenerativeAI(
            model=model_id, google_api_key=os.getenv("GOOGLE_API_KEY"), **kwargs
        )

    if model_id.startswith("claude"):
        from langchain_anthropic import ChatAnthropic

        kwargs.setdefault("max_tokens", 8192)
        return ChatAnthropic(model=model_id, api_key=os.getenv("ANTHROPIC_API_KEY"), **kwargs)

    if model_id.startswith(_OPENAI_PREFIXES):
        from langchain_openai import ChatOpenAI

        return ChatOpenAI(model=model_id, api_key=os.getenv("OPENAI_API_KEY"), **kwargs)

    raise ValueError(
        f"Unknown model id '{model_id}'. Use gemini-*, claude-*, gpt-*/o* or ollama/<model>."
    )
