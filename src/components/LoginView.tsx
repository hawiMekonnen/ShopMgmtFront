import React, { useState } from "react";
import { Loader2, ArrowLeft, Wrench, ClipboardList, Package, Shield } from "lucide-react";
import { api, ApiError } from "../client";
import { AuthSession } from "../types";
import { normalizeRole, type AppRole } from "../roleConfig";

interface LoginViewProps {
  onLogin: (session: AuthSession) => void;
}

const DEMO_PASSWORD = "Demo@123";

const ROLES: {
  id: AppRole;
  label: string;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
  demoEmail?: string;
}[] = [
  {
    id: "Technician",
    label: "Technician",
    hint: "Search parts & submit requests (account from your shop manager)",
    icon: Wrench,
  },
  {
    id: "ShopManager",
    label: "Shop manager",
    hint: "Approve requests, create technician logins",
    icon: ClipboardList,
    demoEmail: "shopmanager@demo.et",
  },
  {
    id: "Procurement",
    label: "Procurement",
    hint: "Stock actions, reorder, mark ready for pickup",
    icon: Package,
    demoEmail: "procurement@demo.et",
  },
  {
    id: "Admin",
    label: "Admin",
    hint: "Full catalog & system access",
    icon: Shield,
    demoEmail: "admin@demo.et",
  },
];

export default function LoginView({ onLogin }: LoginViewProps) {
  const [selectedRole, setSelectedRole] = useState<AppRole | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState(DEMO_PASSWORD);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pickRole = (role: AppRole) => {
    setSelectedRole(role);
    setError(null);
    const cfg = ROLES.find((r) => r.id === role);
    setEmail(cfg?.demoEmail ?? "");
    setPassword(role === "Technician" ? "" : DEMO_PASSWORD);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRole) return;
    setLoading(true);
    setError(null);
    try {
      const session = await api.login(email.trim(), password);
      if (normalizeRole(session.role) !== selectedRole) {
        setError(
          `This account is registered as ${session.role}, not ${selectedRole}. Choose the correct role or use another email.`
        );
        setLoading(false);
        return;
      }
      onLogin(session);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError("Invalid email or password.");
      } else if (err instanceof ApiError && err.status === 502) {
        setError(err.detail ?? "Cannot reach the API. Start the ShopMgmt.WebAPI project (https://localhost:7120) and the frontend (npm run dev).");
      } else {
        setError("Sign-in failed. Check that the API is running and your email/password are correct.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
      <div className="bg-white rounded-xl shadow-md border border-slate-200 p-8 w-full max-w-md space-y-4">
        <h1 className="text-xl font-bold text-slate-900">ET Stores — Sign in</h1>

        {!selectedRole ? (
          <>
            <p className="text-xs text-slate-500">Choose your role, then enter your email and password.</p>
            <div className="grid grid-cols-2 gap-2">
              {ROLES.map((r) => {
                const Icon = r.icon;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => pickRole(r.id)}
                    className="text-left p-3 border border-slate-200 rounded-lg hover:border-[#006039] hover:bg-[#006039]/5 transition-colors"
                  >
                    <Icon className="w-4 h-4 text-[#006039] mb-1" />
                    <span className="font-semibold text-slate-800 text-sm block">{r.label}</span>
                    <span className="block text-[10px] text-slate-400 mt-0.5 leading-snug">{r.hint}</span>
                  </button>
                );
              })}
            </div>
            <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-[11px] text-slate-600 space-y-1">
              <p className="font-semibold text-slate-700">Development demo accounts (password for all: Demo@123)</p>
              <p><span className="font-medium">Admin:</span> admin@demo.et</p>
              <p><span className="font-medium">Shop manager:</span> shopmanager@demo.et</p>
              <p><span className="font-medium">Procurement:</span> procurement@demo.et</p>
              <p><span className="font-medium">Technician:</span> created by shop manager in Team & activity (demo seed also has technician@demo.et)</p>
            </div>
          </>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <button
              type="button"
              onClick={() => {
                setSelectedRole(null);
                setError(null);
              }}
              className="text-xs text-[#006039] font-semibold flex items-center gap-1 hover:underline"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to role selection
            </button>

            <p className="text-sm font-semibold text-[#006039]">
              Signing in as {ROLES.find((r) => r.id === selectedRole)?.label}
            </p>

            {selectedRole === "Technician" ? (
              <p className="text-xs text-slate-500">
                Use the email and password your <strong>shop manager</strong> gave you when they created your account in Team & activity.
              </p>
            ) : (
              <p className="text-xs text-slate-500">
                Demo: <span className="font-mono text-slate-700">{ROLES.find((r) => r.id === selectedRole)?.demoEmail}</span> / {DEMO_PASSWORD}
              </p>
            )}

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-600">Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full mt-1 p-2.5 border border-slate-200 rounded-lg text-sm"
                  autoComplete="username"
                  placeholder={selectedRole === "Technician" ? "you@shop.et" : undefined}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full mt-1 p-2.5 border border-slate-200 rounded-lg text-sm"
                  autoComplete="current-password"
                />
              </div>
            </div>

            {error && <p className="text-xs text-rose-600">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#006039] text-white font-semibold py-2.5 rounded-lg flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Sign in"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
