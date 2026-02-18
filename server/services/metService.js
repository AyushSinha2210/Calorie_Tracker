const MET = { running_moderate: 7, running_fast: 10, cycling: 6, walking_brisk: 4, weight_training: 5, yoga: 3, swimming: 8, jumping_rope: 12, hiking: 5.5, dancing: 4.5 };

export function calculateCalories(exercise, weight, durationMin) {
  const met = MET[exercise];
  if (!met) throw new Error(`Unknown exercise: ${exercise}. Available: ${Object.keys(MET).join(', ')}`);
  return Math.round(met * weight * (durationMin / 60));
}

export const getAvailableExercises = () => Object.entries(MET).map(([key, met]) => ({ key, met }));
