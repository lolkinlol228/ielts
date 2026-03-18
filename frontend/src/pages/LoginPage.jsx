import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../contexts/AuthContext";

const TEXT = {
  ru: {
    back: "Вернуться на главную",
    title: "Вход в систему",
    subtitle: "Введите данные для доступа к платформе",
    username: "Логин",
    usernamePlaceholder: "Введите ваш логин",
    password: "Пароль",
    passwordPlaceholder: "Введите ваш пароль",
    submit: "Войти",
    loading: "Вход...",
    successToast: "Успешный вход",
    errorToast: "Ошибка входа",
  },
  en: {
    back: "Back to home",
    title: "Sign in",
    subtitle: "Enter your credentials to access the platform",
    username: "Username",
    usernamePlaceholder: "Enter your username",
    password: "Password",
    passwordPlaceholder: "Enter your password",
    submit: "Sign in",
    loading: "Signing in...",
    successToast: "Logged in successfully",
    errorToast: "Login error",
  },
  kk: {
    back: "Басты бетке оралу",
    title: "Жүйеге кіру",
    subtitle: "Платформаға кіру үшін деректеріңізді енгізіңіз",
    username: "Логин",
    usernamePlaceholder: "Логиніңізді енгізіңіз",
    password: "Құпия сөз",
    passwordPlaceholder: "Құпия сөзіңізді енгізіңіз",
    submit: "Кіру",
    loading: "Кіру...",
    successToast: "Сәтті кірдіңіз",
    errorToast: "Кіру қатесі",
  },
};

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, user, isAuthenticated } = useAuth();
  const [form, setForm] = useState({ username: "", password: "" });
  const [loading, setLoading] = useState(false);

  const lang = localStorage.getItem("lang") || "ru";
  const t = TEXT[lang] || TEXT.ru;

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
      toast.success(t.successToast);
      if (loggedInUser.role === "student") {
        navigate("/student/schedule");
      } else {
        navigate("/admin");
      }
    } catch (error) {
      toast.error(error?.response?.data?.detail || t.errorToast);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page" data-testid="login-page-root">
      <form className="auth-card" onSubmit={submit} data-testid="login-form">
        <Link to="/" className="ghost-link" data-testid="login-back-to-home-link">
          <ArrowLeft size={16} /> {t.back}
        </Link>

        <h1 data-testid="login-title">{t.title}</h1>
        <p data-testid="login-subtitle">{t.subtitle}</p>

        <label data-testid="login-label-username">
          {t.username}
          <input
            value={form.username}
            onChange={(event) => setForm((prev) => ({ ...prev, username: event.target.value }))}
            placeholder={t.usernamePlaceholder}
            data-testid="login-input-username"
          />
        </label>

        <label data-testid="login-label-password">
          {t.password}
          <input
            type="password"
            value={form.password}
            onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
            placeholder={t.passwordPlaceholder}
            data-testid="login-input-password"
          />
        </label>

        <button
          type="submit"
          className="primary-btn"
          disabled={loading}
          data-testid="login-submit-button"
          style={{ width: "100%", justifyContent: "center", marginTop: "0.5rem" }}
        >
          {loading ? t.loading : t.submit}
        </button>
      </form>
    </div>
  );
}