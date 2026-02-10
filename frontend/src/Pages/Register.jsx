import { useState } from "react";
import { createUserWithEmailAndPassword, signInWithPopup } from "firebase/auth";
import { auth, googleProvider, db } from "../firebase";
import { useNavigate, Link } from "react-router-dom";
import "./Auth.css";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";

function Register() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    try {
      setLoading(true);
      const result = await createUserWithEmailAndPassword(auth, email, password);
      await saveUserToDB(result.user);
      navigate("/dashboard");
    } catch (err) {
      setError(err.message);
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

  const handleGoogleSignUp = async () => {
    setError("");
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      await saveUserToDB(result.user);
      navigate("/dashboard");
    } catch (err) {
      console.error("Google sign-up error:", err);
      setError(err.message || "Failed to sign up with Google. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h2>Create Account</h2>

        <form onSubmit={handleRegister}>
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

          <div className="form-group">
            <label htmlFor="confirmPassword">Confirm Password</label>
            <input
              type="password"
              id="confirmPassword"
              placeholder="Confirm your password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" disabled={loading} className="auth-button">
            {loading ? "Creating Account..." : "Register"}
          </button>
        </form>

        <div style={{ margin: "20px 0", textAlign: "center", color: "#999" }}>OR</div>

        <button onClick={handleGoogleSignUp} disabled={loading} className="auth-button" style={{ background: "#4285f4" }}>
          {loading ? "Signing up..." : "Sign up with Google"}
        </button>

        <p className="auth-link">
          Already have an account? <Link to="/login">Login here</Link>
        </p>
      </div>
    </div>
  );
}

export default Register;
