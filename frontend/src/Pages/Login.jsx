import { useState } from "react";
import { signInWithEmailAndPassword, signInWithPopup } from "firebase/auth";
import { auth, googleProvider, db } from "../firebase";
import { useNavigate, Link } from "react-router-dom";
import "./Auth.css";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";


function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    
    try {
      setLoading(true);
      const result = await signInWithEmailAndPassword(auth, email, password);
      await saveUserToDB(result.user);
      navigate("/dashboard");
    } catch (err) {
      console.error("Login error:", err);
      setError("Invalid email or password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const saveUserToDB = async (user) => {
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
      await setDoc(
        userRef,
        { lastLogin: serverTimestamp() },
        { merge: true }
      );
    } else {
      await setDoc(userRef, {
        name: user.displayName,
        email: user.email,
        photo: user.photoURL,
        createdAt: serverTimestamp(),
      });
    }
  };

  const handleGoogleLogin = async () => {
    setError("");
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      await saveUserToDB(result.user);
      navigate("/dashboard");
    } catch (err) {
      console.error("Google login error:", err);
      setError(err.message || "Failed to login with Google. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h2>Login</h2>

        <form onSubmit={handleLogin}>
          {error && <div className="error-message">{error}</div>}
          
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" disabled={loading} className="auth-button">
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>

        <div style={{ margin: "20px 0", textAlign: "center", color: "#999" }}>OR</div>

        <button onClick={handleGoogleLogin} disabled={loading} className="auth-button" style={{ background: "#4285f4" }}>
          {loading ? "Logging in..." : "Login with Google"}
        </button>

        <p className="auth-link">
          Don't have an account? <Link to="/register">Register here</Link>
        </p>
      </div>
    </div>
  );
}

export default Login;
