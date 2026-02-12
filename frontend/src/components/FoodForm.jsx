import { useState } from "react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";

const FoodForm = () => {
  const { user } = useAuth();
  const [item, setItem] = useState("");
  const [qty, setQty] = useState("");
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [loading, setLoading] = useState(false);
  const [aiText, setAiText] = useState("");
  const [aiResult, setAiResult] = useState(null);
  const [aiTotals, setAiTotals] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);

  const addFood = async () => {
    if (!item || !qty) {
      alert("Please enter food item and quantity");
      return;
    }

    setLoading(true);
    try {
      await addDoc(
        collection(db, "users", user.uid, "foodLogs"),
        {
          itemName: item,
          quantity: qty,
          calories: Number(calories) || 0,
          protein: Number(protein) || 0,
          date: new Date().toISOString().split("T")[0],
          createdAt: serverTimestamp(),
        }
      );

      setItem("");
      setQty("");
      setCalories("");
      setProtein("");
    } catch (error) {
      console.error("Error adding food:", error);
      alert("Failed to add food log");
    } finally {
      setLoading(false);
    }
  };
  const analyzeFood = async () => {
    if (!aiText) {
      alert("Please enter some food text to analyze");
      return;
    }

    setAiLoading(true);
    setAiResult(null);
    
    try {
      const response = await fetch("http://localhost:5000/analyze-food", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ text: aiText })
      });

      if (!response.ok) {
        throw new Error("Failed to analyze food");
      }

      const data = await response.json();
      setAiResult(data.items);
      setAiTotals({ calories: data.total_calories, protein: data.total_protein });
    } catch (error) {
      console.error("Error analyzing food:", error);
      alert("Failed to analyze food. Make sure the server is running on port 5000.");
    } finally {
      setAiLoading(false);
    }
  };
  const saveAiResults = async () => {
    if (!aiResult || !user) {
      alert("No results to save");
      return;
    }

    setSaveLoading(true);
    
    try {
      const today = new Date().toISOString().split("T")[0];

      for (const item of aiResult) {
        await addDoc(
          collection(db, "users", user.uid, "foodLogs"),
          {
            itemName: item.name,
            quantity: item.quantity,
            calories: item.calories,
            protein: item.protein,
            date: today,
            createdAt: serverTimestamp(),
          }
        );
      }

      alert(`Successfully saved ${aiResult.length} food item(s)!`);
      setAiResult(null);
      setAiTotals(null);
      setAiText("");
    } catch (error) {
      console.error("Error saving AI results:", error);
      alert("Failed to save food items. Please try again.");
    } finally {
      setSaveLoading(false);
    }
  };


  return (
    <div>
      <h2>Add Food Log</h2>
      <div>
        <hr />

<h3>AI Food Entry</h3>

<input
  placeholder="e.g. 2 rotis and 1 bowl dal"
  value={aiText}
  onChange={(e) => setAiText(e.target.value)}
/>

<button onClick={analyzeFood} disabled={aiLoading}>
  {aiLoading ? "Analyzing..." : "Analyze"}
</button>

{aiResult && (
  <div>
    <h4>Detected Items:</h4>

    {aiResult.map((item, index) => (
      <div key={`${item.name}-${item.quantity}-${index}`}>
        {item.name} - {item.quantity} - {item.calories} kcal - {item.protein}g protein
      </div>
    ))}

    {aiTotals && (
      <div style={{ marginTop: "10px", fontWeight: "bold", backgroundColor: "#f0f0f0", padding: "10px", borderRadius: "5px" }}>
        <div>Total Calories: {aiTotals.calories} kcal</div>
        <div>Total Protein: {aiTotals.protein}g</div>
      </div>
    )}

    <button onClick={saveAiResults} disabled={saveLoading}>
      {saveLoading ? "Saving..." : "Save All"}
    </button>
  </div>
)}


        <input
          placeholder="Food item (e.g., Chicken Breast)"
          value={item}
          onChange={(e) => setItem(e.target.value)}
        />
        <input
          placeholder="Quantity (e.g., 200g)"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
        />
        <input
          type="number"
          placeholder="Calories"
          value={calories}
          onChange={(e) => setCalories(e.target.value)}
        />
        <input
          type="number"
          placeholder="Protein (g)"
          value={protein}
          onChange={(e) => setProtein(e.target.value)}
        />
        <button 
          onClick={addFood}
          disabled={loading}
        >
          {loading ? "Adding..." : "Add Food"}
        </button>
      </div>
    </div>
  );
};

export default FoodForm;
