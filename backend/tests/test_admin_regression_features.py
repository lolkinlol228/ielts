"""Regression tests for admin leads/branches/schedule new UX+CRUD features."""

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
def auth_headers(api_client):
    # Auth module: superadmin login for protected admin APIs
    response = api_client.post(
        f"{BASE_URL}/api/auth/login",
        json={"username": "admin", "password": "admin123", "branch_id": ""},
        timeout=20,
    )
    assert response.status_code == 200
    token = response.json().get("token")
    assert isinstance(token, str) and token
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="module")
def state(api_client, auth_headers):
    # Branch module: isolated branch/resources for regression run
    suffix = uuid.uuid4().hex[:8]
    branch_payload = {"name": f"TEST REG Branch {suffix}", "location": f"REGCity{suffix}"}
    create = api_client.post(
        f"{BASE_URL}/api/admin/branches",
        json=branch_payload,
        headers=auth_headers,
        timeout=20,
    )
    assert create.status_code == 200
    branch = create.json()

    data = {
        "branch_id": branch["id"],
        "teacher_id": None,
        "classroom_id": None,
        "group_id": None,
        "lead_id": None,
        "schedule_id": None,
    }

    yield data

    api_client.delete(
        f"{BASE_URL}/api/admin/branches/{data['branch_id']}",
        headers=auth_headers,
        timeout=20,
    )


def test_01_branch_update_and_list(api_client, auth_headers, state):
    # Branch module: update/list branch management
    branch_id = state["branch_id"]
    update = api_client.put(
        f"{BASE_URL}/api/admin/branches/{branch_id}",
        json={"name": "TEST REG Branch Updated", "location": "REG Updated City"},
        headers=auth_headers,
        timeout=20,
    )
    assert update.status_code == 200
    assert update.json()["name"] == "TEST REG Branch Updated"
    assert update.json()["location"] == "REG Updated City"

    branches = api_client.get(f"{BASE_URL}/api/admin/branches", headers=auth_headers, timeout=20)
    assert branches.status_code == 200
    listed = next((item for item in branches.json() if item["id"] == branch_id), None)
    assert listed is not None
    assert listed["name"] == "TEST REG Branch Updated"


def test_02_lead_reject_status_and_search(api_client, auth_headers, state):
    # Leads module: create lead, reject lead, verify status change + server search by name
    branch_id = state["branch_id"]
    unique_name = f"TEST Reject Lead {uuid.uuid4().hex[:6]}"

    create_lead = api_client.post(
        f"{BASE_URL}/api/public/leads",
        json={"branch_id": branch_id, "full_name": unique_name, "phone": "+77005556677"},
        timeout=20,
    )
    assert create_lead.status_code == 200

    leads = api_client.get(
        f"{BASE_URL}/api/admin/leads",
        params={"branch_id": branch_id, "search_query": unique_name},
        headers=auth_headers,
        timeout=20,
    )
    assert leads.status_code == 200
    matches = [item for item in leads.json() if item["full_name"] == unique_name]
    assert len(matches) == 1
    state["lead_id"] = matches[0]["id"]
    assert matches[0]["status"] == "pending"

    reject = api_client.post(
        f"{BASE_URL}/api/admin/leads/{state['lead_id']}/reject",
        params={"branch_id": branch_id},
        headers=auth_headers,
        timeout=20,
    )
    assert reject.status_code == 200

    leads_after = api_client.get(
        f"{BASE_URL}/api/admin/leads",
        params={"branch_id": branch_id, "search_query": unique_name},
        headers=auth_headers,
        timeout=20,
    )
    assert leads_after.status_code == 200
    post_reject = next(item for item in leads_after.json() if item["id"] == state["lead_id"])
    assert post_reject["status"] == "rejected"


def test_03_schedule_settings_and_auto_slots(api_client, auth_headers, state):
    # Schedule settings module: save/get start-end-lunch-duration-break and auto-slots
    branch_id = state["branch_id"]
    settings_payload = {
        "start_time": "08:30",
        "end_time": "15:30",
        "lunch_start": "12:00",
        "lunch_end": "13:00",
        "lesson_duration": 90,
        "break_duration": 10,
    }

    put_settings = api_client.put(
        f"{BASE_URL}/api/admin/schedule-settings",
        params={"branch_id": branch_id},
        json=settings_payload,
        headers=auth_headers,
        timeout=20,
    )
    assert put_settings.status_code == 200
    assert put_settings.json()["start_time"] == "08:30"
    assert put_settings.json()["lesson_duration"] == 90

    get_settings = api_client.get(
        f"{BASE_URL}/api/admin/schedule-settings",
        params={"branch_id": branch_id},
        headers=auth_headers,
        timeout=20,
    )
    assert get_settings.status_code == 200
    got = get_settings.json()
    assert got["end_time"] == "15:30"
    assert got["lunch_start"] == "12:00"
    assert got["break_duration"] == 10

    auto_slots = api_client.post(
        f"{BASE_URL}/api/admin/schedule/auto-slots",
        params={"branch_id": branch_id},
        json=settings_payload,
        headers=auth_headers,
        timeout=20,
    )
    assert auto_slots.status_code == 200
    slots = auto_slots.json().get("slots", [])
    assert isinstance(slots, list)
    assert len(slots) >= 2
    assert slots[0]["label"].startswith("Урок")


def test_04_schedule_entry_create_update_conflict_delete(api_client, auth_headers, state):
    # Schedule CRUD/conflicts module: create manual lesson, edit, conflict check, delete
    branch_id = state["branch_id"]
    suffix = uuid.uuid4().hex[:6]

    teacher = api_client.post(
        f"{BASE_URL}/api/admin/teachers",
        params={"branch_id": branch_id},
        json={"name": f"TEST Teacher {suffix}", "phone": "+77001112233"},
        headers=auth_headers,
        timeout=20,
    )
    assert teacher.status_code == 200
    state["teacher_id"] = teacher.json()["id"]

    classroom = api_client.post(
        f"{BASE_URL}/api/admin/classrooms",
        params={"branch_id": branch_id},
        json={"name": f"TEST Room {suffix}", "capacity": 12},
        headers=auth_headers,
        timeout=20,
    )
    assert classroom.status_code == 200
    state["classroom_id"] = classroom.json()["id"]

    group = api_client.post(
        f"{BASE_URL}/api/admin/groups",
        params={"branch_id": branch_id},
        json={"prefix": "test", "index": 91, "year": 2026, "is_individual": False},
        headers=auth_headers,
        timeout=20,
    )
    assert group.status_code == 200
    state["group_id"] = group.json()["id"]

    create_schedule = api_client.post(
        f"{BASE_URL}/api/admin/schedules",
        params={"branch_id": branch_id},
        json={
            "day": "ПН",
            "start": "08:30",
            "end": "10:00",
            "group_id": state["group_id"],
            "teacher_id": state["teacher_id"],
            "classroom_id": state["classroom_id"],
        },
        headers=auth_headers,
        timeout=20,
    )
    assert create_schedule.status_code == 200
    state["schedule_id"] = create_schedule.json()["id"]

    update_schedule = api_client.put(
        f"{BASE_URL}/api/admin/schedules/{state['schedule_id']}",
        params={"branch_id": branch_id},
        json={
            "day": "ПН",
            "start": "10:10",
            "end": "11:40",
            "group_id": state["group_id"],
            "teacher_id": state["teacher_id"],
            "classroom_id": state["classroom_id"],
        },
        headers=auth_headers,
        timeout=20,
    )
    assert update_schedule.status_code == 200
    assert update_schedule.json()["start"] == "10:10"

    conflict = api_client.get(
        f"{BASE_URL}/api/admin/schedules/conflicts",
        params={
            "branch_id": branch_id,
            "day": "ПН",
            "start": "10:30",
            "end": "11:30",
            "teacher_id": state["teacher_id"],
            "classroom_id": state["classroom_id"],
        },
        headers=auth_headers,
        timeout=20,
    )
    assert conflict.status_code == 200
    conflict_data = conflict.json()
    assert conflict_data["has_conflict"] is True
    assert conflict_data["teacher_busy"] is True
    assert conflict_data["classroom_busy"] is True

    delete_schedule = api_client.delete(
        f"{BASE_URL}/api/admin/schedules/{state['schedule_id']}",
        params={"branch_id": branch_id},
        headers=auth_headers,
        timeout=20,
    )
    assert delete_schedule.status_code == 200

    schedules = api_client.get(
        f"{BASE_URL}/api/admin/schedules",
        params={"branch_id": branch_id},
        headers=auth_headers,
        timeout=20,
    )
    assert schedules.status_code == 200
    ids = [item["id"] for item in schedules.json()]
    assert state["schedule_id"] not in ids
