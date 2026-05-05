import { Link } from "react-router-dom";
import { NavBar } from "@/components/NavBar";
import { useEffect, useMemo, useState } from "react";
import { authHeaders } from "@/lib/auth";
import { Activity, MessageCircle, TrendingUp, FileText, CalendarDays, Stethoscope, HeartPulse, Droplets, Scale, CheckCircle2 } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";

const Dashboard = () => {
  const [profile, setProfile] = useState<any>(null);
  const [vitals, setVitals] = useState<any[]>([]);
  const [chatHistory, setChatHistory] = useState<any[]>([]);
  const [upcomingTests, setUpcomingTests] = useState<
    Array<{ name: string; frequency: string; date: string; marked: boolean }>
  >([]);
  const [criticalAlerts, setCriticalAlerts] = useState<
    Array<{ key: string; severity: "high" | "critical"; title: string; detail: string }>
  >([]);
  const [doctorEmail, setDoctorEmail] = useState("");
  const [notifyResult, setNotifyResult] = useState<string | null>(null);

  const toDateInput = (d: Date) => d.toISOString().slice(0, 10);
  const plusDays = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return toDateInput(d);
  };

  useEffect(() => {
    const run = async () => {
      const headers = authHeaders();
      const [meRes, vitalsRes, chatRes] = await Promise.all([
        fetch("/api/auth/me", { headers }),
        fetch("/api/predictions/me?limit=30", { headers }),
        fetch("/api/chat/me?limit=10", { headers }),
      ]);
      if (meRes.ok) setProfile(await meRes.json());
      if (vitalsRes.ok) setVitals(((await vitalsRes.json()) as { items: any[] }).items || []);
      if (chatRes.ok) setChatHistory(((await chatRes.json()) as { items: any[] }).items || []);
      const alertsRes = await fetch("/api/alerts/critical/me", { headers });
      if (alertsRes.ok) {
        const alertsData = (await alertsRes.json()) as {
          alerts: Array<{ key: string; severity: "high" | "critical"; title: string; detail: string }>;
        };
        setCriticalAlerts(alertsData.alerts || []);
      }
    };
    void run();
  }, []);

  const notifyDoctor = async () => {
    setNotifyResult(null);
    try {
      const res = await fetch("/api/alerts/doctor-notify", {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ doctorEmail }),
      });
      const txt = await res.text();
      let parsed: any = null;
      try {
        parsed = JSON.parse(txt);
      } catch {
        parsed = null;
      }
      if (!res.ok) throw new Error((parsed && parsed.detail) || txt || `Request failed: ${res.status}`);
      setNotifyResult(parsed?.sent ? `Notification sent to ${parsed?.to || doctorEmail}.` : (parsed?.detail || "Notification not sent."));
    } catch (e) {
      setNotifyResult(e instanceof Error ? e.message : "Failed to notify doctor.");
    }
  };

  useEffect(() => {
    if (!profile?._id) return;
    const key = `croniccareai_upcoming_tests_${profile._id}`;
    const saved = localStorage.getItem(key);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as Array<{ name: string; frequency: string; date: string; marked: boolean }>;
        setUpcomingTests(parsed);
        return;
      } catch {
        // ignore parse errors and seed defaults
      }
    }
    setUpcomingTests([
      { name: "ECG Test", frequency: "Every month", date: plusDays(30), marked: false },
      { name: "Blood Test", frequency: "Every month", date: plusDays(30), marked: false },
      { name: "Urine Test", frequency: "Every month", date: plusDays(30), marked: false },
    ]);
  }, [profile?._id]);

  useEffect(() => {
    if (!profile?._id || upcomingTests.length === 0) return;
    const key = `croniccareai_upcoming_tests_${profile._id}`;
    localStorage.setItem(key, JSON.stringify(upcomingTests));
  }, [upcomingTests, profile?._id]);

  const sortedVitals = useMemo(
    () =>
      [...vitals].sort(
        (a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()
      ),
    [vitals]
  );

  const statsData = sortedVitals.map((item, i) => ({
    label: `#${i + 1}`,
    score: item.prediction?.score ?? 0,
    weight: item.input?.weightKg ?? 0,
    alcohol: item.input?.alcoholConsumption ?? 0,
  }));

  const latest = sortedVitals[sortedVitals.length - 1];
  const latestInput = latest?.input || {};
  const latestScore = latest?.prediction?.score ?? 0;
  const risk = latest?.prediction?.risk ?? "N/A";

  return (
    <div className="min-h-screen bg-background">
      <NavBar />
      <main className="max-w-7xl mx-auto px-4 pt-24 pb-12">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <aside className="bg-card border border-border rounded-2xl p-5 shadow-card lg:col-span-1">
            <div className="w-16 h-16 rounded-full bg-accent mx-auto mb-3" />
            <h2 className="text-center text-lg font-bold text-foreground">
              {profile?.name || profile?.email || "User"}
            </h2>
            <p className="text-center text-xs text-muted-foreground mt-1">
              Patient ID: {profile?.patientId || "N/A"}
            </p>
            <div className="mt-5 space-y-2 text-sm">
              <p><span className="text-muted-foreground">Blood Group:</span> {profile?.profile?.bloodGroup || "N/A"}</p>
              <p><span className="text-muted-foreground">BMI:</span> {profile?.profile?.bmi ?? "N/A"}</p>
              <p><span className="text-muted-foreground">Height:</span> {profile?.profile?.height || "N/A"}</p>
              <p><span className="text-muted-foreground">Weight:</span> {profile?.profile?.weight || "N/A"}</p>
              <p><span className="text-muted-foreground">Contact:</span> {profile?.profile?.contact || "N/A"}</p>
            </div>
          </aside>

          <section className="lg:col-span-3 bg-card border border-border rounded-2xl p-5 shadow-card">
            <div className="flex items-center gap-2 mb-4">
              <Activity className="w-5 h-5 text-primary" />
              <h2 className="text-2xl font-bold text-foreground">Vital Signs</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              <div className="rounded-xl border border-border p-4 bg-background">
                <div className="flex items-center gap-2 mb-2"><Droplets className="w-4 h-4 text-primary" /><p className="font-semibold">Blood Sugar</p></div>
                <p className="text-2xl font-extrabold">{latestInput.fruitConsumption ?? "N/A"}</p>
              </div>
              <div className="rounded-xl border border-border p-4 bg-background">
                <div className="flex items-center gap-2 mb-2"><HeartPulse className="w-4 h-4 text-primary" /><p className="font-semibold">Heart Rate</p></div>
                <p className="text-2xl font-extrabold">
                  {latestInput.heartRate ? `${latestInput.heartRate} bpm` : "N/A"}
                </p>
              </div>
              <div className="rounded-xl border border-border p-4 bg-background">
                <div className="flex items-center gap-2 mb-2"><Activity className="w-4 h-4 text-primary" /><p className="font-semibold">Blood Pressure</p></div>
                <p className="text-2xl font-extrabold">
                  {latestInput.systolicBp && latestInput.diastolicBp
                    ? `${latestInput.systolicBp}/${latestInput.diastolicBp}`
                    : "N/A"}
                </p>
              </div>
              <div className="rounded-xl border border-border p-4 bg-background">
                <div className="flex items-center gap-2 mb-2"><Scale className="w-4 h-4 text-primary" /><p className="font-semibold">Weight</p></div>
                <p className="text-2xl font-extrabold">{latestInput.weightKg ?? "N/A"}</p>
              </div>
            </div>
          </section>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
          <section className="bg-card border border-border rounded-2xl p-5 shadow-card lg:col-span-3">
            <div className="flex items-center justify-between gap-3 mb-3">
              <h3 className="text-xl font-bold text-foreground">Critical Vitals Alerts</h3>
              <span className="text-xs text-muted-foreground">Simple thresholds: BP &gt; 140/90, HR &lt; 50 or &gt; 110</span>
            </div>
            {criticalAlerts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No critical alerts from latest vitals.</p>
            ) : (
              <div className="space-y-2">
                {criticalAlerts.map((a) => (
                  <div
                    key={a.key}
                    className={`rounded-xl border p-3 ${
                      a.severity === "critical"
                        ? "border-red-300 bg-red-50 dark:bg-red-950/30"
                        : "border-amber-300 bg-amber-50 dark:bg-amber-950/30"
                    }`}
                  >
                    <p className="font-semibold text-foreground">{a.title}</p>
                    <p className="text-sm text-muted-foreground">{a.detail}</p>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <input
                type="email"
                placeholder="Doctor email (optional if server default configured)"
                value={doctorEmail}
                onChange={(e) => setDoctorEmail(e.target.value)}
                className="min-w-[260px] bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground"
              />
              <button
                type="button"
                onClick={() => void notifyDoctor()}
                className="text-sm border border-border rounded-lg px-3 py-2 bg-accent text-accent-foreground hover:bg-muted"
              >
                Notify doctor
              </button>
            </div>
            {notifyResult ? <p className="mt-2 text-sm text-muted-foreground">{notifyResult}</p> : null}
          </section>

          <section className="bg-card border border-border rounded-2xl p-5 shadow-card lg:col-span-1">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xl font-bold text-foreground">Health Reports</h3>
              <Link to="/history" className="text-sm text-primary">View All</Link>
            </div>
            <div className="space-y-3">
              {vitals.slice(0, 4).map((v) => (
                <div key={v._id} className="flex items-center gap-2 text-sm">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  <span>Vitals Report - {new Date(v.createdAt).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="bg-card border border-border rounded-2xl p-5 shadow-card lg:col-span-1">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xl font-bold text-foreground">Medical History</h3>
              <Link to="/history" className="text-sm text-primary">View All</Link>
            </div>
            <div className="space-y-2 text-sm">
              {(profile?.profile?.previousDiseases || []).map((d: string) => (
                <div key={d} className="flex items-center gap-2">
                  <Stethoscope className="w-4 h-4 text-muted-foreground" />
                  <span>{d}</span>
                </div>
              ))}
              {(profile?.profile?.chronicDiseases || []).map((d: string) => (
                <div key={`c-${d}`} className="flex items-center gap-2">
                  <HeartPulse className="w-4 h-4 text-muted-foreground" />
                  <span>{d}</span>
                </div>
              ))}
              {!(profile?.profile?.previousDiseases?.length || profile?.profile?.chronicDiseases?.length) && (
                <p className="text-muted-foreground">No recorded conditions yet.</p>
              )}
            </div>
          </section>

          <section className="bg-card border border-border rounded-2xl p-5 shadow-card lg:col-span-1">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xl font-bold text-foreground">Upcoming</h3>
              <CalendarDays className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="space-y-3 text-sm">
              {upcomingTests.map((test, index) => (
                <div key={`${test.name}-${index}`} className="rounded-xl border border-border p-3 bg-background">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-foreground">{test.name}</p>
                      <p className="text-xs text-muted-foreground">{test.frequency}</p>
                      <p className="text-xs text-muted-foreground mt-1">Suggested date: {test.date}</p>
                    </div>
                    {test.marked ? (
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-semibold">
                        <CheckCircle2 className="w-4 h-4" />
                        Marked
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">Pending</span>
                    )}
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <input
                      type="date"
                      value={test.date}
                      onChange={(e) => {
                        const date = e.target.value;
                        setUpcomingTests((prev) =>
                          prev.map((t, i) => (i === index ? { ...t, date } : t))
                        );
                      }}
                      className="bg-card border border-border rounded-lg px-2 py-1 text-xs text-foreground"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setUpcomingTests((prev) =>
                          prev.map((t, i) => (i === index ? { ...t, marked: !t.marked } : t))
                        )
                      }
                      className="text-xs px-2 py-1 rounded-lg border border-border bg-accent text-accent-foreground hover:bg-muted"
                    >
                      {test.marked ? "Unmark" : "Mark on Calendar"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
          <section className="bg-card border border-border rounded-2xl p-5 shadow-card lg:col-span-1">
            <h3 className="text-xl font-bold text-foreground mb-3">Quick Actions</h3>
            <div className="space-y-3">
              <Link to="/log-vitals" className="block rounded-xl bg-accent border border-border p-3 hover:bg-muted transition-colors">
                <p className="font-semibold text-foreground">Log Vitals</p>
                <p className="text-xs text-muted-foreground">Update today’s measurements</p>
              </Link>
              <Link to="/assistant" className="block rounded-xl bg-accent border border-border p-3 hover:bg-muted transition-colors">
                <p className="font-semibold text-foreground">Talk to Assistant</p>
                <p className="text-xs text-muted-foreground">Ask about your chronic conditions</p>
              </Link>
              <div className="rounded-xl bg-accent border border-border p-3">
                <p className="font-semibold text-foreground">Recent Chats</p>
                <p className="text-xs text-muted-foreground">{chatHistory.length} sessions saved</p>
              </div>
            </div>
          </section>

          <section className="bg-card border border-border rounded-2xl p-5 shadow-card lg:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-5 h-5 text-primary" />
              <h3 className="text-xl font-bold text-foreground">Statistics</h3>
            </div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={statsData} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="score" stroke="hsl(160 70% 42%)" strokeWidth={2.5} dot={false} name="Score" />
                  <Line type="monotone" dataKey="weight" stroke="hsl(205 80% 50%)" strokeWidth={2.5} dot={false} name="Weight" />
                  <Line type="monotone" dataKey="alcohol" stroke="hsl(38 90% 48%)" strokeWidth={2.5} dot={false} name="Alcohol" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
