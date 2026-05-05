import { Navigate, useLocation } from "react-router-dom";
import { getNeedsOnboarding, getToken } from "@/lib/auth";

export function ProtectedRoute({ children }: { children: JSX.Element }) {
  const location = useLocation();
  const authed = Boolean(getToken());
  const needsOnboarding = getNeedsOnboarding();
  if (!authed) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  if (needsOnboarding && location.pathname !== "/onboarding-health") {
    return <Navigate to="/onboarding-health" replace />;
  }
  return children;
}

