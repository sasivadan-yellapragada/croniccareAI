import { useEffect, useMemo, useState } from "react";
import { NavBar } from "@/components/NavBar";
import { me, resetPassword, updateProfile, type AuthUser } from "@/lib/auth";

export default function ProfilePage() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [age, setAge] = useState<number | "">("");
  const [sex, setSex] = useState("");
  const [bloodGroup, setBloodGroup] = useState("");
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [contact, setContact] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const res = await me();
        setUser(res);
        setName(res.name || "");
        setAge(res.profile?.age ?? "");
        setSex(res.profile?.sex || "");
        setBloodGroup(res.profile?.bloodGroup || "");
        setHeight(res.profile?.height || "");
        setWeight(res.profile?.weight || "");
        setContact(res.profile?.contact || "");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load profile");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const bmi = useMemo(() => {
    const h = Number(height);
    const w = Number(weight);
    if (!h || !w || h <= 0 || w <= 0) return undefined;
    return Number((w / ((h / 100) * (h / 100))).toFixed(2));
  }, [height, weight]);

  const onProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setError(null);
    setSaving(true);
    try {
      const res = await updateProfile({
        name: name || undefined,
        age: age === "" ? undefined : Number(age),
        sex: sex || undefined,
        bloodGroup: bloodGroup || undefined,
        height: height || undefined,
        weight: weight || undefined,
        contact: contact || undefined,
        bmi,
        previousDiseases: user?.profile?.previousDiseases || [],
        chronicDiseases: user?.profile?.chronicDiseases || [],
      });
      setUser(res.user);
      setMessage("Profile updated successfully.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const onPasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setError(null);
    setPwSaving(true);
    try {
      await resetPassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setMessage("Password updated successfully.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update password");
    } finally {
      setPwSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <NavBar />
      <main className="max-w-3xl mx-auto px-4 pt-24 pb-12 space-y-6">
        <h1 className="text-3xl font-extrabold text-foreground tracking-tight">Profile Settings</h1>
        {loading ? <p className="text-muted-foreground">Loading...</p> : null}
        {message ? <div className="text-sm text-emerald-600">{message}</div> : null}
        {error ? <div className="text-sm text-red-600 whitespace-pre-wrap">{error}</div> : null}

        <form onSubmit={onProfileSave} className="bg-card border border-border rounded-2xl p-6 shadow-card space-y-4">
          <h2 className="text-xl font-bold text-foreground">Edit Profile</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <input className="bg-background border border-border rounded-xl px-3 py-2 text-sm" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
            <input className="bg-background border border-border rounded-xl px-3 py-2 text-sm" placeholder="Age" type="number" value={age} onChange={(e) => setAge(e.target.value === "" ? "" : Number(e.target.value))} />
            <input className="bg-background border border-border rounded-xl px-3 py-2 text-sm" placeholder="Sex" value={sex} onChange={(e) => setSex(e.target.value)} />
            <input className="bg-background border border-border rounded-xl px-3 py-2 text-sm" placeholder="Blood Group" value={bloodGroup} onChange={(e) => setBloodGroup(e.target.value)} />
            <input className="bg-background border border-border rounded-xl px-3 py-2 text-sm" placeholder="Height (cm)" value={height} onChange={(e) => setHeight(e.target.value)} />
            <input className="bg-background border border-border rounded-xl px-3 py-2 text-sm" placeholder="Weight (kg)" value={weight} onChange={(e) => setWeight(e.target.value)} />
            <input className="bg-background border border-border rounded-xl px-3 py-2 text-sm sm:col-span-2" placeholder="Contact" value={contact} onChange={(e) => setContact(e.target.value)} />
          </div>
          <p className="text-xs text-muted-foreground">BMI: {bmi ?? "N/A"}</p>
          <button type="submit" disabled={saving} className="w-full py-3 rounded-2xl gradient-primary text-primary-foreground font-bold disabled:opacity-70">
            {saving ? "Saving..." : "Save Profile"}
          </button>
        </form>

        <form onSubmit={onPasswordReset} className="bg-card border border-border rounded-2xl p-6 shadow-card space-y-4">
          <h2 className="text-xl font-bold text-foreground">Reset Password</h2>
          <input
            type="password"
            minLength={8}
            required
            className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm"
            placeholder="Current password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
          <input
            type="password"
            minLength={8}
            required
            className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm"
            placeholder="New password (min 8 chars)"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <button type="submit" disabled={pwSaving} className="w-full py-3 rounded-2xl gradient-primary text-primary-foreground font-bold disabled:opacity-70">
            {pwSaving ? "Updating..." : "Update Password"}
          </button>
        </form>
      </main>
    </div>
  );
}
