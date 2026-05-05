import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { NavBar } from "@/components/NavBar";
import { saveHealthProfile, setNeedsOnboarding } from "@/lib/auth";

const previousDiseaseOptions = ["Covid-19", "Typhoid", "Dengue", "Heart Surgery", "Fracture", "Other"];
const chronicOptions = ["Diabetes", "Hypertension", "Asthma", "Arthritis", "Kidney Disease", "Heart Disease"];

export default function OnboardingHealthPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [age, setAge] = useState<number | "">("");
  const [sex, setSex] = useState("");
  const [bloodGroup, setBloodGroup] = useState("");
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [contact, setContact] = useState("");

  const [previousDiseases, setPreviousDiseases] = useState<string[]>([]);
  const [chronicDiseases, setChronicDiseases] = useState<string[]>([]);

  const bmi = useMemo(() => {
    const h = Number(height);
    const w = Number(weight);
    if (!h || !w || h <= 0 || w <= 0) return undefined;
    const m = h / 100;
    return Number((w / (m * m)).toFixed(2));
  }, [height, weight]);

  const toggle = (value: string, list: string[], set: (v: string[]) => void) => {
    if (list.includes(value)) set(list.filter((x) => x !== value));
    else set([...list, value]);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await saveHealthProfile({
        age: age === "" ? undefined : Number(age),
        sex: sex || undefined,
        bloodGroup: bloodGroup || undefined,
        height: height || undefined,
        weight: weight || undefined,
        contact: contact || undefined,
        bmi,
        previousDiseases,
        chronicDiseases,
      });
      setNeedsOnboarding(false);
      navigate("/app", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save health profile");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <NavBar />
      <main className="max-w-3xl mx-auto px-4 pt-24 pb-12">
        <h1 className="text-3xl font-extrabold text-foreground tracking-tight mb-2">Health Onboarding</h1>
        <p className="text-muted-foreground mb-6">Before continuing, tell us about your previous and chronic health issues.</p>

        <form onSubmit={onSubmit} className="bg-card border border-border rounded-2xl p-6 shadow-card space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-semibold text-foreground">Age</label>
              <input
                type="number"
                className="mt-2 w-full bg-background border border-border rounded-xl px-3 py-2 text-sm text-foreground"
                value={age}
                onChange={(e) => setAge(e.target.value === "" ? "" : Number(e.target.value))}
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-foreground">Sex</label>
              <select
                className="mt-2 w-full bg-background border border-border rounded-xl px-3 py-2 text-sm text-foreground"
                value={sex}
                onChange={(e) => setSex(e.target.value)}
              >
                <option value="">Select</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-semibold text-foreground">Blood Group</label>
              <input
                type="text"
                placeholder="e.g. O+"
                className="mt-2 w-full bg-background border border-border rounded-xl px-3 py-2 text-sm text-foreground"
                value={bloodGroup}
                onChange={(e) => setBloodGroup(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-foreground">Contact</label>
              <input
                type="text"
                className="mt-2 w-full bg-background border border-border rounded-xl px-3 py-2 text-sm text-foreground"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-foreground">Height (cm)</label>
              <input
                type="number"
                className="mt-2 w-full bg-background border border-border rounded-xl px-3 py-2 text-sm text-foreground"
                value={height}
                onChange={(e) => setHeight(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-foreground">Weight (kg)</label>
              <input
                type="number"
                className="mt-2 w-full bg-background border border-border rounded-xl px-3 py-2 text-sm text-foreground"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">BMI: {bmi ?? "N/A"}</p>
            </div>
          </div>

          <div>
            <h2 className="text-sm font-semibold text-foreground mb-2">Previous Health Issues</h2>
            <div className="flex flex-wrap gap-2">
              {previousDiseaseOptions.map((opt) => (
                <button
                  type="button"
                  key={opt}
                  onClick={() => toggle(opt, previousDiseases, setPreviousDiseases)}
                  className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                    previousDiseases.includes(opt)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-foreground border-border"
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          <div>
            <h2 className="text-sm font-semibold text-foreground mb-2">Chronic Diseases</h2>
            <div className="flex flex-wrap gap-2">
              {chronicOptions.map((opt) => (
                <button
                  type="button"
                  key={opt}
                  onClick={() => toggle(opt, chronicDiseases, setChronicDiseases)}
                  className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                    chronicDiseases.includes(opt)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-foreground border-border"
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          {error && <div className="text-sm text-red-600 whitespace-pre-wrap">{error}</div>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-2xl gradient-primary text-primary-foreground font-bold shadow-glow hover:shadow-glow transition-all disabled:opacity-70"
          >
            {loading ? "Saving..." : "Continue to Dashboard"}
          </button>
        </form>
      </main>
    </div>
  );
}

