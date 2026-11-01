import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("CONFIG_ROOT", str(tmp_path))
    monkeypatch.setenv("GIT_ENABLED", "false")
    from main import app
    return TestClient(app)


def test_health(client):
    res = client.get("/health")
    assert res.status_code == 200


def test_get_file_not_found_returns_empty(client):
    res = client.get("/config/test-employee/file/Strategy.md")
    assert res.status_code == 200
    assert res.json()["content"] == ""


def test_save_and_read_file(client, tmp_path):
    res = client.put(
        "/config/test-employee/file/Strategy.md",
        json={"content": "# Test Strategy", "reload": False},
    )
    assert res.json()["saved"] is True

    res2 = client.get("/config/test-employee/file/Strategy.md")
    assert res2.json()["content"] == "# Test Strategy"
