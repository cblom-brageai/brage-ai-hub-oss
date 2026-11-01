"""Slack channel publisher — post formatted text to a channel."""


def publish_to_slack(title: str, content: str, channel_config: dict) -> dict:
    """
    Post a message to a Slack channel.
    channel_config keys: bot_token (required), channel (required, name or ID)
    Returns {"ts": message_ts}
    """
    from slack_sdk.web import WebClient

    bot_token = channel_config["bot_token"]
    channel = channel_config["channel"]

    # Truncate content to Slack's limit
    body = content[:3000]
    text = f"*{title}*\n\n{body}"

    client = WebClient(token=bot_token)
    resp = client.chat_postMessage(channel=channel, text=text)
    return {"ts": resp["ts"]}
