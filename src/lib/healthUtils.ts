export type RiskLevel = "Low" | "Medium" | "High";
export type StatusLevel = "Normal" | "Slightly High" | "High";

export interface UserFeaturesInput {
  generalHealth: string; // Poor/Fair/Good/Very Good/Excellent
  checkup: string;
  exercise: string; // Yes/No
  skinCancer: string; // Yes/No
  otherCancer: string; // Yes/No
  sex: string; // Male/Female
  ageCategory: string;

  heightCm: number;
  weightKg: number;

  smokingHistory: string; // Yes/No
  alcoholConsumption: number;
  fruitConsumption: number;
  greenVegetablesConsumption: number;
  friedPotatoConsumption: number;
  systolicBp?: number;
  diastolicBp?: number;
  heartRate?: number;
  sleepHours?: number;
  lifestyleNotes?: string;
}

export interface HealthResult {
  risk: RiskLevel;
  score: number; // 0-100, higher = better
  probabilities?: Record<string, number>;
  predictionId: string;
  advice: {
    food: string;
    activity: string;
    hydration: string;
    sleep: string;
  };
}

export function calculateBmi(heightCm: number, weightKg: number): number {
  const h = heightCm / 100;
  if (!h || h <= 0) return 0;
  return weightKg / (h * h);
}

export function getGeneralHealthStatus(generalHealth: string): StatusLevel {
  if (generalHealth === "Poor") return "High";
  if (generalHealth === "Fair") return "Slightly High";
  return "Normal";
}

export function getExerciseStatus(exercise: string): StatusLevel {
  return exercise === "Yes" ? "Normal" : "High";
}

export function getBmiStatus(bmi: number): StatusLevel {
  if (bmi >= 30) return "High";
  if (bmi >= 25) return "Slightly High";
  return "Normal";
}

export function getRiskColor(risk: string) {
  if (risk === "Low") return { text: "text-risk-low", bg: "bg-risk-low-bg", ring: "stroke-risk-low" };
  if (risk === "Medium") return { text: "text-risk-medium", bg: "bg-risk-medium-bg", ring: "stroke-risk-medium" };
  return { text: "text-risk-high", bg: "bg-risk-high-bg", ring: "stroke-risk-high" };
}

export function getStatusColor(status: string) {
  if (status === "Normal") return "risk-low";
  if (status === "Slightly High") return "risk-medium";
  return "risk-high";
}

// Mock 7-day glucose trend
export function getMockTrend() {
  const labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Today"];
  const values = [98, 105, 102, 110, 107, 99, 103];
  return { labels, values };
}

// Simple AI chat response
export function getAIResponse(message: string): string {
  const lower = message.toLowerCase();

  if (lower.includes("eat") || lower.includes("food") || lower.includes("diet")) {
    return "Great question! 🥗 For managing chronic conditions, focus on:\n\n• **Leafy greens** like spinach, kale, and broccoli\n• **Lean proteins** — grilled chicken, fish, legumes\n• **Low-GI carbs** — quinoa, oats, sweet potato\n• **Healthy fats** — avocado, nuts, olive oil\n\nAvoid processed sugars, white bread, and fried foods as much as possible. Small, consistent meals help keep blood sugar stable!";
  }

  if (lower.includes("sugar") || lower.includes("glucose") || lower.includes("diabetes")) {
    return "To help lower blood sugar naturally: 🌿\n\n• Take a 15-min walk after meals — it's highly effective!\n• Eat fiber first (veggies), then protein, then carbs\n• Stay well-hydrated — dehydration raises glucose\n• Manage stress with deep breathing or meditation\n• Get consistent sleep — poor sleep spikes cortisol & glucose\n\nSmall daily habits make a big difference over time! 💪";
  }

  if (lower.includes("exercise") || lower.includes("workout") || lower.includes("activity")) {
    return "Here's a gentle exercise plan for you: 🏃‍♂️\n\n**Morning (10 min):** Light stretching + deep breathing\n**Midday (20 min):** Brisk walk or cycling\n**Evening (10 min):** Yoga or cool-down stretches\n\n**Weekly Goal:** 150 min of moderate activity\n\nStart slow and build gradually. Even a 10-min walk after meals is scientifically proven to help manage glucose and blood pressure! You've got this 🌟";
  }

  if (lower.includes("blood pressure") || lower.includes("hypertension") || lower.includes("bp")) {
    return "Managing blood pressure naturally: 💙\n\n• **DASH diet** — rich in fruits, veggies, low-fat dairy\n• **Reduce sodium** — aim for under 2,300mg/day\n• **Exercise regularly** — cardio is your best friend\n• **Manage stress** — try journaling or meditation\n• **Limit caffeine** and avoid smoking\n• **Sleep 7–8 hours** consistently\n\nMonitor your BP regularly and keep a log — it helps spot patterns!";
  }

  if (lower.includes("sleep")) {
    return "Quality sleep is medicine! 😴\n\n• Keep a consistent bedtime (even weekends)\n• Avoid screens 1 hour before bed\n• Keep your room cool and dark\n• Avoid heavy meals 2–3 hours before sleep\n• Try chamomile tea or light stretching at bedtime\n\nPoor sleep raises cortisol, which spikes both blood sugar and blood pressure. Prioritizing sleep is one of the best health investments you can make!";
  }

  if (lower.includes("stress") || lower.includes("anxiety")) {
    return "Stress management is crucial for chronic conditions: 🌸\n\n• **4-7-8 breathing:** Inhale 4s, hold 7s, exhale 8s\n• **5-min morning meditation** to set your day\n• **Journaling** — write 3 things you're grateful for\n• **Nature walks** reduce cortisol naturally\n• **Connect socially** — isolation increases stress\n\nChronic stress directly elevates blood sugar and blood pressure. Even small mindfulness moments add up!";
  }

  return "I'm here to support your wellness journey! 🌿 I can help you with:\n\n• **Diet & nutrition** advice for your condition\n• **Exercise plans** tailored to your needs\n• **Blood sugar management** tips\n• **Blood pressure** guidance\n• **Sleep & stress** strategies\n\nWhat would you like to explore today?";
}
