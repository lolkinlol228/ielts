"""Targeted regression for requested Feb-2026 features: leads/graduates cleanup, group constraints, graduation, schedule CRUD/conflicts, admin credentials."""

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
    # Auth module: superadmin session for admin APIs
    login = api_client.post(
        f"{BASE_URL}/api/auth/login",
        json={"username": "admin", "password": "admin123", "branch_id": ""},
        timeout=25,
    )
    if login.status_code != 200:
        pytest.skip("Cannot login as superadmin (admin/admin123); skipping protected regression")
    token = login.json().get("token")
    assert isinstance(token, str) and token
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="module")
def state(api_client, auth_headers):
    # Branch module: isolated branch and entities for this regression run
    suffix = uuid.uuid4().hex[:8]
    created_branch = api_client.post(
        f"{BASE_URL}/api/admin/branches",
        headers=auth_headers,
        json={"name": f"TEST-I4-{suffix}", "location": f"LOC-I4-{suffix}"},
        timeout=25,
    )
    assert created_branch.status_code == 200
    branch = created_branch.json()

    data = {
        "branch_id": branch["id"],
        "student_id": None,
        "student_username": None,
        "student_password": None,
        "general_group_1": None,
        "general_group_2": None,
        "individual_group_1": None,
        "individual_group_2": None,
        "teacher_id": None,
        "classroom_id": None,
        "schedule_group_id": None,
        "schedule_id": None,
    }

    yield data

    api_client.delete(
        f"{BASE_URL}/api/admin/branches/{data['branch_id']}",
        headers=auth_headers,
        timeout=25,
    )


def test_01_leads_search_reject_delete_selected_and_clear_all(api_client, auth_headers, state):
    # Leads module: create/search/reject/selected delete/clear all
    branch_id = state["branch_id"]
    suffix = uuid.uuid4().hex[:6]
    names = [f"TEST-I4 Lead {suffix}-A", f"TEST-I4 Lead {suffix}-B", f"TEST-I4 Lead {suffix}-C"]

    for idx, name in enumerate(names):
        created = api_client.post(
            f"{BASE_URL}/api/public/leads",
            json={"branch_id": branch_id, "full_name": name, "phone": f"+7700111000{idx}"},
            timeout=25,
        )
        assert created.status_code == 200
        assert "принята" in created.json().get("message", "").lower()

    search = api_client.get(
        f"{BASE_URL}/api/admin/leads",
        params={"branch_id": branch_id, "search_query": suffix},
        headers=auth_headers,
        timeout=25,
    )
    assert search.status_code == 200
    leads = [x for x in search.json() if suffix in x["full_name"]]
    assert len(leads) == 3

    reject = api_client.post(
        f"{BASE_URL}/api/admin/leads/{leads[0]['id']}/reject",
        params={"branch_id": branch_id},
        headers=auth_headers,
        timeout=25,
    )
    assert reject.status_code == 200
    assert "отклон" in reject.json().get("message", "").lower()

    delete_selected = api_client.post(
        f"{BASE_URL}/api/admin/leads/delete-selected",
        params={"branch_id": branch_id},
        headers=auth_headers,
        json={"ids": [leads[1]["id"], leads[2]["id"]]},
        timeout=25,
    )
    assert delete_selected.status_code == 200

    after_selected_delete = api_client.get(
        f"{BASE_URL}/api/admin/leads",
        params={"branch_id": branch_id, "search_query": suffix},
        headers=auth_headers,
        timeout=25,
    )
    assert after_selected_delete.status_code == 200
    remain = [x for x in after_selected_delete.json() if suffix in x["full_name"]]
    assert len(remain) == 1
    assert remain[0]["id"] == leads[0]["id"]
    assert remain[0]["status"] == "rejected"

    clear_all = api_client.delete(
        f"{BASE_URL}/api/admin/leads",
        params={"branch_id": branch_id},
        headers=auth_headers,
        timeout=25,
    )
    assert clear_all.status_code == 200

    final_list = api_client.get(
        f"{BASE_URL}/api/admin/leads",
        params={"branch_id": branch_id},
        headers=auth_headers,
        timeout=25,
    )
    assert final_list.status_code == 200
    assert final_list.json() == []


def test_02_group_rule_max_one_general_plus_one_individual(api_client, auth_headers, state):
    # Groups module: enforce 1 general + 1 individual max per student
    branch_id = state["branch_id"]
    suffix = uuid.uuid4().hex[:6]

    lead = api_client.post(
        f"{BASE_URL}/api/public/leads",
        json={"branch_id": branch_id, "full_name": f"TEST-I4 Student {suffix}", "phone": "+77004445566"},
        timeout=25,
    )
    assert lead.status_code == 200

    pending = api_client.get(
        f"{BASE_URL}/api/admin/leads",
        params={"branch_id": branch_id, "search_query": suffix},
        headers=auth_headers,
        timeout=25,
    )
    assert pending.status_code == 200
    pending_lead = next(x for x in pending.json() if suffix in x["full_name"])

    approved = api_client.post(
        f"{BASE_URL}/api/admin/leads/{pending_lead['id']}/approve",
        params={"branch_id": branch_id},
        headers=auth_headers,
        json={},
        timeout=25,
    )
    assert approved.status_code == 200
    approved_data = approved.json()
    state["student_id"] = approved_data["student_id"]
    state["student_username"] = approved_data["username"]
    state["student_password"] = approved_data["password"]

    def create_group(index_num, is_individual):
        response = api_client.post(
            f"{BASE_URL}/api/admin/groups",
            params={"branch_id": branch_id},
            headers=auth_headers,
            json={"prefix": "i4", "index": index_num, "year": 2026, "is_individual": is_individual},
            timeout=25,
        )
        assert response.status_code == 200
        return response.json()["id"]

    state["general_group_1"] = create_group(101, False)
    state["general_group_2"] = create_group(102, False)
    state["individual_group_1"] = create_group(201, True)
    state["individual_group_2"] = create_group(202, True)

    assign_general_1 = api_client.post(
        f"{BASE_URL}/api/admin/groups/{state['general_group_1']}/students/{state['student_id']}",
        params={"branch_id": branch_id},
        headers=auth_headers,
        json={},
        timeout=25,
    )
    assert assign_general_1.status_code == 200

    assign_general_2 = api_client.post(
        f"{BASE_URL}/api/admin/groups/{state['general_group_2']}/students/{state['student_id']}",
        params={"branch_id": branch_id},
        headers=auth_headers,
        json={},
        timeout=25,
    )
    assert assign_general_2.status_code == 400
    assert "общая" in str(assign_general_2.json().get("detail", "")).lower()

    assign_individual_1 = api_client.post(
        f"{BASE_URL}/api/admin/groups/{state['individual_group_1']}/students/{state['student_id']}",
        params={"branch_id": branch_id},
        headers=auth_headers,
        json={},
        timeout=25,
    )
    assert assign_individual_1.status_code == 200

    assign_individual_2 = api_client.post(
        f"{BASE_URL}/api/admin/groups/{state['individual_group_2']}/students/{state['student_id']}",
        params={"branch_id": branch_id},
        headers=auth_headers,
        json={},
        timeout=25,
    )
    assert assign_individual_2.status_code == 400
    assert "индивидуаль" in str(assign_individual_2.json().get("detail", "")).lower()

    students = api_client.get(
        f"{BASE_URL}/api/admin/students",
        params={"branch_id": branch_id},
        headers=auth_headers,
        timeout=25,
    )
    assert students.status_code == 200
    target = next(x for x in students.json() if x["id"] == state["student_id"])
    assert len(target.get("group_ids", [])) == 2


def test_03_graduate_group_deletes_student_account_and_graduates_cleanup(api_client, auth_headers, state):
    # Graduation module: graduate group -> graduates table + remove student/user; then delete selected/all graduates
    branch_id = state["branch_id"]

    graduate = api_client.post(
        f"{BASE_URL}/api/admin/groups/{state['general_group_1']}/graduate",
        params={"branch_id": branch_id},
        headers=auth_headers,
        json={},
        timeout=25,
    )
    assert graduate.status_code == 200
    assert graduate.json().get("graduates_count", 0) >= 1

    students_after = api_client.get(
        f"{BASE_URL}/api/admin/students",
        params={"branch_id": branch_id},
        headers=auth_headers,
        timeout=25,
    )
    assert students_after.status_code == 200
    assert state["student_id"] not in [x["id"] for x in students_after.json()]

    former_student_login = api_client.post(
        f"{BASE_URL}/api/auth/login",
        json={
            "username": state["student_username"],
            "password": state["student_password"],
            "branch_id": branch_id,
        },
        timeout=25,
    )
    assert former_student_login.status_code == 401

    graduates = api_client.get(
        f"{BASE_URL}/api/admin/graduates",
        params={"branch_id": branch_id},
        headers=auth_headers,
        timeout=25,
    )
    assert graduates.status_code == 200
    created_graduates = graduates.json()
    assert len(created_graduates) >= 1

    delete_selected = api_client.post(
        f"{BASE_URL}/api/admin/graduates/delete-selected",
        params={"branch_id": branch_id},
        headers=auth_headers,
        json={"ids": [created_graduates[0]["id"]]},
        timeout=25,
    )
    assert delete_selected.status_code == 200

    graduates_after_selected_delete = api_client.get(
        f"{BASE_URL}/api/admin/graduates",
        params={"branch_id": branch_id},
        headers=auth_headers,
        timeout=25,
    )
    assert graduates_after_selected_delete.status_code == 200
    assert created_graduates[0]["id"] not in [x["id"] for x in graduates_after_selected_delete.json()]

    clear_all = api_client.delete(
        f"{BASE_URL}/api/admin/graduates",
        params={"branch_id": branch_id},
        headers=auth_headers,
        timeout=25,
    )
    assert clear_all.status_code == 200

    graduates_final = api_client.get(
        f"{BASE_URL}/api/admin/graduates",
        params={"branch_id": branch_id},
        headers=auth_headers,
        timeout=25,
    )
    assert graduates_final.status_code == 200
    assert graduates_final.json() == []


def test_04_schedule_settings_auto_slots_conflicts_and_crud(api_client, auth_headers, state):
    # Schedule module: settings, auto slots, create/edit/delete lesson and conflict check
    branch_id = state["branch_id"]
    suffix = uuid.uuid4().hex[:6]

    teacher = api_client.post(
        f"{BASE_URL}/api/admin/teachers",
        params={"branch_id": branch_id},
        headers=auth_headers,
        json={"name": f"TEST-I4 Teacher {suffix}", "phone": "+77008889990"},
        timeout=25,
    )
    assert teacher.status_code == 200
    state["teacher_id"] = teacher.json()["id"]

    classroom = api_client.post(
        f"{BASE_URL}/api/admin/classrooms",
        params={"branch_id": branch_id},
        headers=auth_headers,
        json={"name": f"TEST-I4 Room {suffix}", "capacity": 10},
        timeout=25,
    )
    assert classroom.status_code == 200
    state["classroom_id"] = classroom.json()["id"]

    schedule_group = api_client.post(
        f"{BASE_URL}/api/admin/groups",
        params={"branch_id": branch_id},
        headers=auth_headers,
        json={"prefix": "i4sch", "index": 301, "year": 2026, "is_individual": False},
        timeout=25,
    )
    assert schedule_group.status_code == 200
    state["schedule_group_id"] = schedule_group.json()["id"]

    settings = {
        "start_time": "08:00",
        "end_time": "14:00",
        "lunch_start": "12:00",
        "lunch_end": "13:00",
        "lesson_duration": 120,
        "break_duration": 0,
    }
    put_settings = api_client.put(
        f"{BASE_URL}/api/admin/schedule-settings",
        params={"branch_id": branch_id},
        headers=auth_headers,
        json=settings,
        timeout=25,
    )
    assert put_settings.status_code == 200
    assert put_settings.json()["start_time"] == "08:00"

    auto_slots = api_client.post(
        f"{BASE_URL}/api/admin/schedule/auto-slots",
        params={"branch_id": branch_id},
        headers=auth_headers,
        json=settings,
        timeout=25,
    )
    assert auto_slots.status_code == 200
    slots = auto_slots.json().get("slots", [])
    assert len(slots) >= 2
    assert slots[0]["start"] == "08:00"

    create_lesson = api_client.post(
        f"{BASE_URL}/api/admin/schedules",
        params={"branch_id": branch_id},
        headers=auth_headers,
        json={
            "day": "ПН",
            "start": "08:00",
            "end": "10:00",
            "group_id": state["schedule_group_id"],
            "teacher_id": state["teacher_id"],
            "classroom_id": state["classroom_id"],
        },
        timeout=25,
    )
    assert create_lesson.status_code == 200
    state["schedule_id"] = create_lesson.json()["id"]

    conflict = api_client.get(
        f"{BASE_URL}/api/admin/schedules/conflicts",
        params={
            "branch_id": branch_id,
            "day": "ПН",
            "start": "09:00",
            "end": "11:00",
            "teacher_id": state["teacher_id"],
            "classroom_id": state["classroom_id"],
        },
        headers=auth_headers,
        timeout=25,
    )
    assert conflict.status_code == 200
    conflict_data = conflict.json()
    assert conflict_data["has_conflict"] is True
    assert conflict_data["teacher_busy"] is True
    assert conflict_data["classroom_busy"] is True

    update_lesson = api_client.put(
        f"{BASE_URL}/api/admin/schedules/{state['schedule_id']}",
        params={"branch_id": branch_id},
        headers=auth_headers,
        json={
            "day": "ПН",
            "start": "10:00",
            "end": "12:00",
            "group_id": state["schedule_group_id"],
            "teacher_id": state["teacher_id"],
            "classroom_id": state["classroom_id"],
        },
        timeout=25,
    )
    assert update_lesson.status_code == 200
    assert update_lesson.json()["start"] == "10:00"

    delete_lesson = api_client.delete(
        f"{BASE_URL}/api/admin/schedules/{state['schedule_id']}",
        params={"branch_id": branch_id},
        headers=auth_headers,
        timeout=25,
    )
    assert delete_lesson.status_code == 200

    list_after_delete = api_client.get(
        f"{BASE_URL}/api/admin/schedules",
        params={"branch_id": branch_id},
        headers=auth_headers,
        timeout=25,
    )
    assert list_after_delete.status_code == 200
    assert state["schedule_id"] not in [x["id"] for x in list_after_delete.json()]


def test_05_admin_credentials_change_and_revert(api_client, auth_headers):
    # Account module: update admin username/password then restore back to admin/admin123
    new_username = f"admin_i4_{uuid.uuid4().hex[:6]}"
    new_password = f"TmpPass{uuid.uuid4().hex[:6]}!"

    changed = api_client.put(
        f"{BASE_URL}/api/admin/me/credentials",
        headers=auth_headers,
        json={
            "current_password": "admin123",
            "new_username": new_username,
            "new_password": new_password,
        },
        timeout=25,
    )
    assert changed.status_code == 200

    relogin = api_client.post(
        f"{BASE_URL}/api/auth/login",
        json={"username": new_username, "password": new_password, "branch_id": ""},
        timeout=25,
    )
    assert relogin.status_code == 200
    new_token = relogin.json()["token"]

    restore = api_client.put(
        f"{BASE_URL}/api/admin/me/credentials",
        headers={"Authorization": f"Bearer {new_token}"},
        json={
            "current_password": new_password,
            "new_username": "admin",
            "new_password": "admin123",
        },
        timeout=25,
    )
    assert restore.status_code == 200

    final_login = api_client.post(
        f"{BASE_URL}/api/auth/login",
        json={"username": "admin", "password": "admin123", "branch_id": ""},
        timeout=25,
    )
    assert final_login.status_code == 200
