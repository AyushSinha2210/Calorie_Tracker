export const MEAL_TYPES = [
  "Breakfast",
  "Lunch",
  "Evening Snacks",
  "Dinner",
  "Late Night",
];

export const MEAL_TYPES_WITH_OTHER = [
  ...MEAL_TYPES,
  "Others",
];

export const MEAL_COLORS = {
  Breakfast: "#FF9800",
  Lunch: "#4CAF50",
  "Evening Snacks": "#10b981",
  Dinner: "#2196F3",
  "Late Night": "#607D8B",
  Others: "#795548",
};

export const detectMealType = () => {
  const h = new Date().getHours();
  if (h >= 6 && h < 11) return "Breakfast";
  if (h >= 11 && h < 15) return "Lunch";
  if (h >= 15 && h < 18) return "Evening Snacks";
  if (h >= 18 && h < 22) return "Dinner";
  return "Late Night";
};

