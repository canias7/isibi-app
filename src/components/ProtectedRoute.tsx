import { Navigate } from "react-router-dom";

interface ProtectedRouteProps {
  children: React.ReactNode;
  /** If provided, also checks localStorage "account_type" matches */
  accountType?: "developer" | "customer";
  /** Where to redirect if not authenticated */
  loginPath?: string;
}

export default function ProtectedRoute({
  children,
  accountType,
  loginPath = "/login",
}: ProtectedRouteProps) {
  const token = localStorage.getItem("token");
  if (!token) {
    return <Navigate to={loginPath} replace />;
  }
  // If a specific account type is required, verify it
  if (accountType) {
    const storedType = localStorage.getItem("account_type");
    // Treat missing account_type as "developer" for backward compatibility
    const effectiveType = storedType ?? "developer";
    if (effectiveType !== accountType) {
      return <Navigate to={loginPath} replace />;
    }
  }
  return <>{children}</>;
}
