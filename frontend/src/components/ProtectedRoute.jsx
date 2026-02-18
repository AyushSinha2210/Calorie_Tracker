import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const ProtectedRoute = ({ children }) => useAuth().user ? children : <Navigate to="/login" replace />;
export default ProtectedRoute;
