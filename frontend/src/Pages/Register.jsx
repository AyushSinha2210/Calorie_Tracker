import { useState } from "react";
import { createUserWithEmailAndPassword, signInWithPopup } from "firebase/auth";
import { auth, googleProvider, db } from "../firebase";
import { useNavigate, Link } from "react-router-dom";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";

function Register() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const saveUserToDB = async (user) => {
    const ref = doc(db, "users", user.uid);
    const snap = await getDoc(ref);
    await setDoc(ref, snap.exists() ? { lastLogin: serverTimestamp() } : { name: user.displayName, email: user.email, photo: user.photoURL, createdAt: serverTimestamp() }, { merge: true });
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");
    if (password !== confirmPassword) return setError("Passwords do not match");
    if (password.length < 6) return setError("Password must be at least 6 characters");
    setLoading(true);
    try {
      await saveUserToDB((await createUserWithEmailAndPassword(auth, email, password)).user);
      navigate("/dashboard");
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const handleGoogleSignUp = async () => {
    setError(""); setLoading(true);
    try {
      await saveUserToDB((await signInWithPopup(auth, googleProvider)).user);
      navigate("/dashboard");
    } catch (e) { setError(e.message || "Google sign-up failed."); }
    finally { setLoading(false); }
  };

  return (
    <div><div>
      <h2>Create Account</h2>
      <form onSubmit={handleRegister}>
        {error && <div>{error}</div>}
        <div><label htmlFor="email">Email</label><input type="email" id="email" placeholder="Enter your email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
        <div><label htmlFor="password">Password</label><input type="password" id="password" placeholder="Enter your password" value={password} onChange={(e) => setPassword(e.target.value)} required /></div>
        <div><label htmlFor="confirmPassword">Confirm Password</label><input type="password" id="confirmPassword" placeholder="Confirm your password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required /></div>
        <button type="submit" disabled={loading}>{loading ? "Creating Account..." : "Register"}</button>
      </form>
      <div>OR</div>
      <button onClick={handleGoogleSignUp} disabled={loading}>{loading ? "Signing up..." : "Sign up with Google"}</button>
      <p>Already have an account? <Link to="/login">Login here</Link></p>
    </div></div>
  );
}

export default Register;
