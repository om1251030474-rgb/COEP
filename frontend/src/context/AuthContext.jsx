import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";

const AuthContext = createContext(null);

const STORAGE_USER_KEY = "droneguard_user";
const STORAGE_USERS_KEY = "droneguard_users";

const MASTER_ADMIN_EMAIL = "generaladmin@gmail.com";
const MASTER_ADMIN_PASSWORD = "Admin@123";

function saveUsers(users) {
  localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(users));
}

function loadUser() {
  try {
    const stored = localStorage.getItem(STORAGE_USER_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

function loadUsers() {
  try {
    const users = JSON.parse(localStorage.getItem(STORAGE_USERS_KEY) || "[]");

    // Ensure a protected super-admin account always exists (never removable)
    const hasMaster = users.some((u) => u.email === MASTER_ADMIN_EMAIL);
    if (!hasMaster) {
      users.push({
        name: "General Admin",
        email: MASTER_ADMIN_EMAIL,
        password: MASTER_ADMIN_PASSWORD,
        role: "admin",
        isSuperAdmin: true,
      });
      saveUsers(users);
    }

    return users;
  } catch {
    return [];
  }
}

export function AuthProvider({ children }) {
  const navigate = useNavigate();
  const [user, setUser] = useState(() => loadUser());
  const [error, setError] = useState(null);

  useEffect(() => {
    // keep localStorage in sync when user changes
    if (user) {
      localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(STORAGE_USER_KEY);
    }
  }, [user]);

  const signup = ({ name, email, password }) => {
    const users = loadUsers();
    const existing = users.find((u) => u.email === email.toLowerCase());
    if (existing) {
      throw new Error("An account with that email already exists.");
    }

    const newUser = {
      name,
      email: email.toLowerCase(),
      password,
      role: "user",
      isSuperAdmin: false,
    };

    users.push(newUser);
    saveUsers(users);

    setUser({
      name,
      email: email.toLowerCase(),
      role: "user",
      isSuperAdmin: false,
    });
    setError(null);
    navigate("/dashboard", { replace: true });
  };

  const login = ({ email, password, isAdmin = false }) => {
    const users = loadUsers();
    const matched = users.find(
      (u) => u.email === email.toLowerCase() && u.password === password,
    );
    if (!matched) {
      throw new Error("Invalid email or password.");
    }

    if (isAdmin && matched.role !== "admin") {
      throw new Error("Access denied. Admin privileges required.");
    }

    setUser({
      name: matched.name,
      email: matched.email,
      role: matched.role,
      isSuperAdmin: matched.isSuperAdmin || false,
    });
    setError(null);
    navigate("/dashboard", { replace: true });
  };

  const logout = () => {
    setUser(null);
    setError(null);
    navigate("/", { replace: true });
  };

  const addUser = ({ name, email, password, role = "user" }) => {
    if (!user?.isSuperAdmin) {
      throw new Error("Only the super admin can add users.");
    }

    const users = loadUsers();
    const existing = users.find((u) => u.email === email.toLowerCase());
    if (existing) {
      throw new Error("An account with that email already exists.");
    }

    users.push({
      name,
      email: email.toLowerCase(),
      password,
      role,
      isSuperAdmin: false,
    });

    saveUsers(users);
  };

  const removeUser = (email) => {
    if (!user?.isSuperAdmin) {
      throw new Error("Only the super admin can remove users.");
    }

    const users = loadUsers();
    const filtered = users.filter((u) => u.email !== email.toLowerCase());
    saveUsers(filtered);
  };

  const setUserRole = (email, role) => {
    if (!user?.isSuperAdmin) {
      throw new Error("Only the super admin can change roles.");
    }

    const users = loadUsers();
    const target = users.find((u) => u.email === email.toLowerCase());
    if (!target) {
      throw new Error("User not found.");
    }

    // Never modify super admin role
    if (target.isSuperAdmin) {
      throw new Error("Cannot modify the super admin role.");
    }

    target.role = role;
    saveUsers(users);
  };

  const value = useMemo(
    () => ({
      user,
      error,
      isAuthenticated: Boolean(user),
      isAdmin: user?.role === "admin",
      isSuperAdmin: user?.isSuperAdmin === true,
      login,
      logout,
      signup,
      addUser,
      removeUser,
      setUserRole,
      setError,
    }),
    [user, error, login, logout, signup],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
