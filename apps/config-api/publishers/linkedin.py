"""LinkedIn publisher using OAuth 2.0 UGC Posts API."""
import httpx


def publish_to_linkedin(title: str, content: str, channel_config: dict) -> dict:
    """
    Publish a share to LinkedIn using the UGC Posts API.
    channel_config keys: access_token (required), person_urn (required, e.g. 'urn:li:person:XXXXX')
    Returns {"id": post_id}
    """
    access_token = channel_config["access_token"]
    person_urn = channel_config["person_urn"]

    # LinkedIn allows up to 3000 chars in commentary
    commentary = content[:3000]

    body = {
        "author": person_urn,
        "lifecycleState": "PUBLISHED",
        "specificContent": {
            "com.linkedin.ugc.ShareContent": {
                "shareCommentary": {
                    "text": commentary,
                },
                "shareMediaCategory": "NONE",
            }
        },
        "visibility": {
            "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
        },
    }

    resp = httpx.post(
        "https://api.linkedin.com/v2/ugcPosts",
        headers={
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
            "X-Restli-Protocol-Version": "2.0.0",
        },
        json=body,
        timeout=30,
    )
    resp.raise_for_status()
    data = resp.json()
    return {"id": data.get("id", "")}
