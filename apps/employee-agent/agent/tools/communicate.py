import os
from langchain_core.tools import tool


@tool
async def send_message(channel: str, recipient: str, subject: str, body: str) -> str:
    """
    Send a message via Slack or email.
    channel: 'slack' or 'email'
    recipient: Slack user ID or email address
    subject: Subject line (email) or thread context (Slack)
    body: Message content (Markdown supported)
    """
    if channel == "slack":
        from slack_sdk.web.async_client import AsyncWebClient
        client = AsyncWebClient(token=os.getenv("SLACK_BOT_TOKEN"))
        result = await client.chat_postMessage(channel=recipient, text=body)
        return f"Slack message sent to {recipient}: {result['ts']}"

    if channel == "email":
        # Gmail implementation placeholder — wire up OAuth in production
        return f"Email to {recipient} queued (Gmail integration pending)"

    return f"Unknown channel: {channel}"
