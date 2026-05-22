import React, { useState } from "react";
import { Loader2 } from "lucide-react";
import { api } from "../client";
import { AuthSession } from "../types";
interface LoginViewProps {
  onLogin: (session: AuthSession) => void;
}

const DEMO_ACCOUNTS = [
  { email: "technician@demo.et", label: "Technician", hint: "Search & request" },
  { email: "shopmanager@demo.et", label: "Shop manager", hint: "Request queue" },
  { email: "procurement@demo.et", label: "Procurement", hint: "Inbox" },
  { email: "admin@demo.et", label: "Admin", hint: "Full access" },
];

export default function LoginView({ onLogin }: LoginViewProps) {
  const [email, setEmail] = useState("technician@demo.et");
  const [password, setPassword] = useState("Demo@123");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const session = await api.login(email, password);
      onLogin(session);
    } catch {
      setError("Invalid credentials or API unreachable.");
    } finally {
      setLoading(false);
    }
  };

  const quickLogin = async (demoEmail: string) => {
    setEmail(demoEmail);
    setLoading(true);
    setError(null);
    try {
      const session = await api.login(demoEmail, "Demo@123");
      onLogin(session);
    } catch {
      setError("Invalid credentials or API unreachable.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-md border border-slate-200 p-8 w-full max-w-md space-y-4">
        <h1 className="text-xl font-bold text-slate-900">ET Stores — Sign in</h1>
        <p className="text-xs text-slate-500">Each role sees a different menu and home screen.</p>

        <div className="grid grid-cols-2 gap-2">
          {DEMO_ACCOUNTS.map((a) => (
            <button
              key={a.email}
              type="button"
              onClick={() => quickLogin(a.email)}
              className="text-left p-2 border border-slate-200 rounded-lg hover:border-[#006039] hover:bg-[#006039]/5 text-xs"
            >
              <span className="font-semibold text-slate-800">{a.label}</span>
              <span className="block text-slate-400">{a.hint}</span>
            </button>
          ))}
        </div>

        <div className="border-t border-slate-100 pt-3 space-y-3">
          <div>
            <label className="text-xs font-semibold text-slate-600">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full mt-1 p-2.5 border border-slate-200 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full mt-1 p-2.5 border border-slate-200 rounded-lg text-sm"
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
        <p className="text-[10px] text-slate-400 font-mono text-center">Password for all demo users: Demo@123</p>
      </form>
    </div>
  );
}
