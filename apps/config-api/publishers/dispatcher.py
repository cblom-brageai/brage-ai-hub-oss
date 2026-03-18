"""
Dispatch publishing to the appropriate publisher based on channel type.
"""
import logging

logger = logging.getLogger(__name__)


def dispatch_publish(artefact_id: str, channel_id: str) -> dict:
    """
    Fetch artefact and channel config, dispatch to the right publisher,
    create/update a publish_log entry, return log dict.
    """
    from publishers.publish_store import get_artefact, get_channels, create_log, update_log

    artefact = get_artefact(artefact_id)
    if not artefact:
        raise ValueError(f"Artefact not found: {artefact_id}")

    channels = get_channels()
    channel = next((c for c in channels if c["id"] == channel_id), None)
    if not channel:
        raise ValueError(f"Channel not found: {channel_id}")

    log = create_log(artefact_id, channel_id, status="pending")
    log_id = log.get("id", "")

    title = artefact.get("title", artefact.get("filename", "Untitled"))
    content = artefact.get("content", "")
    channel_type = channel.get("type", "")
    config = channel.get("config", {})

    try:
        if channel_type == "hubspot":
            from publishers.hubspot import publish_to_hubspot
            result = publish_to_hubspot(title, content, config)
        elif channel_type == "linkedin":
            from publishers.linkedin import publish_to_linkedin
            result = publish_to_linkedin(title, content, config)
        elif channel_type == "slack":
            from publishers.slack_channel import publish_to_slack
            result = publish_to_slack(title, content, config)
        elif channel_type == "word_slack":
            from publishers.word_slack import publish_word_to_slack
            result = publish_word_to_slack(title, content, config)
        else:
            raise ValueError(f"Unknown channel type: {channel_type}")

        updated = update_log(log_id, status="success")
        logger.info("Published artefact %s to channel %s: %s", artefact_id, channel_id, result)
        return updated if updated else log

    except Exception as e:
        error_msg = str(e)
        logger.error("Publish failed for artefact %s channel %s: %s", artefact_id, channel_id, error_msg)
        updated = update_log(log_id, status="failed", error=error_msg)
        return updated if updated else log
