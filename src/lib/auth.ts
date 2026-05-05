export type AuthUser = {
  _id: string;
  email: string;
  name?: string | null;
  patientId?: string;
  healthProfileCompleted?: boolean;
  profile?: {
    age?: number | null;
    sex?: string | null;
    bloodGroup?: string | null;
    height?: string | null;
    weight?: string | null;
    contact?: string | null;
    bmi?: number | null;
    previousDiseases?: string[];
    chronicDiseases?: string[];
  };
};

const TOKEN_KEY = "croniccareai_token";
const NEEDS_ONBOARDING_KEY = "croniccareai_needs_onboarding";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(NEEDS_ONBOARDING_KEY);
}

export function getNeedsOnboarding(): boolean {
  return localStorage.getItem(NEEDS_ONBOARDING_KEY) === "true";
}

export function setNeedsOnboarding(value: boolean) {
  localStorage.setItem(NEEDS_ONBOARDING_KEY, value ? "true" : "false");
}

export function authHeaders() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function fetchWithApiFallback(
  path: string,
  init?: RequestInit
): Promise<Response> {
  return fetch(path, init);
}

export async function signup(email: string, password: string, name?: string) {
  const res = await fetch("/api/auth/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, name }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<{ accessToken: string; user: AuthUser; needsOnboarding?: boolean }>;
}

export async function login(email: string, password: string) {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<{ accessToken: string; user: AuthUser; needsOnboarding?: boolean }>;
}

export async function me() {
  const res = await fetchWithApiFallback("/api/auth/me", {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<AuthUser>;
}

export async function saveHealthProfile(payload: {
  age?: number;
  sex?: string;
  bloodGroup?: string;
  height?: string;
  weight?: string;
  contact?: string;
  bmi?: number;
  previousDiseases: string[];
  chronicDiseases: string[];
}) {
  const res = await fetch("/api/auth/health-profile", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<{ ok: boolean; user: AuthUser }>;
}

export async function updateProfile(payload: {
  name?: string;
  age?: number;
  sex?: string;
  bloodGroup?: string;
  height?: string;
  weight?: string;
  contact?: string;
  bmi?: number;
  previousDiseases: string[];
  chronicDiseases: string[];
}) {
  const res = await fetchWithApiFallback("/api/auth/profile", {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<{ ok: boolean; user: AuthUser }>;
}

export async function resetPassword(currentPassword: string, newPassword: string) {
  const payload = JSON.stringify({ currentPassword, newPassword });
  const headers = { "Content-Type": "application/json", ...authHeaders() };
  const paths = [
    "/api/auth/password-reset",
    "/api/auth/reset-password",
    "/api/auth/change-password",
  ];

  let lastError = "";
  for (const path of paths) {
    const res = await fetch(path, {
      method: "POST",
      headers,
      body: payload,
    });
    if (res.ok) return res.json() as Promise<{ ok: boolean }>;
    lastError = await res.text().catch(() => `Request failed: ${res.status}`);
    if (res.status !== 404) break;
  }
  throw new Error(lastError || "Password reset failed");
}
