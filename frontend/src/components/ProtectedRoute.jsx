import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const ProtectedRoute = ({ children, skipProfileCheck = false }) => {
  const { user, profileComplete, profileLoading } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (!user.emailVerified) return <Navigate to="/verify-email" replace />;
  if (profileLoading) return <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>Loading...</div>;
  if (!skipProfileCheck && !profileComplete) return <Navigate to="/profile-setup" replace />;
  return children;
};
export default ProtectedRoute;
