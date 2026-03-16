import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { BookOpen, CalendarDays, LogOut } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../contexts/AuthContext";
import { api, authConfig } from "../lib/api";

const DAYS = ["ПН", "ВТ", "СР", "ЧТ", "ПТ", "СБ", "ВС"];

export default function StudentSchedulePage() {
  const { user, token, logout } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ current_password: "", new_password: "", confirm_password: "" });
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    if (!token) return;
    api
      .get("/api/student/schedule", authConfig(token))
      .then((response) => setData(response.data))
      .catch(() => toast.error("Не удалось загрузить расписание"))
      .finally(() => setLoading(false));
  }, [token]);

  if (!user || user.role !== "student") {
    return <Navigate to="/" replace />;
  }

  const handleChangePassword = async (event) => {
    event.preventDefault();
    if (!passwordForm.current_password || !passwordForm.new_password || !passwordForm.confirm_password) {
      toast.error("Заполните все поля для смены пароля");
      return;
    }
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      toast.error("Новый пароль и подтверждение не совпадают");
      return;
    }
    setChangingPassword(true);
    try {
      const response = await api.put("/api/student/change-password", passwordForm, authConfig(token));
      toast.success(response.data.message || "Пароль изменен");
      setPasswordForm({ current_password: "", new_password: "", confirm_password: "" });
      setShowPasswordModal(false);
    } catch (error) {
      toast.error(error?.response?.data?.detail || "Ошибка смены пароля");
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <div className="student-page" data-testid="student-schedule-page">
      <header className="student-header" data-testid="student-schedule-header">
        <div>
          <h1 data-testid="student-schedule-title">Расписание занятий</h1>
          <p data-testid="student-schedule-student-name">{data?.student?.full_name || user.full_name}</p>
        </div>
        <div className="inline-form compact" data-testid="student-header-actions">
          <button
            className="primary-btn"
            onClick={() => setShowPasswordModal(true)}
            data-testid="student-open-password-modal-button"
          >
            Изменить пароль
          </button>
          <Link className="primary-btn" to="/" data-testid="student-go-home-link">
            <BookOpen size={16} /> Главная
          </Link>
          <button className="danger-btn" onClick={logout} data-testid="student-logout-button">
            <LogOut size={16} /> Выйти
          </button>
        </div>
      </header>

      {loading ? (
        <div className="card" data-testid="student-schedule-loading">Загрузка...</div>
      ) : (
        <div className="week-grid" data-testid="student-week-grid">
          {DAYS.map((day) => (
            <section key={day} className="card" data-testid={`student-day-card-${day}`}>
              <h2 data-testid={`student-day-title-${day}`}>
                <CalendarDays size={16} /> {day}
              </h2>
              {(data?.schedule?.[day] || []).length === 0 ? (
                <p data-testid={`student-day-empty-${day}`}>Занятий нет</p>
              ) : (
                <div className="simple-list" data-testid={`student-day-lessons-${day}`}>
                  {data.schedule[day].map((lesson, index) => (
                    <article key={`${day}-${index}`} className="lesson-card" data-testid={`student-lesson-${day}-${index}`}>
                      <strong data-testid={`student-lesson-time-${day}-${index}`}>
                        {lesson.start} - {lesson.end}
                      </strong>
                      <p data-testid={`student-lesson-group-${day}-${index}`}>{lesson.group_name}</p>
                      <p data-testid={`student-lesson-teacher-${day}-${index}`}>{lesson.teacher_name}</p>
                      <p data-testid={`student-lesson-classroom-${day}-${index}`}>Кабинет: {lesson.classroom_name}</p>
                    </article>
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
      )}

      {showPasswordModal && (
        <div className="confirm-overlay" data-testid="student-password-modal-overlay">
          <div className="confirm-card" data-testid="student-password-modal-card">
            <h3 data-testid="student-password-modal-title">Смена пароля</h3>
            <form className="form-grid" onSubmit={handleChangePassword} data-testid="student-password-change-form">
              <input
                type="password"
                placeholder="Текущий пароль"
                value={passwordForm.current_password}
                onChange={(event) => setPasswordForm((prev) => ({ ...prev, current_password: event.target.value }))}
                data-testid="student-current-password-input"
              />
              <input
                type="password"
                placeholder="Новый пароль"
                value={passwordForm.new_password}
                onChange={(event) => setPasswordForm((prev) => ({ ...prev, new_password: event.target.value }))}
                data-testid="student-new-password-input"
              />
              <input
                type="password"
                placeholder="Повторите новый пароль"
                value={passwordForm.confirm_password}
                onChange={(event) => setPasswordForm((prev) => ({ ...prev, confirm_password: event.target.value }))}
                data-testid="student-confirm-password-input"
              />
              <div className="inline-form compact" data-testid="student-password-modal-actions">
                <button type="submit" className="primary-btn" disabled={changingPassword} data-testid="student-change-password-button">
                  {changingPassword ? "Сохраняем..." : "Сохранить"}
                </button>
                <button
                  type="button"
                  className="danger-btn"
                  onClick={() => setShowPasswordModal(false)}
                  data-testid="student-close-password-modal-button"
                >
                  Закрыть
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
