import { useEffect, useMemo, useState } from "react";
import { useLocation, Link, useNavigate } from "react-router-dom";
import { NavBar } from "@/components/NavBar";
import {
  type HealthResult,
  type UserFeaturesInput,
  getBmiStatus,
  getExerciseStatus,
  getGeneralHealthStatus,
  getRiskColor,
  getStatusColor,
} from "@/lib/healthUtils";
import { ArrowLeft, Dumbbell, Heart, Leaf, Lock, MessageCircle, Moon, Scale, Utensils, Waves, Activity } from "lucide-react";

interface LocationState {
  features: UserFeaturesInput & { bmi: number };
  result: HealthResult;
}

function RiskRing({ score, risk }: { score: number; risk: string }) {
  const [animated, setAnimated] = useState(0);
  const riskColors = getRiskColor(risk);
  const circumference = 2 * Math.PI * 54;
  const offset = circumference - (animated / 100) * circumference;

  useEffect(() => {
    const timer = window.setTimeout(() => setAnimated(score), 100);
    return () => window.clearTimeout(timer);
  }, [score]);

  const strokeColor = risk === "Low" ? "hsl(155 55% 42%)" : risk === "Medium" ? "hsl(38 90% 48%)" : "hsl(5 80% 52%)";

  return (
    <div className="relative w-40 h-40 mx-auto">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r="54" fill="none" stroke="hsl(210 25% 92%)" strokeWidth="10" />
        <circle
          cx="60"
          cy="60"
          r="54"
          fill="none"
          stroke={strokeColor}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(0.4, 0, 0.2, 1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-3xl font-extrabold ${riskColors.text}`}>{animated}%</span>
        <span className="text-sm font-semibold text-muted-foreground mt-0.5">{risk} Risk</span>
      </div>
    </div>
  );
}

function StatusCard({
  label,
  status,
  icon: Icon,
  value,
}: {
  label: string;
  status: string;
  icon: React.ElementType;
  value: string;
}) {
  const colorClass = getStatusColor(status);
  return (
    <div className="bg-card rounded-2xl border border-border p-4 shadow-card flex items-center gap-4">
      <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center flex-shrink-0">
        <Icon className="w-5 h-5 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground font-medium">{label}</p>
        <p className="text-sm font-semibold text-foreground truncate">{value}</p>
      </div>
      <span className={`${colorClass} text-xs font-bold px-2.5 py-1 rounded-full whitespace-nowrap`}>{status}</span>
    </div>
  );
}

const adviceItems = [
  { key: "food" as const, icon: Utensils, label: "Food" },
  { key: "activity" as const, icon: Dumbbell, label: "Activity" },
  { key: "hydration" as const, icon: Waves, label: "Hydration" },
  { key: "sleep" as const, icon: Moon, label: "Sleep" },
] as const;

const Results = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as LocationState | null;

  useEffect(() => {
    if (!state) navigate("/log-vitals");
  }, [state, navigate]);

  const content = useMemo(() => {
    if (!state) return null;
    const { features, result } = state;
    const riskColors = getRiskColor(result.risk);
    const summaryMessage =
      result.risk === "Low"
        ? "You're in great shape today. Keep up the healthy habits."
        : result.risk === "Medium"
        ? "Some areas need attention. Here are steps that can help."
        : "Let's work together to reduce risk over time.";

    return { features, result, riskColors, summaryMessage };
  }, [state]);

  if (!content) return null;

  const { features, result, riskColors, summaryMessage } = content;
  const generalHealthStatus = getGeneralHealthStatus(features.generalHealth);
  const exerciseStatus = getExerciseStatus(features.exercise);
  const bmiStatus = getBmiStatus(features.bmi);

  return (
    <div className="min-h-screen bg-background">
      <NavBar />
      <main className="max-w-2xl mx-auto px-4 pt-24 pb-12">
        <button
          onClick={() => navigate("/log-vitals")}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Log Vitals
        </button>

        <h1 className="text-3xl font-extrabold text-foreground tracking-tight mb-1">Your Health Report</h1>
        <p className="text-muted-foreground mb-8">Based on the details you provided</p>

        <div className="bg-card rounded-2xl border border-border p-8 shadow-card text-center mb-6">
          <RiskRing score={result.score} risk={result.risk} />
          <div className={`inline-flex items-center gap-2 mt-4 px-4 py-2 rounded-full text-sm font-bold ${riskColors.bg} ${riskColors.text}`}>
            ● Overall Health Score
          </div>
          <p className="text-muted-foreground text-sm mt-3 max-w-xs mx-auto">{summaryMessage}</p>
        </div>

        <div className="mb-6">
          <h2 className="text-lg font-bold text-foreground mb-3">Key Insights</h2>
          <div className="space-y-3">
            <StatusCard
              label="General Health"
              status={generalHealthStatus}
              icon={Heart}
              value={features.generalHealth}
            />
            <StatusCard label="Exercise" status={exerciseStatus} icon={Activity} value={features.exercise} />
            <StatusCard label="BMI" status={bmiStatus} icon={Scale} value={`${features.bmi.toFixed(1)} kg/m²`} />
          </div>
        </div>

        <div className="bg-card rounded-2xl border border-border p-6 shadow-card mb-6">
          <h2 className="text-lg font-bold text-foreground mb-4">Lifestyle Advice</h2>

          <div className="flex gap-3 mb-5">
            <div className="w-9 h-9 rounded-full gradient-primary flex items-center justify-center flex-shrink-0 shadow-soft">
              <Leaf className="w-4 h-4 text-primary-foreground" />
            </div>
            <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-foreground max-w-xs">
              Based on your estimated risk, here's what to focus on:
            </div>
          </div>

          <div className="space-y-3">
            {adviceItems.map(({ key, icon: Icon, label }) => (
              <div key={key} className="flex gap-3 items-start">
                <div className="w-8 h-8 rounded-xl bg-accent flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Icon className="w-4 h-4 text-accent-foreground" />
                </div>
                <div>
                  <p className="text-xs font-bold text-primary uppercase tracking-wide mb-0.5">{label}</p>
                  <p className="text-sm text-foreground leading-relaxed">{result.advice[key]}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-center gap-1.5 mt-5 text-muted-foreground text-sm">
            <Lock className="w-3.5 h-3.5" />
            Your data is private and secure
          </div>
        </div>

        <Link to="/assistant">
          <button className="w-full py-4 rounded-2xl gradient-primary text-primary-foreground font-bold text-lg shadow-glow hover:shadow-glow transition-all duration-300 hover:-translate-y-0.5 flex items-center justify-center gap-3">
            <MessageCircle className="w-5 h-5" />
            Ask a Question
          </button>
        </Link>
      </main>
    </div>
  );
};

export default Results;

