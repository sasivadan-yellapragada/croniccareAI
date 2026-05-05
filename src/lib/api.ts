import type { HealthResult, UserFeaturesInput } from "./healthUtils";
import { getToken } from "./auth";

export async function predictHealth(features: UserFeaturesInput): Promise<HealthResult> {
  const payload = {
    generalHealth: features.generalHealth,
    checkup: features.checkup,
    exercise: features.exercise,
    skinCancer: features.skinCancer,
    otherCancer: features.otherCancer,
    sex: features.sex,
    ageCategory: features.ageCategory,
    heightCm: features.heightCm,
    weightKg: features.weightKg,
    smokingHistory: features.smokingHistory,
    alcoholConsumption: features.alcoholConsumption,
    fruitConsumption: features.fruitConsumption,
    greenVegetablesConsumption: features.greenVegetablesConsumption,
    friedPotatoConsumption: features.friedPotatoConsumption,
    systolicBp: features.systolicBp ?? null,
    diastolicBp: features.diastolicBp ?? null,
    heartRate: features.heartRate ?? null,
    sleepHours: features.sleepHours ?? null,
    lifestyleNotes: features.lifestyleNotes ?? "",
  };

  const res = await fetch("/api/predict", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Request failed: ${res.status}`);
  }

  return res.json() as Promise<HealthResult>;
}

