import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import API_URL from "../config";

const PromptGenerator = () => {
  const { userProfile } = useAuth();
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [generatedPrompt, setGeneratedPrompt] = useState("");
  const [promptTitle, setPromptTitle] = useState("");
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  // Extra fields for certain templates
  const [goal, setGoal] = useState("");
  const [fitnessLevel, setFitnessLevel] = useState("Beginner");
  const [dietPref, setDietPref] = useState("Indian vegetarian & non-vegetarian");
  const [targetWeight, setTargetWeight] = useState("");
  const [timeframe, setTimeframe] = useState("3 months");
  const [constraints, setConstraints] = useState("");

  useEffect(() => {
    fetch(`${API_URL}/ai-coach/templates`)
      .then(r => r.json())
      .then(setTemplates)
      .catch(() => {
        // Fallback templates in case server is down
        setTemplates([
          { key: "workout-home", title: "🏠 Home Workout Plan", description: "No equipment needed" },
          { key: "workout-gym", title: "🏋️ Gym Workout Plan", description: "Full gym routine" },
          { key: "workout-exercise", title: "🏃 Daily Exercise", description: "Quick 20-30 min routine" },
          { key: "diet-mess", title: "🍱 Mess Diet Plan", description: "Optimize mess meals" },
          { key: "diet-plan", title: "🥗 Diet Plan", description: "Custom weekly plan" },
          { key: "weight-loss", title: "⚖️ Weight Loss", description: "Diet + exercise strategy" },
        ]);
      });
  }, []);

  const generatePrompt = async (templateKey) => {
    setLoading(true);
    setSelectedTemplate(templateKey);
    try {
      const profile = {
        age: userProfile?.age,
        gender: userProfile?.gender,
        weight: userProfile?.weight,
        height: userProfile?.height,
        calorieTarget: userProfile?.dailyCalorieTarget,
        goal: goal || undefined,
        fitnessLevel,
        dietPref,
        targetWeight: targetWeight || undefined,
        timeframe,
        constraints: constraints || undefined,
      };

      const res = await fetch(`${API_URL}/ai-coach/prompt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateKey, profile }),
      });
      const data = await res.json();
      if (data.prompt) {
        setGeneratedPrompt(data.prompt);
        setPromptTitle(data.title);
      }
    } catch {
      setGeneratedPrompt("Failed to generate prompt. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(generatedPrompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const ta = document.createElement("textarea");
      ta.value = generatedPrompt;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-6">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-2xl">📋</span>
        <h3 className="text-lg font-bold text-gray-800 m-0">Prompt Generator</h3>
      </div>
      <p className="text-sm text-gray-500 mb-4 m-0">
        Generate ready-to-use prompts for ChatGPT, Gemini, or any AI — pre-filled with your profile data. Just copy & paste!
      </p>

      {/* Customization fields */}
      <div className="mb-4 p-3 bg-gray-50 rounded-xl border border-gray-100">
        <div className="text-sm font-semibold text-gray-600 mb-2">Customize (optional)</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div>
            <label htmlFor="pg-goal" className="text-xs font-medium text-gray-500 block mb-1">Your Goal</label>
            <input
              id="pg-goal"
              type="text"
              value={goal}
              onChange={e => setGoal(e.target.value)}
              placeholder="e.g. Lose 5kg, Build muscle"
              className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-1 focus:ring-brand-400 focus:border-brand-400 outline-none"
            />
          </div>
          <div>
            <label htmlFor="pg-fitness" className="text-xs font-medium text-gray-500 block mb-1">Fitness Level</label>
            <select
              id="pg-fitness"
              value={fitnessLevel}
              onChange={e => setFitnessLevel(e.target.value)}
              className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-1 focus:ring-brand-400 focus:border-brand-400 outline-none bg-white"
            >
              <option>Beginner</option>
              <option>Intermediate</option>
              <option>Advanced</option>
            </select>
          </div>
          <div>
            <label htmlFor="pg-diet" className="text-xs font-medium text-gray-500 block mb-1">Diet Preference</label>
            <input
              id="pg-diet"
              type="text"
              value={dietPref}
              onChange={e => setDietPref(e.target.value)}
              placeholder="e.g. Vegetarian, Keto"
              className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-1 focus:ring-brand-400 focus:border-brand-400 outline-none"
            />
          </div>
          <div>
            <label htmlFor="pg-target" className="text-xs font-medium text-gray-500 block mb-1">Target Weight (kg)</label>
            <input
              id="pg-target"
              type="number"
              value={targetWeight}
              onChange={e => setTargetWeight(e.target.value)}
              placeholder="e.g. 65"
              className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-1 focus:ring-brand-400 focus:border-brand-400 outline-none"
            />
          </div>
          <div>
            <label htmlFor="pg-time" className="text-xs font-medium text-gray-500 block mb-1">Timeframe</label>
            <select
              id="pg-time"
              value={timeframe}
              onChange={e => setTimeframe(e.target.value)}
              className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-1 focus:ring-brand-400 focus:border-brand-400 outline-none bg-white"
            >
              <option>1 month</option>
              <option>2 months</option>
              <option>3 months</option>
              <option>6 months</option>
              <option>1 year</option>
            </select>
          </div>
          <div>
            <label htmlFor="pg-const" className="text-xs font-medium text-gray-500 block mb-1">Constraints</label>
            <input
              id="pg-const"
              type="text"
              value={constraints}
              onChange={e => setConstraints(e.target.value)}
              placeholder="e.g. Bad knees, No running"
              className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-1 focus:ring-brand-400 focus:border-brand-400 outline-none"
            />
          </div>
        </div>
      </div>

      {/* Template buttons */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
        {templates.map(t => (
          <button
            key={t.key}
            onClick={() => generatePrompt(t.key)}
            disabled={loading}
            className={`text-left p-3 rounded-xl text-sm transition-all border ${selectedTemplate === t.key
              ? "bg-brand-50 border-brand-300 ring-1 ring-brand-200"
              : "bg-white border-gray-200 hover:border-brand-200 hover:bg-brand-50/30"
              } disabled:opacity-50`}
          >
            <div className="font-semibold text-gray-700">{t.title}</div>
            <div className="text-xs text-gray-400 mt-0.5">{t.description}</div>
          </button>
        ))}
      </div>

      {/* Generated prompt display */}
      <AnimatePresence>
        {generatedPrompt && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="relative"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-semibold text-gray-700">{promptTitle}</div>
              <button
                onClick={copyToClipboard}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${copied
                  ? "bg-green-100 text-green-700 border border-green-200"
                  : "bg-brand-50 text-brand-600 border border-brand-200 hover:bg-brand-100"
                  }`}
              >
                {copied ? "✓ Copied!" : "📋 Copy Prompt"}
              </button>
            </div>
            <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 max-h-80 overflow-y-auto">
              <pre className="whitespace-pre-wrap text-sm text-gray-700 font-sans m-0 leading-relaxed">
                {generatedPrompt}
              </pre>
            </div>
            <p className="text-xs text-gray-400 mt-2 m-0">
              Paste this prompt into ChatGPT, Gemini, Claude, or any AI assistant to get your personalized plan.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {loading && !generatedPrompt && (
        <div className="text-center py-4 text-sm text-gray-400">
          <span className="inline-block w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mr-2" />{" "}
          Generating prompt...
        </div>
      )}
    </div>
  );
};

export default PromptGenerator;
