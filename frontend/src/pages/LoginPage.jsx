import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Lock, User } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../contexts/AuthContext";

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, user, isAuthenticated } = useAuth();
  const [form, setForm] = useState({ username: "", password: "" });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) return;
    if (user?.role === "student") {
      navigate("/student/schedule", { replace: true });
      return;
    }
    navigate("/admin", { replace: true });
  }, [isAuthenticated, navigate, user]);

  const submit = async (event) => {
    event.preventDefault();
    setLoading(true);
    try {
      const loggedInUser = await login(form);
      toast.success("Успешный вход");
      if (loggedInUser.role === "student") {
        navigate("/student/schedule");
      } else {
        navigate("/admin");
      }
    } catch (error) {
      toast.error(error?.response?.data?.detail || "Ошибка входа");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page" data-testid="login-page-root">
      <form className="auth-card" onSubmit={submit} data-testid="login-form">
        <Link to="/" className="ghost-link" data-testid="login-back-to-home-link">
          <ArrowLeft size={16} /> Вернуться на главную
        </Link>
        <h1 data-testid="login-title">Вход в систему</h1>
        <p data-testid="login-subtitle">Введите данные для доступа к платформе</p>

        <label data-testid="login-label-username">
          Логин
          <input
            value={form.username}
            onChange={(event) => setForm((prev) => ({ ...prev, username: event.target.value }))}
            placeholder="Введите ваш логин"
            data-testid="login-input-username"
          />
        </label>

        <label data-testid="login-label-password">
          Пароль
          <input
            type="password"
            value={form.password}
            onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
            placeholder="Введите ваш пароль"
            data-testid="login-input-password"
          />
        </label>

        <button type="submit" className="primary-btn" disabled={loading} data-testid="login-submit-button" style={{ width: "100%", justifyContent: "center", marginTop: "0.5rem" }}>
          {loading ? "Вход..." : "Войти"}
        </button>
      </form>
    </div>
  );
}
