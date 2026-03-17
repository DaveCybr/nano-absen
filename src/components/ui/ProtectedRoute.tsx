import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";

interface ProtectedRouteProps {
  allowedRoles?: string[];
}

export default function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
  const { session, employee, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500">Memuat...</p>
        </div>
      </div>
    );
  }

  if (!session) return <Navigate to="/auth/login" replace />;

  if (!employee) return <Navigate to="/auth/unauthorized" replace />;

  if (allowedRoles && !allowedRoles.includes(employee.access_type)) {
    return <Navigate to="/auth/unauthorized" replace />;
  }

  return <Outlet />;
}
