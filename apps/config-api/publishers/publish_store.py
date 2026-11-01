"""
Publish store — CRUD for publish_channels, publish_rules, publish_logs via Supabase REST API.
Follows the same pattern as task_store.py (httpx, no SDK).
"""
import os
import logging

import httpx

logger = logging.getLogger(__name__)

SUPABASE_URL = os.getenv("SUPABASE_URL", "").rstrip("/")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_KEY") or os.getenv("SUPABASE_SERVICE_KEY", "")


def _headers() -> dict:
    return {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }


# ── Channels ──────────────────────────────────────────────────────────────────

def get_channels() -> list[dict]:
    try:
        resp = httpx.get(
            f"{SUPABASE_URL}/rest/v1/publish_channels",
            headers=_headers(),
            params={"select": "*", "order": "created_at.desc"},
            timeout=10,
        )
        resp.raise_for_status()
        return resp.json()
    except Exception as e:
        logger.error("Failed to get channels: %s", e)
        return []


def create_channel(data: dict) -> dict:
    try:
        resp = httpx.post(
            f"{SUPABASE_URL}/rest/v1/publish_channels",
            headers=_headers(),
            json=data,
            timeout=10,
        )
        resp.raise_for_status()
        rows = resp.json()
        return rows[0] if rows else {}
    except Exception as e:
        logger.error("Failed to create channel: %s", e)
        return {}


def update_channel(channel_id: str, data: dict) -> dict:
    try:
        resp = httpx.patch(
            f"{SUPABASE_URL}/rest/v1/publish_channels",
            headers=_headers(),
            params={"id": f"eq.{channel_id}"},
            json=data,
            timeout=10,
        )
        resp.raise_for_status()
        rows = resp.json()
        return rows[0] if rows else {}
    except Exception as e:
        logger.error("Failed to update channel %s: %s", channel_id, e)
        return {}


def delete_channel(channel_id: str) -> bool:
    try:
        resp = httpx.delete(
            f"{SUPABASE_URL}/rest/v1/publish_channels",
            headers=_headers(),
            params={"id": f"eq.{channel_id}"},
            timeout=10,
        )
        resp.raise_for_status()
        return True
    except Exception as e:
        logger.error("Failed to delete channel %s: %s", channel_id, e)
        return False


# ── Rules ──────────────────────────────────────────────────────────────────────

def get_rules(employee_id: str = "") -> list[dict]:
    try:
        params: dict = {"select": "*", "order": "created_at.desc"}
        if employee_id:
            params["employee_id"] = f"eq.{employee_id}"
        resp = httpx.get(
            f"{SUPABASE_URL}/rest/v1/publish_rules",
            headers=_headers(),
            params=params,
            timeout=10,
        )
        resp.raise_for_status()
        return resp.json()
    except Exception as e:
        logger.error("Failed to get rules: %s", e)
        return []


def create_rule(data: dict) -> dict:
    try:
        resp = httpx.post(
            f"{SUPABASE_URL}/rest/v1/publish_rules",
            headers=_headers(),
            json=data,
            timeout=10,
        )
        resp.raise_for_status()
        rows = resp.json()
        return rows[0] if rows else {}
    except Exception as e:
        logger.error("Failed to create rule: %s", e)
        return {}


def delete_rule(rule_id: str) -> bool:
    try:
        resp = httpx.delete(
            f"{SUPABASE_URL}/rest/v1/publish_rules",
            headers=_headers(),
            params={"id": f"eq.{rule_id}"},
            timeout=10,
        )
        resp.raise_for_status()
        return True
    except Exception as e:
        logger.error("Failed to delete rule %s: %s", rule_id, e)
        return False


# ── Logs ───────────────────────────────────────────────────────────────────────

def get_logs(artefact_id: str = "", limit: int = 50) -> list[dict]:
    try:
        params: dict = {"select": "*", "order": "published_at.desc", "limit": str(limit)}
        if artefact_id:
            params["artefact_id"] = f"eq.{artefact_id}"
        resp = httpx.get(
            f"{SUPABASE_URL}/rest/v1/publish_logs",
            headers=_headers(),
            params=params,
            timeout=10,
        )
        resp.raise_for_status()
        return resp.json()
    except Exception as e:
        logger.error("Failed to get logs: %s", e)
        return []


def create_log(artefact_id: str, channel_id: str, status: str = "pending", error: str = "") -> dict:
    try:
        data: dict = {"artefact_id": artefact_id, "channel_id": channel_id, "status": status}
        if error:
            data["error"] = error
        resp = httpx.post(
            f"{SUPABASE_URL}/rest/v1/publish_logs",
            headers=_headers(),
            json=data,
            timeout=10,
        )
        resp.raise_for_status()
        rows = resp.json()
        return rows[0] if rows else {}
    except Exception as e:
        logger.error("Failed to create log: %s", e)
        return {}


def update_log(log_id: str, status: str, error: str = "") -> dict:
    try:
        data: dict = {"status": status}
        if error:
            data["error"] = error
        resp = httpx.patch(
            f"{SUPABASE_URL}/rest/v1/publish_logs",
            headers=_headers(),
            params={"id": f"eq.{log_id}"},
            json=data,
            timeout=10,
        )
        resp.raise_for_status()
        rows = resp.json()
        return rows[0] if rows else {}
    except Exception as e:
        logger.error("Failed to update log %s: %s", log_id, e)
        return {}


# ── Artefact & Template lookups ───────────────────────────────────────────────

def get_artefact(artefact_id: str) -> dict | None:
    try:
        resp = httpx.get(
            f"{SUPABASE_URL}/rest/v1/artefacts",
            headers=_headers(),
            params={"id": f"eq.{artefact_id}", "select": "*"},
            timeout=10,
        )
        resp.raise_for_status()
        rows = resp.json()
        return rows[0] if rows else None
    except Exception as e:
        logger.error("Failed to get artefact %s: %s", artefact_id, e)
        return None


def get_template(template_id: str) -> dict | None:
    try:
        resp = httpx.get(
            f"{SUPABASE_URL}/rest/v1/document_templates",
            headers=_headers(),
            params={"id": f"eq.{template_id}", "select": "*"},
            timeout=10,
        )
        resp.raise_for_status()
        rows = resp.json()
        return rows[0] if rows else None
    except Exception as e:
        logger.error("Failed to get template %s: %s", template_id, e)
        return None
