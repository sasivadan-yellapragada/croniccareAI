import { useEffect, useState } from "react";
import { NavBar } from "@/components/NavBar";
import { getToken } from "@/lib/auth";
import { Activity, MessageSquare, Clock3 } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";

type VitalsHistoryItem = {
  _id: string;
  createdAt?: string;
  input?: {
    heightCm?: number;
    weightKg?: number;
    alcoholConsumption?: number;
    fruitConsumption?: number;
    greenVegetablesConsumption?: number;
    friedPotatoConsumption?: number;
  };
  prediction?: {
    risk?: string;
    score?: number;
  };
};

type ChatHistoryItem = {
  _id: string;
  createdAt?: string;
  messages?: Array<{ role: string; content: string }>;
};

function getLastMessageByRole(
  messages: Array<{ role: string; content: string }> | undefined,
  role: "user" | "assistant"
) {
  if (!messages?.length) return undefined;
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i]?.role === role) return messages[i];
  }
  return undefined;
}

function formatDate(date?: string) {
  if (!date) return "Unknown time";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleString();
}

function shortDate(date?: string) {
  if (!date) return "-";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString();
}

export default function HistoryPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [vitalsHistory, setVitalsHistory] = useState<VitalsHistoryItem[]>([]);
  const [chatHistory, setChatHistory] = useState<ChatHistoryItem[]>([]);
  const [expandedChats, setExpandedChats] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const token = getToken();
        const headers = token ? { Authorization: `Bearer ${token}` } : {};

        const [vitalsRes, chatRes] = await Promise.all([
          fetch("/api/predictions/me?limit=50", { headers }),
          fetch("/api/chat/me?limit=50", { headers }),
        ]);

        if (!vitalsRes.ok) throw new Error(await vitalsRes.text());
        if (!chatRes.ok) throw new Error(await chatRes.text());

        const vitalsData = (await vitalsRes.json()) as { items: VitalsHistoryItem[] };
        const chatData = (await chatRes.json()) as { items: ChatHistoryItem[] };

        setVitalsHistory(vitalsData.items || []);
        setChatHistory(chatData.items || []);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load history");
      } finally {
        setLoading(false);
      }
    };
    void run();
  }, []);

  const vitalsChartData = [...vitalsHistory]
    .sort((a, b) => {
      const ad = new Date(a.createdAt || 0).getTime();
      const bd = new Date(b.createdAt || 0).getTime();
      return ad - bd;
    })
    .map((item, idx) => ({
      idx: idx + 1,
      date: shortDate(item.createdAt),
      score: item.prediction?.score ?? null,
      weightKg: item.input?.weightKg ?? null,
      heightCm: item.input?.heightCm ?? null,
      alcohol: item.input?.alcoholConsumption ?? null,
      fruit: item.input?.fruitConsumption ?? null,
      vegetables: item.input?.greenVegetablesConsumption ?? null,
      friedPotato: item.input?.friedPotatoConsumption ?? null,
    }));

  return (
    <div className="min-h-screen bg-background">
      <NavBar />
      <main className="max-w-4xl mx-auto px-4 pt-24 pb-12">
        <h1 className="text-3xl font-extrabold text-foreground tracking-tight mb-2">History</h1>
        <p className="text-muted-foreground mb-8">Your saved vitals analysis and chat sessions</p>

        {loading && (
          <div className="text-sm text-muted-foreground">Loading history...</div>
        )}

        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-6 whitespace-pre-wrap">
            {error}
          </div>
        )}

        {!loading && !error && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <section className="bg-card border border-border rounded-2xl p-5 shadow-card">
              <div className="flex items-center gap-2 mb-4">
                <Activity className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-bold text-foreground">My Vitals History</h2>
              </div>

              {vitalsHistory.length === 0 ? (
                <p className="text-sm text-muted-foreground">No vitals history found yet.</p>
              ) : (
                <div className="space-y-4">
                  <div className="border border-border rounded-xl p-3 bg-background">
                    <p className="text-sm font-semibold text-foreground mb-2">Vitals Trend Graphs</p>

                    <div className="h-52">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={vitalsChartData} margin={{ top: 8, right: 8, left: -18, bottom: 8 }}>
                          <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 11 }} />
                          <Tooltip />
                          <Legend wrapperStyle={{ fontSize: 11 }} />
                          <Line type="monotone" dataKey="score" stroke="hsl(178 65% 38%)" dot={false} name="Score" />
                          <Line type="monotone" dataKey="weightKg" stroke="hsl(210 70% 48%)" dot={false} name="Weight (kg)" />
                          <Line type="monotone" dataKey="heightCm" stroke="hsl(280 65% 50%)" dot={false} name="Height (cm)" />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="h-52 mt-4">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={vitalsChartData} margin={{ top: 8, right: 8, left: -18, bottom: 8 }}>
                          <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 11 }} />
                          <Tooltip />
                          <Legend wrapperStyle={{ fontSize: 11 }} />
                          <Line type="monotone" dataKey="alcohol" stroke="hsl(15 80% 52%)" dot={false} name="Alcohol" />
                          <Line type="monotone" dataKey="fruit" stroke="hsl(145 60% 40%)" dot={false} name="Fruit" />
                          <Line type="monotone" dataKey="vegetables" stroke="hsl(95 60% 40%)" dot={false} name="Vegetables" />
                          <Line type="monotone" dataKey="friedPotato" stroke="hsl(38 90% 48%)" dot={false} name="Fried Potato" />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {vitalsHistory.map((item) => (
                    <div key={item._id} className="border border-border rounded-xl p-3 bg-background">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-foreground">
                            Risk: {item.prediction?.risk ?? "N/A"} | Score: {item.prediction?.score ?? "N/A"}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                            <Clock3 className="w-3 h-3" />
                            {formatDate(item.createdAt)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="bg-card border border-border rounded-2xl p-5 shadow-card">
              <div className="flex items-center gap-2 mb-4">
                <MessageSquare className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-bold text-foreground">My Chat History</h2>
              </div>

              {chatHistory.length === 0 ? (
                <p className="text-sm text-muted-foreground">No chat history found yet.</p>
              ) : (
                <div className="space-y-3">
                  {chatHistory.map((item) => {
                    const userMsg = getLastMessageByRole(item.messages, "user");
                    const assistantMsg = getLastMessageByRole(item.messages, "assistant");
                    const expanded = Boolean(expandedChats[item._id]);
                    const conversation = (item.messages || []).filter(
                      (m) => m.role === "user" || m.role === "assistant"
                    );
                    return (
                      <div key={item._id} className="border border-border rounded-xl p-3 bg-background">
                        <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                          <Clock3 className="w-3 h-3" />
                          {formatDate(item.createdAt)}
                        </p>
                        <p className="text-sm text-foreground">
                          <span className="font-semibold">You:</span> {userMsg?.content ?? "N/A"}
                        </p>
                        <p className="text-sm text-foreground mt-1 line-clamp-3">
                          <span className="font-semibold">Assistant:</span> {assistantMsg?.content ?? "N/A"}
                        </p>

                        <button
                          type="button"
                          onClick={() =>
                            setExpandedChats((prev) => ({ ...prev, [item._id]: !prev[item._id] }))
                          }
                          className="mt-2 text-xs font-semibold text-primary hover:underline"
                        >
                          {expanded ? "Hide full chat" : "Read full chat"}
                        </button>

                        {expanded && (
                          <div className="mt-3 border-t border-border pt-3 space-y-2">
                            {conversation.length === 0 ? (
                              <p className="text-xs text-muted-foreground">No full conversation found.</p>
                            ) : (
                              conversation.map((m, idx) => (
                                <p key={`${item._id}-${idx}`} className="text-sm text-foreground whitespace-pre-wrap">
                                  <span className="font-semibold">
                                    {m.role === "user" ? "You" : "Assistant"}:
                                  </span>{" "}
                                  {m.content}
                                </p>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}

