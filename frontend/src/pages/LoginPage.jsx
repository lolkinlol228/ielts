import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { api } from "../lib/api";
import { useAuth } from "../contexts/AuthContext";

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, user, isAuthenticated } = useAuth();
  const [branches, setBranches] = useState([]);
  const [form, setForm] = useState({ username: "", password: "", branch_id: "" });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api
      .get("/api/public/branches")
      .then((response) => {
        setBranches(response.data);
        if (response.data[0]?.id) {
          setForm((prev) => ({ ...prev, branch_id: response.data[0].id }));
        }
      })
      .catch(() => toast.error("Не удалось загрузить филиалы"));
  }, []);

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
        <h1 data-testid="login-title">Вход в систему</h1>
        <p data-testid="login-subtitle">Для администратора: admin / admin123</p>

        <label data-testid="login-label-branch">Филиал</label>
        <select
          value={form.branch_id}
          onChange={(event) => setForm((prev) => ({ ...prev, branch_id: event.target.value }))}
          data-testid="login-branch-select"
        >
          <option value="">Без филиала (для superadmin)</option>
          {branches.map((branch) => (
            <option key={branch.id} value={branch.id}>
              {branch.name} — {branch.location}
            </option>
          ))}
        </select>

        <label data-testid="login-label-username">Логин</label>
        <input
          value={form.username}
          onChange={(event) => setForm((prev) => ({ ...prev, username: event.target.value }))}
          data-testid="login-input-username"
        />

        <label data-testid="login-label-password">Пароль</label>
        <input
          type="password"
          value={form.password}
          onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
          data-testid="login-input-password"
        />

        <button type="submit" className="primary-btn" disabled={loading} data-testid="login-submit-button">
          {loading ? "Вход..." : "Войти"}
        </button>
      </form>
    </div>
  );
}
