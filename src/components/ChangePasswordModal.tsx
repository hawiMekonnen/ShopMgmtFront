import React, { useState } from "react";
import { Loader2, X } from "lucide-react";
import { api, ApiError } from "../client";

interface ChangePasswordModalProps {
  required?: boolean;
  onDone: () => void;
  onCancel?: () => void;
}

export default function ChangePasswordModal({ required, onDone, onCancel }: ChangePasswordModalProps) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (next.length < 6) {
      setError("New password must be at least 6 characters.");
      return;
    }
    if (next !== confirm) {
      setError("New passwords do not match.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await api.changePassword(current, next);
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.detail ?? err.title : "Could not change password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-lg border border-slate-200 w-full max-w-md p-6 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Change password</h2>
            <p className="text-xs text-slate-500 mt-1">
              {required
                ? "You must set a new password before continuing."
                : "Update your account password."}
            </p>
          </div>
          {!required && onCancel && (
            <button type="button" onClick={onCancel} className="text-slate-400 hover:text-slate-600 cursor-pointer">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-slate-600">Current password</label>
            <input
              type="password"
              required
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              className="w-full mt-1 p-2.5 border border-slate-200 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600">New password</label>
            <input
              type="password"
              required
              minLength={6}
              value={next}
              onChange={(e) => setNext(e.target.value)}
              className="w-full mt-1 p-2.5 border border-slate-200 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600">Confirm new password</label>
            <input
              type="password"
              required
              minLength={6}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full mt-1 p-2.5 border border-slate-200 rounded-lg text-sm"
            />
          </div>
          {error && <p className="text-xs text-rose-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#006039] text-white font-semibold py-2.5 rounded-lg flex items-center justify-center gap-2 cursor-pointer"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save new password"}
          </button>
        </form>
      </div>
    </div>
  );
}
