import os
from langchain_core.tools import tool


@tool
async def send_message(channel: str, recipient: str, subject: str, body: str, thread_ts: str = "") -> str:
    """
    Send a message via Slack or email.
    channel: 'slack' or 'email'
    recipient: Slack channel ID or name (with or without #). Defaults to SLACK_DEFAULT_CHANNEL env var if empty.
    subject: Subject line (email) or thread context (Slack)
    body: Message content (Markdown supported)
    thread_ts: Slack thread timestamp to reply in. Extract from the [slack_thread ...] context at the top of your input.
    """
    if channel == "slack":
        from slack_sdk.web.async_client import AsyncWebClient
        from slack_sdk.errors import SlackApiError
        # Use provided recipient or fall back to the configured default channel
        raw = recipient.strip() if recipient.strip() else os.getenv("SLACK_DEFAULT_CHANNEL", "")
        slack_recipient = raw.lstrip("#")
        client = AsyncWebClient(token=os.getenv("SLACK_BOT_TOKEN"))
        try:
            kwargs = {"channel": slack_recipient, "text": body}
            if thread_ts:
                kwargs["thread_ts"] = thread_ts
            result = await client.chat_postMessage(**kwargs)
            return f"Slack message sent to {slack_recipient} (thread {thread_ts or 'new'}): {result['ts']}"
        except SlackApiError as e:
            return f"Slack error sending to {slack_recipient}: {e.response['error']}"

    if channel == "email":
        # Gmail implementation placeholder — wire up OAuth in production
        return f"Email to {recipient} queued (Gmail integration pending)"

    return f"Unknown channel: {channel}"
