import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { doc, setDoc, collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { motion } from "framer-motion";
import BrandLogo from "../components/ui/BrandLogo";

const labelCls = "block text-xs font-bold text-dark-muted uppercase tracking-wider mb-1";
const inpCls =
  "w-full px-3.5 py-2.5 rounded-xl border border-dark-border/80 bg-dark-surface-2 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all placeholder:text-dark-muted/60 text-dark-text text-sm";
const selectCls =
  "h-[42px] rounded-xl border border-dark-border/80 bg-dark-surface-2 px-3 text-xs font-bold focus:outline-none focus:border-emerald-500 cursor-pointer text-dark-text";

function ProfileSetup() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState(user?.displayName || "");

  useEffect(() => {
    if (user?.displayName && !name) {
      setName(user.displayName);
    }
  }, [user?.displayName, name]);
  const [age, setAge] = useState("");
  const [weight, setWeight] = useState("");
  const [weightUnit, setWeightUnit] = useState("kg");
  const [height, setHeight] = useState("");
  const [heightUnit, setHeightUnit] = useState("cm");
  const [calorieTarget, setCalorieTarget] = useState("");
  const [gender, setGender] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!name.trim() || !age || !weight || !height || !calorieTarget || !gender) {
      return setError("All fields are required.");
    }
    const ageNum = Number(age);
    if (ageNum < 10 || ageNum > 120) return setError("Age must be between 10 and 120.");
    const wNum = Number(weight);
    if (wNum < 20 || wNum > 700) return setError("Please enter a valid weight.");
    const hNum = Number(height);
    if (hNum < (heightUnit === "ft" ? 1 : 50) || hNum > (heightUnit === "ft" ? 10 : 300))
      return setError("Please enter a valid height.");
    const calNum = Number(calorieTarget);
    if (calNum < 500 || calNum > 10000)
      return setError("Calorie target must be between 500 and 10,000.");

    setLoading(true);
    try {
      const wKg = weightUnit === "lbs" ? +(wNum * 0.453592).toFixed(1) : +wNum.toFixed(1);
      const hCm = heightUnit === "ft" ? +(hNum * 30.48).toFixed(1) : +hNum.toFixed(1);

      await setDoc(
        doc(db, "users", user.uid),
        {
          name: name.trim(),
          age: ageNum,
          weight: wKg,
          weightUnit,
          originalWeight: wNum,
          height: hCm,
          heightUnit,
          originalHeight: hNum,
          dailyCalorieTarget: calNum,
          gender,
          profileComplete: true,
          lastRecordedWeight: wKg,
          lastWeightLogDate: new Date().toISOString().split("T")[0],
          lastActive: serverTimestamp(),
        },
        { merge: true }
      );

      // Bi-directional sync: write initial weight log
      const today = new Date().toISOString().split("T")[0];
      await addDoc(collection(db, "users", user.uid, "weightLogs"), {
        weight: wKg,
        originalWeight: wNum,
        unit: weightUnit,
        date: today,
        source: "profile",
        createdAt: serverTimestamp(),
      });

      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(err.message || "Failed to save profile.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-dark-bg text-dark-text p-4 relative overflow-hidden">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative w-full max-w-[440px] my-8 z-10"
      >
        <div className="flex justify-center mb-7">
          <BrandLogo size="lg" to="/" />
        </div>

        <div className="card p-8 bg-dark-surface/90 border-dark-border/80 shadow-2xl">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-extrabold text-white tracking-tight">Set up your profile</h2>
            <p className="text-dark-muted text-xs mt-1">
              Welcome, <span className="text-emerald-400 font-bold">{user?.displayName || user?.email}</span>! Set your baseline goals.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-rose-500/10 text-rose-400 px-4 py-2.5 rounded-xl text-xs font-semibold border border-rose-500/20">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="name" className={labelCls}>
                Full Name
              </label>
              <input
                type="text"
                id="name"
                placeholder="e.g. Alex Smith"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className={inpCls}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="age" className={labelCls}>
                  Age
                </label>
                <input
                  type="number"
                  id="age"
                  placeholder="25"
                  min="10"
                  max="120"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  required
                  className={inpCls}
                />
              </div>
              <div>
                <label htmlFor="gender" className={labelCls}>
                  Gender
                </label>
                <select
                  id="gender"
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  required
                  className={`${selectCls} w-full`}
                >
                  <option value="">Select</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="calorieTarget" className={labelCls}>
                Daily Calorie Target (kcal)
              </label>
              <input
                type="number"
                id="calorieTarget"
                placeholder="2000"
                min="500"
                max="10000"
                value={calorieTarget}
                onChange={(e) => setCalorieTarget(e.target.value)}
                required
                className={inpCls}
              />
            </div>

            <div className="grid grid-cols-[1fr_auto] gap-2 items-end">
              <div>
                <label htmlFor="weight" className={labelCls}>
                  Current Weight
                </label>
                <input
                  type="number"
                  id="weight"
                  placeholder={weightUnit === "kg" ? "70" : "154"}
                  step="0.1"
                  min="20"
                  max="700"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  required
                  className={inpCls}
                />
              </div>
              <select
                value={weightUnit}
                onChange={(e) => setWeightUnit(e.target.value)}
                className={selectCls}
              >
                <option value="kg">kg</option>
                <option value="lbs">lbs</option>
              </select>
            </div>

            <div className="grid grid-cols-[1fr_auto] gap-2 items-end">
              <div>
                <label htmlFor="height" className={labelCls}>
                  Height
                </label>
                <input
                  type="number"
                  id="height"
                  placeholder={heightUnit === "cm" ? "175" : "5.9"}
                  step="0.1"
                  min={heightUnit === "ft" ? "1" : "50"}
                  max={heightUnit === "ft" ? "10" : "300"}
                  value={height}
                  onChange={(e) => setHeight(e.target.value)}
                  required
                  className={inpCls}
                />
              </div>
              <select
                value={heightUnit}
                onChange={(e) => setHeightUnit(e.target.value)}
                className={selectCls}
              >
                <option value="cm">cm</option>
                <option value="ft">ft</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 mt-4 bg-gradient-to-r from-emerald-500 to-lime-500 text-dark-bg font-extrabold rounded-xl text-xs transition-all shadow-glow btn-press cursor-pointer"
            >
              {loading ? "Saving Profile..." : "Save & Launch Dashboard →"}
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}

export default ProfileSetup;
