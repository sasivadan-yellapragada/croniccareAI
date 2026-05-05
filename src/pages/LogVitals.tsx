import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { NavBar } from "@/components/NavBar";
import { predictHealth } from "@/lib/api";
import { calculateBmi, type HealthResult, type UserFeaturesInput } from "@/lib/healthUtils";
import { ChevronRight, Activity, Heart, Leaf, Lock, Scale, User } from "lucide-react";

interface LocationState {
  features: UserFeaturesInput & { bmi: number };
  result: HealthResult;
}

const LogVitals = () => {
  const navigate = useNavigate();
  const [features, setFeatures] = useState<UserFeaturesInput>({
    generalHealth: "Good",
    checkup: "Within the past year",
    exercise: "Yes",
    skinCancer: "No",
    otherCancer: "No",
    sex: "Female",
    ageCategory: "70-74",
    heightCm: 165,
    weightKg: 70,
    smokingHistory: "No",
    alcoholConsumption: 0,
    fruitConsumption: 30,
    greenVegetablesConsumption: 8,
    friedPotatoConsumption: 4,
    systolicBp: 120,
    diastolicBp: 80,
    heartRate: 72,
    sleepHours: 7,
    lifestyleNotes: "",
  });

  const bmi = useMemo(() => calculateBmi(features.heightCm, features.weightKg), [features.heightCm, features.weightKg]);
  const [loading, setLoading] = useState(false);

  const handleChange = <K extends keyof UserFeaturesInput>(field: K, value: UserFeaturesInput[K]) => {
    setFeatures((prev) => ({ ...prev, [field]: value }));
  };

  const yesNo = ["Yes", "No"];
  const generalHealthOptions = ["Poor", "Fair", "Good", "Very Good", "Excellent"];
  const checkupOptions = [
    "Within the past year",
    "Within the past 2 years",
    "Within the past 5 years",
    "5 or more years ago",
    "Never",
  ];
  const ageCategoryOptions = [
    "18-24",
    "25-29",
    "30-34",
    "35-39",
    "40-44",
    "45-49",
    "50-54",
    "55-59",
    "60-64",
    "65-69",
    "70-74",
    "75-79",
    "80+",
  ];

  const handleAnalyze = async () => {
    setLoading(true);
    try {
      const result = await predictHealth(features);
      navigate("/results", { state: { features: { ...features, bmi }, result } satisfies LocationState });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Prediction failed";
      alert(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <NavBar />
      <main className="max-w-2xl mx-auto px-4 pt-24 pb-12">
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent text-accent-foreground text-sm font-medium mb-4">
            <Activity className="w-3.5 h-3.5" />
            Health Check
          </div>
          <h1 className="text-3xl font-extrabold text-foreground tracking-tight mb-2">Log Your Health</h1>
          <p className="text-muted-foreground">Enter details based on the dataset and get a personalized risk estimate.</p>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-card rounded-2xl border border-border p-5 shadow-card">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-xl bg-accent flex items-center justify-center">
                  <Heart className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <label className="text-sm font-semibold text-foreground">General Health</label>
                  <p className="text-xs text-muted-foreground">Overall wellness rating</p>
                </div>
              </div>
              <select
                value={features.generalHealth}
                onChange={(e) => handleChange("generalHealth", e.target.value)}
                className="w-full bg-card border border-border rounded-xl px-3 py-2 text-sm text-foreground"
              >
                {generalHealthOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            <div className="bg-card rounded-2xl border border-border p-5 shadow-card">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-xl bg-accent flex items-center justify-center">
                  <Activity className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <label className="text-sm font-semibold text-foreground">Checkup</label>
                  <p className="text-xs text-muted-foreground">When last seen a doctor</p>
                </div>
              </div>
              <select
                value={features.checkup}
                onChange={(e) => handleChange("checkup", e.target.value)}
                className="w-full bg-card border border-border rounded-xl px-3 py-2 text-sm text-foreground"
              >
                {checkupOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-card rounded-2xl border border-border p-5 shadow-card">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-xl bg-accent flex items-center justify-center">
                  <Activity className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <label className="text-sm font-semibold text-foreground">Exercise</label>
                  <p className="text-xs text-muted-foreground">Do you exercise?</p>
                </div>
              </div>
              <select
                value={features.exercise}
                onChange={(e) => handleChange("exercise", e.target.value)}
                className="w-full bg-card border border-border rounded-xl px-3 py-2 text-sm text-foreground"
              >
                {yesNo.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            <div className="bg-card rounded-2xl border border-border p-5 shadow-card">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-xl bg-accent flex items-center justify-center">
                  <User className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <label className="text-sm font-semibold text-foreground">Sex</label>
                  <p className="text-xs text-muted-foreground">Biological sex</p>
                </div>
              </div>
              <select
                value={features.sex}
                onChange={(e) => handleChange("sex", e.target.value)}
                className="w-full bg-card border border-border rounded-xl px-3 py-2 text-sm text-foreground"
              >
                {["Female", "Male"].map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-card rounded-2xl border border-border p-5 shadow-card">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-xl bg-accent flex items-center justify-center">
                  <Heart className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <label className="text-sm font-semibold text-foreground">Skin Cancer</label>
                  <p className="text-xs text-muted-foreground">History of skin cancer</p>
                </div>
              </div>
              <select
                value={features.skinCancer}
                onChange={(e) => handleChange("skinCancer", e.target.value)}
                className="w-full bg-card border border-border rounded-xl px-3 py-2 text-sm text-foreground"
              >
                {yesNo.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            <div className="bg-card rounded-2xl border border-border p-5 shadow-card">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-xl bg-accent flex items-center justify-center">
                  <Heart className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <label className="text-sm font-semibold text-foreground">Other Cancer</label>
                  <p className="text-xs text-muted-foreground">History of other cancers</p>
                </div>
              </div>
              <select
                value={features.otherCancer}
                onChange={(e) => handleChange("otherCancer", e.target.value)}
                className="w-full bg-card border border-border rounded-xl px-3 py-2 text-sm text-foreground"
              >
                {yesNo.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-card rounded-2xl border border-border p-5 shadow-card">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-xl bg-accent flex items-center justify-center">
                  <User className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <label className="text-sm font-semibold text-foreground">Age Category</label>
                  <p className="text-xs text-muted-foreground">Age range bucket</p>
                </div>
              </div>
              <select
                value={features.ageCategory}
                onChange={(e) => handleChange("ageCategory", e.target.value)}
                className="w-full bg-card border border-border rounded-xl px-3 py-2 text-sm text-foreground"
              >
                {ageCategoryOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            <div className="bg-card rounded-2xl border border-border p-5 shadow-card">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-xl bg-accent flex items-center justify-center">
                  <Scale className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <label className="text-sm font-semibold text-foreground">BMI (computed)</label>
                  <p className="text-xs text-muted-foreground">Based on height and weight</p>
                </div>
              </div>
              <div className="text-3xl font-extrabold text-primary">{bmi.toFixed(1)}</div>
              <p className="text-xs text-muted-foreground mt-1">kg/m²</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-card rounded-2xl border border-border p-5 shadow-card">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-xl bg-accent flex items-center justify-center">
                  <User className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <label className="text-sm font-semibold text-foreground">Height (cm)</label>
                  <p className="text-xs text-muted-foreground">Dataset range 91 - 241</p>
                </div>
              </div>
              <input
                type="number"
                value={features.heightCm}
                onChange={(e) => handleChange("heightCm", parseFloat(e.target.value) || 0)}
                className="w-full bg-card border border-border rounded-xl px-3 py-2 text-sm text-foreground"
                min={91}
                max={241}
                step={1}
              />
            </div>

            <div className="bg-card rounded-2xl border border-border p-5 shadow-card">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-xl bg-accent flex items-center justify-center">
                  <User className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <label className="text-sm font-semibold text-foreground">Weight (kg)</label>
                  <p className="text-xs text-muted-foreground">Dataset range 25 - 293</p>
                </div>
              </div>
              <input
                type="number"
                value={features.weightKg}
                onChange={(e) => handleChange("weightKg", parseFloat(e.target.value) || 0)}
                className="w-full bg-card border border-border rounded-xl px-3 py-2 text-sm text-foreground"
                min={25}
                max={293}
                step={0.1}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-card rounded-2xl border border-border p-5 shadow-card">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-xl bg-accent flex items-center justify-center">
                  <Heart className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <label className="text-sm font-semibold text-foreground">Smoking History</label>
                  <p className="text-xs text-muted-foreground">Smoker or not</p>
                </div>
              </div>
              <select
                value={features.smokingHistory}
                onChange={(e) => handleChange("smokingHistory", e.target.value)}
                className="w-full bg-card border border-border rounded-xl px-3 py-2 text-sm text-foreground"
              >
                {yesNo.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            <div className="bg-card rounded-2xl border border-border p-5 shadow-card">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-xl bg-accent flex items-center justify-center">
                  <Heart className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <label className="text-sm font-semibold text-foreground">Alcohol Consumption</label>
                  <p className="text-xs text-muted-foreground">0 - 30 (dataset scale)</p>
                </div>
              </div>
              <input
                type="number"
                value={features.alcoholConsumption}
                onChange={(e) => handleChange("alcoholConsumption", parseFloat(e.target.value) || 0)}
                className="w-full bg-card border border-border rounded-xl px-3 py-2 text-sm text-foreground"
                min={0}
                max={30}
                step={0.5}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-card rounded-2xl border border-border p-5 shadow-card">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-xl bg-accent flex items-center justify-center">
                  <Leaf className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <label className="text-sm font-semibold text-foreground">Fruit Consumption</label>
                  <p className="text-xs text-muted-foreground">0 - 120 (dataset scale)</p>
                </div>
              </div>
              <input
                type="number"
                value={features.fruitConsumption}
                onChange={(e) => handleChange("fruitConsumption", parseFloat(e.target.value) || 0)}
                className="w-full bg-card border border-border rounded-xl px-3 py-2 text-sm text-foreground"
                min={0}
                max={120}
                step={1}
              />
            </div>

            <div className="bg-card rounded-2xl border border-border p-5 shadow-card">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-xl bg-accent flex items-center justify-center">
                  <Leaf className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <label className="text-sm font-semibold text-foreground">Green Vegetables</label>
                  <p className="text-xs text-muted-foreground">0 - 128 (dataset scale)</p>
                </div>
              </div>
              <input
                type="number"
                value={features.greenVegetablesConsumption}
                onChange={(e) => handleChange("greenVegetablesConsumption", parseFloat(e.target.value) || 0)}
                className="w-full bg-card border border-border rounded-xl px-3 py-2 text-sm text-foreground"
                min={0}
                max={128}
                step={1}
              />
            </div>
          </div>

          <div className="bg-card rounded-2xl border border-border p-5 shadow-card">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-xl bg-accent flex items-center justify-center">
                <Leaf className="w-4 h-4 text-primary" />
              </div>
              <div>
                <label className="text-sm font-semibold text-foreground">Fried Potato Consumption</label>
                <p className="text-xs text-muted-foreground">0 - 128 (dataset scale)</p>
              </div>
            </div>
            <input
              type="number"
              value={features.friedPotatoConsumption}
              onChange={(e) => handleChange("friedPotatoConsumption", parseFloat(e.target.value) || 0)}
              className="w-full bg-card border border-border rounded-xl px-3 py-2 text-sm text-foreground"
              min={0}
              max={128}
              step={1}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-card rounded-2xl border border-border p-5 shadow-card">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-xl bg-accent flex items-center justify-center">
                  <Activity className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <label className="text-sm font-semibold text-foreground">Blood Pressure (Systolic)</label>
                  <p className="text-xs text-muted-foreground">Optional, e.g. 120</p>
                </div>
              </div>
              <input
                type="number"
                value={features.systolicBp ?? ""}
                onChange={(e) => handleChange("systolicBp", parseInt(e.target.value, 10) || undefined)}
                className="w-full bg-card border border-border rounded-xl px-3 py-2 text-sm text-foreground"
                min={60}
                max={240}
                step={1}
              />
            </div>
            <div className="bg-card rounded-2xl border border-border p-5 shadow-card">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-xl bg-accent flex items-center justify-center">
                  <Activity className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <label className="text-sm font-semibold text-foreground">Blood Pressure (Diastolic)</label>
                  <p className="text-xs text-muted-foreground">Optional, e.g. 80</p>
                </div>
              </div>
              <input
                type="number"
                value={features.diastolicBp ?? ""}
                onChange={(e) => handleChange("diastolicBp", parseInt(e.target.value, 10) || undefined)}
                className="w-full bg-card border border-border rounded-xl px-3 py-2 text-sm text-foreground"
                min={40}
                max={140}
                step={1}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-card rounded-2xl border border-border p-5 shadow-card">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-xl bg-accent flex items-center justify-center">
                  <Heart className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <label className="text-sm font-semibold text-foreground">Heart Rate (bpm)</label>
                  <p className="text-xs text-muted-foreground">Optional resting heart rate</p>
                </div>
              </div>
              <input
                type="number"
                value={features.heartRate ?? ""}
                onChange={(e) => handleChange("heartRate", parseInt(e.target.value, 10) || undefined)}
                className="w-full bg-card border border-border rounded-xl px-3 py-2 text-sm text-foreground"
                min={30}
                max={220}
                step={1}
              />
            </div>
            <div className="bg-card rounded-2xl border border-border p-5 shadow-card">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-xl bg-accent flex items-center justify-center">
                  <Leaf className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <label className="text-sm font-semibold text-foreground">Sleep (hours)</label>
                  <p className="text-xs text-muted-foreground">Optional average last night</p>
                </div>
              </div>
              <input
                type="number"
                value={features.sleepHours ?? ""}
                onChange={(e) => handleChange("sleepHours", parseFloat(e.target.value) || undefined)}
                className="w-full bg-card border border-border rounded-xl px-3 py-2 text-sm text-foreground"
                min={0}
                max={24}
                step={0.5}
              />
            </div>
          </div>

          <div className="bg-card rounded-2xl border border-border p-5 shadow-card">
            <label className="text-sm font-semibold text-foreground">Lifestyle Notes</label>
            <p className="text-xs text-muted-foreground mb-2">Optional context for stress, routine, food, etc.</p>
            <textarea
              value={features.lifestyleNotes ?? ""}
              onChange={(e) => handleChange("lifestyleNotes", e.target.value)}
              className="w-full bg-card border border-border rounded-xl px-3 py-2 text-sm text-foreground min-h-24"
              placeholder="Example: walked 30 mins, high work stress, slept late."
            />
          </div>
        </div>

        <div className="mt-8">
          <button
            onClick={handleAnalyze}
            disabled={loading}
            className="w-full py-4 rounded-2xl gradient-primary text-primary-foreground font-bold text-lg shadow-glow hover:shadow-glow transition-all duration-300 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-3"
          >
            {loading ? (
              <>
                <div className="w-5 h-5 rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground animate-spin" />
                Analyzing Your Health...
              </>
            ) : (
              <>
                Analyze My Health
                <ChevronRight className="w-5 h-5" />
              </>
            )}
          </button>

          <div className="flex items-center justify-center gap-1.5 mt-4 text-muted-foreground text-sm">
            <Lock className="w-3.5 h-3.5" />
            <span>Your data is private and secure</span>
          </div>
        </div>
      </main>
    </div>
  );
};

export default LogVitals;

