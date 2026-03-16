"""Regression for Feb-2026 student auth lifecycle rules (approve/assign/transfer/password change)."""

import os
import re
import uuid

import pytest
import requests
from dotenv import load_dotenv


load_dotenv("/app/frontend/.env")

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL")
if not BASE_URL:
    raise RuntimeError("REACT_APP_BACKEND_URL must be set")
BASE_URL = BASE_URL.rstrip("/")


def sanitize_group_for_login(group_name: str) -> str:
    safe = re.sub(r"[^a-zA-Z0-9\-]", "", group_name.strip().lower())
    return safe or "group"


@pytest.fixture(scope="module")
def api_client():
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture(scope="module")
def admin_headers(api_client):
    # Auth module: admin login for protected APIs
    response = api_client.post(
        f"{BASE_URL}/api/auth/login",
        json={"username": "admin", "password": "admin123", "branch_id": ""},
        timeout=25,
    )
    if response.status_code != 200:
        pytest.skip("Cannot login as admin/admin123 in preview env")
    token = response.json().get("token")
    assert isinstance(token, str) and token
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="module")
def state(api_client, admin_headers):
    # Branch module: isolated branch + cleanup for this regression run
    suffix = uuid.uuid4().hex[:8]
    branch_res = api_client.post(
        f"{BASE_URL}/api/admin/branches",
        headers=admin_headers,
        json={"name": f"TEST-SAUTH-{suffix}", "location": f"SAUTH-{suffix}"},
        timeout=25,
    )
    assert branch_res.status_code == 200
    branch = branch_res.json()

    data = {
        "branch_id": branch["id"],
        "group_a": None,
        "group_b": None,
        "group_a_name": None,
        "group_b_name": None,
        "student1_id": None,
        "student2_id": None,
        "student1_username": None,
        "student1_password": None,
        "student1_password_custom": None,
    }

    yield data

    api_client.delete(
        f"{BASE_URL}/api/admin/branches/{data['branch_id']}",
        headers=admin_headers,
        timeout=25,
    )


def create_lead_and_approve(api_client, admin_headers, branch_id: str, full_name: str, phone: str):
    create = api_client.post(
        f"{BASE_URL}/api/public/leads",
        json={"branch_id": branch_id, "full_name": full_name, "phone": phone},
        timeout=25,
    )
    assert create.status_code == 200
    assert "принята" in create.json().get("message", "").lower()

    leads = api_client.get(
        f"{BASE_URL}/api/admin/leads",
        params={"branch_id": branch_id, "search_query": full_name},
        headers=admin_headers,
        timeout=25,
    )
    assert leads.status_code == 200
    pending = next(item for item in leads.json() if item["full_name"] == full_name)

    approve = api_client.post(
        f"{BASE_URL}/api/admin/leads/{pending['id']}/approve",
        params={"branch_id": branch_id},
        headers=admin_headers,
        json={},
        timeout=25,
    )
    assert approve.status_code == 200
    return approve.json()


def test_01_approve_lead_returns_no_credentials_before_group_binding(api_client, admin_headers, state):
    # Leads/Auth module: approve must not issue credentials pre-assignment
    suffix = uuid.uuid4().hex[:6]
    approved = create_lead_and_approve(
        api_client,
        admin_headers,
        state["branch_id"],
        full_name=f"TEST SA Student1 {suffix}",
        phone="+77001000001",
    )
    state["student1_id"] = approved["student_id"]

    assert "student_id" in approved
    assert isinstance(approved["student_id"], str) and approved["student_id"]
    assert "username" not in approved
    assert "password" not in approved
    assert "будут сгенерированы" in approved.get("message", "").lower()

    students = api_client.get(
        f"{BASE_URL}/api/admin/students",
        params={"branch_id": state["branch_id"]},
        headers=admin_headers,
        timeout=25,
    )
    assert students.status_code == 200
    student = next(item for item in students.json() if item["id"] == state["student1_id"])
    assert student["group_ids"] == []
    assert student["groups"] == []


def test_02_assign_generates_group_username_password_and_unique_suffix(api_client, admin_headers, state):
    # Groups/Auth module: assign -> generate group-based credentials with 3-digit unique suffix
    suffix = uuid.uuid4().hex[:6]
    group_a = api_client.post(
        f"{BASE_URL}/api/admin/groups",
        params={"branch_id": state["branch_id"]},
        headers=admin_headers,
        json={"prefix": f"qa{suffix}", "index": 11, "year": 2026, "is_individual": False},
        timeout=25,
    )
    assert group_a.status_code == 200
    state["group_a"] = group_a.json()["id"]
    state["group_a_name"] = group_a.json()["name"]

    group_b = api_client.post(
        f"{BASE_URL}/api/admin/groups",
        params={"branch_id": state["branch_id"]},
        headers=admin_headers,
        json={"prefix": f"qb{suffix}", "index": 12, "year": 2026, "is_individual": True},
        timeout=25,
    )
    assert group_b.status_code == 200
    state["group_b"] = group_b.json()["id"]
    state["group_b_name"] = group_b.json()["name"]

    approved2 = create_lead_and_approve(
        api_client,
        admin_headers,
        state["branch_id"],
        full_name=f"TEST SA Student2 {suffix}",
        phone="+77001000002",
    )
    state["student2_id"] = approved2["student_id"]

    assign1 = api_client.post(
        f"{BASE_URL}/api/admin/groups/{state['group_a']}/students/{state['student1_id']}",
        params={"branch_id": state["branch_id"]},
        headers=admin_headers,
        json={},
        timeout=25,
    )
    assert assign1.status_code == 200
    assign1_data = assign1.json()
    state["student1_username"] = assign1_data["username"]
    state["student1_password"] = assign1_data["password"]

    expected_prefix = sanitize_group_for_login(state["group_a_name"])
    assert re.fullmatch(rf"{re.escape(expected_prefix)}-\d{{3}}", assign1_data["username"])
    assert assign1_data["password"] == assign1_data["username"]

    assign2 = api_client.post(
        f"{BASE_URL}/api/admin/groups/{state['group_a']}/students/{state['student2_id']}",
        params={"branch_id": state["branch_id"]},
        headers=admin_headers,
        json={},
        timeout=25,
    )
    assert assign2.status_code == 200
    assign2_data = assign2.json()

    assert re.fullmatch(rf"{re.escape(expected_prefix)}-\d{{3}}", assign2_data["username"])
    assert assign2_data["username"] != assign1_data["username"]
    assert assign2_data["password"] == assign2_data["username"]


def test_03_transfer_updates_username_to_new_group_and_rotates_password_when_not_customized(api_client, admin_headers, state):
    # Transfer/Auth module: transfer before manual password change should rotate login+password
    transfer = api_client.post(
        f"{BASE_URL}/api/admin/students/{state['student1_id']}/transfer",
        params={"branch_id": state["branch_id"]},
        headers=admin_headers,
        json={"from_group_id": state["group_a"], "to_group_id": state["group_b"]},
        timeout=25,
    )
    assert transfer.status_code == 200
    data = transfer.json()

    expected_prefix = sanitize_group_for_login(state["group_b_name"])
    assert re.fullmatch(rf"{re.escape(expected_prefix)}-\d{{3}}", data["username"])
    assert data["password"] == data["username"]
    assert data["password_changed"] is True

    state["student1_username"] = data["username"]
    state["student1_password"] = data["password"]


def test_04_student_schedule_password_change_and_transfer_keeps_custom_password(api_client, admin_headers, state):
    # Student/Auth module: change-password works; post-transfer should keep customized password
    student_login = api_client.post(
        f"{BASE_URL}/api/auth/login",
        json={
            "username": state["student1_username"],
            "password": state["student1_password"],
            "branch_id": state["branch_id"],
        },
        timeout=25,
    )
    assert student_login.status_code == 200
    student_token = student_login.json()["token"]

    schedule = api_client.get(
        f"{BASE_URL}/api/student/schedule",
        headers={"Authorization": f"Bearer {student_token}"},
        timeout=25,
    )
    assert schedule.status_code == 200
    schedule_data = schedule.json()
    assert schedule_data["student"]["id"] == state["student1_id"]
    assert isinstance(schedule_data["schedule"], dict)

    custom_password = f"Cust{uuid.uuid4().hex[:8]}!"
    change = api_client.put(
        f"{BASE_URL}/api/student/change-password",
        headers={"Authorization": f"Bearer {student_token}"},
        json={
            "current_password": state["student1_password"],
            "new_password": custom_password,
            "confirm_password": custom_password,
        },
        timeout=25,
    )
    assert change.status_code == 200
    assert "успешно" in change.json().get("message", "").lower()
    state["student1_password_custom"] = custom_password

    transfer_back = api_client.post(
        f"{BASE_URL}/api/admin/students/{state['student1_id']}/transfer",
        params={"branch_id": state["branch_id"]},
        headers=admin_headers,
        json={"from_group_id": state["group_b"], "to_group_id": state["group_a"]},
        timeout=25,
    )
    assert transfer_back.status_code == 200
    back_data = transfer_back.json()

    expected_prefix = sanitize_group_for_login(state["group_a_name"])
    assert re.fullmatch(rf"{re.escape(expected_prefix)}-\d{{3}}", back_data["username"])
    assert back_data["password"] is None
    assert back_data["password_changed"] is False

    old_generated_login = api_client.post(
        f"{BASE_URL}/api/auth/login",
        json={
            "username": back_data["username"],
            "password": state["student1_password"],
            "branch_id": state["branch_id"],
        },
        timeout=25,
    )
    assert old_generated_login.status_code == 401

    custom_login = api_client.post(
        f"{BASE_URL}/api/auth/login",
        json={
            "username": back_data["username"],
            "password": state["student1_password_custom"],
            "branch_id": state["branch_id"],
        },
        timeout=25,
    )
    assert custom_login.status_code == 200
