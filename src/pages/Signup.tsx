import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { NavBar } from "@/components/NavBar";
import { getToken, setNeedsOnboarding, setToken, signup } from "@/lib/auth";
import { Mail, User, Lock } from "lucide-react";

export default function SignupPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
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
      const res = await signup(email, password, name || undefined);
      setToken(res.accessToken);
      setNeedsOnboarding(Boolean(res.needsOnboarding ?? true));
      navigate("/onboarding-health", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Signup failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <NavBar />
      <main className="max-w-md mx-auto px-4 pt-24 pb-12">
        <h1 className="text-3xl font-extrabold text-foreground tracking-tight mb-2">Create your account</h1>
        <p className="text-muted-foreground mb-6">Sign up to save your activity and chat history</p>

        <form onSubmit={onSubmit} className="bg-card border border-border rounded-2xl p-6 shadow-card space-y-4">
          <div>
            <label className="text-sm font-semibold text-foreground">Name (optional)</label>
            <div className="mt-2 flex items-center gap-2 border border-border rounded-xl px-3 py-2 bg-background">
              <User className="w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                className="flex-1 bg-transparent outline-none text-sm text-foreground"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          </div>

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
            <p className="text-xs text-muted-foreground mt-1">Minimum 8 characters.</p>
          </div>

          {error && <div className="text-sm text-red-600 whitespace-pre-wrap">{error}</div>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-2xl gradient-primary text-primary-foreground font-bold shadow-glow hover:shadow-glow transition-all disabled:opacity-70"
          >
            {loading ? "Creating account..." : "Sign up"}
          </button>

          <p className="text-sm text-muted-foreground text-center">
            Already have an account?{" "}
            <Link to="/login" className="text-primary font-semibold hover:underline">
              Log in
            </Link>
          </p>
        </form>
      </main>
    </div>
  );
}

