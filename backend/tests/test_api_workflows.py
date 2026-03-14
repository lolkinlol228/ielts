"""Critical API workflow tests for IELTS Center MVP (auth, branches, leads, resources, groups, schedule, student page)."""

import os
import time
import uuid

import pytest
import requests


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
def state():
    return {
        "branch_id": None,
        "lead_id": None,
        "student_id": None,
        "student_username": None,
        "student_password": None,
        "teacher_id": None,
        "classroom_id": None,
        "group_a_id": None,
        "group_b_id": None,
        "schedule_created": False,
    }


def test_01_public_endpoints(api_client):
    health = api_client.get(f"{BASE_URL}/api/health", timeout=20)
    assert health.status_code == 200
    assert health.json().get("status") == "ok"

    branches = api_client.get(f"{BASE_URL}/api/public/branches", timeout=20)
    assert branches.status_code == 200
    branch_list = branches.json()
    assert isinstance(branch_list, list)
    assert len(branch_list) > 0
    assert "id" in branch_list[0]

    settings = api_client.get(
        f"{BASE_URL}/api/public/settings",
        params={"branch_id": branch_list[0]["id"]},
        timeout=20,
    )
    assert settings.status_code == 200
    settings_data = settings.json()
    assert settings_data.get("key") == "site"
    assert isinstance(settings_data.get("content"), dict)


def test_02_admin_branch_leads_resources_groups_schedule(api_client, state):
    # Superadmin login
    login = api_client.post(
        f"{BASE_URL}/api/auth/login",
        json={"username": "admin", "password": "admin123", "branch_id": ""},
        timeout=20,
    )
    assert login.status_code == 200
    login_data = login.json()
    token = login_data["token"]
    assert login_data["user"]["role"] == "superadmin"

    auth_headers = {"Authorization": f"Bearer {token}"}

    # Branch create + verify appears in list
    suffix = uuid.uuid4().hex[:6]
    new_branch_payload = {"name": f"TEST Branch {suffix}", "location": f"TESTCity{suffix}"}
    branch_create = api_client.post(
        f"{BASE_URL}/api/admin/branches",
        json=new_branch_payload,
        headers=auth_headers,
        timeout=20,
    )
    assert branch_create.status_code == 200
    created_branch = branch_create.json()
    assert created_branch["name"] == new_branch_payload["name"]
    assert created_branch["location"] == new_branch_payload["location"]
    state["branch_id"] = created_branch["id"]

    branches = api_client.get(f"{BASE_URL}/api/admin/branches", headers=auth_headers, timeout=20)
    assert branches.status_code == 200
    branch_ids = [item["id"] for item in branches.json()]
    assert state["branch_id"] in branch_ids

    # Site settings update + get verify
    site_update_payload = {
        "brand_name": f"TEST IELTS {suffix}",
        "logo_url": "https://example.com/logo.png",
        "phone": "+7 (777) 111-22-33",
        "colors": {
            "primary": "#000000",
            "secondary": "#111111",
            "accent": "#222222",
            "background": "#ffffff",
            "surface": "#f5f5f5",
            "text_main": "#333333",
        },
        "content": {
            "hero_title": {"ru": "TEST RU", "en": "TEST EN", "kk": "TEST KK"},
            "hero_subtitle": {"ru": "S RU", "en": "S EN", "kk": "S KK"},
            "about_title": {"ru": "A RU", "en": "A EN", "kk": "A KK"},
            "about_text": {"ru": "AT RU", "en": "AT EN", "kk": "AT KK"},
            "why_choose_title": {"ru": "W RU", "en": "W EN", "kk": "W KK"},
            "consultation_title": {"ru": "C RU", "en": "C EN", "kk": "C KK"},
            "offer_title": {"ru": "O RU", "en": "O EN", "kk": "O KK"},
        },
    }
    site_put = api_client.put(
        f"{BASE_URL}/api/admin/site-settings",
        params={"branch_id": state["branch_id"]},
        json=site_update_payload,
        headers=auth_headers,
        timeout=20,
    )
    assert site_put.status_code == 200
    assert site_put.json()["brand_name"] == site_update_payload["brand_name"]

    site_get = api_client.get(
        f"{BASE_URL}/api/admin/site-settings",
        params={"branch_id": state["branch_id"]},
        headers=auth_headers,
        timeout=20,
    )
    assert site_get.status_code == 200
    assert site_get.json()["logo_url"] == site_update_payload["logo_url"]

    # Create lead from public and approve to student
    lead_create = api_client.post(
        f"{BASE_URL}/api/public/leads",
        json={"branch_id": state["branch_id"], "full_name": f"TEST Student {suffix}", "phone": "+77001234567"},
        timeout=20,
    )
    assert lead_create.status_code == 200
    assert "принята" in lead_create.json().get("message", "").lower()

    leads = api_client.get(
        f"{BASE_URL}/api/admin/leads",
        params={"branch_id": state["branch_id"]},
        headers=auth_headers,
        timeout=20,
    )
    assert leads.status_code == 200
    lead_rows = leads.json()
    assert len(lead_rows) > 0
    pending = next((row for row in lead_rows if row.get("status") == "pending"), None)
    assert pending is not None
    state["lead_id"] = pending["id"]

    approve = api_client.post(
        f"{BASE_URL}/api/admin/leads/{state['lead_id']}/approve",
        params={"branch_id": state["branch_id"]},
        json={},
        headers=auth_headers,
        timeout=20,
    )
    assert approve.status_code == 200
    approve_data = approve.json()
    state["student_id"] = approve_data["student_id"]
    state["student_username"] = approve_data["username"]
    state["student_password"] = approve_data["password"]
    assert isinstance(state["student_username"], str)
    assert isinstance(state["student_password"], str)

    students = api_client.get(
        f"{BASE_URL}/api/admin/students",
        params={"branch_id": state["branch_id"]},
        headers=auth_headers,
        timeout=20,
    )
    assert students.status_code == 200
    student_ids = [s["id"] for s in students.json()]
    assert state["student_id"] in student_ids

    # Teacher CRUD + Classroom CRUD
    teacher_create = api_client.post(
        f"{BASE_URL}/api/admin/teachers",
        params={"branch_id": state["branch_id"]},
        json={"name": f"TEST Teacher {suffix}", "phone": "+77009998877"},
        headers=auth_headers,
        timeout=20,
    )
    assert teacher_create.status_code == 200
    state["teacher_id"] = teacher_create.json()["id"]

    class_create = api_client.post(
        f"{BASE_URL}/api/admin/classrooms",
        params={"branch_id": state["branch_id"]},
        json={"name": f"TEST-{suffix}", "capacity": 12},
        headers=auth_headers,
        timeout=20,
    )
    assert class_create.status_code == 200
    state["classroom_id"] = class_create.json()["id"]

    teachers = api_client.get(
        f"{BASE_URL}/api/admin/teachers",
        params={"branch_id": state["branch_id"]},
        headers=auth_headers,
        timeout=20,
    )
    assert teachers.status_code == 200
    assert state["teacher_id"] in [t["id"] for t in teachers.json()]

    classrooms = api_client.get(
        f"{BASE_URL}/api/admin/classrooms",
        params={"branch_id": state["branch_id"]},
        headers=auth_headers,
        timeout=20,
    )
    assert classrooms.status_code == 200
    assert state["classroom_id"] in [c["id"] for c in classrooms.json()]

    # Groups create, assign student, transfer
    group_a = api_client.post(
        f"{BASE_URL}/api/admin/groups",
        params={"branch_id": state["branch_id"]},
        json={"prefix": "test", "index": 1, "year": 2026, "is_individual": False},
        headers=auth_headers,
        timeout=20,
    )
    assert group_a.status_code == 200
    state["group_a_id"] = group_a.json()["id"]

    group_b = api_client.post(
        f"{BASE_URL}/api/admin/groups",
        params={"branch_id": state["branch_id"]},
        json={"prefix": "test", "index": 2, "year": 2026, "is_individual": False},
        headers=auth_headers,
        timeout=20,
    )
    assert group_b.status_code == 200
    state["group_b_id"] = group_b.json()["id"]

    assign = api_client.post(
        f"{BASE_URL}/api/admin/groups/{state['group_a_id']}/students/{state['student_id']}",
        params={"branch_id": state["branch_id"]},
        json={},
        headers=auth_headers,
        timeout=20,
    )
    assert assign.status_code == 200

    students_after_assign = api_client.get(
        f"{BASE_URL}/api/admin/students",
        params={"branch_id": state["branch_id"]},
        headers=auth_headers,
        timeout=20,
    )
    assert students_after_assign.status_code == 200
    target_student = next(s for s in students_after_assign.json() if s["id"] == state["student_id"])
    assert len(target_student.get("groups", [])) >= 1

    # Schedule settings + auto slots + create lesson + conflict check
    schedule_settings = {
        "start_time": "08:00",
        "end_time": "14:00",
        "lunch_start": "12:00",
        "lunch_end": "13:00",
        "lesson_duration": 120,
        "break_duration": 0,
    }
    set_settings = api_client.put(
        f"{BASE_URL}/api/admin/schedule-settings",
        params={"branch_id": state["branch_id"]},
        json=schedule_settings,
        headers=auth_headers,
        timeout=20,
    )
    assert set_settings.status_code == 200
    assert set_settings.json()["start_time"] == "08:00"

    auto_slots = api_client.post(
        f"{BASE_URL}/api/admin/schedule/auto-slots",
        params={"branch_id": state["branch_id"]},
        json=schedule_settings,
        headers=auth_headers,
        timeout=20,
    )
    assert auto_slots.status_code == 200
    slots = auto_slots.json()["slots"]
    assert isinstance(slots, list)
    assert len(slots) >= 2

    create_lesson = api_client.post(
        f"{BASE_URL}/api/admin/schedules",
        params={"branch_id": state["branch_id"]},
        json={
            "day": "ПН",
            "start": "08:00",
            "end": "10:00",
            "group_id": state["group_a_id"],
            "teacher_id": state["teacher_id"],
            "classroom_id": state["classroom_id"],
        },
        headers=auth_headers,
        timeout=20,
    )
    assert create_lesson.status_code == 200
    state["schedule_created"] = True

    conflict = api_client.get(
        f"{BASE_URL}/api/admin/schedules/conflicts",
        params={
            "branch_id": state["branch_id"],
            "day": "ПН",
            "start": "09:00",
            "end": "11:00",
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


def test_03_student_login_and_schedule(api_client, state):
    assert state["branch_id"] is not None
    assert state["student_username"] is not None
    assert state["student_password"] is not None

    # Sometimes eventual consistency for freshly inserted password hash/record
    time.sleep(0.5)

    student_login = api_client.post(
        f"{BASE_URL}/api/auth/login",
        json={
            "username": state["student_username"],
            "password": state["student_password"],
            "branch_id": state["branch_id"],
        },
        timeout=20,
    )
    assert student_login.status_code == 200
    student_token = student_login.json()["token"]
    assert student_login.json()["user"]["role"] == "student"

    schedule = api_client.get(
        f"{BASE_URL}/api/student/schedule",
        headers={"Authorization": f"Bearer {student_token}"},
        timeout=20,
    )
    assert schedule.status_code == 200
    schedule_data = schedule.json()
    assert schedule_data["student"]["id"] == state["student_id"]
    assert "ПН" in schedule_data["schedule"]
    assert state["schedule_created"] is True
    assert len(schedule_data["schedule"]["ПН"]) >= 1


def test_04_transfer_between_groups(api_client, state):
    # Re-login as superadmin for isolated transfer endpoint validation
    login = api_client.post(
        f"{BASE_URL}/api/auth/login",
        json={"username": "admin", "password": "admin123", "branch_id": ""},
        timeout=20,
    )
    assert login.status_code == 200
    token = login.json()["token"]
    auth_headers = {"Authorization": f"Bearer {token}"}

    transfer = api_client.post(
        f"{BASE_URL}/api/admin/students/{state['student_id']}/transfer",
        params={"branch_id": state["branch_id"]},
        json={"from_group_id": state["group_a_id"], "to_group_id": state["group_b_id"]},
        headers=auth_headers,
        timeout=20,
    )
    assert transfer.status_code == 200
