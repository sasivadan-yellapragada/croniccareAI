import { useState, useRef, useEffect } from "react";
import { NavBar } from "@/components/NavBar";
import { getToken } from "@/lib/auth";
import { Send, Bot } from "lucide-react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

const starters = [
  "What should I eat today?",
  "How can I lower my sugar?",
  "Give me a simple exercise plan",
  "How do I manage stress?",
];

function formatMessage(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return <span key={i}>{part}</span>;
  });
}

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === "user";

  if (isUser) {
    return (
      <div className="flex justify-end mb-4">
        <div className="max-w-xs sm:max-w-sm">
          <div className="gradient-primary text-primary-foreground rounded-2xl rounded-br-sm px-4 py-3 text-sm leading-relaxed shadow-soft">
            {msg.content}
          </div>
          <p className="text-xs text-muted-foreground mt-1 text-right">
            {msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3 mb-4">
      <div className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center flex-shrink-0 shadow-soft mt-1">
        <Bot className="w-4 h-4 text-primary-foreground" />
      </div>
      <div className="max-w-xs sm:max-w-sm lg:max-w-md">
        <div className="bg-card border border-border text-foreground rounded-2xl rounded-tl-sm px-4 py-3 text-sm leading-relaxed shadow-card">
          {msg.content.split("\n").map((line, i) => {
            if (line.startsWith("• ")) {
              return (
                <div key={i} className="flex gap-2 mt-1">
                  <span className="text-primary mt-0.5">•</span>
                  <span>{formatMessage(line.slice(2))}</span>
                </div>
              );
            }
            return line ? (
              <p key={i} className={i > 0 ? "mt-1.5" : ""}>
                {formatMessage(line)}
              </p>
            ) : (
              <div key={i} className="h-1" />
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </p>
      </div>
    </div>
  );
}

const Assistant = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "0",
      role: "assistant",
      content:
        "Hi there! 🌿 I'm your ChronicCare AI health companion. I'm here to help you understand your health better and guide you with gentle, personalized lifestyle advice.\n\nWhat would you like to know today?",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: text.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const payload = {
        messages: [...messages, userMsg].map((m) => ({
          role: m.role,
          content: m.content,
        })),
      };

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        throw new Error(errText || `Chat failed: ${res.status}`);
      }

      const data = (await res.json()) as { message: { role: "assistant"; content: string } };
      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.message.content,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Chat failed";
      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: `Sorry—I'm having trouble reaching the assistant right now.\n\n${msg}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, aiMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      <NavBar />
      <div className="flex-1 flex flex-col max-w-2xl mx-auto w-full px-4 pt-16 overflow-hidden">

        {/* Header */}
        <div className="py-5 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center shadow-soft">
              <Bot className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-bold text-foreground" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                AI Health Assistant
              </h1>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-risk-low animate-pulse" />
                <p className="text-xs text-muted-foreground">Always here for you</p>
              </div>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto py-5 space-y-1 scrollbar-thin">
          {messages.map((msg) => (
            <MessageBubble key={msg.id} msg={msg} />
          ))}

          {loading && (
            <div className="flex gap-3 mb-4">
              <div className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center flex-shrink-0 shadow-soft">
                <Bot className="w-4 h-4 text-primary-foreground" />
              </div>
              <div className="bg-card border border-border rounded-2xl rounded-tl-sm px-4 py-3 shadow-card">
                <div className="flex gap-1.5 items-center h-5">
                  <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0ms" }} />
                  <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "150ms" }} />
                  <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Starter chips */}
        {messages.length <= 1 && (
          <div className="flex flex-wrap gap-2 pb-3">
            {starters.map((s) => (
              <button
                key={s}
                onClick={() => sendMessage(s)}
                className="text-xs font-medium px-3 py-2 rounded-full bg-accent text-accent-foreground border border-border hover:bg-muted transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="pb-6 pt-2">
          <form onSubmit={handleSubmit} className="flex gap-3">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask me anything about your health..."
              className="flex-1 bg-card border border-border rounded-2xl px-4 py-3.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 shadow-card transition-all"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              className="w-12 h-12 rounded-2xl gradient-primary flex items-center justify-center shadow-glow hover:shadow-glow transition-all duration-200 hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:translate-y-0"
            >
              <Send className="w-4.5 h-4.5 text-primary-foreground" style={{ width: 18, height: 18 }} />
            </button>
          </form>
        </div>

      </div>
    </div>
  );
};

export default Assistant;
