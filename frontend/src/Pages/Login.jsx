import { useState } from "react";
import { signInWithEmailAndPassword, signInWithPopup } from "firebase/auth";
import { auth, googleProvider, db } from "../firebase";
import { useNavigate, Link } from "react-router-dom";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const saveUserToDB = async (user) => {
    const ref = doc(db, "users", user.uid);
    const snap = await getDoc(ref);
    await setDoc(ref, snap.exists() ? { lastLogin: serverTimestamp(), lastActive: serverTimestamp() } : { name: user.displayName, email: user.email, photo: user.photoURL, createdAt: serverTimestamp(), lastActive: serverTimestamp() }, { merge: true });
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { user: loggedInUser } = await signInWithEmailAndPassword(auth, email, password);
      if (!loggedInUser.emailVerified) {
        navigate("/verify-email");
        return;
      }
      await saveUserToDB(loggedInUser);
      navigate("/dashboard");
    } catch { setError("Invalid email or password."); }
    finally { setLoading(false); }
  };

  const handleGoogleLogin = async () => {
    setError(""); setLoading(true);
    try {
      await saveUserToDB((await signInWithPopup(auth, googleProvider)).user);
      navigate("/dashboard");
    } catch (e) { setError(e.message || "Google login failed."); }
    finally { setLoading(false); }
  };

  return (
    <div><div>
      <h2>Login</h2>
      <form onSubmit={handleLogin}>
        {error && <div>{error}</div>}
        <div><label htmlFor="email">Email</label><input type="email" id="email" placeholder="Enter your email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
        <div><label htmlFor="password">Password</label><input type="password" id="password" placeholder="Enter your password" value={password} onChange={(e) => setPassword(e.target.value)} required /></div>
        <div style={{ textAlign: 'right', marginTop: '-4px', marginBottom: '12px' }}><Link to="/forgot-password" style={{ fontSize: '13px', color: '#667eea', textDecoration: 'none', fontWeight: 600 }}>Forgot Password?</Link></div>
        <button type="submit" disabled={loading}>{loading ? "Logging in..." : "Login"}</button>
      </form>
      <div>OR</div>
      <button onClick={handleGoogleLogin} disabled={loading}>{loading ? "Logging in..." : "Login with Google"}</button>
      <p>Don't have an account? <Link to="/register">Register here</Link></p>
    </div></div>
  );
}

export default Login;
