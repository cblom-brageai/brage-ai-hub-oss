"""HubSpot Blog publisher using CMS API v3."""
import httpx


def publish_to_hubspot(title: str, content: str, channel_config: dict) -> dict:
    """
    Publish a post to HubSpot CMS Blog.
    channel_config keys: access_token (required), portal_id (optional), blog_id (optional)
    Returns {"url": post_url, "id": post_id}
    """
    access_token = channel_config["access_token"].strip()
    blog_id = channel_config.get("blog_id")

    # Basic markdown → HTML conversion: replace newlines with <br>
    html_content = content.replace("\n", "<br>\n")

    body: dict = {
        "name": title,
        "htmlTitle": title,
        "postBody": html_content,
        "state": "DRAFT",
    }
    if blog_id:
        body["contentGroupId"] = blog_id

    resp = httpx.post(
        "https://api.hubapi.com/cms/v3/blogs/posts",
        headers={
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
        },
        json=body,
        timeout=30,
    )
    if not resp.is_success:
        raise ValueError(f"HubSpot {resp.status_code}: {resp.text}")
    resp.raise_for_status()
    data = resp.json()
    return {
        "url": data.get("url", ""),
        "id": data.get("id", ""),
    }
