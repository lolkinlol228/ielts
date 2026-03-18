import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { BookOpen, Clock, GraduationCap, Home, KeyRound, LayoutList, LogOut, MapPin, User } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../contexts/AuthContext";
import { api, authConfig } from "../lib/api";

const DAYS_KEYS = ["ПН", "ВТ", "СР", "ЧТ", "ПТ", "СБ", "ВС"];

const DAYS_LABELS = {
  ru: ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье"],
  en: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
  kk: ["Дүйсенбі", "Сейсенбі", "Сәрсенбі", "Бейсенбі", "Жұма", "Сенбі", "Жексенбі"],
};

const DAYS_SHORT = {
  ru: ["ПН", "ВТ", "СР", "ЧТ", "ПТ", "СБ", "ВС"],
  en: ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"],
  kk: ["ДС", "СС", "СР", "БС", "ЖМ", "СН", "ЖС"],
};

const TEXT = {
  ru: {
    title: "Моё расписание",
    changePassword: "Сменить пароль",
    home: "На сайт",
    logout: "Выйти",
    loading: "Загрузка расписания...",
    noLessons: "Занятий нет",
    cabinet: "Кабинет",
    teacher: "Преподаватель",
    group: "Группа",
    passwordModalTitle: "Смена пароля",
    currentPassword: "Текущий пароль",
    newPassword: "Новый пароль",
    confirmPassword: "Повторите пароль",
    save: "Сохранить",
    saving: "Сохранение...",
    close: "Отмена",
    errorLoad: "Не удалось загрузить расписание",
    errorFields: "Заполните все поля",
    errorMatch: "Пароли не совпадают",
    errorChange: "Ошибка смены пароля",
    lessons: "занятий",
    today: "Сегодня",
    viewAll: "Вся неделя",
  },
  en: {
    title: "My Schedule",
    changePassword: "Change Password",
    home: "Website",
    logout: "Log out",
    loading: "Loading schedule...",
    noLessons: "No classes",
    cabinet: "Room",
    teacher: "Teacher",
    group: "Group",
    passwordModalTitle: "Change Password",
    currentPassword: "Current password",
    newPassword: "New password",
    confirmPassword: "Confirm password",
    save: "Save",
    saving: "Saving...",
    close: "Cancel",
    errorLoad: "Failed to load schedule",
    errorFields: "Please fill in all fields",
    errorMatch: "Passwords do not match",
    errorChange: "Error changing password",
    lessons: "classes",
    today: "Today",
    viewAll: "Full week",
  },
  kk: {
    title: "Менің кестем",
    changePassword: "Құпия сөзді өзгерту",
    home: "Сайтқа",
    logout: "Шығу",
    loading: "Кесте жүктелуде...",
    noLessons: "Сабақ жоқ",
    cabinet: "Кабинет",
    teacher: "Оқытушы",
    group: "Топ",
    passwordModalTitle: "Құпия сөзді өзгерту",
    currentPassword: "Ағымдағы құпия сөз",
    newPassword: "Жаңа құпия сөз",
    confirmPassword: "Құпия сөзді растаңыз",
    save: "Сақтау",
    saving: "Сақталуда...",
    close: "Болдырмау",
    errorLoad: "Кестені жүктеу мүмкін болмады",
    errorFields: "Барлық өрістерді толтырыңыз",
    errorMatch: "Құпия сөздер сәйкес келмейді",
    errorChange: "Құпия сөзді өзгерту қатесі",
    lessons: "сабақ",
    today: "Бүгін",
    viewAll: "Бүкіл апта",
  },
};

// Текущий день недели → индекс 0-6 (0=ПН)
const getTodayIndex = () => {
  const d = new Date().getDay(); // 0=вс, 1=пн...
  return d === 0 ? 6 : d - 1;
};

export default function StudentSchedulePage() {
  const { user, token, logout } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ current_password: "", new_password: "", confirm_password: "" });
  const [changingPassword, setChangingPassword] = useState(false);
  const [activeDay, setActiveDay] = useState(getTodayIndex());
  const [viewAll, setViewAll] = useState(false);

  // Читаем язык из localStorage реактивно
  const [lang] = useState(() => localStorage.getItem("lang") || "ru");
  const t = TEXT[lang] || TEXT.ru;
  const daysLong = DAYS_LABELS[lang] || DAYS_LABELS.ru;
  const daysShort = DAYS_SHORT[lang] || DAYS_SHORT.ru;

  useEffect(() => {
    if (!token) return;
    api
      .get("/api/student/schedule", authConfig(token))
      .then((response) => setData(response.data))
      .catch(() => toast.error(t.errorLoad))
      .finally(() => setLoading(false));
  }, [token]);

  if (!user || user.role !== "student") {
    return <Navigate to="/" replace />;
  }

  const handleChangePassword = async (event) => {
    event.preventDefault();
    if (!passwordForm.current_password || !passwordForm.new_password || !passwordForm.confirm_password) {
      toast.error(t.errorFields);
      return;
    }
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      toast.error(t.errorMatch);
      return;
    }
    setChangingPassword(true);
    try {
      const response = await api.put("/api/student/change-password", passwordForm, authConfig(token));
      toast.success(response.data.message || t.save);
      setPasswordForm({ current_password: "", new_password: "", confirm_password: "" });
      setShowPasswordModal(false);
    } catch (error) {
      toast.error(error?.response?.data?.detail || t.errorChange);
    } finally {
      setChangingPassword(false);
    }
  };

  const todayIndex = getTodayIndex();
  const activeDayKey = DAYS_KEYS[activeDay];
  const activeLessons = data?.schedule?.[activeDayKey] || [];

  // Считаем общее количество занятий в неделю
  const totalLessons = DAYS_KEYS.reduce((sum, key) => sum + (data?.schedule?.[key]?.length || 0), 0);

  return (
    <div className="sched-page" data-testid="student-schedule-page">

      {/* ── Шапка ── */}
      <header className="sched-header" data-testid="student-schedule-header">
        <div className="sched-header-left">
          <div className="sched-avatar">
            <User size={22} />
          </div>
          <div>
            <h1 className="sched-name" data-testid="student-schedule-student-name">
              {data?.student?.full_name || user.full_name}
            </h1>
            <p className="sched-subtitle" data-testid="student-schedule-title">{t.title}</p>
          </div>
        </div>

        <div className="sched-header-right" data-testid="student-header-actions">
          <button
            className="sched-icon-btn"
            onClick={() => setShowPasswordModal(true)}
            title={t.changePassword}
            data-testid="student-open-password-modal-button"
          >
            <KeyRound size={17} />
          </button>
          <button
            className={`sched-icon-btn ${viewAll ? "active" : ""}`}
            onClick={() => setViewAll((v) => !v)}
            title={t.viewAll}
            data-testid="student-toggle-view-button"
          >
            <LayoutList size={17} />
          </button>
          <Link className="sched-icon-btn" to="/" title={t.home} data-testid="student-go-home-link">
            <Home size={17} />
          </Link>
          <button className="sched-icon-btn danger" onClick={logout} title={t.logout} data-testid="student-logout-button">
            <LogOut size={17} />
          </button>
        </div>
      </header>

      {loading ? (
        <div className="sched-loading" data-testid="student-schedule-loading">
          <div className="sched-spinner" />
          <span>{t.loading}</span>
        </div>
      ) : (
        <div className="sched-body">

          {/* ── Стат-карточка ── */}
          <div className="sched-stat-row">
            <div className="sched-stat-card">
              <GraduationCap size={20} />
              <div>
                <strong>{totalLessons}</strong>
                <span>{t.lessons} / {lang === "ru" ? "неделю" : lang === "en" ? "week" : "апта"}</span>
              </div>
            </div>
            <div className="sched-stat-card accent">
              <Clock size={20} />
              <div>
                <strong>{daysShort[todayIndex]}</strong>
                <span>{t.today}</span>
              </div>
            </div>
          </div>

          {/* ── Табы дней (только в режиме одного дня) ── */}
          {!viewAll && (
            <>
              <div className="sched-day-tabs" data-testid="student-week-grid">
                {DAYS_KEYS.map((dayKey, index) => {
                  const count = data?.schedule?.[dayKey]?.length || 0;
                  const isToday = index === todayIndex;
                  const isActive = index === activeDay;
                  return (
                    <button
                      key={dayKey}
                      className={`sched-day-tab ${isActive ? "active" : ""} ${isToday ? "today" : ""}`}
                      onClick={() => setActiveDay(index)}
                      data-testid={`student-day-card-${dayKey}`}
                    >
                      <span className="sched-day-short">{daysShort[index]}</span>
                      {count > 0 && <span className="sched-day-dot" />}
                    </button>
                  );
                })}
              </div>

              <div className="sched-day-title" data-testid={`student-day-title-${activeDayKey}`}>
                {daysLong[activeDay]}
                {activeDay === todayIndex && <span className="sched-today-badge">{t.today}</span>}
              </div>

              {activeLessons.length === 0 ? (
                <div className="sched-empty" data-testid={`student-day-empty-${activeDayKey}`}>
                  <CalendarEmpty />
                  <p>{t.noLessons}</p>
                </div>
              ) : (
                <div className="sched-lessons" data-testid={`student-day-lessons-${activeDayKey}`}>
                  {activeLessons.map((lesson, index) => (
                    <LessonCard
                      key={`${activeDayKey}-${index}`}
                      lesson={lesson}
                      dayKey={activeDayKey}
                      index={index}
                      t={t}
                    />
                  ))}
                </div>
              )}
            </>
          )}

          {/* ── Все дни сразу ── */}
          {viewAll && (
            <div className="sched-all-days" data-testid="student-week-grid">
              {DAYS_KEYS.map((dayKey, index) => {
                const lessons = data?.schedule?.[dayKey] || [];
                const isToday = index === todayIndex;
                return (
                  <div key={dayKey} className="sched-all-day-block" data-testid={`student-day-card-${dayKey}`}>
                    <div className={`sched-all-day-header ${isToday ? "today" : ""}`}>
                      <span data-testid={`student-day-title-${dayKey}`}>{daysLong[index]}</span>
                      {isToday && <span className="sched-today-badge">{t.today}</span>}
                    </div>
                    {lessons.length === 0 ? (
                      <p className="sched-all-day-empty" data-testid={`student-day-empty-${dayKey}`}>{t.noLessons}</p>
                    ) : (
                      <div className="sched-lessons" data-testid={`student-day-lessons-${dayKey}`}>
                        {lessons.map((lesson, lessonIndex) => (
                          <LessonCard
                            key={`${dayKey}-${lessonIndex}`}
                            lesson={lesson}
                            dayKey={dayKey}
                            index={lessonIndex}
                            t={t}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Модалка смены пароля ── */}
      {showPasswordModal && (
        <div className="confirm-overlay" data-testid="student-password-modal-overlay">
          <div className="confirm-card" data-testid="student-password-modal-card">
            <h3 data-testid="student-password-modal-title">{t.passwordModalTitle}</h3>
            <form
              className="form-grid"
              onSubmit={handleChangePassword}
              data-testid="student-password-change-form"
              style={{ gridTemplateColumns: "1fr" }}
            >
              <input
                type="password"
                placeholder={t.currentPassword}
                value={passwordForm.current_password}
                onChange={(e) => setPasswordForm((prev) => ({ ...prev, current_password: e.target.value }))}
                data-testid="student-current-password-input"
              />
              <input
                type="password"
                placeholder={t.newPassword}
                value={passwordForm.new_password}
                onChange={(e) => setPasswordForm((prev) => ({ ...prev, new_password: e.target.value }))}
                data-testid="student-new-password-input"
              />
              <input
                type="password"
                placeholder={t.confirmPassword}
                value={passwordForm.confirm_password}
                onChange={(e) => setPasswordForm((prev) => ({ ...prev, confirm_password: e.target.value }))}
                data-testid="student-confirm-password-input"
              />
              <div style={{ display: "flex", gap: "0.75rem" }} data-testid="student-password-modal-actions">
                <button
                  type="submit"
                  className="primary-btn"
                  disabled={changingPassword}
                  style={{ flex: 1, justifyContent: "center" }}
                  data-testid="student-change-password-button"
                >
                  {changingPassword ? t.saving : t.save}
                </button>
                <button
                  type="button"
                  className="danger-btn"
                  onClick={() => setShowPasswordModal(false)}
                  style={{ flex: 1, justifyContent: "center" }}
                  data-testid="student-close-password-modal-button"
                >
                  {t.close}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// Карточка урока — переиспользуется в обоих режимах
function LessonCard({ lesson, dayKey, index, t }) {
  return (
    <article
      className="sched-lesson-card"
      data-testid={`student-lesson-${dayKey}-${index}`}
    >
      <div className="sched-lesson-time" data-testid={`student-lesson-time-${dayKey}-${index}`}>
        <Clock size={14} />
        {lesson.start} — {lesson.end}
      </div>
      <div className="sched-lesson-info">
        <div className="sched-lesson-row" data-testid={`student-lesson-group-${dayKey}-${index}`}>
          <GraduationCap size={14} />
          <span>{lesson.group_name}</span>
        </div>
        <div className="sched-lesson-row" data-testid={`student-lesson-teacher-${dayKey}-${index}`}>
          <User size={14} />
          <span>{lesson.teacher_name}</span>
        </div>
        <div className="sched-lesson-row" data-testid={`student-lesson-classroom-${dayKey}-${index}`}>
          <MapPin size={14} />
          <span>{t.cabinet} {lesson.classroom_name}</span>
        </div>
      </div>
    </article>
  );
}

// Иконка пустого состояния
function CalendarEmpty() {
  return (
    <svg width="56" height="56" viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ opacity: 0.25 }}>
      <rect x="4" y="10" width="48" height="42" rx="6" stroke="currentColor" strokeWidth="2.5" />
      <path d="M4 22H52" stroke="currentColor" strokeWidth="2.5" />
      <path d="M18 4V14M38 4V14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="28" cy="36" r="6" stroke="currentColor" strokeWidth="2" />
      <path d="M25 36h6M28 33v6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}