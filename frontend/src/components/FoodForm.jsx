import { useState, useRef } from "react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { motion, AnimatePresence } from "framer-motion";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { apiFetch } from "../config";
import HealthScoreBadge from "./ui/HealthScoreBadge";

import { MEAL_TYPES, detectMealType } from "../constants/mealTypes";

const FoodForm = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("scan"); // "scan" | "text" | "manual"
  const [mealType, setMealType] = useState(detectMealType());

  // Manual entry state
  const [item, setItem] = useState("");
  const [qty, setQty] = useState("");
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");
  const [loading, setLoading] = useState(false);

  // AI text state
  const [aiText, setAiText] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  // Photo Scan state
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [saveLoading, setSaveLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  // Image resizing before upload
  const preprocessImage = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = (e) => {
        const img = new Image();
        img.onerror = reject;
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          let w = img.width;
          let h = img.height;
          const maxDim = 1280;
          if (w > h && w > maxDim) {
            h = (h * maxDim) / w;
            w = maxDim;
          } else if (h > maxDim) {
            w = (w * maxDim) / h;
            h = maxDim;
          }
          canvas.width = w;
          canvas.height = h;
          ctx.drawImage(img, 0, 0, w, h);
          canvas.toBlob(resolve, "image/jpeg", 0.8);
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });

  const handleImageSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setErrorMsg("");
    try {
      const blob = await preprocessImage(file);
      const processed = new File([blob], file.name || "meal.jpg", { type: "image/jpeg" });
      setImageFile(processed);
      setImagePreview(URL.createObjectURL(processed));
      setScanResult(null);
      // Auto-trigger scan
      performScan(processed);
    } catch {
      setErrorMsg("Failed to process image.");
    }
  };

  const performScan = async (fileToScan) => {
    const targetFile = fileToScan || imageFile;
    if (!targetFile) return;
    setImageLoading(true);
    setErrorMsg("");
    try {
      const formData = new FormData();
      formData.append("image", targetFile);

      // Attempt Cal AI-style one-shot /scan-meal
      let res = await apiFetch("/scan-meal", { method: "POST", body: formData });

      // Fallback if 404 (Render backend not yet redeployed)
      if (res.status === 404) {
        res = await apiFetch("/analyze-food-image", { method: "POST", body: formData });
        if (!res.ok) throw new Error("Image analysis failed");
        const detectData = await res.json();
        if (!detectData.items?.length) throw new Error("No food detected in photo");

        // Calculate nutrition for detected items
        const calcRes = await apiFetch("/calculate-nutrition", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: detectData.items }),
        });
        const calcData = await calcRes.json();
        setScanResult({
          mealName: calcData.items?.map((i) => i.name).join(", ") || "Meal",
          items: (calcData.items || []).map((i) => ({
            name: i.name,
            quantity: i.quantity || `${i.grams || 100}g`,
            grams: i.grams || 100,
            calories: i.calories || 0,
            protein: i.protein || 0,
            carbs: 0,
            fat: 0,
          })),
          total_calories: calcData.total_calories || 0,
          total_protein: calcData.total_protein || 0,
          total_carbs: 0,
          total_fat: 0,
          healthScore: 6,
          tip: "Protein and calorie estimate complete.",
          source: "image-fallback",
        });
        return;
      }

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || err?.details || "Failed to scan meal");
      }

      const data = await res.json();
      if (!data.items?.length) {
        throw new Error(data.note || "Could not detect food items. Try a clearer photo.");
      }

      setScanResult({
        mealName: data.mealName || "Scanned Meal",
        items: data.items || [],
        total_calories: data.total_calories || 0,
        total_protein: data.total_protein || 0,
        total_carbs: data.total_carbs || 0,
        total_fat: data.total_fat || 0,
        healthScore: data.healthScore || 7,
        tip: data.tip || "",
        source: "scan",
      });
    } catch (err) {
      setErrorMsg(err.message || "Failed to scan meal.");
    } finally {
      setImageLoading(false);
    }
  };

  const clearImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setScanResult(null);
    setErrorMsg("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  };

  // Recalculate macro totals when user edits items
  const updateScanItem = (index, field, value) => {
    if (!scanResult) return;
    const items = [...scanResult.items];
    const item = { ...items[index] };
    const oldVal = item[field];
    const num = Number(value) || 0;

    if (field === "grams") {
      const oldG = Number(oldVal) || 100;
      const newG = Math.max(1, num);
      const ratio = newG / (oldG || 1);
      item.grams = newG;
      item.quantity = `${newG}g`;
      item.calories = Math.round(item.calories * ratio);
      item.protein = Math.round(item.protein * ratio * 10) / 10;
      item.carbs = Math.round(item.carbs * ratio * 10) / 10;
      item.fat = Math.round(item.fat * ratio * 10) / 10;
    } else {
      item[field] = field === "name" || field === "quantity" ? value : num;
    }

    items[index] = item;
    const total_cal = Math.round(items.reduce((s, i) => s + (Number(i.calories) || 0), 0));
    const total_pro = Math.round(items.reduce((s, i) => s + (Number(i.protein) || 0), 0) * 10) / 10;
    const total_carb = Math.round(items.reduce((s, i) => s + (Number(i.carbs) || 0), 0) * 10) / 10;
    const total_f = Math.round(items.reduce((s, i) => s + (Number(i.fat) || 0), 0) * 10) / 10;

    setScanResult({
      ...scanResult,
      items,
      total_calories: total_cal,
      total_protein: total_pro,
      total_carbs: total_carb,
      total_fat: total_f,
    });
  };

  const removeScanItem = (index) => {
    if (!scanResult) return;
    const items = scanResult.items.filter((_, i) => i !== index);
    if (!items.length) {
      setScanResult(null);
      return;
    }
    const total_cal = Math.round(items.reduce((s, i) => s + (Number(i.calories) || 0), 0));
    const total_pro = Math.round(items.reduce((s, i) => s + (Number(i.protein) || 0), 0) * 10) / 10;
    const total_carb = Math.round(items.reduce((s, i) => s + (Number(i.carbs) || 0), 0) * 10) / 10;
    const total_f = Math.round(items.reduce((s, i) => s + (Number(i.fat) || 0), 0) * 10) / 10;

    setScanResult({
      ...scanResult,
      items,
      total_calories: total_cal,
      total_protein: total_pro,
      total_carbs: total_carb,
      total_fat: total_f,
    });
  };

  const saveScanResult = async () => {
    if (!scanResult || !user) return;
    setSaveLoading(true);
    setErrorMsg("");
    try {
      const today = new Date().toISOString().split("T")[0];
      const itemsToSave = scanResult.items.map((it) => ({
        name: it.name,
        quantity: it.quantity || `${it.grams || 100}g`,
        grams: it.grams || 100,
        calories: Number(it.calories) || 0,
        protein: Number(it.protein) || 0,
        carbs: Number(it.carbs) || 0,
        fat: Number(it.fat) || 0,
      }));

      await addDoc(collection(db, "users", user.uid, "foodLogs"), {
        itemName: scanResult.mealName || itemsToSave.map((i) => i.name).join(", "),
        items: itemsToSave,
        calories: scanResult.total_calories || 0,
        protein: scanResult.total_protein || 0,
        carbs: scanResult.total_carbs || 0,
        fat: scanResult.total_fat || 0,
        healthScore: scanResult.healthScore || 0,
        source: scanResult.source || "scan",
        quantity: `${itemsToSave.length} item${itemsToSave.length !== 1 ? "s" : ""}`,
        mealType,
        date: today,
        createdAt: serverTimestamp(),
      });

      clearImage();
    } catch {
      setErrorMsg("Failed to save meal log. Please try again.");
    } finally {
      setSaveLoading(false);
    }
  };

  // AI text analysis
  const analyzeText = async () => {
    if (!aiText.trim()) return setErrorMsg("Please describe your meal first.");
    setAiLoading(true);
    setErrorMsg("");
    try {
      const res = await apiFetch("/analyze-food", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: aiText.trim() }),
      });
      const data = await res.json();
      if (!data.items?.length) {
        throw new Error(data.note || "Could not parse food items from description.");
      }
      setScanResult({
        mealName: aiText.trim().slice(0, 50),
        items: (data.items || []).map((i) => ({
          name: i.name,
          quantity: i.quantity || "100g",
          grams: Number(i.quantity) || 100,
          calories: i.calories || 0,
          protein: i.protein || 0,
          carbs: 0,
          fat: 0,
        })),
        total_calories: data.total_calories || 0,
        total_protein: data.total_protein || 0,
        total_carbs: 0,
        total_fat: 0,
        healthScore: 7,
        tip: "Logged via AI text description.",
        source: "text",
      });
      setAiText("");
    } catch (err) {
      setErrorMsg(err.message || "Failed to analyze text description.");
    } finally {
      setAiLoading(false);
    }
  };

  // Manual entry
  const addManualFood = async () => {
    if (!item.trim() || !qty.trim()) return setErrorMsg("Please enter food name and quantity.");
    setLoading(true);
    setErrorMsg("");
    try {
      const today = new Date().toISOString().split("T")[0];
      await addDoc(collection(db, "users", user.uid, "foodLogs"), {
        itemName: item.trim(),
        quantity: qty.trim(),
        calories: Number(calories) || 0,
        protein: Number(protein) || 0,
        carbs: Number(carbs) || 0,
        fat: Number(fat) || 0,
        healthScore: 6,
        source: "manual",
        mealType,
        date: today,
        createdAt: serverTimestamp(),
      });
      setItem("");
      setQty("");
      setCalories("");
      setProtein("");
      setCarbs("");
      setFat("");
    } catch {
      setErrorMsg("Failed to add food log.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card p-5 bg-dark-surface/90 border-dark-border/80">
      {/* Header with Title and Meal Selector */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          <h2 className="text-base font-bold text-dark-text tracking-tight">Log Nutrition</h2>
        </div>
        <select
          value={mealType}
          onChange={(e) => setMealType(e.target.value)}
          className="px-3 py-1.5 rounded-xl border border-dark-border/70 bg-dark-surface-2 text-xs font-semibold text-dark-text outline-none focus:border-emerald-500 cursor-pointer"
        >
          {MEAL_TYPES.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>

      {/* Tabs */}
      <div className="flex p-1 mb-5 rounded-xl bg-dark-surface-2/80 border border-dark-border/60">
        {[
          { id: "scan", label: "📸 Photo Scan", badge: "Cal AI" },
          { id: "text", label: "✍️ AI Text" },
          { id: "manual", label: "✏️ Manual" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id);
              setErrorMsg("");
            }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === tab.id
                ? "bg-dark-surface text-white shadow-sm border border-emerald-500/30"
                : "text-dark-muted hover:text-dark-text"
            }`}
          >
            <span>{tab.label}</span>
            {tab.badge && (
              <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-400 font-extrabold">
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {errorMsg && (
        <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-medium flex items-center justify-between">
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg("")} className="text-rose-400 hover:text-rose-200 ml-2 font-bold">
            ✕
          </button>
        </div>
      )}

      {/* ── PHOTO SCAN TAB ── */}
      {activeTab === "scan" && (
        <div className="space-y-4">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageSelect}
            className="hidden"
          />
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleImageSelect}
            className="hidden"
          />

          {!imagePreview ? (
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => cameraInputRef.current?.click()}
                className="flex flex-col items-center justify-center gap-2 p-6 rounded-2xl border-2 border-dashed border-emerald-500/30 hover:border-emerald-500/60 bg-emerald-500/5 hover:bg-emerald-500/10 transition-all group btn-press cursor-pointer"
              >
                <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                  📷
                </div>
                <span className="text-xs font-bold text-emerald-400">Take Photo</span>
                <span className="text-[10px] text-dark-muted text-center">Camera scan</span>
              </button>

              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center justify-center gap-2 p-6 rounded-2xl border-2 border-dashed border-dark-border/80 hover:border-emerald-500/40 bg-dark-surface-2/60 hover:bg-dark-surface-2 transition-all group btn-press cursor-pointer"
              >
                <div className="w-12 h-12 rounded-full bg-dark-border/40 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                  🖼️
                </div>
                <span className="text-xs font-bold text-dark-text">Upload Image</span>
                <span className="text-[10px] text-dark-muted text-center">Gallery / file</span>
              </button>
            </div>
          ) : (
            <div className="relative rounded-2xl overflow-hidden border border-dark-border">
              <img
                src={imagePreview}
                alt="Meal to scan"
                className="w-full max-h-72 object-cover"
              />

              {/* Animated laser scan line */}
              {imageLoading && (
                <div className="absolute inset-0 bg-dark-bg/40 backdrop-blur-[2px] flex flex-col items-center justify-center">
                  <div className="scan-laser" />
                  <div className="relative z-10 px-4 py-2 rounded-xl bg-dark-bg/80 border border-emerald-500/40 text-xs font-bold text-emerald-400 shadow-glow flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin" />
                    AI Analyzing Meal & Macros...
                  </div>
                </div>
              )}

              {/* Action buttons over photo */}
              {!imageLoading && (
                <div className="absolute top-3 right-3 flex items-center gap-2">
                  <button
                    onClick={() => performScan()}
                    className="px-3 py-1.5 rounded-lg bg-emerald-500 text-dark-bg text-xs font-bold shadow-lg hover:bg-emerald-400 transition-all btn-press"
                  >
                    Rescan
                  </button>
                  <button
                    onClick={clearImage}
                    className="px-3 py-1.5 rounded-lg bg-dark-bg/80 backdrop-blur-md text-white text-xs font-bold border border-dark-border hover:bg-rose-500 transition-all btn-press"
                  >
                    Clear
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Scanned Result Card */}
          <AnimatePresence>
            {scanResult && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="p-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 space-y-4"
              >
                {/* Result header */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-extrabold text-white">
                      {scanResult.mealName}
                    </h3>
                    {scanResult.tip && (
                      <p className="text-xs text-emerald-400/90 mt-0.5">
                        💡 {scanResult.tip}
                      </p>
                    )}
                  </div>
                  {scanResult.healthScore > 0 && (
                    <HealthScoreBadge score={scanResult.healthScore} size="lg" />
                  )}
                </div>

                {/* Macro breakdown summary */}
                <div className="grid grid-cols-4 gap-2 text-center p-3 rounded-xl bg-dark-surface/90 border border-dark-border/60">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-orange-400 uppercase font-bold">Calories</span>
                    <span className="text-base font-extrabold text-orange-400">{scanResult.total_calories}</span>
                    <span className="text-[9px] text-dark-muted">kcal</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-rose-400 uppercase font-bold">Protein</span>
                    <span className="text-base font-extrabold text-rose-400">{scanResult.total_protein}</span>
                    <span className="text-[9px] text-dark-muted">grams</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-amber-400 uppercase font-bold">Carbs</span>
                    <span className="text-base font-extrabold text-amber-400">{scanResult.total_carbs}</span>
                    <span className="text-[9px] text-dark-muted">grams</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-sky-400 uppercase font-bold">Fat</span>
                    <span className="text-base font-extrabold text-sky-400">{scanResult.total_fat}</span>
                    <span className="text-[9px] text-dark-muted">grams</span>
                  </div>
                </div>

                {/* Detected food items list */}
                <div className="space-y-2">
                  <span className="text-[11px] font-bold text-dark-muted uppercase tracking-wider">
                    Detected Items ({scanResult.items.length}) — Click to tweak
                  </span>
                  {scanResult.items.map((itm, i) => (
                    <div
                      key={i}
                      className="p-3 rounded-xl bg-dark-surface border border-dark-border/70 flex flex-col gap-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <input
                          value={itm.name}
                          onChange={(e) => updateScanItem(i, "name", e.target.value)}
                          className="font-bold text-xs text-white bg-transparent outline-none flex-1 border-b border-transparent focus:border-emerald-500"
                        />
                        <button
                          onClick={() => removeScanItem(i)}
                          className="text-xs text-rose-400 hover:text-rose-200 px-2 py-0.5 rounded bg-rose-500/10"
                        >
                          Remove
                        </button>
                      </div>

                      <div className="grid grid-cols-4 gap-2">
                        <div>
                          <label className="text-[9px] text-dark-muted uppercase">Grams</label>
                          <input
                            type="number"
                            value={itm.grams || ""}
                            onChange={(e) => updateScanItem(i, "grams", e.target.value)}
                            className="w-full px-2 py-1 rounded bg-dark-surface-2 border border-dark-border text-xs text-white outline-none focus:border-emerald-500"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] text-orange-400 uppercase">Cal</label>
                          <input
                            type="number"
                            value={itm.calories || ""}
                            onChange={(e) => updateScanItem(i, "calories", e.target.value)}
                            className="w-full px-2 py-1 rounded bg-dark-surface-2 border border-dark-border text-xs text-orange-400 font-bold outline-none focus:border-emerald-500"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] text-rose-400 uppercase">Pro (g)</label>
                          <input
                            type="number"
                            value={itm.protein || ""}
                            onChange={(e) => updateScanItem(i, "protein", e.target.value)}
                            className="w-full px-2 py-1 rounded bg-dark-surface-2 border border-dark-border text-xs text-rose-400 font-bold outline-none focus:border-emerald-500"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] text-amber-400 uppercase">Carb (g)</label>
                          <input
                            type="number"
                            value={itm.carbs || ""}
                            onChange={(e) => updateScanItem(i, "carbs", e.target.value)}
                            className="w-full px-2 py-1 rounded bg-dark-surface-2 border border-dark-border text-xs text-amber-400 font-bold outline-none focus:border-emerald-500"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Save button */}
                <button
                  onClick={saveScanResult}
                  disabled={saveLoading}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-lime-500 text-dark-bg font-extrabold text-sm hover:opacity-95 transition-all shadow-glow btn-press flex items-center justify-center gap-2 cursor-pointer"
                >
                  {saveLoading ? (
                    <div className="w-4 h-4 rounded-full border-2 border-dark-bg border-t-transparent animate-spin" />
                  ) : (
                    "✓ Save Meal to Log"
                  )}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* ── AI TEXT TAB ── */}
      {activeTab === "text" && (
        <div className="space-y-3">
          <label className="text-xs font-semibold text-dark-muted">
            Describe what you ate in natural language:
          </label>
          <textarea
            rows={3}
            placeholder="e.g. 2 whole wheat rotis, 1 bowl yellow dal, and 100g paneer"
            value={aiText}
            onChange={(e) => setAiText(e.target.value)}
            className="w-full p-3 rounded-xl border border-dark-border/80 bg-dark-surface-2 text-sm text-dark-text placeholder:text-dark-muted/60 outline-none focus:border-emerald-500 transition-all resize-none"
          />
          <button
            onClick={analyzeText}
            disabled={aiLoading}
            className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-dark-bg font-bold text-xs transition-all btn-press flex items-center justify-center gap-2 cursor-pointer"
          >
            {aiLoading ? (
              <div className="w-3.5 h-3.5 rounded-full border-2 border-dark-bg border-t-transparent animate-spin" />
            ) : (
              "Analyze Meal Description"
            )}
          </button>
        </div>
      )}

      {/* ── MANUAL ENTRY TAB ── */}
      {activeTab === "manual" && (
        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-dark-muted mb-1 block">Food Item</label>
            <input
              placeholder="e.g. Grilled Chicken Breast"
              value={item}
              onChange={(e) => setItem(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-dark-border/80 bg-dark-surface-2 text-sm text-dark-text outline-none focus:border-emerald-500"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-dark-muted mb-1 block">Portion / Quantity</label>
            <input
              placeholder="e.g. 150g or 1 cup"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-dark-border/80 bg-dark-surface-2 text-sm text-dark-text outline-none focus:border-emerald-500"
            />
          </div>
          <div className="grid grid-cols-4 gap-2">
            <div>
              <label className="text-[10px] text-orange-400 font-bold block mb-1">Calories</label>
              <input
                type="number"
                placeholder="kcal"
                value={calories}
                onChange={(e) => setCalories(e.target.value)}
                className="w-full px-2 py-1.5 rounded-xl border border-dark-border/80 bg-dark-surface-2 text-xs text-orange-400 font-bold outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="text-[10px] text-rose-400 font-bold block mb-1">Protein</label>
              <input
                type="number"
                placeholder="g"
                value={protein}
                onChange={(e) => setProtein(e.target.value)}
                className="w-full px-2 py-1.5 rounded-xl border border-dark-border/80 bg-dark-surface-2 text-xs text-rose-400 font-bold outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="text-[10px] text-amber-400 font-bold block mb-1">Carbs</label>
              <input
                type="number"
                placeholder="g"
                value={carbs}
                onChange={(e) => setCarbs(e.target.value)}
                className="w-full px-2 py-1.5 rounded-xl border border-dark-border/80 bg-dark-surface-2 text-xs text-amber-400 font-bold outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="text-[10px] text-sky-400 font-bold block mb-1">Fat</label>
              <input
                type="number"
                placeholder="g"
                value={fat}
                onChange={(e) => setFat(e.target.value)}
                className="w-full px-2 py-1.5 rounded-xl border border-dark-border/80 bg-dark-surface-2 text-xs text-sky-400 font-bold outline-none focus:border-emerald-500"
              />
            </div>
          </div>
          <button
            onClick={addManualFood}
            disabled={loading}
            className="w-full mt-2 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-dark-bg font-bold text-xs transition-all btn-press flex items-center justify-center gap-2 cursor-pointer"
          >
            {loading ? (
              <div className="w-3.5 h-3.5 rounded-full border-2 border-dark-bg border-t-transparent animate-spin" />
            ) : (
              "+ Add Food Item"
            )}
          </button>
        </div>
      )}
    </div>
  );
};

export default FoodForm;
