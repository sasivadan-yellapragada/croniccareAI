import { useEffect, useMemo, useState } from "react";
import { NavBar } from "@/components/NavBar";
import { authHeaders } from "@/lib/auth";
import { FileUp, AlertTriangle, CheckCircle2 } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";

type ReportItem = {
  _id: string;
  reportName?: string;
  reportType?: string;
  createdAt?: string;
  aiAnalysis?: {
    summary?: string;
    foodHabits?: string[];
    exerciseIdeas?: string[];
    medicationsToDiscuss?: string[];
    safetyNotes?: string[];
    safety?: string[];
  };
  metrics?: Array<{
    key: string;
    label: string;
    value: number;
    unit: string;
    status: "low" | "normal" | "high" | "unknown";
  }>;
  outOfRangeMetrics?: Array<{
    key: string;
    label: string;
    value: number;
    unit: string;
    status: "low" | "high";
  }>;
};

type MetricPoint = {
  id?: string;
  key: string;
  label: string;
  value: number;
  unit: string;
  createdAt: string;
  reportName?: string;
  source?: "report" | "vitals";
};

type VitalsHistoryItem = {
  _id: string;
  createdAt?: string;
  input?: {
    heightCm?: number;
    weightKg?: number;
    systolicBp?: number;
    diastolicBp?: number;
    heartRate?: number;
    sleepHours?: number;
    alcoholConsumption?: number;
    fruitConsumption?: number;
    greenVegetablesConsumption?: number;
    friedPotatoConsumption?: number;
  };
};

const BLOOD_PRESSURE_KEY = "__blood_pressure";

const VITAL_METRICS: Array<{
  key: string;
  label: string;
  unit: string;
  pick: (input: NonNullable<VitalsHistoryItem["input"]>) => number | undefined;
}> = [
  { key: "bp_systolic", label: "Systolic BP", unit: "mmHg", pick: (input) => input.systolicBp },
  { key: "bp_diastolic", label: "Diastolic BP", unit: "mmHg", pick: (input) => input.diastolicBp },
  { key: "heart_rate", label: "Heart Rate", unit: "bpm", pick: (input) => input.heartRate },
  { key: "sleep_hours", label: "Sleep Hours", unit: "hours", pick: (input) => input.sleepHours },
  { key: "weight_kg", label: "Weight", unit: "kg", pick: (input) => input.weightKg },
  { key: "height_cm", label: "Height", unit: "cm", pick: (input) => input.heightCm },
  { key: "alcohol_consumption", label: "Alcohol Consumption", unit: "days/month", pick: (input) => input.alcoholConsumption },
  { key: "fruit_consumption", label: "Fruit Consumption", unit: "days/month", pick: (input) => input.fruitConsumption },
  {
    key: "green_vegetables_consumption",
    label: "Green Vegetable Consumption",
    unit: "days/month",
    pick: (input) => input.greenVegetablesConsumption,
  },
  { key: "fried_potato_consumption", label: "Fried Potato Consumption", unit: "days/month", pick: (input) => input.friedPotatoConsumption },
];

function shortDate(date?: string) {
  if (!date) return "-";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString();
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export default function ReportsPage() {
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [analyzingReportIds, setAnalyzingReportIds] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [metrics, setMetrics] = useState<MetricPoint[]>([]);
  const [selectedMetric, setSelectedMetric] = useState<string>("");
  const [reportType, setReportType] = useState("CBC");
  const [file, setFile] = useState<File | null>(null);

  const apiFetch = async (path: string, init?: RequestInit): Promise<Response> => {
    const urls = [path, `http://127.0.0.1:8000${path}`];
    let last: Response | null = null;
    for (const url of urls) {
      const res = await fetch(url, init);
      if (res.ok) return res;
      last = res;
      if (res.status !== 404) return res;
    }
    return last as Response;
  };

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const headers = authHeaders();
      const [reportsRes, metricsRes, vitalsRes] = await Promise.all([
        apiFetch("/api/reports/me?limit=50", { headers }),
        apiFetch("/api/reports/metrics/me?limit=300", { headers }),
        apiFetch("/api/predictions/me?limit=300", { headers }),
      ]);
      if (!reportsRes.ok) throw new Error(await reportsRes.text());
      if (!metricsRes.ok) throw new Error(await metricsRes.text());
      if (!vitalsRes.ok) throw new Error(await vitalsRes.text());
      const rj = (await reportsRes.json()) as { items: ReportItem[] };
      const mj = (await metricsRes.json()) as { items: MetricPoint[] };
      const vj = (await vitalsRes.json()) as { items: VitalsHistoryItem[] };
      const vitalsMetrics = (vj.items || []).flatMap((item) => {
        const input = item.input;
        if (!input || !item.createdAt) return [];
        return VITAL_METRICS.flatMap((metric) => {
          const value = metric.pick(input);
          if (!isNumber(value)) return [];
          return {
            id: `${item._id}-${metric.key}`,
            key: metric.key,
            label: metric.label,
            value,
            unit: metric.unit,
            createdAt: item.createdAt,
            reportName: "Logged vitals",
            source: "vitals" as const,
          };
        });
      });
      setReports(rj.items || []);
      setMetrics([...(mj.items || []).map((m) => ({ ...m, source: "report" as const })), ...vitalsMetrics]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load reports");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const metricOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of metrics) map.set(m.key, m.label);
    const options = Array.from(map.entries()).map(([key, label]) => ({ key, label }));
    const hasBloodPressure = map.has("bp_systolic") || map.has("bp_diastolic");
    if (hasBloodPressure) {
      return [{ key: BLOOD_PRESSURE_KEY, label: "Blood Pressure" }, ...options];
    }
    return options;
  }, [metrics]);

  useEffect(() => {
    if (!selectedMetric && metricOptions.length) setSelectedMetric(metricOptions[0].key);
  }, [metricOptions, selectedMetric]);

  const trendData = useMemo(() => {
    const selectedKeys =
      selectedMetric === BLOOD_PRESSURE_KEY ? ["bp_systolic", "bp_diastolic"] : [selectedMetric];

    const rows = new Map<string, { date: string; sortTime: number; value?: number; systolic?: number; diastolic?: number }>();
    metrics
      .filter((m) => selectedKeys.includes(m.key))
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      .forEach((m, i) => {
        const time = new Date(m.createdAt).getTime();
        const rowKey = Number.isNaN(time) ? `${m.createdAt}-${i}` : String(time);
        const row = rows.get(rowKey) || {
          date: shortDate(m.createdAt),
          sortTime: Number.isNaN(time) ? i : time,
        };
        if (selectedMetric === BLOOD_PRESSURE_KEY) {
          if (m.key === "bp_systolic") row.systolic = m.value;
          if (m.key === "bp_diastolic") row.diastolic = m.value;
        } else {
          row.value = m.value;
        }
        rows.set(rowKey, row);
      });

    return Array.from(rows.values()).sort((a, b) => a.sortTime - b.sortTime);
  }, [metrics, selectedMetric]);

  const selectedMetricLabel = metricOptions.find((m) => m.key === selectedMetric)?.label || "Metric";
  const selectedMetricUnit =
    selectedMetric === BLOOD_PRESSURE_KEY
      ? "mmHg"
      : metrics.find((m) => m.key === selectedMetric)?.unit || "";

  const onUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("reportType", reportType);
      const res = await apiFetch("/api/reports/upload", {
        method: "POST",
        headers: authHeaders(),
        body: fd,
      });
      if (!res.ok) throw new Error(await res.text());
      setFile(null);
      await load();
    } catch (e2) {
      setError(e2 instanceof Error ? e2.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const analyzeWithAi = async (reportId: string) => {
    setError(null);
    setAnalyzingReportIds((prev) => ({ ...prev, [reportId]: true }));
    try {
      const res = await apiFetch("/api/reports/analyze", {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ reportId, mode: "lifestyle" }),
      });
      if (!res.ok) throw new Error(await res.text());
      await load();
    } catch (e2) {
      setError(e2 instanceof Error ? e2.message : "Analysis failed");
    } finally {
      setAnalyzingReportIds((prev) => ({ ...prev, [reportId]: false }));
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <NavBar />
      <main className="max-w-6xl mx-auto px-4 pt-24 pb-12">
        <h1 className="text-3xl font-extrabold text-foreground tracking-tight mb-2">Reports & OCR Summary</h1>
        <p className="text-muted-foreground mb-6">Upload PDF/image reports, extract trendable metrics, and flag out-of-range values.</p>

        <form onSubmit={onUpload} className="bg-card border border-border rounded-2xl p-5 shadow-card mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
            <div className="md:col-span-2">
              <label className="text-sm font-semibold text-foreground">Report File (PDF/Image)</label>
              <input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.webp,.bmp,.tiff"
                onChange={(ev) => setFile(ev.target.files?.[0] || null)}
                className="mt-2 w-full border border-border rounded-xl px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-foreground">Report Type</label>
              <select
                value={reportType}
                onChange={(ev) => setReportType(ev.target.value)}
                className="mt-2 w-full border border-border rounded-xl px-3 py-2 text-sm bg-background"
              >
                <option value="CBC">CBC</option>
                <option value="ECG">ECG</option>
                <option value="Lipid Profile">Lipid Profile</option>
                <option value="Diabetes Panel">Diabetes Panel</option>
                <option value="General">General</option>
              </select>
            </div>
            <button
              type="submit"
              disabled={!file || uploading}
              className="inline-flex items-center justify-center gap-2 py-2.5 rounded-xl gradient-primary text-primary-foreground font-semibold disabled:opacity-60"
            >
              <FileUp className="w-4 h-4" />
              {uploading ? "Uploading..." : "Upload"}
            </button>
          </div>
        </form>

        {error && <div className="mb-4 text-sm text-red-600 whitespace-pre-wrap">{error}</div>}

        {!loading && metricOptions.length > 0 && (
          <section className="bg-card border border-border rounded-2xl p-5 shadow-card mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xl font-bold text-foreground">Metric Trends</h2>
              <select
                value={selectedMetric}
                onChange={(e) => setSelectedMetric(e.target.value)}
                className="border border-border rounded-lg px-3 py-1.5 text-sm bg-background"
              >
                {metricOptions.map((m) => (
                  <option key={m.key} value={m.key}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip />
                  <Legend />
                  {selectedMetric === BLOOD_PRESSURE_KEY ? (
                    <>
                      <Line name="Systolic" type="monotone" dataKey="systolic" stroke="hsl(178 65% 38%)" strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
                      <Line name="Diastolic" type="monotone" dataKey="diastolic" stroke="hsl(12 76% 55%)" strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
                    </>
                  ) : (
                    <Line name={selectedMetricUnit ? `${selectedMetricLabel} (${selectedMetricUnit})` : selectedMetricLabel} type="monotone" dataKey="value" stroke="hsl(178 65% 38%)" strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>
        )}

        <section className="bg-card border border-border rounded-2xl p-5 shadow-card">
          <h2 className="text-xl font-bold text-foreground mb-4">Uploaded Reports</h2>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading reports...</p>
          ) : reports.length === 0 ? (
            <p className="text-sm text-muted-foreground">No reports uploaded yet.</p>
          ) : (
            <div className="space-y-4">
              {reports.map((r) => (
                <div key={r._id} className="border border-border rounded-xl p-4 bg-background">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="font-semibold text-foreground">{r.reportName || "Report"}</p>
                      <p className="text-xs text-muted-foreground">
                        {r.reportType || "General"} • {r.createdAt ? new Date(r.createdAt).toLocaleString() : "Unknown time"}
                      </p>
                    </div>
                    {(r.outOfRangeMetrics?.length || 0) > 0 ? (
                      <span className="inline-flex items-center gap-1 text-xs text-red-600 font-semibold">
                        <AlertTriangle className="w-4 h-4" />
                        {(r.outOfRangeMetrics || []).length} out-of-range
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-semibold">
                        <CheckCircle2 className="w-4 h-4" />
                        In range
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                    {(r.metrics || []).map((m) => (
                      <div key={`${r._id}-${m.key}`} className="rounded-lg border border-border px-3 py-2">
                        <p className="text-sm font-medium text-foreground">{m.label}</p>
                        <p className="text-sm text-muted-foreground">
                          {m.value} {m.unit} • {m.status}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-3">
                    {r.aiAnalysis?.summary ? (
                      <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                        AI analysis ready
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">AI analysis not generated yet</span>
                    )}

                    <button
                      type="button"
                      onClick={() => void analyzeWithAi(r._id)}
                      disabled={!!analyzingReportIds[r._id]}
                      className="inline-flex items-center justify-center gap-2 py-2 rounded-lg border border-border px-3 text-sm font-semibold disabled:opacity-60"
                    >
                      {analyzingReportIds[r._id] ? "Analyzing..." : "Analyze with AI"}
                    </button>
                  </div>

                  {r.aiAnalysis?.summary ? (
                    <div className="mt-3 space-y-3">
                      <div>
                        <p className="text-sm font-semibold text-foreground">AI Summary</p>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{r.aiAnalysis.summary}</p>
                      </div>

                      {r.aiAnalysis.foodHabits?.length ? (
                        <div>
                          <p className="text-sm font-semibold text-foreground">Food habits</p>
                          <div className="mt-1 text-sm text-muted-foreground space-y-1">
                            {r.aiAnalysis.foodHabits.slice(0, 6).map((x, idx) => (
                              <div key={`${r._id}-food-${idx}`}>- {x}</div>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      {r.aiAnalysis.exerciseIdeas?.length ? (
                        <div>
                          <p className="text-sm font-semibold text-foreground">Exercise ideas</p>
                          <div className="mt-1 text-sm text-muted-foreground space-y-1">
                            {r.aiAnalysis.exerciseIdeas.slice(0, 6).map((x, idx) => (
                              <div key={`${r._id}-ex-${idx}`}>- {x}</div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
