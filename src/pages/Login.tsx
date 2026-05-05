import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { NavBar } from "@/components/NavBar";
import { getToken, login, setNeedsOnboarding, setToken } from "@/lib/auth";
import { Lock, Mail } from "lucide-react";

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (getToken()) navigate("/app", { replace: true });
  }, [navigate]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await login(email, password);
      setToken(res.accessToken);
      const needs = Boolean(res.needsOnboarding);
      setNeedsOnboarding(needs);
      navigate(needs ? "/onboarding-health" : "/app", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <NavBar />
      <main className="max-w-md mx-auto px-4 pt-24 pb-12">
        <h1 className="text-3xl font-extrabold text-foreground tracking-tight mb-2">Welcome back</h1>
        <p className="text-muted-foreground mb-6">Log in to continue</p>

        <form onSubmit={onSubmit} className="bg-card border border-border rounded-2xl p-6 shadow-card space-y-4">
          <div>
            <label className="text-sm font-semibold text-foreground">Email</label>
            <div className="mt-2 flex items-center gap-2 border border-border rounded-xl px-3 py-2 bg-background">
              <Mail className="w-4 h-4 text-muted-foreground" />
              <input
                type="email"
                className="flex-1 bg-transparent outline-none text-sm text-foreground"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-semibold text-foreground">Password</label>
            <div className="mt-2 flex items-center gap-2 border border-border rounded-xl px-3 py-2 bg-background">
              <Lock className="w-4 h-4 text-muted-foreground" />
              <input
                type="password"
                className="flex-1 bg-transparent outline-none text-sm text-foreground"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>
          </div>

          {error && <div className="text-sm text-red-600 whitespace-pre-wrap">{error}</div>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-2xl gradient-primary text-primary-foreground font-bold shadow-glow hover:shadow-glow transition-all disabled:opacity-70"
          >
            {loading ? "Logging in..." : "Log in"}
          </button>

          <p className="text-sm text-muted-foreground text-center">
            Don’t have an account?{" "}
            <Link to="/signup" className="text-primary font-semibold hover:underline">
              Sign up
            </Link>
          </p>
        </form>
      </main>
    </div>
  );
}

