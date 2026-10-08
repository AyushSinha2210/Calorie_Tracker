import { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { doc, setDoc, collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";

/** Resize an image file to a small square JPEG and return a base64 data-URL */
function resizeImage(file, maxSize = 160) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement("canvas");
        c.width = maxSize;
        c.height = maxSize;
        const ctx = c.getContext("2d");
        const min = Math.min(img.width, img.height);
        const sx = (img.width - min) / 2;
        const sy = (img.height - min) / 2;
        ctx.drawImage(img, sx, sy, min, min, 0, 0, maxSize, maxSize);
        resolve(c.toDataURL("image/jpeg", 0.8));
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const labelCls = "block text-[11px] font-bold text-dark-muted uppercase tracking-wider mb-1";
const inpCls =
  "w-full px-3.5 py-2.5 rounded-xl border border-dark-border/80 bg-dark-surface-2 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all text-dark-text text-sm";
const selectCls =
  "h-[42px] rounded-xl border border-dark-border/80 bg-dark-surface-2 px-3 text-xs font-bold focus:outline-none focus:border-emerald-500 cursor-pointer text-dark-text";

function Profile() {
  const { user, userProfile } = useAuth();
  const navigate = useNavigate();

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [weight, setWeight] = useState("");
  const [weightUnit, setWeightUnit] = useState("kg");
  const [height, setHeight] = useState("");
  const [heightUnit, setHeightUnit] = useState("cm");
  const [calorieTarget, setCalorieTarget] = useState("");
  const [gender, setGender] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [profileImage, setProfileImage] = useState(null);
  const [imageUploading, setImageUploading] = useState(false);
  const imgInputRef = useRef(null);

  useEffect(() => {
    if (!userProfile) return;
    setName(userProfile.name || user?.displayName || "");
    setAge(userProfile.age?.toString() || "");
    setWeight(userProfile.originalWeight?.toString() || userProfile.weight?.toString() || "");
    setWeightUnit(userProfile.weightUnit || "kg");
    setHeight(userProfile.originalHeight?.toString() || userProfile.height?.toString() || "");
    setHeightUnit(userProfile.heightUnit || "cm");
    setCalorieTarget(userProfile.dailyCalorieTarget?.toString() || "");
    setGender(userProfile.gender || "");
    setProfileImage(userProfile.profileImage || null);
  }, [userProfile, user?.displayName]);

  const handleImageChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return setError("Please select an image file.");
    if (file.size > 5 * 1024 * 1024) return setError("Image must be under 5 MB.");
    setImageUploading(true);
    setError("");
    try {
      const dataUrl = await resizeImage(file, 160);
      setProfileImage(dataUrl);
      await setDoc(doc(db, "users", user.uid), { profileImage: dataUrl }, { merge: true });
      setSuccess("Profile photo updated!");
    } catch {
      setError("Failed to process image. Try another one.");
    } finally {
      setImageUploading(false);
      if (imgInputRef.current) imgInputRef.current.value = "";
    }
  };

  const removeImage = async () => {
    setProfileImage(null);
    try {
      await setDoc(doc(db, "users", user.uid), { profileImage: "" }, { merge: true });
      setSuccess("Profile photo removed.");
    } catch {
      setError("Failed to remove photo.");
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (!name.trim() || !age || !weight || !height || !calorieTarget)
      return setError("All fields are required.");
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

      // Bi-directional sync: write to weightLogs for today
      const today = new Date().toISOString().split("T")[0];
      await addDoc(collection(db, "users", user.uid, "weightLogs"), {
        weight: wKg,
        originalWeight: wNum,
        unit: weightUnit,
        date: today,
        source: "profile",
        createdAt: serverTimestamp(),
      });

      setSuccess("Profile updated successfully!");
      setEditing(false);
    } catch (err) {
      setError(err.message || "Failed to save profile.");
    } finally {
      setLoading(false);
    }
  };

  const displayWeight = userProfile?.originalWeight
    ? `${userProfile.originalWeight} ${userProfile.weightUnit || "kg"}`
    : userProfile?.weight
    ? `${userProfile.weight} kg`
    : "—";
  const displayHeight = userProfile?.originalHeight
    ? `${userProfile.originalHeight} ${userProfile.heightUnit || "cm"}`
    : userProfile?.height
    ? `${userProfile.height} cm`
    : "—";

  return (
    <div className="min-h-screen bg-dark-bg text-dark-text p-4 md:p-8 flex items-start justify-center pt-8 md:pt-16 relative overflow-hidden">
      <div className="card p-6 md:p-8 bg-dark-surface/90 border-dark-border/80 shadow-2xl max-w-lg w-full">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => navigate("/dashboard")}
            className="text-xs font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            ← Back to Dashboard
          </button>
          <h2 className="text-lg font-extrabold text-white">Profile & Goals</h2>
          <div className="w-12" />
        </div>

        {/* Avatar */}
        <div className="flex flex-col items-center mb-6">
          <div
            className="relative cursor-pointer group"
            onClick={() => imgInputRef.current?.click()}
            title="Click to change photo"
          >
            {profileImage ? (
              <img
                src={profileImage}
                alt="Profile"
                className="w-20 h-20 rounded-full object-cover ring-2 ring-emerald-500/40 group-hover:opacity-90 transition-opacity"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-emerald-500/10 border-2 border-emerald-500/30 flex items-center justify-center text-2xl font-extrabold text-emerald-400">
                {(userProfile?.name || user?.displayName || user?.email || "U")[0].toUpperCase()}
              </div>
            )}
            <div className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-emerald-500 flex items-center justify-center text-xs text-dark-bg font-bold shadow-md">
              {imageUploading ? "…" : "📷"}
            </div>
          </div>
          <input
            ref={imgInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageChange}
          />
          {profileImage && (
            <button
              onClick={removeImage}
              className="mt-2 text-[11px] text-rose-400 hover:text-rose-300 underline"
            >
              Remove photo
            </button>
          )}
          <h3 className="text-base font-bold text-white mt-2">
            {userProfile?.name || user?.displayName || "Fitness Enthusiast"}
          </h3>
          <p className="text-xs text-dark-muted">{user?.email}</p>
        </div>

        {error && (
          <div className="mb-4 bg-rose-500/10 text-rose-400 px-4 py-2.5 rounded-xl text-xs font-semibold border border-rose-500/20">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 bg-emerald-500/10 text-emerald-400 px-4 py-2.5 rounded-xl text-xs font-semibold border border-emerald-500/20">
            ✓ {success}
          </div>
        )}

        {!editing ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 p-4 rounded-2xl bg-dark-surface-2/60 border border-dark-border/60">
              <div>
                <span className={labelCls}>Daily Calorie Target</span>
                <span className="text-sm font-extrabold text-emerald-400">
                  {userProfile?.dailyCalorieTarget ? `${userProfile.dailyCalorieTarget} kcal` : "—"}
                </span>
              </div>
              <div>
                <span className={labelCls}>Gender</span>
                <span className="text-sm font-semibold capitalize text-dark-text">
                  {userProfile?.gender || "—"}
                </span>
              </div>
              <div>
                <span className={labelCls}>Weight</span>
                <span className="text-sm font-semibold text-dark-text">{displayWeight}</span>
              </div>
              <div>
                <span className={labelCls}>Height</span>
                <span className="text-sm font-semibold text-dark-text">{displayHeight}</span>
              </div>
              <div>
                <span className={labelCls}>Age</span>
                <span className="text-sm font-semibold text-dark-text">{userProfile?.age || "—"} yrs</span>
              </div>
              <div>
                <span className={labelCls}>AI Coach Tone</span>
                <span className="text-sm font-semibold text-dark-text capitalize">
                  {userProfile?.coachTone || "Friendly"}
                </span>
              </div>
            </div>

            <button
              onClick={() => {
                setEditing(true);
                setError("");
                setSuccess("");
              }}
              className="w-full py-3 bg-dark-surface-2 hover:bg-dark-border text-white font-bold rounded-xl text-xs transition-all border border-dark-border btn-press cursor-pointer"
            >
              Edit Profile Details
            </button>
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-3">
            <div>
              <label htmlFor="p-name" className={labelCls}>
                Full Name
              </label>
              <input
                type="text"
                id="p-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className={inpCls}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="p-age" className={labelCls}>
                  Age
                </label>
                <input
                  type="number"
                  id="p-age"
                  min="10"
                  max="120"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  required
                  className={inpCls}
                />
              </div>
              <div>
                <label htmlFor="p-gender" className={labelCls}>
                  Gender
                </label>
                <select
                  id="p-gender"
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
              <label htmlFor="p-cal" className={labelCls}>
                Daily Calorie Target (kcal)
              </label>
              <input
                type="number"
                id="p-cal"
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
                <label htmlFor="p-wt" className={labelCls}>
                  Weight
                </label>
                <input
                  type="number"
                  id="p-wt"
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
                <label htmlFor="p-ht" className={labelCls}>
                  Height
                </label>
                <input
                  type="number"
                  id="p-ht"
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

            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-3 bg-gradient-to-r from-emerald-500 to-lime-500 text-dark-bg font-extrabold rounded-xl text-xs transition-all shadow-glow btn-press cursor-pointer"
              >
                {loading ? "Saving..." : "Save Changes"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setError("");
                  setSuccess("");
                }}
                disabled={loading}
                className="px-5 py-3 border border-dark-border text-dark-muted hover:text-white rounded-xl text-xs font-bold transition-all"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default Profile;
