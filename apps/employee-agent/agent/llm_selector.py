"""
Multi-LLM factory. All LLM calls go through get_llm().
PRIVACY_MODE=true routes all calls to local Ollama.
"""
import os
from langchain_core.language_models import BaseChatModel


def get_llm(override: str | None = None) -> BaseChatModel:
    privacy_mode = os.getenv("PRIVACY_MODE", "false").lower() == "true"

    if privacy_mode:
        from langchain_ollama import ChatOllama
        model = os.getenv("OLLAMA_MODEL", "llama3.1:8b")
        base_url = os.getenv("OLLAMA_BASE_URL", "http://ollama:11434")
        return ChatOllama(model=model, base_url=base_url)

    model_id = override or os.getenv("DEFAULT_LLM", "claude-sonnet-4-6")

    if model_id.startswith("claude"):
        from langchain_anthropic import ChatAnthropic
        return ChatAnthropic(
            model=model_id,
            api_key=os.getenv("ANTHROPIC_API_KEY"),
            max_tokens=8192,
        )

    if model_id.startswith("gpt"):
        from langchain_openai import ChatOpenAI
        return ChatOpenAI(model=model_id, api_key=os.getenv("OPENAI_API_KEY"))

    if model_id.startswith("gemini"):
        from langchain_google_genai import ChatGoogleGenerativeAI
        return ChatGoogleGenerativeAI(model=model_id, google_api_key=os.getenv("GOOGLE_API_KEY"))

    raise ValueError(f"Unknown model: {model_id}")
