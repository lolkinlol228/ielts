import os
import re
import uuid
import random
import string
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from passlib.context import CryptContext
from pydantic import BaseModel


BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

MONGO_URL = os.environ.get("MONGO_URL")
DB_NAME = os.environ.get("DB_NAME")
JWT_SECRET = os.environ.get("JWT_SECRET")

if not MONGO_URL or not DB_NAME or not JWT_SECRET:
    raise RuntimeError("MONGO_URL, DB_NAME, JWT_SECRET must be set in environment")

ALGORITHM = "HS256"

app = FastAPI(title="IELTS Center API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

client = AsyncIOMotorClient(MONGO_URL)
master_db = client[DB_NAME]

security = HTTPBearer()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

WEEK_DAYS = ["ПН", "ВТ", "СР", "ЧТ", "ПТ", "СБ", "ВС"]
MAX_FAILED_ATTEMPTS = 5
FAILED_ATTEMPTS_WINDOW_SECONDS = 10 * 60
ACCOUNT_LOCK_SECONDS = 15 * 60


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def slugify(value: str) -> str:
    cleaned = re.sub(r"[^a-zA-Z0-9а-яА-ЯёЁ]+", "-", value.strip().lower())
    return cleaned.strip("-") or "branch"


def parse_time_to_minutes(value: str) -> int:
    try:
        hh, mm = value.split(":")
        return int(hh) * 60 + int(mm)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Неверный формат времени: {value}") from exc


def minutes_to_time(value: int) -> str:
    hh = value // 60
    mm = value % 60
    return f"{hh:02d}:{mm:02d}"


def has_overlap(start_a: str, end_a: str, start_b: str, end_b: str) -> bool:
    sa = parse_time_to_minutes(start_a)
    ea = parse_time_to_minutes(end_a)
    sb = parse_time_to_minutes(start_b)
    eb = parse_time_to_minutes(end_b)
    return max(sa, sb) < min(ea, eb)


def sanitize(doc: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    if not doc:
        return None
    sanitized = {k: v for k, v in doc.items() if k != "_id"}
    return sanitized


def random_password(length: int = 8) -> str:
    chars = string.ascii_letters + string.digits
    return "".join(random.choice(chars) for _ in range(length))


def random_username(name: str) -> str:
    base = re.sub(r"[^a-zA-Z0-9]", "", name.lower())[:8] or "student"
    return f"{base}{random.randint(100, 999)}"


def build_default_site_settings(brand_name: str) -> Dict[str, Any]:
    return {
        "key": "site",
        "brand_name": brand_name,
        "logo_url": "https://images.unsplash.com/photo-1545239351-1141bd82e8a6?crop=entropy&cs=srgb&fm=jpg&q=80",
        "phone": "+7 (700) 000-00-00",
        "social_links": {
            "instagram": "https://instagram.com",
            "facebook": "https://facebook.com",
            "whatsapp": "https://wa.me/77000000000",
        },
        "colors": {
            "primary": "#1e3a8a",
            "secondary": "#4b5563",
            "accent": "#dc2626",
            "background": "#ffffff",
            "surface": "#f9fafb",
            "text_main": "#111827",
        },
        "content": {
            "hero_title": {
                "ru": "Подготовка к IELTS для учебы, работы и жизни за границей",
                "en": "IELTS preparation for study, work and life abroad",
                "kk": "Шетелде оқу, жұмыс және өмір үшін IELTS дайындығы",
            },
            "hero_subtitle": {
                "ru": "Системный подход, сильные преподаватели и результат, который открывает двери в лучшие университеты.",
                "en": "A structured approach, strong teachers, and results that open doors to top universities.",
                "kk": "Құрылымды әдіс, мықты мұғалімдер және үздік университеттерге жол ашатын нәтиже.",
            },
            "about_title": {
                "ru": "Для чего нужен IELTS?",
                "en": "Why do you need IELTS?",
                "kk": "IELTS не үшін қажет?",
            },
            "about_text": {
                "ru": "Если вы мечтаете работать, учиться или жить за границей, тест IELTS позволит вашей мечте осуществиться. IELTS требуется для поступления в университеты, получения рабочей визы и ПМЖ в англоязычных странах.",
                "en": "If you dream of working, studying, or living abroad, IELTS helps turn that dream into reality. IELTS is required for university admission, work visas, and residency in English-speaking countries.",
                "kk": "Егер сіз шетелде жұмыс істеуді, оқуды немесе өмір сүруді армандасаңыз, IELTS сол арманды жүзеге асыруға көмектеседі. IELTS ағылшын тілінде сөйлейтін елдерде университетке түсуге, жұмыс визасы мен резиденттікке қажет.",
            },
            "why_choose_title": {
                "ru": "Почему выбирают IELTS Center",
                "en": "Why Students Choose IELTS Center",
                "kk": "Неге IELTS Center таңдайды",
            },
            "consultation_title": {
                "ru": "Для записи на индивидуальную консультацию оставьте ФИО и номер телефона",
                "en": "For an individual consultation, leave your full name and phone number",
                "kk": "Жеке кеңеске жазылу үшін аты-жөніңіз бен телефон нөміріңізді қалдырыңыз",
            },
            "offer_title": {
                "ru": "Приходи на бесплатное занятие и получи диагностику IELTS бесплатно",
                "en": "Join a free lesson and get a free IELTS diagnostic",
                "kk": "Тегін сабаққа келіп, IELTS бойынша тегін диагностика алыңыз",
            },
        },
        "course_program": {
            "lessons_per_month": "12 занятий/мес.",
            "frequency": "3 раза в неделю по 90 минут",
            "items": [
                "Vocabulary approach / Grammar",
                "Pre-preparation to IELTS",
                "Tips, tricks and strategies for all 4 sections of IELTS",
                "Авторский учебник Тамары Ильясовой",
                "Регистрация IELTS в BRITISH COUNCIL",
            ],
        },
        "success_metrics": [
            {"label": "Выпускников", "value": "1200+"},
            {"label": "Средний рост балла", "value": "+1.5"},
            {"label": "Преподавателей", "value": "18"},
        ],
        "testimonials": [
            {
                "id": str(uuid.uuid4()),
                "name": "Aruzhan K.",
                "platform": "instagram",
                "image_url": "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?crop=entropy&cs=srgb&fm=jpg&q=80",
                "text": {
                    "ru": "Подготовка структурная и очень понятная. Сдала IELTS на 7.0!",
                    "en": "The preparation was structured and clear. I scored 7.0 on IELTS!",
                    "kk": "Дайындық өте жүйелі әрі түсінікті болды. IELTS-тен 7.0 алдым!",
                },
            },
            {
                "id": str(uuid.uuid4()),
                "name": "Eldar S.",
                "platform": "facebook",
                "image_url": "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?crop=entropy&cs=srgb&fm=jpg&q=80",
                "text": {
                    "ru": "Отличные преподаватели и правильная стратегия на все 4 секции.",
                    "en": "Excellent teachers and the right strategy for all 4 sections.",
                    "kk": "Өте мықты ұстаздар және 4 бөлімге дұрыс стратегия берілді.",
                },
            },
        ],
        "map_locations": [
            {
                "id": str(uuid.uuid4()),
                "title": "Филиал на Абая",
                "address": "Абая 68, Алматы",
                "lat": 43.2387,
                "lng": 76.8897,
            },
            {
                "id": str(uuid.uuid4()),
                "title": "Филиал в Мамыр",
                "address": "Саина 197а, Мамыр 4, Алматы",
                "lat": 43.2276,
                "lng": 76.8412,
            },
        ],
        "updated_at": now_iso(),
    }


def build_default_schedule_settings() -> Dict[str, Any]:
    return {
        "key": "main",
        "start_time": "08:00",
        "end_time": "17:00",
        "lunch_start": "12:00",
        "lunch_end": "13:00",
        "lesson_duration": 120,
        "break_duration": 0,
        "updated_at": now_iso(),
    }


def normalize_site_settings(settings: Dict[str, Any]) -> Dict[str, Any]:
    defaults = build_default_site_settings(settings.get("brand_name") or "IELTS Center")
    normalized = {**defaults, **settings}
    normalized["social_links"] = {**defaults.get("social_links", {}), **settings.get("social_links", {})}
    normalized["colors"] = {**defaults.get("colors", {}), **settings.get("colors", {})}
    normalized["content"] = {**defaults.get("content", {}), **settings.get("content", {})}
    normalized["testimonials"] = settings.get("testimonials", defaults.get("testimonials", []))
    normalized["map_locations"] = settings.get("map_locations", defaults.get("map_locations", []))
    return normalized


class LoginRequest(BaseModel):
    username: str
    password: str
    branch_id: Optional[str] = None


class LeadCreate(BaseModel):
    branch_id: str
    full_name: str
    phone: str


class BranchCreate(BaseModel):
    name: str
    location: str


class BranchUpdate(BaseModel):
    name: str
    location: str


class SiteSettingsUpdate(BaseModel):
    brand_name: Optional[str] = None
    logo_url: Optional[str] = None
    phone: Optional[str] = None
    social_links: Optional[Dict[str, str]] = None
    colors: Optional[Dict[str, str]] = None
    content: Optional[Dict[str, Dict[str, str]]] = None
    testimonials: Optional[List[Dict[str, Any]]] = None
    map_locations: Optional[List[Dict[str, Any]]] = None


class TeacherInput(BaseModel):
    name: str
    phone: str
    image_url: Optional[str] = None
    specialization: Optional[str] = None
    bio: Optional[Dict[str, str]] = None


class ClassroomInput(BaseModel):
    name: str
    capacity: Optional[int] = None


class GroupInput(BaseModel):
    prefix: str = "ielts"
    index: int
    year: int
    is_individual: bool = False


class ScheduleSettingsInput(BaseModel):
    start_time: str
    end_time: str
    lunch_start: str
    lunch_end: str
    lesson_duration: int
    break_duration: int = 0


class ScheduleAutoRequest(BaseModel):
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    lunch_start: Optional[str] = None
    lunch_end: Optional[str] = None
    lesson_duration: Optional[int] = None
    break_duration: Optional[int] = None


class ScheduleEntryInput(BaseModel):
    day: str
    start: str
    end: str
    group_id: str
    teacher_id: str
    classroom_id: str


class LeadApproveInput(BaseModel):
    username: Optional[str] = None
    password: Optional[str] = None


class StudentCredentialsInput(BaseModel):
    username: str
    password: str


class TransferInput(BaseModel):
    from_group_id: str
    to_group_id: str


class IdsInput(BaseModel):
    ids: List[str]


class AdminCredentialsInput(BaseModel):
    current_password: str
    new_username: str
    new_password: str


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> Dict[str, Any]:
    token = credentials.credentials
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
    except JWTError as exc:
        raise HTTPException(status_code=401, detail="Неверный токен") from exc

    if not user_id:
        raise HTTPException(status_code=401, detail="Неверный токен")

    user = await master_db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Пользователь не найден")
    return user


def require_roles(*roles: str):
    async def checker(user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
        if user.get("role") not in roles:
            raise HTTPException(status_code=403, detail="Недостаточно прав")
        return user

    return checker


async def get_branch(branch_id: str) -> Dict[str, Any]:
    branch = await master_db.branches.find_one({"id": branch_id}, {"_id": 0})
    if not branch:
        raise HTTPException(status_code=404, detail="Филиал не найден")
    return branch


async def get_default_branch() -> Dict[str, Any]:
    branch = await master_db.branches.find_one({}, {"_id": 0}, sort=[("created_at", 1)])
    if not branch:
        raise HTTPException(status_code=404, detail="Филиалы не настроены")
    return branch


def assert_branch_access(user: Dict[str, Any], branch_id: str) -> None:
    if user.get("role") == "admin" and user.get("branch_id") and user["branch_id"] != branch_id:
        raise HTTPException(status_code=403, detail="Нет доступа к этому филиалу")
    if user.get("role") == "student" and user.get("branch_id") != branch_id:
        raise HTTPException(status_code=403, detail="Нет доступа к этому филиалу")


async def get_branch_db(branch_id: str) -> AsyncIOMotorDatabase:
    branch = await get_branch(branch_id)
    return client[branch["db_name"]]


def now_ts() -> int:
    return int(datetime.now(timezone.utc).timestamp())


async def record_login_attempt(
    username: str,
    success: bool,
    branch_id: Optional[str],
    role: str,
    request: Request,
) -> None:
    attempt = {
        "id": str(uuid.uuid4()),
        "username": username,
        "success": success,
        "branch_id": branch_id,
        "role": role,
        "ip": request.client.host if request.client else "unknown",
        "user_agent": request.headers.get("user-agent", "unknown"),
        "created_at": now_iso(),
        "ts": now_ts(),
    }
    await master_db.login_attempts.insert_one(attempt)


async def lock_account_and_alert(
    username: str,
    branch_id: Optional[str],
    role: str,
) -> None:
    current_ts = now_ts()
    locked_until_ts = current_ts + ACCOUNT_LOCK_SECONDS
    await master_db.account_locks.update_one(
        {"username": username},
        {
            "$set": {
                "username": username,
                "locked_until_ts": locked_until_ts,
                "locked_until": datetime.fromtimestamp(locked_until_ts, tz=timezone.utc).isoformat(),
                "updated_at": now_iso(),
                "reason": "too_many_failed_login_attempts",
            }
        },
        upsert=True,
    )

    alert = await master_db.security_alerts.find_one(
        {"username": username, "type": "bruteforce", "status": "new"},
        {"_id": 0},
    )
    if alert:
        await master_db.security_alerts.update_one(
            {"id": alert["id"]},
            {
                "$inc": {"count": 1},
                "$set": {
                    "last_seen_at": now_iso(),
                    "branch_id": branch_id,
                    "role": role,
                },
            },
        )
    else:
        await master_db.security_alerts.insert_one(
            {
                "id": str(uuid.uuid4()),
                "type": "bruteforce",
                "status": "new",
                "username": username,
                "branch_id": branch_id,
                "role": role,
                "count": 1,
                "message": f"Подозрение на перебор пароля для пользователя: {username}",
                "created_at": now_iso(),
                "last_seen_at": now_iso(),
            }
        )


async def check_account_lock(username: str) -> Optional[int]:
    lock = await master_db.account_locks.find_one({"username": username}, {"_id": 0})
    if not lock:
        return None
    current_ts = now_ts()
    if lock.get("locked_until_ts", 0) <= current_ts:
        await master_db.account_locks.delete_one({"username": username})
        return None
    return lock["locked_until_ts"] - current_ts


async def get_student_group_type_counts(branch_db: AsyncIOMotorDatabase, group_ids: List[str]) -> Dict[str, int]:
    if not group_ids:
        return {"general": 0, "individual": 0}
    groups = await branch_db.groups.find({"id": {"$in": group_ids}}, {"_id": 0, "id": 1, "is_individual": 1}).to_list(length=500)
    general = sum(1 for group in groups if not group.get("is_individual"))
    individual = sum(1 for group in groups if group.get("is_individual"))
    return {"general": general, "individual": individual}


def create_token(user: Dict[str, Any]) -> str:
    payload = {
        "sub": user["id"],
        "role": user["role"],
        "branch_id": user.get("branch_id"),
        "username": user["username"],
        "iat": int(datetime.now(timezone.utc).timestamp()),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=ALGORITHM)


async def ensure_branch_seed(branch_id: str) -> None:
    branch = await get_branch(branch_id)
    branch_db = client[branch["db_name"]]
    settings = await branch_db.settings.find_one({"key": "site"}, {"_id": 0})
    if not settings:
        await branch_db.settings.insert_one(build_default_site_settings("IELTS Center"))
    schedule_settings = await branch_db.schedule_settings.find_one({"key": "main"}, {"_id": 0})
    if not schedule_settings:
        await branch_db.schedule_settings.insert_one(build_default_schedule_settings())


@app.on_event("startup")
async def startup_event() -> None:
    await master_db.users.create_index([("username", 1), ("branch_id", 1)], unique=True)
    await master_db.users.create_index("student_id")
    await master_db.branches.create_index("id", unique=True)
    await master_db.branches.create_index("db_name", unique=True)
    await master_db.login_attempts.create_index("ts")
    await master_db.account_locks.create_index("username", unique=True)
    await master_db.security_alerts.create_index([("status", 1), ("created_at", -1)])

    branch = await master_db.branches.find_one({}, {"_id": 0})
    if not branch:
        default_branch_id = str(uuid.uuid4())
        default_branch = {
            "id": default_branch_id,
            "name": "Главный филиал",
            "location": "Алматы",
            "db_name": f"{DB_NAME}_main",
            "created_at": now_iso(),
        }
        await master_db.branches.insert_one(default_branch)
        await ensure_branch_seed(default_branch_id)

    superadmin = await master_db.users.find_one({"role": "superadmin"}, {"_id": 0})
    if not superadmin:
        superadmin_user = {
            "id": str(uuid.uuid4()),
            "branch_id": None,
            "student_id": None,
            "role": "superadmin",
            "full_name": "Platform Admin",
            "username": "admin",
            "password_hash": pwd_context.hash("admin123"),
            "created_at": now_iso(),
        }
        await master_db.users.insert_one(superadmin_user)


@app.get("/api/health")
async def health() -> Dict[str, str]:
    return {"status": "ok"}


@app.get("/api/public/branches")
async def public_branches() -> List[Dict[str, Any]]:
    branches = await master_db.branches.find({}, {"_id": 0}).to_list(length=200)
    return sorted(branches, key=lambda b: b["name"])


@app.get("/api/public/settings")
async def public_settings(branch_id: Optional[str] = Query(None)) -> Dict[str, Any]:
    if not branch_id:
        default_branch = await get_default_branch()
        branch_id = default_branch["id"]
    branch_db = await get_branch_db(branch_id)
    settings = await branch_db.settings.find_one({"key": "site"}, {"_id": 0})
    if not settings:
        settings = build_default_site_settings("IELTS Center")
        await branch_db.settings.insert_one(settings)
    normalized = normalize_site_settings(settings)
    await branch_db.settings.update_one({"key": "site"}, {"$set": normalized}, upsert=True)
    return normalized


@app.get("/api/public/teachers")
async def public_teachers(branch_id: Optional[str] = Query(None)) -> List[Dict[str, Any]]:
    if not branch_id:
        default_branch = await get_default_branch()
        branch_id = default_branch["id"]
    branch_db = await get_branch_db(branch_id)
    teachers = await branch_db.teachers.find({}, {"_id": 0}).to_list(length=500)
    return sorted(teachers, key=lambda item: item["name"])


@app.post("/api/public/leads")
async def create_lead(payload: LeadCreate) -> Dict[str, str]:
    branch_db = await get_branch_db(payload.branch_id)
    lead = {
        "id": str(uuid.uuid4()),
        "full_name": payload.full_name.strip(),
        "phone": payload.phone.strip(),
        "status": "pending",
        "created_at": now_iso(),
    }
    await branch_db.leads.insert_one(lead)
    return {"message": "Заявка принята"}


@app.post("/api/auth/login")
async def login(payload: LoginRequest, request: Request) -> Dict[str, Any]:
    username = payload.username.strip().lower()
    branch_id = payload.branch_id

    remaining_lock_seconds = await check_account_lock(username)
    if remaining_lock_seconds:
        raise HTTPException(
            status_code=429,
            detail=f"Слишком много попыток входа. Повторите через {remaining_lock_seconds} сек.",
        )

    user = None
    if branch_id:
        user = await master_db.users.find_one({"username": username, "branch_id": branch_id}, {"_id": 0})
    if not user:
        if username == "admin":
            user = await master_db.users.find_one({"username": username, "role": "superadmin"}, {"_id": 0})
        else:
            users = await master_db.users.find({"username": username}, {"_id": 0}).to_list(length=5)
            if len(users) > 1:
                raise HTTPException(status_code=400, detail="Найдено несколько аккаунтов с таким логином")
            user = users[0] if users else None

    if not user or not pwd_context.verify(payload.password, user["password_hash"]):
        await record_login_attempt(
            username=username,
            success=False,
            branch_id=user.get("branch_id") if user else None,
            role=user.get("role", "unknown") if user else "unknown",
            request=request,
        )

        current_ts = now_ts()
        cutoff_ts = current_ts - FAILED_ATTEMPTS_WINDOW_SECONDS
        failures = await master_db.login_attempts.count_documents(
            {"username": username, "success": False, "ts": {"$gte": cutoff_ts}}
        )
        await master_db.login_attempts.delete_many({"ts": {"$lt": current_ts - 86400}})

        if failures >= MAX_FAILED_ATTEMPTS:
            await lock_account_and_alert(
                username=username,
                branch_id=user.get("branch_id") if user else None,
                role=user.get("role", "unknown") if user else "unknown",
            )
            raise HTTPException(
                status_code=429,
                detail="Аккаунт временно заблокирован из-за большого числа неудачных попыток.",
            )

        raise HTTPException(status_code=401, detail="Неверный логин или пароль")

    await record_login_attempt(
        username=username,
        success=True,
        branch_id=user.get("branch_id"),
        role=user.get("role", "unknown"),
        request=request,
    )
    await master_db.account_locks.delete_one({"username": username})

    token = create_token(user)
    return {
        "token": token,
        "user": {
            "id": user["id"],
            "username": user["username"],
            "role": user["role"],
            "branch_id": user.get("branch_id"),
            "full_name": user.get("full_name", ""),
        },
    }


@app.get("/api/auth/me")
async def auth_me(user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    return {
        "id": user["id"],
        "username": user["username"],
        "role": user["role"],
        "branch_id": user.get("branch_id"),
        "student_id": user.get("student_id"),
        "full_name": user.get("full_name", ""),
    }


@app.get("/api/admin/branches")
async def admin_branches(user: Dict[str, Any] = Depends(require_roles("superadmin", "admin"))) -> List[Dict[str, Any]]:
    branches = await master_db.branches.find({}, {"_id": 0}).to_list(length=500)
    if user.get("role") == "admin" and user.get("branch_id"):
        branches = [b for b in branches if b["id"] == user["branch_id"]]
    return sorted(branches, key=lambda item: item["name"])


@app.get("/api/admin/security-alerts")
async def list_security_alerts(
    branch_id: str = Query(...),
    status_filter: Optional[str] = Query("new"),
    user: Dict[str, Any] = Depends(require_roles("superadmin", "admin")),
) -> List[Dict[str, Any]]:
    assert_branch_access(user, branch_id)
    query: Dict[str, Any] = {}
    if status_filter and status_filter != "all":
        query["status"] = status_filter

    if user.get("role") == "superadmin":
        query["$or"] = [{"branch_id": branch_id}, {"branch_id": None}]
    else:
        query["branch_id"] = branch_id

    alerts = await master_db.security_alerts.find(query, {"_id": 0}).to_list(length=500)
    return sorted(alerts, key=lambda item: item.get("last_seen_at", item["created_at"]), reverse=True)


@app.post("/api/admin/security-alerts/{alert_id}/ack")
async def ack_security_alert(
    alert_id: str,
    branch_id: str = Query(...),
    user: Dict[str, Any] = Depends(require_roles("superadmin", "admin")),
) -> Dict[str, str]:
    assert_branch_access(user, branch_id)
    alert = await master_db.security_alerts.find_one({"id": alert_id}, {"_id": 0})
    if not alert:
        raise HTTPException(status_code=404, detail="Оповещение не найдено")

    if user.get("role") != "superadmin" and alert.get("branch_id") != branch_id:
        raise HTTPException(status_code=403, detail="Нет доступа")

    await master_db.security_alerts.update_one(
        {"id": alert_id},
        {"$set": {"status": "ack", "ack_at": now_iso(), "ack_by": user.get("username", "admin")}},
    )
    return {"message": "Оповещение подтверждено"}


@app.put("/api/admin/branches/{branch_id}")
async def update_branch(
    branch_id: str,
    payload: BranchUpdate,
    user: Dict[str, Any] = Depends(require_roles("superadmin")),
) -> Dict[str, Any]:
    existing = await master_db.branches.find_one({"id": branch_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Филиал не найден")

    update_doc = {
        "name": payload.name.strip(),
        "location": payload.location.strip(),
        "updated_at": now_iso(),
    }
    await master_db.branches.update_one({"id": branch_id}, {"$set": update_doc})
    updated = await master_db.branches.find_one({"id": branch_id}, {"_id": 0})
    return sanitize(updated) or {**existing, **update_doc}


@app.delete("/api/admin/branches/{branch_id}")
async def delete_branch(
    branch_id: str,
    user: Dict[str, Any] = Depends(require_roles("superadmin")),
) -> Dict[str, str]:
    branch = await master_db.branches.find_one({"id": branch_id}, {"_id": 0})
    if not branch:
        raise HTTPException(status_code=404, detail="Филиал не найден")

    branch_count = await master_db.branches.count_documents({})
    if branch_count <= 1:
        raise HTTPException(status_code=400, detail="Нельзя удалить последний филиал")

    await master_db.users.delete_many({"branch_id": branch_id})
    await master_db.branches.delete_one({"id": branch_id})
    await client.drop_database(branch["db_name"])
    return {"message": "Филиал удалён"}


@app.post("/api/admin/branches")
async def create_branch(
    payload: BranchCreate,
    user: Dict[str, Any] = Depends(require_roles("superadmin")),
) -> Dict[str, Any]:
    branch_slug = slugify(payload.location)
    suffix = uuid.uuid4().hex[:6]
    branch = {
        "id": str(uuid.uuid4()),
        "name": payload.name.strip(),
        "location": payload.location.strip(),
        "db_name": f"{DB_NAME}_{branch_slug}_{suffix}",
        "created_at": now_iso(),
    }
    await master_db.branches.insert_one(branch)
    await ensure_branch_seed(branch["id"])
    return sanitize(branch)


@app.get("/api/admin/site-settings")
async def get_site_settings(
    branch_id: str = Query(...),
    user: Dict[str, Any] = Depends(require_roles("superadmin", "admin")),
) -> Dict[str, Any]:
    assert_branch_access(user, branch_id)
    branch_db = await get_branch_db(branch_id)
    settings = await branch_db.settings.find_one({"key": "site"}, {"_id": 0})
    if not settings:
        settings = build_default_site_settings("IELTS Center")
        await branch_db.settings.insert_one(settings)
    normalized = normalize_site_settings(settings)
    await branch_db.settings.update_one({"key": "site"}, {"$set": normalized}, upsert=True)
    return normalized


@app.put("/api/admin/site-settings")
async def update_site_settings(
    payload: SiteSettingsUpdate,
    branch_id: str = Query(...),
    user: Dict[str, Any] = Depends(require_roles("superadmin", "admin")),
) -> Dict[str, Any]:
    assert_branch_access(user, branch_id)
    branch_db = await get_branch_db(branch_id)
    current = await branch_db.settings.find_one({"key": "site"}, {"_id": 0})
    if not current:
        current = build_default_site_settings("IELTS Center")
    current = normalize_site_settings(current)

    merged = {**current}
    for field in ["brand_name", "logo_url", "phone"]:
        incoming_value = getattr(payload, field)
        if incoming_value is not None:
            merged[field] = incoming_value
    if payload.social_links is not None:
        merged["social_links"] = payload.social_links
    if payload.colors is not None:
        merged["colors"] = payload.colors
    if payload.content is not None:
        merged["content"] = payload.content
    if payload.testimonials is not None:
        merged["testimonials"] = payload.testimonials
    if payload.map_locations is not None:
        merged["map_locations"] = payload.map_locations

    merged["updated_at"] = now_iso()
    await branch_db.settings.update_one({"key": "site"}, {"$set": merged}, upsert=True)
    updated = await branch_db.settings.find_one({"key": "site"}, {"_id": 0})
    return sanitize(updated) or merged


@app.get("/api/admin/leads")
async def list_leads(
    branch_id: str = Query(...),
    status_filter: Optional[str] = Query(None),
    search_query: Optional[str] = Query(None),
    user: Dict[str, Any] = Depends(require_roles("superadmin", "admin")),
) -> List[Dict[str, Any]]:
    assert_branch_access(user, branch_id)
    branch_db = await get_branch_db(branch_id)
    query: Dict[str, Any] = {}
    if status_filter:
        query["status"] = status_filter
    if search_query:
        query["full_name"] = {"$regex": re.escape(search_query.strip()), "$options": "i"}
    leads = await branch_db.leads.find(query, {"_id": 0}).to_list(length=1000)
    return sorted(leads, key=lambda x: x["created_at"], reverse=True)


@app.post("/api/admin/leads/delete-selected")
async def delete_selected_leads(
    payload: IdsInput,
    branch_id: str = Query(...),
    user: Dict[str, Any] = Depends(require_roles("superadmin", "admin")),
) -> Dict[str, str]:
    assert_branch_access(user, branch_id)
    if not payload.ids:
        raise HTTPException(status_code=400, detail="Не выбраны заявки")
    branch_db = await get_branch_db(branch_id)
    await branch_db.leads.delete_many({"id": {"$in": payload.ids}})
    return {"message": "Выбранные заявки удалены"}


@app.delete("/api/admin/leads")
async def delete_all_leads(
    branch_id: str = Query(...),
    user: Dict[str, Any] = Depends(require_roles("superadmin", "admin")),
) -> Dict[str, str]:
    assert_branch_access(user, branch_id)
    branch_db = await get_branch_db(branch_id)
    await branch_db.leads.delete_many({})
    return {"message": "Все заявки удалены"}


@app.post("/api/admin/leads/{lead_id}/approve")
async def approve_lead(
    lead_id: str,
    payload: LeadApproveInput,
    branch_id: str = Query(...),
    user: Dict[str, Any] = Depends(require_roles("superadmin", "admin")),
) -> Dict[str, Any]:
    assert_branch_access(user, branch_id)
    branch_db = await get_branch_db(branch_id)
    lead = await branch_db.leads.find_one({"id": lead_id}, {"_id": 0})
    if not lead:
        raise HTTPException(status_code=404, detail="Заявка не найдена")
    if lead.get("status") == "approved":
        raise HTTPException(status_code=400, detail="Заявка уже подтверждена")

    student_id = str(uuid.uuid4())
    student = {
        "id": student_id,
        "full_name": lead["full_name"],
        "phone": lead["phone"],
        "group_ids": [],
        "created_at": now_iso(),
    }
    await branch_db.students.insert_one(student)

    username = (payload.username or random_username(lead["full_name"])).lower()
    password = payload.password or random_password(8)
    existing = await master_db.users.find_one({"username": username}, {"_id": 0})
    if existing:
        username = f"{username}{random.randint(10,99)}"

    student_user = {
        "id": str(uuid.uuid4()),
        "role": "student",
        "branch_id": branch_id,
        "student_id": student_id,
        "full_name": lead["full_name"],
        "username": username,
        "password_hash": pwd_context.hash(password),
        "created_at": now_iso(),
    }
    await master_db.users.insert_one(student_user)
    await branch_db.leads.update_one(
        {"id": lead_id},
        {"$set": {"status": "approved", "student_id": student_id, "approved_at": now_iso()}},
    )
    return {"message": "Заявка подтверждена", "student_id": student_id, "username": username, "password": password}


@app.post("/api/admin/leads/{lead_id}/reject")
async def reject_lead(
    lead_id: str,
    branch_id: str = Query(...),
    user: Dict[str, Any] = Depends(require_roles("superadmin", "admin")),
) -> Dict[str, str]:
    assert_branch_access(user, branch_id)
    branch_db = await get_branch_db(branch_id)
    lead = await branch_db.leads.find_one({"id": lead_id}, {"_id": 0})
    if not lead:
        raise HTTPException(status_code=404, detail="Заявка не найдена")
    if lead.get("status") == "approved":
        raise HTTPException(status_code=400, detail="Подтвержденную заявку нельзя отклонить")

    await branch_db.leads.update_one(
        {"id": lead_id},
        {"$set": {"status": "rejected", "rejected_at": now_iso()}},
    )
    return {"message": "Заявка отклонена"}


@app.get("/api/admin/students")
async def list_students(
    branch_id: str = Query(...),
    user: Dict[str, Any] = Depends(require_roles("superadmin", "admin")),
) -> List[Dict[str, Any]]:
    assert_branch_access(user, branch_id)
    branch_db = await get_branch_db(branch_id)
    students = await branch_db.students.find({}, {"_id": 0}).to_list(length=2000)
    groups = await branch_db.groups.find({}, {"_id": 0, "id": 1, "name": 1}).to_list(length=2000)
    group_map = {g["id"]: g["name"] for g in groups}

    for student in students:
        student["groups"] = [group_map[group_id] for group_id in student.get("group_ids", []) if group_id in group_map]

    return sorted(students, key=lambda s: s["full_name"])


@app.put("/api/admin/students/{student_id}/credentials")
async def update_student_credentials(
    student_id: str,
    payload: StudentCredentialsInput,
    branch_id: str = Query(...),
    user: Dict[str, Any] = Depends(require_roles("superadmin", "admin")),
) -> Dict[str, str]:
    assert_branch_access(user, branch_id)
    student = await (await get_branch_db(branch_id)).students.find_one({"id": student_id}, {"_id": 0})
    if not student:
        raise HTTPException(status_code=404, detail="Студент не найден")

    existing_username = await master_db.users.find_one(
        {
            "username": payload.username.lower(),
            "student_id": {"$ne": student_id},
        },
        {"_id": 0},
    )
    if existing_username:
        raise HTTPException(status_code=400, detail="Логин уже занят")

    await master_db.users.update_one(
        {"branch_id": branch_id, "student_id": student_id, "role": "student"},
        {
            "$set": {
                "username": payload.username.lower(),
                "password_hash": pwd_context.hash(payload.password),
                "full_name": student["full_name"],
            },
            "$setOnInsert": {
                "id": str(uuid.uuid4()),
                "role": "student",
                "branch_id": branch_id,
                "student_id": student_id,
                "created_at": now_iso(),
            },
        },
        upsert=True,
    )
    return {"message": "Данные для входа обновлены"}


@app.get("/api/admin/teachers")
async def list_teachers(
    branch_id: str = Query(...),
    user: Dict[str, Any] = Depends(require_roles("superadmin", "admin")),
) -> List[Dict[str, Any]]:
    assert_branch_access(user, branch_id)
    branch_db = await get_branch_db(branch_id)
    teachers = await branch_db.teachers.find({}, {"_id": 0}).to_list(length=1000)
    return sorted(teachers, key=lambda t: t["name"])


@app.post("/api/admin/teachers")
async def create_teacher(
    payload: TeacherInput,
    branch_id: str = Query(...),
    user: Dict[str, Any] = Depends(require_roles("superadmin", "admin")),
) -> Dict[str, Any]:
    assert_branch_access(user, branch_id)
    teacher = {
        "id": str(uuid.uuid4()),
        "name": payload.name,
        "phone": payload.phone,
        "image_url": payload.image_url or "",
        "specialization": payload.specialization or "IELTS Instructor",
        "bio": payload.bio
        or {
            "ru": "Опытный преподаватель IELTS.",
            "en": "Experienced IELTS instructor.",
            "kk": "Тәжірибелі IELTS оқытушысы.",
        },
        "created_at": now_iso(),
    }
    branch_db = await get_branch_db(branch_id)
    await branch_db.teachers.insert_one(teacher)
    return sanitize(teacher)


@app.put("/api/admin/teachers/{teacher_id}")
async def update_teacher(
    teacher_id: str,
    payload: TeacherInput,
    branch_id: str = Query(...),
    user: Dict[str, Any] = Depends(require_roles("superadmin", "admin")),
) -> Dict[str, Any]:
    assert_branch_access(user, branch_id)
    branch_db = await get_branch_db(branch_id)
    existing = await branch_db.teachers.find_one({"id": teacher_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Преподаватель не найден")

    update_doc = {
        "name": payload.name,
        "phone": payload.phone,
        "image_url": payload.image_url or "",
        "specialization": payload.specialization or "IELTS Instructor",
        "bio": payload.bio
        or {
            "ru": "Опытный преподаватель IELTS.",
            "en": "Experienced IELTS instructor.",
            "kk": "Тәжірибелі IELTS оқытушысы.",
        },
        "updated_at": now_iso(),
    }
    await branch_db.teachers.update_one({"id": teacher_id}, {"$set": update_doc})
    updated = await branch_db.teachers.find_one({"id": teacher_id}, {"_id": 0})
    return sanitize(updated) or {**existing, **update_doc}


@app.delete("/api/admin/teachers/{teacher_id}")
async def delete_teacher(
    teacher_id: str,
    branch_id: str = Query(...),
    user: Dict[str, Any] = Depends(require_roles("superadmin", "admin")),
) -> Dict[str, str]:
    assert_branch_access(user, branch_id)
    branch_db = await get_branch_db(branch_id)
    result = await branch_db.teachers.delete_one({"id": teacher_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Преподаватель не найден")
    return {"message": "Преподаватель удалён"}


@app.get("/api/admin/classrooms")
async def list_classrooms(
    branch_id: str = Query(...),
    user: Dict[str, Any] = Depends(require_roles("superadmin", "admin")),
) -> List[Dict[str, Any]]:
    assert_branch_access(user, branch_id)
    branch_db = await get_branch_db(branch_id)
    classes = await branch_db.classrooms.find({}, {"_id": 0}).to_list(length=1000)
    return sorted(classes, key=lambda c: c["name"])


@app.post("/api/admin/classrooms")
async def create_classroom(
    payload: ClassroomInput,
    branch_id: str = Query(...),
    user: Dict[str, Any] = Depends(require_roles("superadmin", "admin")),
) -> Dict[str, Any]:
    assert_branch_access(user, branch_id)
    classroom = {
        "id": str(uuid.uuid4()),
        "name": payload.name,
        "capacity": payload.capacity,
        "created_at": now_iso(),
    }
    branch_db = await get_branch_db(branch_id)
    await branch_db.classrooms.insert_one(classroom)
    return sanitize(classroom)


@app.delete("/api/admin/classrooms/{classroom_id}")
async def delete_classroom(
    classroom_id: str,
    branch_id: str = Query(...),
    user: Dict[str, Any] = Depends(require_roles("superadmin", "admin")),
) -> Dict[str, str]:
    assert_branch_access(user, branch_id)
    branch_db = await get_branch_db(branch_id)
    result = await branch_db.classrooms.delete_one({"id": classroom_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Кабинет не найден")
    return {"message": "Кабинет удалён"}


@app.get("/api/admin/groups")
async def list_groups(
    branch_id: str = Query(...),
    user: Dict[str, Any] = Depends(require_roles("superadmin", "admin")),
) -> List[Dict[str, Any]]:
    assert_branch_access(user, branch_id)
    groups = await (await get_branch_db(branch_id)).groups.find({}, {"_id": 0}).to_list(length=1000)
    return sorted(groups, key=lambda g: g["name"])


@app.post("/api/admin/groups")
async def create_group(
    payload: GroupInput,
    branch_id: str = Query(...),
    user: Dict[str, Any] = Depends(require_roles("superadmin", "admin")),
) -> Dict[str, Any]:
    assert_branch_access(user, branch_id)
    prefix = payload.prefix.strip() or "ielts"
    name = f"{prefix}-{payload.index}-{payload.year}"
    group = {
        "id": str(uuid.uuid4()),
        "name": name,
        "prefix": prefix,
        "index": payload.index,
        "year": payload.year,
        "is_individual": payload.is_individual,
        "student_ids": [],
        "created_at": now_iso(),
    }
    branch_db = await get_branch_db(branch_id)
    await branch_db.groups.insert_one(group)
    return sanitize(group)


@app.delete("/api/admin/groups/{group_id}")
async def delete_group(
    group_id: str,
    branch_id: str = Query(...),
    user: Dict[str, Any] = Depends(require_roles("superadmin", "admin")),
) -> Dict[str, str]:
    assert_branch_access(user, branch_id)
    branch_db = await get_branch_db(branch_id)
    await branch_db.students.update_many({}, {"$pull": {"group_ids": group_id}})
    await branch_db.schedules.delete_many({"group_id": group_id})
    result = await branch_db.groups.delete_one({"id": group_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Группа не найдена")
    return {"message": "Группа удалена"}


@app.post("/api/admin/groups/{group_id}/students/{student_id}")
async def assign_student_to_group(
    group_id: str,
    student_id: str,
    branch_id: str = Query(...),
    user: Dict[str, Any] = Depends(require_roles("superadmin", "admin")),
) -> Dict[str, str]:
    assert_branch_access(user, branch_id)
    branch_db = await get_branch_db(branch_id)
    group = await branch_db.groups.find_one({"id": group_id}, {"_id": 0})
    student = await branch_db.students.find_one({"id": student_id}, {"_id": 0})
    if not group or not student:
        raise HTTPException(status_code=404, detail="Студент или группа не найдены")

    student_group_ids = student.get("group_ids", [])
    if group_id not in student_group_ids:
        counts = await get_student_group_type_counts(branch_db, student_group_ids)
        if group.get("is_individual") and counts["individual"] >= 1:
            raise HTTPException(status_code=400, detail="У студента уже есть индивидуальная группа")
        if not group.get("is_individual") and counts["general"] >= 1:
            raise HTTPException(status_code=400, detail="У студента уже есть общая группа")

    await branch_db.groups.update_one({"id": group_id}, {"$addToSet": {"student_ids": student_id}})
    await branch_db.students.update_one({"id": student_id}, {"$addToSet": {"group_ids": group_id}})
    return {"message": "Студент добавлен в группу"}


@app.post("/api/admin/students/{student_id}/transfer")
async def transfer_student(
    student_id: str,
    payload: TransferInput,
    branch_id: str = Query(...),
    user: Dict[str, Any] = Depends(require_roles("superadmin", "admin")),
) -> Dict[str, str]:
    assert_branch_access(user, branch_id)
    if payload.from_group_id == payload.to_group_id:
        raise HTTPException(status_code=400, detail="Группа назначения должна отличаться")

    branch_db = await get_branch_db(branch_id)
    student = await branch_db.students.find_one({"id": student_id}, {"_id": 0})
    to_group = await branch_db.groups.find_one({"id": payload.to_group_id}, {"_id": 0})
    if not student or not to_group:
        raise HTTPException(status_code=404, detail="Студент или группа не найдены")

    remaining_group_ids = [group_id for group_id in student.get("group_ids", []) if group_id != payload.from_group_id]
    counts = await get_student_group_type_counts(branch_db, remaining_group_ids)
    if to_group.get("is_individual") and counts["individual"] >= 1:
        raise HTTPException(status_code=400, detail="У студента уже есть индивидуальная группа")
    if not to_group.get("is_individual") and counts["general"] >= 1:
        raise HTTPException(status_code=400, detail="У студента уже есть общая группа")

    await branch_db.groups.update_one({"id": payload.from_group_id}, {"$pull": {"student_ids": student_id}})
    await branch_db.groups.update_one({"id": payload.to_group_id}, {"$addToSet": {"student_ids": student_id}})
    await branch_db.students.update_one({"id": student_id}, {"$pull": {"group_ids": payload.from_group_id}})
    await branch_db.students.update_one({"id": student_id}, {"$addToSet": {"group_ids": payload.to_group_id}})
    return {"message": "Студент переведен"}


@app.post("/api/admin/groups/{group_id}/graduate")
async def graduate_group(
    group_id: str,
    branch_id: str = Query(...),
    user: Dict[str, Any] = Depends(require_roles("superadmin", "admin")),
) -> Dict[str, Any]:
    assert_branch_access(user, branch_id)
    branch_db = await get_branch_db(branch_id)
    group = await branch_db.groups.find_one({"id": group_id}, {"_id": 0})
    if not group:
        raise HTTPException(status_code=404, detail="Группа не найдена")

    student_ids = group.get("student_ids", [])
    if not student_ids:
        return {"message": "В группе нет учеников", "graduates_count": 0}

    students = await branch_db.students.find({"id": {"$in": student_ids}}, {"_id": 0}).to_list(length=5000)
    graduate_docs = []
    for student in students:
        graduate_docs.append(
            {
                "id": str(uuid.uuid4()),
                "student_id": student["id"],
                "full_name": student["full_name"],
                "phone": student.get("phone", ""),
                "group_name": group.get("name", ""),
                "group_id": group_id,
                "graduated_at": now_iso(),
            }
        )

    if graduate_docs:
        await branch_db.graduates.insert_many(graduate_docs)

    await master_db.users.delete_many({"branch_id": branch_id, "student_id": {"$in": student_ids}, "role": "student"})
    await branch_db.students.delete_many({"id": {"$in": student_ids}})
    await branch_db.groups.update_one({"id": group_id}, {"$set": {"student_ids": [], "graduated_at": now_iso()}})
    await branch_db.schedules.delete_many({"group_id": group_id})
    return {"message": "Группа выпущена", "graduates_count": len(graduate_docs)}


@app.get("/api/admin/graduates")
async def list_graduates(
    branch_id: str = Query(...),
    search_query: Optional[str] = Query(None),
    user: Dict[str, Any] = Depends(require_roles("superadmin", "admin")),
) -> List[Dict[str, Any]]:
    assert_branch_access(user, branch_id)
    branch_db = await get_branch_db(branch_id)
    query: Dict[str, Any] = {}
    if search_query:
        query["full_name"] = {"$regex": re.escape(search_query.strip()), "$options": "i"}
    graduates = await branch_db.graduates.find(query, {"_id": 0}).to_list(length=5000)
    return sorted(graduates, key=lambda item: item["graduated_at"], reverse=True)


@app.post("/api/admin/graduates/delete-selected")
async def delete_selected_graduates(
    payload: IdsInput,
    branch_id: str = Query(...),
    user: Dict[str, Any] = Depends(require_roles("superadmin", "admin")),
) -> Dict[str, str]:
    assert_branch_access(user, branch_id)
    if not payload.ids:
        raise HTTPException(status_code=400, detail="Не выбраны выпускники")
    branch_db = await get_branch_db(branch_id)
    await branch_db.graduates.delete_many({"id": {"$in": payload.ids}})
    return {"message": "Выбранные выпускники удалены"}


@app.delete("/api/admin/graduates")
async def delete_all_graduates(
    branch_id: str = Query(...),
    user: Dict[str, Any] = Depends(require_roles("superadmin", "admin")),
) -> Dict[str, str]:
    assert_branch_access(user, branch_id)
    branch_db = await get_branch_db(branch_id)
    await branch_db.graduates.delete_many({})
    return {"message": "Все выпускники удалены"}


@app.get("/api/admin/schedule-settings")
async def get_schedule_settings(
    branch_id: str = Query(...),
    user: Dict[str, Any] = Depends(require_roles("superadmin", "admin")),
) -> Dict[str, Any]:
    assert_branch_access(user, branch_id)
    branch_db = await get_branch_db(branch_id)
    settings = await branch_db.schedule_settings.find_one({"key": "main"}, {"_id": 0})
    if not settings:
        settings = build_default_schedule_settings()
        await branch_db.schedule_settings.insert_one(settings)
    return settings


@app.put("/api/admin/schedule-settings")
async def set_schedule_settings(
    payload: ScheduleSettingsInput,
    branch_id: str = Query(...),
    user: Dict[str, Any] = Depends(require_roles("superadmin", "admin")),
) -> Dict[str, Any]:
    assert_branch_access(user, branch_id)
    updated = {
        "key": "main",
        "start_time": payload.start_time,
        "end_time": payload.end_time,
        "lunch_start": payload.lunch_start,
        "lunch_end": payload.lunch_end,
        "lesson_duration": payload.lesson_duration,
        "break_duration": payload.break_duration,
        "updated_at": now_iso(),
    }
    branch_db = await get_branch_db(branch_id)
    await branch_db.schedule_settings.update_one({"key": "main"}, {"$set": updated}, upsert=True)
    return updated


@app.post("/api/admin/schedule/auto-slots")
async def auto_slots(
    payload: ScheduleAutoRequest,
    branch_id: str = Query(...),
    user: Dict[str, Any] = Depends(require_roles("superadmin", "admin")),
) -> Dict[str, Any]:
    assert_branch_access(user, branch_id)
    branch_db = await get_branch_db(branch_id)
    base_settings = await branch_db.schedule_settings.find_one({"key": "main"}, {"_id": 0})
    if not base_settings:
        base_settings = build_default_schedule_settings()

    start_time = payload.start_time or base_settings["start_time"]
    end_time = payload.end_time or base_settings["end_time"]
    lunch_start = payload.lunch_start or base_settings["lunch_start"]
    lunch_end = payload.lunch_end or base_settings["lunch_end"]
    lesson_duration = payload.lesson_duration or base_settings["lesson_duration"]
    break_duration = payload.break_duration if payload.break_duration is not None else base_settings["break_duration"]

    current = parse_time_to_minutes(start_time)
    end = parse_time_to_minutes(end_time)
    lunch_s = parse_time_to_minutes(lunch_start)
    lunch_e = parse_time_to_minutes(lunch_end)

    slots: List[Dict[str, Any]] = []
    lesson_index = 1
    while current + lesson_duration <= end:
        lesson_start = current
        lesson_end = current + lesson_duration

        if has_overlap(minutes_to_time(lesson_start), minutes_to_time(lesson_end), minutes_to_time(lunch_s), minutes_to_time(lunch_e)):
            current = lunch_e
            continue

        slots.append(
            {
                "label": f"Урок {lesson_index}",
                "start": minutes_to_time(lesson_start),
                "end": minutes_to_time(lesson_end),
            }
        )
        lesson_index += 1
        current = lesson_end + break_duration

    return {"slots": slots}


async def collect_conflicts(
    branch_db: AsyncIOMotorDatabase,
    day: str,
    start: str,
    end: str,
    teacher_id: str,
    classroom_id: str,
    skip_schedule_id: Optional[str] = None,
) -> Dict[str, Any]:
    schedules = await branch_db.schedules.find({"day": day}, {"_id": 0}).to_list(length=4000)
    conflicts: List[Dict[str, Any]] = []
    for schedule in schedules:
        if skip_schedule_id and schedule["id"] == skip_schedule_id:
            continue
        if not has_overlap(start, end, schedule["start"], schedule["end"]):
            continue
        if schedule["teacher_id"] == teacher_id or schedule["classroom_id"] == classroom_id:
            conflicts.append(schedule)

    teacher_conflicts = [entry for entry in conflicts if entry["teacher_id"] == teacher_id]
    class_conflicts = [entry for entry in conflicts if entry["classroom_id"] == classroom_id]
    return {
        "has_conflict": len(conflicts) > 0,
        "teacher_busy": len(teacher_conflicts) > 0,
        "classroom_busy": len(class_conflicts) > 0,
        "conflicts": conflicts,
    }


@app.get("/api/admin/schedules/conflicts")
async def get_schedule_conflicts(
    branch_id: str = Query(...),
    day: str = Query(...),
    start: str = Query(...),
    end: str = Query(...),
    teacher_id: str = Query(...),
    classroom_id: str = Query(...),
    schedule_id: Optional[str] = Query(None),
    user: Dict[str, Any] = Depends(require_roles("superadmin", "admin")),
) -> Dict[str, Any]:
    assert_branch_access(user, branch_id)
    branch_db = await get_branch_db(branch_id)
    return await collect_conflicts(branch_db, day, start, end, teacher_id, classroom_id, schedule_id)


@app.get("/api/admin/schedules")
async def list_schedules(
    branch_id: str = Query(...),
    user: Dict[str, Any] = Depends(require_roles("superadmin", "admin")),
) -> List[Dict[str, Any]]:
    assert_branch_access(user, branch_id)
    branch_db = await get_branch_db(branch_id)
    schedules = await branch_db.schedules.find({}, {"_id": 0}).to_list(length=4000)
    groups = await branch_db.groups.find({}, {"_id": 0, "id": 1, "name": 1}).to_list(length=1000)
    teachers = await branch_db.teachers.find({}, {"_id": 0, "id": 1, "name": 1}).to_list(length=1000)
    classrooms = await branch_db.classrooms.find({}, {"_id": 0, "id": 1, "name": 1}).to_list(length=1000)

    group_map = {x["id"]: x["name"] for x in groups}
    teacher_map = {x["id"]: x["name"] for x in teachers}
    classroom_map = {x["id"]: x["name"] for x in classrooms}

    for item in schedules:
        item["group_name"] = group_map.get(item["group_id"], "-")
        item["teacher_name"] = teacher_map.get(item["teacher_id"], "-")
        item["classroom_name"] = classroom_map.get(item["classroom_id"], "-")

    day_order = {day: idx for idx, day in enumerate(WEEK_DAYS)}
    return sorted(schedules, key=lambda s: (day_order.get(s["day"], 99), s["start"]))


@app.post("/api/admin/schedules")
async def create_schedule(
    payload: ScheduleEntryInput,
    branch_id: str = Query(...),
    user: Dict[str, Any] = Depends(require_roles("superadmin", "admin")),
) -> Dict[str, Any]:
    assert_branch_access(user, branch_id)
    if payload.day not in WEEK_DAYS:
        raise HTTPException(status_code=400, detail="Неверный день недели")

    branch_db = await get_branch_db(branch_id)
    conflicts = await collect_conflicts(
        branch_db,
        payload.day,
        payload.start,
        payload.end,
        payload.teacher_id,
        payload.classroom_id,
    )
    if conflicts["has_conflict"]:
        raise HTTPException(status_code=400, detail=conflicts)

    schedule = {
        "id": str(uuid.uuid4()),
        "day": payload.day,
        "start": payload.start,
        "end": payload.end,
        "group_id": payload.group_id,
        "teacher_id": payload.teacher_id,
        "classroom_id": payload.classroom_id,
        "created_at": now_iso(),
    }
    await branch_db.schedules.insert_one(schedule)
    return sanitize(schedule)


@app.delete("/api/admin/schedules/{schedule_id}")
async def delete_schedule(
    schedule_id: str,
    branch_id: str = Query(...),
    user: Dict[str, Any] = Depends(require_roles("superadmin", "admin")),
) -> Dict[str, str]:
    assert_branch_access(user, branch_id)
    result = await (await get_branch_db(branch_id)).schedules.delete_one({"id": schedule_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Расписание не найдено")
    return {"message": "Запись удалена"}


@app.put("/api/admin/schedules/{schedule_id}")
async def update_schedule(
    schedule_id: str,
    payload: ScheduleEntryInput,
    branch_id: str = Query(...),
    user: Dict[str, Any] = Depends(require_roles("superadmin", "admin")),
) -> Dict[str, Any]:
    assert_branch_access(user, branch_id)
    if payload.day not in WEEK_DAYS:
        raise HTTPException(status_code=400, detail="Неверный день недели")

    branch_db = await get_branch_db(branch_id)
    existing = await branch_db.schedules.find_one({"id": schedule_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Расписание не найдено")

    conflicts = await collect_conflicts(
        branch_db,
        payload.day,
        payload.start,
        payload.end,
        payload.teacher_id,
        payload.classroom_id,
        skip_schedule_id=schedule_id,
    )
    if conflicts["has_conflict"]:
        raise HTTPException(status_code=400, detail=conflicts)

    update_doc = {
        "day": payload.day,
        "start": payload.start,
        "end": payload.end,
        "group_id": payload.group_id,
        "teacher_id": payload.teacher_id,
        "classroom_id": payload.classroom_id,
        "updated_at": now_iso(),
    }
    await branch_db.schedules.update_one({"id": schedule_id}, {"$set": update_doc})
    updated = await branch_db.schedules.find_one({"id": schedule_id}, {"_id": 0})
    return sanitize(updated) or {**existing, **update_doc}


@app.get("/api/student/schedule")
async def student_schedule(user: Dict[str, Any] = Depends(require_roles("student"))) -> Dict[str, Any]:
    branch_id = user.get("branch_id")
    student_id = user.get("student_id")
    if not branch_id or not student_id:
        raise HTTPException(status_code=400, detail="Профиль студента не настроен")

    branch_db = await get_branch_db(branch_id)
    student = await branch_db.students.find_one({"id": student_id}, {"_id": 0})
    if not student:
        raise HTTPException(status_code=404, detail="Студент не найден")

    group_ids = student.get("group_ids", [])
    schedules = await branch_db.schedules.find({"group_id": {"$in": group_ids}}, {"_id": 0}).to_list(length=2000)
    groups = await branch_db.groups.find({}, {"_id": 0, "id": 1, "name": 1}).to_list(length=1000)
    teachers = await branch_db.teachers.find({}, {"_id": 0, "id": 1, "name": 1}).to_list(length=1000)
    classrooms = await branch_db.classrooms.find({}, {"_id": 0, "id": 1, "name": 1}).to_list(length=1000)

    group_map = {g["id"]: g["name"] for g in groups}
    teacher_map = {t["id"]: t["name"] for t in teachers}
    class_map = {c["id"]: c["name"] for c in classrooms}

    grouped: Dict[str, List[Dict[str, Any]]] = {day: [] for day in WEEK_DAYS}
    for item in schedules:
        day = item["day"]
        grouped.setdefault(day, []).append(
            {
                "start": item["start"],
                "end": item["end"],
                "group_name": group_map.get(item["group_id"], "-"),
                "teacher_name": teacher_map.get(item["teacher_id"], "-"),
                "classroom_name": class_map.get(item["classroom_id"], "-"),
            }
        )

    for day in grouped:
        grouped[day] = sorted(grouped[day], key=lambda x: x["start"])

    return {
        "student": {
            "id": student["id"],
            "full_name": student["full_name"],
            "phone": student["phone"],
        },
        "schedule": grouped,
    }


@app.put("/api/admin/me/credentials")
async def update_admin_credentials(
    payload: AdminCredentialsInput,
    user: Dict[str, Any] = Depends(require_roles("superadmin", "admin")),
) -> Dict[str, str]:
    existing = await master_db.users.find_one({"id": user["id"]}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Пользователь не найден")

    if not pwd_context.verify(payload.current_password, existing["password_hash"]):
        raise HTTPException(status_code=400, detail="Текущий пароль неверный")

    candidate_username = payload.new_username.strip().lower()
    duplicate = await master_db.users.find_one({"username": candidate_username, "id": {"$ne": user["id"]}}, {"_id": 0})
    if duplicate:
        raise HTTPException(status_code=400, detail="Логин уже занят")

    await master_db.users.update_one(
        {"id": user["id"]},
        {
            "$set": {
                "username": candidate_username,
                "password_hash": pwd_context.hash(payload.new_password),
                "updated_at": now_iso(),
            }
        },
    )
    return {"message": "Логин и пароль обновлены"}
