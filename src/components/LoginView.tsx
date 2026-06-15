import React, { useState } from "react";
import { Loader2 } from "lucide-react";
import { api, ApiError } from "../client";
import { AuthSession } from "../types";

interface LoginViewProps {
  onLogin: (session: AuthSession) => void;
}

export default function LoginView({ onLogin }: LoginViewProps) {
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const session = await api.login(loginId.trim(), password);
      onLogin(session);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError("Invalid ID or password.");
      } else if (err instanceof ApiError && err.status === 502) {
        setError(err.detail ?? "Cannot reach the API. Start ShopMgmt.WebAPI (https://localhost:7120) and the frontend (npm run dev).");
      } else {
        setError("Sign-in failed. Check that the API is running and your ID/password are correct.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
      <div className="bg-white rounded-xl shadow-md border border-slate-200 p-8 w-full max-w-md space-y-4">
        <h1 className="text-xl font-bold text-slate-900">Airline Store Management System — Sign in</h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-600">Employee ID</label>
            <input
              type="text"
              required
              value={loginId}
              onChange={(e) => setLoginId(e.target.value.toUpperCase())}
              className="w-full mt-1 p-2.5 border border-slate-200 rounded-lg text-sm font-mono uppercase"
              autoComplete="username"
              placeholder="e.g. E001, M001, P001, A001"
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

          {error && <p className="text-xs text-rose-600">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#006039] text-white font-semibold py-2.5 rounded-lg flex items-center justify-center gap-2 cursor-pointer"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
