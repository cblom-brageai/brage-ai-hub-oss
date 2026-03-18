"""Word document generator + Slack file upload."""
import io
import re


def _parse_markdown_to_docx(title: str, content: str):
    """Convert markdown text to a python-docx Document."""
    from docx import Document
    from docx.shared import Pt

    doc = Document()
    doc.add_heading(title, level=0)

    for line in content.splitlines():
        if line.startswith("### "):
            doc.add_heading(line[4:].strip(), level=3)
        elif line.startswith("## "):
            doc.add_heading(line[3:].strip(), level=2)
        elif line.startswith("# "):
            doc.add_heading(line[2:].strip(), level=1)
        elif line.strip() == "":
            # Empty line — add spacing paragraph
            doc.add_paragraph("")
        else:
            # Handle inline **bold** markers
            para = doc.add_paragraph()
            # Split on **...**
            parts = re.split(r"(\*\*.*?\*\*)", line)
            for part in parts:
                if part.startswith("**") and part.endswith("**"):
                    run = para.add_run(part[2:-2])
                    run.bold = True
                else:
                    para.add_run(part)

    return doc


def publish_word_to_slack(title: str, content: str, channel_config: dict) -> dict:
    """
    Generate a .docx from markdown content and upload it to a Slack channel.
    channel_config keys: bot_token (required), channel (required)
    Returns {"file_id": ..., "permalink": ...}
    """
    from slack_sdk.web import WebClient

    bot_token = channel_config["bot_token"]
    channel = channel_config["channel"]

    doc = _parse_markdown_to_docx(title, content)

    buffer = io.BytesIO()
    doc.save(buffer)
    buffer.seek(0)

    client = WebClient(token=bot_token)
    resp = client.files_upload(
        channels=channel,
        file=buffer,
        filename=f"{title}.docx",
        filetype="docx",
        title=title,
    )

    file_data = resp.get("file", {})
    return {
        "file_id": file_data.get("id", ""),
        "permalink": file_data.get("permalink", ""),
    }
