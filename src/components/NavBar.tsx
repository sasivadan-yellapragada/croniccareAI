import { Link, useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, Bot, ClipboardList, LogIn, UserPlus, LogOut, History, FileText, Pill, User } from "lucide-react";
import { clearToken, getToken } from "@/lib/auth";

const navItems = [
  { path: "/app", label: "Home", icon: LayoutDashboard },
  { path: "/log-vitals", label: "Log Vitals", icon: ClipboardList },
  { path: "/assistant", label: "AI Assistant", icon: Bot },
  { path: "/history", label: "History", icon: History },
  { path: "/reports", label: "Reports", icon: FileText },
  { path: "/medications", label: "Medications", icon: Pill },
  { path: "/profile", label: "Profile", icon: User },
];

export function NavBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const authed = Boolean(getToken());

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-card/80 backdrop-blur-md border-b border-border shadow-card">
      <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link to={authed ? "/app" : "/login"} className="flex items-center gap-2.5">
          <span className="font-bold text-lg tracking-tight text-foreground" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            ChronicCare <span className="text-primary">AI</span>
          </span>
        </Link>

        <div className="flex items-center gap-1">
          {navItems.map(({ path, label, icon: Icon }) => {
            const active = location.pathname === path;
            return (
              <Link
                key={path}
                to={path}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                  active
                    ? "bg-accent text-accent-foreground shadow-soft"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{label}</span>
              </Link>
            );
          })}

          {!authed ? (
            <>
              <Link
                to="/login"
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                  location.pathname === "/login"
                    ? "bg-accent text-accent-foreground shadow-soft"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                <LogIn className="w-4 h-4" />
                <span className="hidden sm:inline">Login</span>
              </Link>
              <Link
                to="/signup"
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                  location.pathname === "/signup"
                    ? "bg-accent text-accent-foreground shadow-soft"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                <UserPlus className="w-4 h-4" />
                <span className="hidden sm:inline">Sign up</span>
              </Link>
            </>
          ) : (
            <button
              onClick={() => {
                clearToken();
                navigate("/login");
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200 text-muted-foreground hover:text-foreground hover:bg-muted"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}
