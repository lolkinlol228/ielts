import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api, authConfig } from "../lib/api";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(localStorage.getItem("token") || "");
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem("user");
    return raw ? JSON.parse(raw) : null;
  });
  const [loading, setLoading] = useState(Boolean(token));

  const login = async ({ username, password, branch_id }) => {
    const payload = { username, password, branch_id: branch_id || null };
    const response = await api.post("/api/auth/login", payload);
    localStorage.setItem("token", response.data.token);
    localStorage.setItem("user", JSON.stringify(response.data.user));
    setToken(response.data.token);
    setUser(response.data.user);
    return response.data.user;
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setToken("");
    setUser(null);
  };

  useEffect(() => {
    const restore = async () => {
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const response = await api.get("/api/auth/me", authConfig(token));
        setUser(response.data);
        localStorage.setItem("user", JSON.stringify(response.data));
      } catch {
        logout();
      } finally {
        setLoading(false);
      }
    };
    restore();
  }, [token]);

  const value = useMemo(
    () => ({ token, user, loading, login, logout, isAuthenticated: Boolean(token && user) }),
    [token, user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};
