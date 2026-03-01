import { useState, useRef } from "react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { apiFetch } from "../config";

const btnCls = "px-3 py-1.5 rounded-md font-semibold text-xs transition-all cursor-pointer text-white";
const btnPrimary = `${btnCls} bg-surface-900 dark:bg-surface-100 dark:text-surface-900 hover:bg-surface-800 dark:hover:bg-surface-200`;
const btnGreen = `${btnCls} bg-brand-600 hover:bg-brand-700`;
const btnBlue = `${btnCls} bg-blue-600 hover:bg-blue-700`;
const btnRed = `${btnCls} bg-red-500 hover:bg-red-600`;
const btnDisabled = `${btnCls} bg-surface-300 dark:bg-surface-600 cursor-not-allowed`;
const inpCls = "w-full px-3 py-2 mb-2 rounded-md border border-surface-200/60 dark:border-surface-700/60 bg-white/70 dark:bg-surface-800/70 backdrop-blur-sm text-surface-900 dark:text-surface-100 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/20 transition-all placeholder:text-surface-400";
const smallInpCls = "flex-1 px-2 py-1.5 rounded-md border border-surface-200/60 dark:border-surface-700/60 bg-white/70 dark:bg-surface-800/70 backdrop-blur-sm text-surface-900 dark:text-surface-100 text-xs outline-none focus:border-brand-500 transition-all placeholder:text-surface-400";
const selectCls = "px-3 py-2 mb-2 rounded-md border border-surface-200/60 dark:border-surface-700/60 bg-white/70 dark:bg-surface-800/70 backdrop-blur-sm text-surface-900 dark:text-surface-100 text-sm cursor-pointer outline-none focus:border-brand-500 transition-all";

const MEAL_TYPES = ["Breakfast", "Lunch", "Evening Snacks", "Dinner", "Late Night", "Others"];

const detectMealType = () => {
  const h = new Date().getHours();
  if (h >= 6 && h < 11) return "Breakfast";
  if (h >= 11 && h < 15) return "Lunch";
  if (h >= 15 && h < 18) return "Evening Snacks";
  if (h >= 18 && h < 22) return "Dinner";
  return "Late Night";
};

const FoodForm = () => {
  const { user } = useAuth();
  const [item, setItem] = useState("");
  const [qty, setQty] = useState("");
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [loading, setLoading] = useState(false);
  const [aiText, setAiText] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [confirmationData, setConfirmationData] = useState(null);
  const [lookupLoading, setLookupLoading] = useState({});
  const [mealType, setMealType] = useState(detectMealType());
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const debounceTimerRef = useRef(null);

  const preprocessImage = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        let w = img.width, h = img.height;
        if (w > h && w > 1024) { h = (h * 1024) / w; w = 1024; } else if (h > 1024) { w = (w * 1024) / h; h = 1024; }
        canvas.width = w; canvas.height = h;
        ctx.drawImage(img, 0, 0, w, h);
        canvas.toBlob(resolve, "image/jpeg", 0.7);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });

  const handleImageSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const blob = await preprocessImage(file);
      const processed = new File([blob], file.name, { type: "image/jpeg" });
      setImageFile(processed);
      setImagePreview(URL.createObjectURL(processed));
    } catch { alert("Failed to process image"); }
  };

  const analyzeImage = async () => {
    if (!imageFile) return alert("Please select an image first");
    setImageLoading(true);
    try {
      const formData = new FormData();
      formData.append("image", imageFile);
      const res = await apiFetch("/analyze-food-image", { method: "POST", body: formData });
      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error || errData?.details || "Failed to analyze image");
      }
      const data = await res.json();
      setConfirmationData({ type: "image", items: data.items, totals: { calories: data.total_calories, protein: data.total_protein }, needsNutritionCalculation: data.needsNutritionCalculation || false });
    } catch (err) {
      alert(err.message || "Failed to analyze image.");
    }
    finally { setImageLoading(false); }
  };

  const calculateNutrition = async () => {
    if (!confirmationData?.items) return alert("No items to calculate nutrition for");
    setSaveLoading(true);
    try {
      const res = await apiFetch("/calculate-nutrition", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items: confirmationData.items }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.details || data.error || "Failed to calculate nutrition");
      setConfirmationData({ ...confirmationData, items: data.items, totals: { calories: data.total_calories, protein: data.total_protein }, needsNutritionCalculation: false });
      alert("Nutrition calculated! Review and save when ready.");
    } catch (e) { alert(`Failed to calculate nutrition: ${e.message}`); }
    finally { setSaveLoading(false); }
  };

  const clearImage = () => {
    setImageFile(null); setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  };

  const addFood = async () => {
    if (!item || !qty) return alert("Please enter food item and quantity");
    setLoading(true);
    try {
      await addDoc(collection(db, "users", user.uid, "foodLogs"), { itemName: item, quantity: qty, calories: Number(calories) || 0, protein: Number(protein) || 0, mealType, date: new Date().toISOString().split("T")[0], createdAt: serverTimestamp() });
      setItem(""); setQty(""); setCalories(""); setProtein(""); setMealType(detectMealType());
    } catch { alert("Failed to add food log"); }
    finally { setLoading(false); }
  };

  const analyzeFood = async () => {
    if (!aiText) return alert("Please enter some food text to analyze");
    setAiLoading(true);
    try {
      const res = await apiFetch("/analyze-food", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: aiText }) });
      const data = await res.json();
      if (data.note) {
        if (!data.items?.length) { alert(data.note); setAiLoading(false); return; }
      }
      if (!res.ok && !data.items?.length) throw new Error(data.error || data.details || "Failed to analyze food");
      setConfirmationData({ type: "text", items: data.items || [], totals: { calories: data.total_calories || 0, protein: data.total_protein || 0 } });
      if (data.note) alert(data.note);
    } catch (err) {
      alert(err.message || "Failed to analyze food. Please try again.");
    }
    finally { setAiLoading(false); }
  };

  const saveAiResults = async () => {
    if (!confirmationData || !user) return alert("No results to save");
    setSaveLoading(true);
    try {
      const today = new Date().toISOString().split("T")[0];
      const items = confirmationData.items.map((it) => ({
        name: it.name, quantity: it.quantity,
        calories: Number(it.calories) || 0, protein: Number(it.protein) || 0,
      }));
      const totalCal = items.reduce((s, i) => s + i.calories, 0);
      const totalPro = Math.round(items.reduce((s, i) => s + i.protein, 0) * 10) / 10;
      const combinedName = items.map((i) => i.name).join(", ");
      await addDoc(collection(db, "users", user.uid, "foodLogs"), {
        itemName: combinedName, items, calories: totalCal, protein: totalPro,
        quantity: `${items.length} item${items.length !== 1 ? "s" : ""}`,
        mealType, date: today, createdAt: serverTimestamp(),
      });
      alert(`Successfully saved ${items.length} food item(s) as one entry!`);
      setAiText(""); setImageFile(null); setImagePreview(null); setConfirmationData(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (cameraInputRef.current) cameraInputRef.current.value = "";
    } catch { alert("Failed to save food items. Please try again."); }
    finally { setSaveLoading(false); }
  };

  const lookupFoodNutrition = async (index, foodName, quantity) => {
    try {
      setLookupLoading((p) => ({ ...p, [index]: true }));
      const res = await apiFetch("/lookup-food", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: foodName, quantity }) });
      if (!res.ok) return alert(`Could not find nutrition data for "${foodName}"`);
      const data = await res.json();
      const items = [...confirmationData.items];
      items[index] = { ...items[index], name: data.name, calories: data.calories, protein: data.protein };
      setConfirmationData({ ...confirmationData, items, totals: { calories: items.reduce((s, i) => s + i.calories, 0), protein: items.reduce((s, i) => s + i.protein, 0) } });
    } catch { alert("Failed to lookup food nutrition"); }
    finally { setLookupLoading((p) => ({ ...p, [index]: false })); }
  };

  const recalcTotals = (items) => ({ calories: items.reduce((s, i) => s + i.calories, 0), protein: items.reduce((s, i) => s + i.protein, 0) });

  const updateConfirmationItem = (index, field, value) => {
    const items = [...confirmationData.items];
    const oldVal = items[index][field];
    items[index][field] = field === "calories" || field === "protein" ? Number(value) : value;
    if (field === "quantity" && !confirmationData.needsNutritionCalculation) {
      const oldG = parseFloat(oldVal) || 0, newG = parseFloat(value) || 0;
      if (oldG > 0 && newG > 0 && oldG !== newG) { const r = newG / oldG; items[index].calories = Math.round(items[index].calories * r); items[index].protein = Math.round(items[index].protein * r * 10) / 10; items[index].grams = newG; }
    }
    if (field === "quantity" && confirmationData.needsNutritionCalculation) { const g = parseFloat(value) || 0; if (g > 0) items[index].grams = g; }
    if (field === "name" && value.trim() && value !== oldVal && !confirmationData.needsNutritionCalculation) {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => lookupFoodNutrition(index, value, items[index].quantity), 800);
    }
    setConfirmationData({ ...confirmationData, items, totals: recalcTotals(items) });
  };

  const removeConfirmationItem = (index) => {
    const items = confirmationData.items.filter((_, i) => i !== index);
    if (!items.length) return setConfirmationData(null);
    setConfirmationData({ ...confirmationData, items, totals: recalcTotals(items) });
  };

  return (
    <div className="rounded-xl border border-surface-200/50 dark:border-surface-700/50 bg-white/50 dark:bg-surface-900/50 backdrop-blur-md p-3 md:p-4">
      <h2 className="text-sm font-bold text-surface-900 dark:text-surface-50 mb-3 flex items-center gap-2">
        <span className="w-1 h-1 rounded-full bg-brand-500" />Add Food
      </h2>

      <div className="space-y-3">
        {/* Meal type */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-surface-500 dark:text-surface-400">Meal</label>
          <select value={mealType} onChange={(e) => setMealType(e.target.value)} className={`${selectCls} mb-0 min-w-[140px] text-xs py-1.5`}>
            {MEAL_TYPES.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>

        <div className="border-t border-surface-200/30 dark:border-surface-700/30" />

        {/* Image analysis */}
        <div>
          <h3 className="text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider mb-2">AI Image Analysis</h3>
          <div className="flex flex-wrap gap-1.5 mb-2">
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageSelect} className="hidden" />
            <button onClick={() => fileInputRef.current?.click()} className={btnGreen}>Choose Image</button>
            <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={handleImageSelect} className="hidden" />
            <button onClick={() => cameraInputRef.current?.click()} className={btnBlue}>Take Photo</button>
            {imageFile && (<>
              <button onClick={analyzeImage} disabled={imageLoading} className={imageLoading ? btnDisabled : btnPrimary}>{imageLoading ? "Analyzing..." : "Analyze"}</button>
              <button onClick={clearImage} className={btnRed}>Clear</button>
            </>)}
          </div>
          {imagePreview && <img src={imagePreview} alt="Food preview" className="max-w-[200px] max-h-[200px] rounded-md border border-surface-200/50 dark:border-surface-700/50 mt-1" />}
        </div>

        <div className="border-t border-surface-200/30 dark:border-surface-700/30" />

        {/* Text analysis */}
        <div>
          <h3 className="text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider mb-2">AI Text Analysis</h3>
          <input placeholder="e.g. 2 rotis and 1 bowl dal" value={aiText} onChange={(e) => setAiText(e.target.value)} className={inpCls} />
          <button onClick={analyzeFood} disabled={aiLoading} className={`${aiLoading ? btnDisabled : btnPrimary} mb-1`}>{aiLoading ? "Analyzing..." : "Analyze"}</button>
        </div>

        {/* Confirmation panel */}
        {confirmationData && (
          <div className="p-3 bg-white/40 dark:bg-surface-800/40 backdrop-blur-sm rounded-lg border border-brand-500/20">
            <h4 className="text-xs font-bold text-surface-900 dark:text-surface-100 mb-0.5">Confirm Before Saving</h4>
            <p className="text-[10px] text-surface-500 dark:text-surface-400 mb-2">{confirmationData.needsNutritionCalculation ? "Review items, adjust quantities, then Calculate." : "Review and edit before saving."}</p>
            {confirmationData.items.map((itm, i) => (
              <div key={i} className="bg-white dark:bg-surface-800 p-3 mb-2 rounded-lg border border-surface-200 dark:border-surface-700">
                <div className="flex gap-2 flex-wrap items-center">
                  {confirmationData.needsNutritionCalculation ? (<>
                    <div className="flex-[2] px-2 py-1.5 rounded border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-900 text-sm text-surface-900 dark:text-surface-100">{itm.name}</div>
                    <input placeholder="Quantity" value={itm.quantity} onChange={(e) => updateConfirmationItem(i, "quantity", e.target.value)} className={`${smallInpCls} border-brand-500`} />
                    <button onClick={() => removeConfirmationItem(i)} className="px-2.5 py-1.5 rounded bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors border border-red-200 dark:border-red-800">Remove</button>
                  </>) : (<>
                    <div className="flex-[2] flex items-center gap-1.5">
                      <input placeholder="Food name" value={itm.name} onChange={(e) => updateConfirmationItem(i, "name", e.target.value)} className={smallInpCls} />
                      {lookupLoading[i] && <span className="text-xs text-brand-600 dark:text-brand-400 whitespace-nowrap">Looking up...</span>}
                    </div>
                    <input placeholder="Quantity" value={itm.quantity} onChange={(e) => updateConfirmationItem(i, "quantity", e.target.value)} className={smallInpCls} />
                    <input type="number" placeholder="Calories" value={itm.calories} onChange={(e) => updateConfirmationItem(i, "calories", e.target.value)} className={smallInpCls} />
                    <input type="number" placeholder="Protein (g)" value={itm.protein} onChange={(e) => updateConfirmationItem(i, "protein", e.target.value)} className={smallInpCls} />
                    <button onClick={() => removeConfirmationItem(i)} className="px-2.5 py-1.5 rounded bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors border border-red-200 dark:border-red-800">Remove</button>
                  </>)}
                </div>
              </div>
            ))}
            <div className="mt-2 p-2 bg-brand-50/50 dark:bg-brand-900/20 rounded-md border border-brand-200/50 dark:border-brand-800/50 text-xs font-semibold text-surface-900 dark:text-surface-100">
              <div>Total: {confirmationData.totals.calories} kcal &middot; {confirmationData.totals.protein}g protein</div>
            </div>
            <div className="flex gap-1.5 mt-2">
              {confirmationData.needsNutritionCalculation
                ? <button onClick={calculateNutrition} disabled={saveLoading} className={`flex-1 py-1.5 ${saveLoading ? btnDisabled : btnPrimary}`}>{saveLoading ? "Calculating..." : "Calculate Nutrition"}</button>
                : <button onClick={saveAiResults} disabled={saveLoading} className={`flex-1 py-1.5 ${saveLoading ? btnDisabled : btnGreen}`}>{saveLoading ? "Saving..." : "Save All"}</button>}
              <button onClick={() => setConfirmationData(null)} className={`${btnRed} px-4`}>Cancel</button>
            </div>
          </div>
        )}

        <div className="border-t border-surface-200/30 dark:border-surface-700/30" />

        {/* Manual entry */}
        <div>
          <h3 className="text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider mb-2">Manual Entry</h3>
          <input placeholder="Food item (e.g., Chicken Breast)" value={item} onChange={(e) => setItem(e.target.value)} className={inpCls} />
          <input placeholder="Quantity (e.g., 200g)" value={qty} onChange={(e) => setQty(e.target.value)} className={inpCls} />
          <input type="number" placeholder="Calories" value={calories} onChange={(e) => setCalories(e.target.value)} className={inpCls} />
          <input type="number" placeholder="Protein (g)" value={protein} onChange={(e) => setProtein(e.target.value)} className={inpCls} />
          <button onClick={addFood} disabled={loading} className={`w-full py-3 ${loading ? btnDisabled : btnPrimary}`}>{loading ? "Adding..." : "Add Food"}</button>
        </div>
      </div>
    </div>
  );
};

export default FoodForm;
