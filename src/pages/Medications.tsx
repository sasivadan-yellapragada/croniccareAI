import { useEffect, useMemo, useState } from "react";
import { NavBar } from "@/components/NavBar";
import { authHeaders } from "@/lib/auth";

type MedicationItem = {
  _id: string;
  patientId?: string;
  medicationName: string;
  dosage?: string | null;
  frequency: string;
  startDate?: string | null;
  endDate?: string | null;
  notes?: string | null;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
  reminders?: Array<{
    time: string;
    days?: string[];
    enabled?: boolean;
  }>;
};

type AdvisoryResponse = {
  disclaimer: string;
  suggestions: string[];
};

type AdherenceLog = {
  _id: string;
  medicationId: string;
  medicationName?: string;
  status: "taken" | "skipped";
  takenAt?: string;
  note?: string | null;
  createdAt?: string;
};

type ReminderAlert = {
  id: string;
  medicationId: string;
  medicationName: string;
  time: string;
  dueLabel: string;
};

const REMINDER_NOTIFICATION_KEY = "croniccareai_reminder_notified";
const REMINDER_SNOOZE_KEY = "croniccareai_reminder_snooze";
const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_MAP: Record<string, string> = {
  sun: "Sun",
  sunday: "Sun",
  mon: "Mon",
  monday: "Mon",
  tue: "Tue",
  tues: "Tue",
  tuesday: "Tue",
  wed: "Wed",
  wednesday: "Wed",
  thu: "Thu",
  thur: "Thu",
  thurs: "Thu",
  thursday: "Thu",
  fri: "Fri",
  friday: "Fri",
  sat: "Sat",
  saturday: "Sat",
};

export default function MedicationsPage() {
  const [items, setItems] = useState<MedicationItem[]>([]);
  const [includeHistory, setIncludeHistory] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [advisoryLoading, setAdvisoryLoading] = useState(false);
  const [advisory, setAdvisory] = useState<AdvisoryResponse | null>(null);
  const [adherenceLogs, setAdherenceLogs] = useState<AdherenceLog[]>([]);
  const [loggingStatus, setLoggingStatus] = useState<Record<string, boolean>>({});
  const [reminderDraft, setReminderDraft] = useState<Record<string, { time: string; days: string }>>({});
  const [savingReminder, setSavingReminder] = useState<Record<string, boolean>>({});
  const [activeAlerts, setActiveAlerts] = useState<ReminderAlert[]>([]);
  const [notificationEnabled, setNotificationEnabled] = useState<boolean>(
    typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted"
  );
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    medicationName: "",
    dosage: "",
    frequency: "",
    startDate: "",
    notes: "",
  });

  const apiFetch = async (path: string, init?: RequestInit): Promise<Response> => {
    return fetch(path, init);
  };

  const load = async (withHistory = includeHistory) => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/medications/me?includeHistory=${withHistory ? "true" : "false"}&limit=300`, {
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { items: MedicationItem[] };
      setItems(data.items || []);
      const logRes = await apiFetch(`/api/medications/adherence/me?days=30&limit=250`, {
        headers: authHeaders(),
      });
      if (logRes.ok) {
        const logData = (await logRes.json()) as { items: AdherenceLog[] };
        setAdherenceLogs(logData.items || []);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load medications");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load(includeHistory);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [includeHistory]);

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const day = DAY_LABELS[now.getDay()];
      const nowMinutes = now.getHours() * 60 + now.getMinutes();

      const notifiedRaw = localStorage.getItem(REMINDER_NOTIFICATION_KEY);
      const notifiedMap = notifiedRaw ? (JSON.parse(notifiedRaw) as Record<string, string>) : {};
      const snoozeRaw = localStorage.getItem(REMINDER_SNOOZE_KEY);
      const snoozeMap = snoozeRaw ? (JSON.parse(snoozeRaw) as Record<string, string>) : {};

      const dueAlerts: ReminderAlert[] = [];

      for (const med of items) {
        if (!med.isActive || !med.reminders?.length) continue;
        for (const slot of med.reminders) {
          if (!slot.enabled || !slot.time) continue;
          const days = (slot.days || [])
            .map((d) => DAY_MAP[(d || "").trim().toLowerCase()] || "")
            .filter(Boolean);
          if (days.length && !days.includes(day)) continue;
          const parts = slot.time.split(":");
          if (parts.length < 2) continue;
          const slotHour = Number(parts[0]);
          const slotMinute = Number(parts[1]);
          if (Number.isNaN(slotHour) || Number.isNaN(slotMinute)) continue;
          const slotTotal = slotHour * 60 + slotMinute;
          const diff = nowMinutes - slotTotal;
          if (diff < 0 || diff > 2) continue;

          const dedupeKey = `${med._id}-${day}-${slot.time}`;
          const todayKey = now.toISOString().slice(0, 10);
          if (notifiedMap[dedupeKey] === todayKey) continue;
          const snoozedUntil = snoozeMap[dedupeKey];
          if (snoozedUntil && new Date(snoozedUntil).getTime() > now.getTime()) continue;

          notifiedMap[dedupeKey] = todayKey;
          dueAlerts.push({
            id: `${dedupeKey}-${now.getTime()}`,
            medicationId: med._id,
            medicationName: med.medicationName,
            time: slot.time,
            dueLabel: `Due now (${slot.time})`,
          });

          if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
            void new Notification("Medication Reminder", {
              body: `${med.medicationName} is due at ${slot.time}.`,
            });
          }
        }
      }

      if (dueAlerts.length) {
        setActiveAlerts((prev) => [...dueAlerts, ...prev].slice(0, 20));
      }
      localStorage.setItem(REMINDER_NOTIFICATION_KEY, JSON.stringify(notifiedMap));
    };

    tick();
    const timer = window.setInterval(tick, 15000);
    return () => window.clearInterval(timer);
  }, [items]);

  const enableBrowserNotifications = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    const result = await Notification.requestPermission();
    setNotificationEnabled(result === "granted");
  };

  const resetForm = () => {
    setEditingId(null);
    setForm({ medicationName: "", dosage: "", frequency: "", startDate: "", notes: "" });
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.medicationName.trim() || !form.frequency.trim()) {
      setError("Medication name and frequency are required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        medicationName: form.medicationName.trim(),
        dosage: form.dosage.trim() || null,
        frequency: form.frequency.trim(),
        startDate: form.startDate || null,
        notes: form.notes.trim() || null,
      };

      if (editingId) {
        const res = await apiFetch(`/api/medications/${editingId}`, {
          method: "PUT",
          headers: { ...authHeaders(), "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error(await res.text());
      } else {
        const res = await apiFetch("/api/medications", {
          method: "POST",
          headers: { ...authHeaders(), "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error(await res.text());
      }
      resetForm();
      await load(includeHistory);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const onEdit = (item: MedicationItem) => {
    setEditingId(item._id);
    setForm({
      medicationName: item.medicationName || "",
      dosage: item.dosage || "",
      frequency: item.frequency || "",
      startDate: item.startDate || "",
      notes: item.notes || "",
    });
  };

  const onDelete = async (id: string) => {
    if (!confirm("Remove this medication from current list? It will remain in history.")) return;
    setError(null);
    try {
      const res = await apiFetch(`/api/medications/${id}`, { method: "DELETE", headers: authHeaders() });
      if (!res.ok) throw new Error(await res.text());
      await load(includeHistory);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    }
  };

  const fetchAdvisory = async () => {
    setAdvisoryLoading(true);
    setError(null);
    try {
      const res = await apiFetch("/api/medications/advisory", {
        method: "POST",
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as AdvisoryResponse;
      setAdvisory(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch AI advisory");
    } finally {
      setAdvisoryLoading(false);
    }
  };

  const saveReminder = async (medicationId: string) => {
    const draft = reminderDraft[medicationId] || { time: "", days: "" };
    if (!draft.time) {
      setError("Please choose a reminder time first.");
      return;
    }
    setSavingReminder((prev) => ({ ...prev, [medicationId]: true }));
    setError(null);
    try {
      const days = draft.days
        .split(",")
        .map((d) => d.trim())
        .filter(Boolean);
      const res = await apiFetch(`/api/medications/${medicationId}/reminders`, {
        method: "PUT",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          reminders: [{ time: draft.time, days, enabled: true }],
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      await load(includeHistory);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save reminder");
    } finally {
      setSavingReminder((prev) => ({ ...prev, [medicationId]: false }));
    }
  };

  const logAdherence = async (medicationId: string, status: "taken" | "skipped") => {
    setLoggingStatus((prev) => ({ ...prev, [medicationId]: true }));
    setError(null);
    try {
      const res = await apiFetch(`/api/medications/${medicationId}/adherence`, {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error(await res.text());
      await load(includeHistory);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to log adherence");
    } finally {
      setLoggingStatus((prev) => ({ ...prev, [medicationId]: false }));
    }
  };

  const dismissAlert = (id: string) => {
    setActiveAlerts((prev) => prev.filter((a) => a.id !== id));
  };

  const snoozeAlert = (alert: ReminderAlert) => {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 10);
    const day = DAY_LABELS[new Date().getDay()];
    const dedupeKey = `${alert.medicationId}-${day}-${alert.time}`;
    const snoozeRaw = localStorage.getItem(REMINDER_SNOOZE_KEY);
    const snoozeMap = snoozeRaw ? (JSON.parse(snoozeRaw) as Record<string, string>) : {};
    snoozeMap[dedupeKey] = now.toISOString();
    localStorage.setItem(REMINDER_SNOOZE_KEY, JSON.stringify(snoozeMap));
    dismissAlert(alert.id);
  };

  const patientId = useMemo(() => items.find((x) => x.patientId)?.patientId, [items]);

  return (
    <div className="min-h-screen bg-background">
      <NavBar />
      <main className="max-w-6xl mx-auto px-4 pt-24 pb-12">
        <h1 className="text-3xl font-extrabold text-foreground tracking-tight mb-2">Medications</h1>
        <p className="text-muted-foreground mb-6">Track current medications, keep history, and get safe AI doctor-discussion suggestions.</p>

        <section className="bg-card border border-border rounded-2xl p-5 shadow-card mb-6">
          <div className="flex items-center justify-between gap-3 mb-3">
            <h2 className="text-xl font-bold text-foreground">Reminders & Notifications</h2>
            {!notificationEnabled ? (
              <button
                type="button"
                onClick={() => void enableBrowserNotifications()}
                className="text-sm border border-border rounded-lg px-3 py-1.5"
              >
                Enable browser notifications
              </button>
            ) : (
              <span className="text-xs font-semibold text-emerald-700">Browser notifications enabled</span>
            )}
          </div>
          {activeAlerts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No medication reminders due right now.</p>
          ) : (
            <div className="space-y-2">
              {activeAlerts.map((alert) => (
                <div key={alert.id} className="rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="font-semibold text-foreground">{alert.medicationName}</p>
                      <p className="text-xs text-muted-foreground">{alert.dueLabel}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => void logAdherence(alert.medicationId, "taken")}
                        className="text-sm border border-emerald-200 text-emerald-700 rounded-lg px-3 py-1.5"
                      >
                        Mark taken
                      </button>
                      <button
                        onClick={() => snoozeAlert(alert)}
                        className="text-sm border border-border rounded-lg px-3 py-1.5"
                      >
                        Snooze 10m
                      </button>
                      <button
                        onClick={() => dismissAlert(alert.id)}
                        className="text-sm border border-border rounded-lg px-3 py-1.5"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="bg-card border border-border rounded-2xl p-5 shadow-card mb-6">
          <div className="flex items-center justify-between gap-3 mb-4">
            <p className="text-sm text-muted-foreground">Patient ID: <span className="font-semibold text-foreground">{patientId || "Loading..."}</span></p>
            <button
              type="button"
              onClick={() => setIncludeHistory((v) => !v)}
              className="text-sm border border-border rounded-lg px-3 py-1.5"
            >
              {includeHistory ? "Hide history" : "Show history"}
            </button>
          </div>

          <form onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
            <input
              value={form.medicationName}
              onChange={(e) => setForm((f) => ({ ...f, medicationName: e.target.value }))}
              placeholder="Medication name *"
              className="border border-border rounded-xl px-3 py-2 text-sm"
            />
            <input
              value={form.dosage}
              onChange={(e) => setForm((f) => ({ ...f, dosage: e.target.value }))}
              placeholder="Dosage (optional)"
              className="border border-border rounded-xl px-3 py-2 text-sm"
            />
            <input
              value={form.frequency}
              onChange={(e) => setForm((f) => ({ ...f, frequency: e.target.value }))}
              placeholder="Frequency *"
              className="border border-border rounded-xl px-3 py-2 text-sm"
            />
            <input
              type="date"
              value={form.startDate}
              onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
              className="border border-border rounded-xl px-3 py-2 text-sm"
            />
            <input
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Notes"
              className="border border-border rounded-xl px-3 py-2 text-sm"
            />
            <div className="lg:col-span-5 flex items-center gap-2">
              <button
                type="submit"
                disabled={saving}
                className="py-2.5 rounded-xl gradient-primary text-primary-foreground font-semibold px-4 disabled:opacity-60"
              >
                {saving ? "Saving..." : editingId ? "Update medication" : "Add medication"}
              </button>
              {editingId ? (
                <button type="button" onClick={resetForm} className="py-2.5 rounded-xl border border-border px-4 text-sm font-semibold">
                  Cancel edit
                </button>
              ) : null}
            </div>
          </form>
        </section>

        <section className="bg-card border border-border rounded-2xl p-5 shadow-card mb-6">
          <div className="flex items-center justify-between gap-3 mb-3">
            <h2 className="text-xl font-bold text-foreground">AI Advisory (Safe Mode)</h2>
            <button
              onClick={() => void fetchAdvisory()}
              disabled={advisoryLoading}
              className="py-2 rounded-xl border border-border px-3 text-sm font-semibold disabled:opacity-60"
            >
              {advisoryLoading ? "Generating..." : "Generate suggestions"}
            </button>
          </div>
          <p className="text-xs text-amber-700 dark:text-amber-400 font-semibold mb-2">
            {advisory?.disclaimer || "This is not medical advice. Please consult a healthcare professional."}
          </p>
          <div className="space-y-1 text-sm text-muted-foreground">
            {(advisory?.suggestions || []).map((s, i) => (
              <div key={`advice-${i}`}>- {s}</div>
            ))}
            {!advisory?.suggestions?.length && <div>No suggestions yet. Click "Generate suggestions".</div>}
          </div>
        </section>

        <section className="bg-card border border-border rounded-2xl p-5 shadow-card">
          <h2 className="text-xl font-bold text-foreground mb-4">{includeHistory ? "Medication History" : "Current Medications"}</h2>
          {error && <div className="mb-3 text-sm text-red-600 whitespace-pre-wrap">{error}</div>}
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading medications...</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No medications found.</p>
          ) : (
            <div className="space-y-3">
              {items.map((m) => (
                <div key={m._id} className="border border-border rounded-xl p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-foreground">{m.medicationName}</p>
                      <p className="text-xs text-muted-foreground">
                        {m.frequency} {m.dosage ? `• ${m.dosage}` : ""} {m.startDate ? `• Start: ${m.startDate}` : ""}{" "}
                        {m.endDate ? `• End: ${new Date(m.endDate).toLocaleDateString()}` : ""}
                      </p>
                      {m.notes ? <p className="text-sm text-muted-foreground mt-1">{m.notes}</p> : null}
                    </div>
                    <div className="flex items-center gap-2">
                      {m.isActive ? (
                        <>
                          <button onClick={() => onEdit(m)} className="text-sm border border-border rounded-lg px-3 py-1.5">
                            Edit
                          </button>
                          <button onClick={() => void onDelete(m._id)} className="text-sm border border-red-200 text-red-600 rounded-lg px-3 py-1.5">
                            Remove
                          </button>
                        </>
                      ) : (
                        <span className="text-xs font-semibold text-muted-foreground">Inactive</span>
                      )}
                    </div>
                  </div>

                  {m.isActive ? (
                    <div className="mt-3 border-t border-border pt-3 grid grid-cols-1 lg:grid-cols-2 gap-3">
                      <div className="rounded-lg border border-border p-3">
                        <p className="text-sm font-semibold text-foreground mb-2">Reminder schedule</p>
                        <div className="flex items-center gap-2">
                          <input
                            type="time"
                            value={reminderDraft[m._id]?.time || m.reminders?.[0]?.time || ""}
                            onChange={(e) =>
                              setReminderDraft((prev) => ({
                                ...prev,
                                [m._id]: {
                                  time: e.target.value,
                                  days: prev[m._id]?.days || (m.reminders?.[0]?.days || []).join(", "),
                                },
                              }))
                            }
                            className="border border-border rounded-lg px-2 py-1.5 text-sm"
                          />
                          <input
                            value={reminderDraft[m._id]?.days || (m.reminders?.[0]?.days || []).join(", ")}
                            onChange={(e) =>
                              setReminderDraft((prev) => ({
                                ...prev,
                                [m._id]: {
                                  time: prev[m._id]?.time || m.reminders?.[0]?.time || "",
                                  days: e.target.value,
                                },
                              }))
                            }
                            placeholder="Days (Mon, Tue, Wed)"
                            className="flex-1 border border-border rounded-lg px-2 py-1.5 text-sm"
                          />
                          <button
                            onClick={() => void saveReminder(m._id)}
                            disabled={!!savingReminder[m._id]}
                            className="text-sm border border-border rounded-lg px-3 py-1.5 disabled:opacity-60"
                          >
                            {savingReminder[m._id] ? "Saving..." : "Save"}
                          </button>
                        </div>
                      </div>

                      <div className="rounded-lg border border-border p-3">
                        <p className="text-sm font-semibold text-foreground mb-2">Adherence tracking</p>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => void logAdherence(m._id, "taken")}
                            disabled={!!loggingStatus[m._id]}
                            className="text-sm border border-emerald-200 text-emerald-700 rounded-lg px-3 py-1.5 disabled:opacity-60"
                          >
                            Mark taken
                          </button>
                          <button
                            onClick={() => void logAdherence(m._id, "skipped")}
                            disabled={!!loggingStatus[m._id]}
                            className="text-sm border border-amber-200 text-amber-700 rounded-lg px-3 py-1.5 disabled:opacity-60"
                          >
                            Mark skipped
                          </button>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          Last 30 days:{" "}
                          {
                            adherenceLogs.filter((x) => x.medicationId === m._id && x.status === "taken").length
                          }{" "}
                          taken,{" "}
                          {
                            adherenceLogs.filter((x) => x.medicationId === m._id && x.status === "skipped").length
                          }{" "}
                          skipped
                        </p>
                      </div>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="bg-card border border-border rounded-2xl p-5 shadow-card mt-6">
          <h2 className="text-xl font-bold text-foreground mb-3">Recent Adherence Logs (30 days)</h2>
          {adherenceLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No adherence logs yet.</p>
          ) : (
            <div className="space-y-2">
              {adherenceLogs.slice(0, 30).map((log) => (
                <div key={log._id} className="text-sm border border-border rounded-lg p-3">
                  <span className="font-semibold text-foreground">{log.medicationName || "Medication"}</span>{" "}
                  <span className={log.status === "taken" ? "text-emerald-700" : "text-amber-700"}>
                    {log.status}
                  </span>{" "}
                  <span className="text-muted-foreground">
                    • {log.takenAt ? new Date(log.takenAt).toLocaleString() : "Unknown time"}
                  </span>
                  {log.note ? <div className="text-muted-foreground mt-1">{log.note}</div> : null}
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
