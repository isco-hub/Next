import { Navigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { roleHome } from "../lib/roles";

export const DashboardRedirect = () => {
  const { user } = useAuth();
  return <Navigate to={user ? roleHome(user.role) : "/sign-in"} replace />;
};
