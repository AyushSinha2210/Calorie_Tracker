import { createContext, useContext, useEffect, useState, useMemo, useCallback } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../firebase";
import { doc, setDoc, onSnapshot, serverTimestamp } from "firebase/firestore";

const AuthContext = createContext();

// Throttle lastActive writes — max once per 30 minutes per session
const LAST_ACTIVE_THROTTLE_MS = 30 * 60 * 1000;
let _lastActiveWrittenAt = 0;

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profileComplete, setProfileComplete] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);
  const [userProfile, setUserProfile] = useState(null);

  useEffect(() => onAuthStateChanged(auth, (u) => {
    setUser(u);
    setLoading(false);
    if (u) {
      const now = Date.now();
      if (now - _lastActiveWrittenAt >= LAST_ACTIVE_THROTTLE_MS) {
        _lastActiveWrittenAt = now;
        setDoc(doc(db, "users", u.uid), { lastActive: serverTimestamp() }, { merge: true }).catch(() => {});
      }
    } else {
      setProfileComplete(false);
      setProfileLoading(false);
      setUserProfile(null);
    }
  }), []);

  // Listen to user doc for profileComplete flag
  useEffect(() => {
    if (!user) return; // Don't touch profileLoading here — first effect handles logout
    setProfileLoading(true);
    const unsub = onSnapshot(doc(db, "users", user.uid), (snap) => {
      const data = snap.data();
      setProfileComplete(!!data?.profileComplete);
      setUserProfile(data || null);
      setProfileLoading(false);
    }, () => { setProfileLoading(false); });
    return unsub;
  }, [user]);

  const markProfileComplete = useCallback(async () => {
    if (!user) return;
    await setDoc(doc(db, "users", user.uid), { profileComplete: true }, { merge: true });
    setProfileComplete(true);
  }, [user]);

  const value = useMemo(() => ({
    user, loading, profileComplete, profileLoading, markProfileComplete, userProfile,
  }), [user, loading, profileComplete, profileLoading, markProfileComplete, userProfile]);

  return <AuthContext.Provider value={value}>{!loading && children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
