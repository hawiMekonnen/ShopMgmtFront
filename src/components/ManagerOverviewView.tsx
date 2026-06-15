import React, { useEffect, useState, useCallback } from "react";
import { Users, ClipboardList, Search, Bell, RefreshCw, AlertCircle } from "lucide-react";
import { api } from "../client";
import { AuthSession, MaterialRequest, ViewState } from "../types";
import { requestStatusLabel, normalizeRequestStatus } from "../requestStatus";

interface ManagerOverviewViewProps {
  session: AuthSession;
  onNavigate: (view: ViewState) => void;
  executeApiCall: <T,>(call: () => Promise<T>) => Promise<T | null>;
}

export default function ManagerOverviewView({ session, onNavigate, executeApiCall }: ManagerOverviewViewProps) {
  const [requests, setRequests] = useState<MaterialRequest[]>([]);
  const [employeeCount, setEmployeeCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [reqs, employees] = await Promise.all([
      executeApiCall(() => api.getMaterialRequests(session.shopId)),
      executeApiCall(() => api.getEmployees(session.shopId)),
    ]);
    if (reqs) setRequests(reqs);
    if (employees) {
      const mine = employees.filter(
        (e: { managerId?: number }) => !session.userId || e.managerId === session.userId
      );
      setEmployeeCount(mine.length);
    }
    setLoading(false);
  }, [session.shopId, session.userId, executeApiCall]);

  useEffect(() => {
    load();
  }, [load]);

  const myEmployees = (userId: number) =>
    requests.filter((r) => {
      return r.requestedByUserId === userId;
    });

  const pending = requests.filter(
    (r) => normalizeRequestStatus(r.status) === "PendingManagerApproval"
  );

  const pendingForMyTeam = pending.filter((r) => {
    // All pending in shop — manager sees shop-wide pending
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Manager overview</h2>
          <p className="text-sm text-slate-500">Review team requests, request materials for yourself, and manage employees.</p>
        </div>
        <button onClick={load} className="p-2 border rounded-lg hover:bg-slate-50 cursor-pointer">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase">Pending approvals</span>
            <AlertCircle className={`w-5 h-5 ${pendingForMyTeam.length > 0 ? "text-amber-500" : "text-slate-300"}`} />
          </div>
          <p className="text-3xl font-bold text-slate-900 mt-2">{pendingForMyTeam.length}</p>
          <p className="text-xs text-slate-400 mt-1">Employee requests awaiting your decision</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase">Team size</span>
            <Users className="w-5 h-5 text-[#006039]" />
          </div>
          <p className="text-3xl font-bold text-slate-900 mt-2">{employeeCount}</p>
          <p className="text-xs text-slate-400 mt-1">Employees under your account</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase">Open requests</span>
            <ClipboardList className="w-5 h-5 text-[#006039]" />
          </div>
          <p className="text-3xl font-bold text-slate-900 mt-2">
            {requests.filter((r) => !["Issued", "Rejected", "Cancelled"].includes(normalizeRequestStatus(r.status))).length}
          </p>
          <p className="text-xs text-slate-400 mt-1">Active shop requests</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <button
          type="button"
          onClick={() => onNavigate({ type: "team" })}
          className="text-left bg-white rounded-xl border border-slate-200 p-5 hover:border-[#006039]/40 hover:shadow-sm transition-all cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[#006039]/10">
              <Users className="w-5 h-5 text-[#006039]" />
            </div>
            <div>
              <p className="font-semibold text-slate-800">Team & user management</p>
              <p className="text-xs text-slate-500 mt-0.5">View employees, accept or reject requests, see history</p>
            </div>
            {pendingForMyTeam.length > 0 && (
              <span className="ml-auto min-w-[1.5rem] h-6 px-2 flex items-center justify-center rounded-full bg-amber-100 text-amber-800 text-xs font-bold">
                {pendingForMyTeam.length}
              </span>
            )}
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigate({ type: "material-search" })}
          className="text-left bg-white rounded-xl border border-slate-200 p-5 hover:border-[#006039]/40 hover:shadow-sm transition-all cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[#006039]/10">
              <Search className="w-5 h-5 text-[#006039]" />
            </div>
            <div>
              <p className="font-semibold text-slate-800">Request materials</p>
              <p className="text-xs text-slate-500 mt-0.5">Manager requests go straight to procurement — no approval needed</p>
            </div>
          </div>
        </button>
      </div>

      {pendingForMyTeam.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <h3 className="text-sm font-bold text-amber-900 flex items-center gap-2 mb-3">
            <Bell className="w-4 h-4" /> Needs your attention
          </h3>
          <div className="divide-y divide-amber-100">
            {pendingForMyTeam.slice(0, 5).map((r) => (
              <div key={r.requestId} className="py-2 flex justify-between items-center text-sm">
                <div>
                  <span className="font-semibold text-slate-800">{r.requestedByName}</span>
                  <span className="text-slate-600"> — {r.materialName} (Qty {r.quantity})</span>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate({ type: "team" })}
                  className="text-xs font-semibold text-[#006039] hover:underline cursor-pointer"
                >
                  Review
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
