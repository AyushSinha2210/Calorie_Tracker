import { useState, useRef } from "react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";

const btn = (bg, extra = {}) => ({ padding: "10px 20px", background: bg, color: "white", border: "none", borderRadius: "5px", cursor: "pointer", ...extra });
const inp = (extra = {}) => ({ width: "100%", padding: "10px", marginBottom: "10px", borderRadius: "5px", border: "1px solid #ddd", ...extra });
const smallInp = (extra = {}) => ({ flex: "1", padding: "8px", borderRadius: "4px", border: "1px solid #ddd", ...extra });
const selectStyle = (extra = {}) => ({ padding: "10px", marginBottom: "10px", borderRadius: "5px", border: "1px solid #ddd", background: "#fff", fontSize: "14px", cursor: "pointer", ...extra });

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
      const res = await fetch("http://localhost:5000/analyze-food-image", { method: "POST", body: formData });
      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error || errData?.details || "Failed to analyze image");
      }
      const data = await res.json();
      setConfirmationData({ type: "image", items: data.items, totals: { calories: data.total_calories, protein: data.total_protein }, needsNutritionCalculation: data.needsNutritionCalculation || false });
    } catch (err) {
      alert(err.message || "Failed to analyze image. Make sure the server is running on port 5000.");
    }
    finally { setImageLoading(false); }
  };

  const calculateNutrition = async () => {
    if (!confirmationData?.items) return alert("No items to calculate nutrition for");
    setSaveLoading(true);
    try {
      const res = await fetch("http://localhost:5000/calculate-nutrition", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items: confirmationData.items }) });
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
      const res = await fetch("http://localhost:5000/analyze-food", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: aiText }) });
      const data = await res.json();
      if (data.note) {
        // Server returned a note (quota issue, fallback, etc) — show it but still display any items
        if (!data.items?.length) { alert(data.note); setAiLoading(false); return; }
      }
      if (!res.ok && !data.items?.length) throw new Error(data.error || data.details || "Failed to analyze food");
      setConfirmationData({ type: "text", items: data.items || [], totals: { calories: data.total_calories || 0, protein: data.total_protein || 0 } });
      if (data.note) alert(data.note);
    } catch (err) {
      const msg = err.message || "";
      if (/fetch|network|ERR_CONNECTION/i.test(msg)) {
        alert("Cannot connect to server. Make sure the server is running on port 5000.");
      } else {
        alert(msg || "Failed to analyze food. Please try again.");
      }
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
        itemName: combinedName,
        items,
        calories: totalCal,
        protein: totalPro,
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
      const res = await fetch("http://localhost:5000/lookup-food", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: foodName, quantity }) });
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

  const delBtn = btn("#f44336", { padding: "8px 12px", borderRadius: "4px" });

  return (
    <div>
      <h2>Add Food Log</h2>
      <div>
        <hr />
        <div style={{ marginBottom: "15px" }}>
          <label style={{ fontWeight: "600", marginRight: "10px", color: "#333" }}>🍽️ Meal Type:</label>
          <select value={mealType} onChange={(e) => setMealType(e.target.value)} style={selectStyle({ width: "auto", minWidth: "160px" })}>
            {MEAL_TYPES.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <hr />
        <h3>📸 AI Food Analysis - Upload or Camera</h3>
        <div style={{ marginBottom: "20px" }}>
          <div style={{ display: "flex", gap: "10px", marginBottom: "10px" }}>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageSelect} style={{ display: "none" }} />
            <button onClick={() => fileInputRef.current?.click()} style={btn("#4CAF50")}>📁 Choose Image</button>
            <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={handleImageSelect} style={{ display: "none" }} />
            <button onClick={() => cameraInputRef.current?.click()} style={btn("#2196F3")}>📷 Take Photo</button>
            {imageFile && (<>
              <button onClick={analyzeImage} disabled={imageLoading} style={btn(imageLoading ? "#ccc" : "#667eea", { cursor: imageLoading ? "not-allowed" : "pointer" })}>{imageLoading ? "Analyzing..." : "🔍 Analyze"}</button>
              <button onClick={clearImage} style={btn("#f44336")}>✕ Clear</button>
            </>)}
          </div>
          {imagePreview && <div style={{ marginTop: "10px" }}><img src={imagePreview} alt="Food preview" style={{ maxWidth: "300px", maxHeight: "300px", borderRadius: "8px", border: "2px solid #ddd" }} /></div>}
        </div>
        <hr />
        <h3>✍️ AI Food Entry - Text Input</h3>
        <input placeholder="e.g. 2 rotis and 1 bowl dal" value={aiText} onChange={(e) => setAiText(e.target.value)} style={inp()} />
        <button onClick={analyzeFood} disabled={aiLoading} style={btn(aiLoading ? "#ccc" : "#667eea", { marginBottom: "10px", cursor: aiLoading ? "not-allowed" : "pointer" })}>{aiLoading ? "Analyzing..." : "🔍 Analyze"}</button>

        {confirmationData && (
          <div style={{ marginTop: "20px", padding: "15px", background: "#f9f9f9", borderRadius: "8px", border: "2px solid #667eea" }}>
            <h4>✅ Confirm Before Saving</h4>
            <p style={{ fontSize: "14px", color: "#666" }}>{confirmationData.needsNutritionCalculation ? "Review detected items and adjust quantities if needed. Click 'Calculate Nutrition' to get calories and protein." : "Review and edit all details before saving to your database"}</p>
            {confirmationData.items.map((itm, i) => (
              <div key={i} style={{ background: "white", padding: "10px", marginBottom: "10px", borderRadius: "5px", border: "1px solid #ddd" }}>
                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
                  {confirmationData.needsNutritionCalculation ? (<>
                    <div style={{ flex: "2", padding: "8px", borderRadius: "4px", border: "1px solid #ddd", background: "#f5f5f5", color: "#333" }}>{itm.name}</div>
                    <input placeholder="Quantity" value={itm.quantity} onChange={(e) => updateConfirmationItem(i, "quantity", e.target.value)} style={smallInp({ border: "1px solid #667eea" })} />
                    <button onClick={() => removeConfirmationItem(i)} style={delBtn}>🗑️</button>
                  </>) : (<>
                    <div style={{ flex: "2", display: "flex", alignItems: "center", gap: "5px" }}>
                      <input placeholder="Food name" value={itm.name} onChange={(e) => updateConfirmationItem(i, "name", e.target.value)} style={smallInp()} />
                      {lookupLoading[i] && <span style={{ fontSize: "12px", color: "#667eea" }}>🔍 Looking up...</span>}
                    </div>
                    <input placeholder="Quantity" value={itm.quantity} onChange={(e) => updateConfirmationItem(i, "quantity", e.target.value)} style={smallInp()} />
                    <input type="number" placeholder="Calories" value={itm.calories} onChange={(e) => updateConfirmationItem(i, "calories", e.target.value)} style={smallInp()} />
                    <input type="number" placeholder="Protein (g)" value={itm.protein} onChange={(e) => updateConfirmationItem(i, "protein", e.target.value)} style={smallInp()} />
                    <button onClick={() => removeConfirmationItem(i)} style={delBtn}>🗑️</button>
                  </>)}
                </div>
              </div>
            ))}
            <div style={{ marginTop: "15px", padding: "10px", background: "#e8f5e9", borderRadius: "5px", fontWeight: "bold" }}>
              <div>Total Calories: {confirmationData.totals.calories} kcal</div>
              <div>Total Protein: {confirmationData.totals.protein}g</div>
            </div>
            <div style={{ display: "flex", gap: "10px", marginTop: "15px" }}>
              {confirmationData.needsNutritionCalculation
                ? <button onClick={calculateNutrition} disabled={saveLoading} style={btn(saveLoading ? "#ccc" : "#667eea", { flex: "1", padding: "12px", fontWeight: "bold", cursor: saveLoading ? "not-allowed" : "pointer" })}>{saveLoading ? "Calculating..." : "🔢 Calculate Nutrition"}</button>
                : <button onClick={saveAiResults} disabled={saveLoading} style={btn(saveLoading ? "#ccc" : "#4CAF50", { flex: "1", padding: "12px", fontWeight: "bold", cursor: saveLoading ? "not-allowed" : "pointer" })}>{saveLoading ? "Saving..." : "💾 Save All to Database"}</button>}
              <button onClick={() => setConfirmationData(null)} style={btn("#f44336", { padding: "12px 20px" })}>✕ Cancel</button>
            </div>
          </div>
        )}
        <hr />
        <h3>📝 Manual Food Entry</h3>
        <input placeholder="Food item (e.g., Chicken Breast)" value={item} onChange={(e) => setItem(e.target.value)} style={inp()} />
        <input placeholder="Quantity (e.g., 200g)" value={qty} onChange={(e) => setQty(e.target.value)} style={inp()} />
        <input type="number" placeholder="Calories" value={calories} onChange={(e) => setCalories(e.target.value)} style={inp()} />
        <input type="number" placeholder="Protein (g)" value={protein} onChange={(e) => setProtein(e.target.value)} style={inp()} />
        <button onClick={addFood} disabled={loading} style={btn(loading ? "#ccc" : "#667eea", { width: "100%", padding: "12px", fontWeight: "bold", cursor: loading ? "not-allowed" : "pointer" })}>{loading ? "Adding..." : "➕ Add Food"}</button>
      </div>
    </div>
  );
};

export default FoodForm;
