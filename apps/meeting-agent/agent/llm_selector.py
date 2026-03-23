"""
LLM factory for meeting agents. Only Gemini models are permitted.
PRIVACY_MODE=true routes all calls to local Ollama.
"""
import os
from langchain_core.language_models import BaseChatModel


def get_llm(override: str | None = None) -> BaseChatModel:
    if os.getenv("PRIVACY_MODE", "false").lower() == "true":
        from langchain_ollama import ChatOllama
        return ChatOllama(
            model=os.getenv("OLLAMA_MODEL", "llama3.1:8b"),
            base_url=os.getenv("OLLAMA_BASE_URL", "http://ollama:11434"),
        )

    model_id = override or "gemini-3-flash-preview"

    if not model_id.startswith("gemini"):
        raise ValueError(
            f"Only Gemini models are permitted in this project. Got: {model_id}"
        )

    from langchain_google_genai import ChatGoogleGenerativeAI
    return ChatGoogleGenerativeAI(
        model=model_id,
        google_api_key=os.getenv("GOOGLE_API_KEY"),
    )
