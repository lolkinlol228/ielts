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

  return (
    <div className="student-page" data-testid="student-schedule-page">
      <header className="student-header" data-testid="student-schedule-header">
        <div>
          <h1 data-testid="student-schedule-title">Расписание занятий</h1>
          <p data-testid="student-schedule-student-name">{data?.student?.full_name || user.full_name}</p>
        </div>
        <div className="inline-form compact" data-testid="student-header-actions">
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
    </div>
  );
}
