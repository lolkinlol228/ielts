"""Regression tests for brute-force lockout and admin security alerts flow."""

import os
import uuid

import pytest
import requests
from dotenv import load_dotenv


load_dotenv("/app/frontend/.env")

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL")
if not BASE_URL:
    raise RuntimeError("REACT_APP_BACKEND_URL must be set")
BASE_URL = BASE_URL.rstrip("/")


@pytest.fixture(scope="module")
def api_client():
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture(scope="module")
def admin_auth(api_client):
    # Auth module: baseline admin login used for protected endpoints
    response = api_client.post(
        f"{BASE_URL}/api/auth/login",
        json={"username": "admin", "password": "admin123", "branch_id": ""},
        timeout=25,
    )
    if response.status_code != 200:
        pytest.skip("admin/admin123 login failed; skipping protected security tests")
    token = response.json().get("token")
    assert isinstance(token, str) and token
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="module")
def security_state(api_client, admin_auth):
    # Branch + student module: isolated user for brute-force test so superadmin remains unaffected
    suffix = uuid.uuid4().hex[:8]
    create_branch = api_client.post(
        f"{BASE_URL}/api/admin/branches",
        headers=admin_auth,
        json={"name": f"TEST-SEC-{suffix}", "location": f"SEC-{suffix}"},
        timeout=25,
    )
    assert create_branch.status_code == 200
    branch_id = create_branch.json()["id"]

    create_lead = api_client.post(
        f"{BASE_URL}/api/public/leads",
        json={
            "branch_id": branch_id,
            "full_name": f"TEST Security Student {suffix}",
            "phone": "+77001234567",
        },
        timeout=25,
    )
    assert create_lead.status_code == 200

    leads = api_client.get(
        f"{BASE_URL}/api/admin/leads",
        params={"branch_id": branch_id, "search_query": suffix},
        headers=admin_auth,
        timeout=25,
    )
    assert leads.status_code == 200
    created_lead = next(item for item in leads.json() if suffix in item["full_name"])

    username = f"test_bruteforce_{suffix}"
    real_password = "TestPass123!"
    approve = api_client.post(
        f"{BASE_URL}/api/admin/leads/{created_lead['id']}/approve",
        params={"branch_id": branch_id},
        headers=admin_auth,
        json={"username": username, "password": real_password},
        timeout=25,
    )
    assert approve.status_code == 200

    data = {
        "branch_id": branch_id,
        "username": username,
        "password": real_password,
        "alert_id": None,
    }

    yield data

    api_client.delete(
        f"{BASE_URL}/api/admin/branches/{branch_id}",
        headers=admin_auth,
        timeout=25,
    )


def test_01_failed_login_attempts_trigger_429_lock(api_client, security_state):
    # Auth lock module: after 5 wrong passwords, account must be temporarily locked (429)
    branch_id = security_state["branch_id"]
    username = security_state["username"]

    for attempt in range(1, 6):
        response = api_client.post(
            f"{BASE_URL}/api/auth/login",
            json={"username": username, "password": "WrongPass!", "branch_id": branch_id},
            timeout=25,
        )
        if attempt < 5:
            assert response.status_code == 401
            assert "detail" in response.json()
        else:
            assert response.status_code == 429
            assert "заблок" in str(response.json().get("detail", "")).lower()

    locked_with_correct_password = api_client.post(
        f"{BASE_URL}/api/auth/login",
        json={"username": username, "password": security_state["password"], "branch_id": branch_id},
        timeout=25,
    )
    assert locked_with_correct_password.status_code == 429


def test_02_security_alert_created_and_listed_for_admin(api_client, admin_auth, security_state):
    # Security alerts module: lock event should produce a new brute-force alert for selected branch
    response = api_client.get(
        f"{BASE_URL}/api/admin/security-alerts",
        params={"branch_id": security_state["branch_id"], "status_filter": "new"},
        headers=admin_auth,
        timeout=25,
    )
    assert response.status_code == 200

    alerts = response.json()
    match = next((item for item in alerts if item.get("username") == security_state["username"]), None)
    assert match is not None
    assert match.get("type") == "bruteforce"
    assert match.get("status") == "new"
    assert int(match.get("count", 0)) >= 1
    security_state["alert_id"] = match["id"]


def test_03_admin_can_ack_security_alert(api_client, admin_auth, security_state):
    # Security alerts module: admin acknowledges alert and it moves to ack status
    assert security_state.get("alert_id")
    ack = api_client.post(
        f"{BASE_URL}/api/admin/security-alerts/{security_state['alert_id']}/ack",
        params={"branch_id": security_state["branch_id"]},
        headers=admin_auth,
        json={},
        timeout=25,
    )
    assert ack.status_code == 200
    assert "подтвержден" in str(ack.json().get("message", "")).lower()

    ack_list = api_client.get(
        f"{BASE_URL}/api/admin/security-alerts",
        params={"branch_id": security_state["branch_id"], "status_filter": "ack"},
        headers=admin_auth,
        timeout=25,
    )
    assert ack_list.status_code == 200
    acknowledged = next((item for item in ack_list.json() if item.get("id") == security_state["alert_id"]), None)
    assert acknowledged is not None
    assert acknowledged.get("status") == "ack"


def test_04_admin_login_still_works(api_client):
    # Auth module: successful superadmin login remains functional after lockout scenarios
    response = api_client.post(
        f"{BASE_URL}/api/auth/login",
        json={"username": "admin", "password": "admin123", "branch_id": ""},
        timeout=25,
    )
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data.get("token"), str) and data["token"]
    assert data.get("user", {}).get("username") == "admin"
