import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

export function ProtectedRoute({
  children,
  adminOnly = false,
  superAdminOnly = false,
}) {
  const { isAuthenticated, isAdmin, isSuperAdmin } = useAuth();

  if (!isAuthenticated) {
    return (
      <Navigate
        to={adminOnly || superAdminOnly ? "/admin-login" : "/login"}
        replace
      />
    );
  }

  if (superAdminOnly && !isSuperAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  if (adminOnly && !isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
