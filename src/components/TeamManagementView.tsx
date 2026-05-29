import React, { useState, useEffect, useCallback } from "react";
import { Users, RefreshCw, UserPlus, ClipboardList, Package, Shield } from "lucide-react";
import { api } from "../client";
import { AuthSession, MaterialRequest } from "../types";
import { requestStatusLabel } from "../requestStatus";

type ToastFn = (type: "success" | "error" | "warning" | "info", title: string, message?: string) => void;

interface Technician {
  userId: number;
  name: string;
  email: string;
}

interface UsageRow {
  usageId: number;
  materialName: string;
  partNumber: string;
  userName: string;
  quantityUsed: number;
  usedAt: string;
}

export default function TeamManagementView({
  session,
  addToast,
  executeApiCall,
}: {
  session: AuthSession;
  addToast: ToastFn;
  executeApiCall: <T,>(call: () => Promise<T>, msg?: string) => Promise<T | null>;
}) {
  const isAdmin = session.role === "Admin";
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [requests, setRequests] = useState<MaterialRequest[]>([]);
  const [usages, setUsages] = useState<UsageRow[]>([]);
  const [managers, setManagers] = useState<Technician[]>([]);
  const [shops, setShops] = useState<{ id: number; name: string }[]>([]);
  const [selectedShopId, setSelectedShopId] = useState<number | "">(session.shopId ?? "");
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [managerName, setManagerName] = useState("");
  const [managerEmail, setManagerEmail] = useState("");
  const [managerPassword, setManagerPassword] = useState("");
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const sid = selectedShopId === "" ? undefined : Number(selectedShopId);
    const [activity, mgrs] = await Promise.all<any>([
      executeApiCall(() => (api as any).getShopActivity(sid)),
      isAdmin ? executeApiCall(() => (api as any).getShopManagers()) : Promise.resolve(null),
    ]);

    if (activity) {
      setTechnicians(activity.technicians ?? []);
      setRequests(activity.requests ?? []);
      setUsages(activity.recentUsages ?? []);
    }
    if (mgrs) setManagers(mgrs as Technician[]);
    setLoading(false);
  }, [selectedShopId, executeApiCall, isAdmin]);

  useEffect(() => {
    (async () => {
      const s = await executeApiCall(() => api.getShops());
      if (s) {
        setShops(s);
        if (selectedShopId === "" && s.length > 0) {
          setSelectedShopId(session.shopId ?? s[0].id);
        }
      }
    })();
  }, [executeApiCall, session.shopId, selectedShopId]);

  useEffect(() => {
    if (selectedShopId !== "") load();
  }, [selectedShopId, load]);

  const createTechnician = async () => {
    if (!name.trim() || !email.trim() || password.length < 6) {
      addToast("warning", "Invalid form", "Name, email, and password (6+ chars) are required.");
      return;
    }
    setCreating(true);
    const sid = selectedShopId === "" ? undefined : Number(selectedShopId);
    const created = await executeApiCall(
      () =>
        sid !== undefined
          ? api.createTechnicianForShop(sid, { name: name.trim(), email: email.trim(), password })
          : api.createTechnician({ name: name.trim(), email: email.trim(), password }),
      "Technician account created"
    );
    setCreating(false);
    if (created) {
      setName("");
      setEmail("");
      setPassword("");
      load();
    }
  };

  const createManager = async () => {
    const sid = selectedShopId === "" ? undefined : Number(selectedShopId);
    if (!sid || !managerName.trim() || !managerEmail.trim() || managerPassword.length < 6) {
      addToast("warning", "Invalid manager form", "Pick a shop and provide valid manager credentials.");
      return;
    }
    const ok = await executeApiCall(
      () =>
        api.createShopManager({
          name: managerName.trim(),
          email: managerEmail.trim(),
          password: managerPassword,
          shopId: sid,
        }),
      "Shop manager account created"
    );
    if (ok) {
      setManagerName("");
      setManagerEmail("");
      setManagerPassword("");
      load();
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <Users className="w-6 h-6" /> Shop team & activity
        </h2>
        <button type="button" onClick={load} className="p-2 border rounded-lg hover:bg-slate-50">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      <p className="text-sm text-slate-500">
        {isAdmin
          ? "Admin can create shop-manager accounts for all 7 shops and review shop activities."
          : "Create login accounts for technicians in your shop. They submit requests; you approve or reject before release."}
      </p>

      {shops.length > 0 && (
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-slate-600">Shop</label>
          <select
            value={selectedShopId}
            onChange={(e) => setSelectedShopId(e.target.value ? Number(e.target.value) : "")}
            className="border rounded-lg px-3 py-2 text-sm"
          >
            {shops.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {isAdmin && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2 text-sm">
            <Shield className="w-4 h-4 text-[#006039]" /> New shop manager account
          </h3>
          <div className="flex flex-wrap gap-2">
            <input
              placeholder="Manager full name"
              value={managerName}
              onChange={(e) => setManagerName(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm flex-1 min-w-[140px]"
            />
            <input
              placeholder="Manager email"
              type="email"
              value={managerEmail}
              onChange={(e) => setManagerEmail(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm flex-1 min-w-[180px]"
            />
            <input
              placeholder="Temporary password"
              type="password"
              value={managerPassword}
              onChange={(e) => setManagerPassword(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm w-40"
            />
            <button
              type="button"
              onClick={createManager}
              className="px-4 py-2 bg-[#006039] text-white text-sm font-semibold rounded-lg"
            >
              Create manager
            </button>
          </div>
          <div className="text-xs text-slate-500">
            Existing managers: {managers.length}
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
        <h3 className="font-semibold text-slate-800 flex items-center gap-2 text-sm">
          <UserPlus className="w-4 h-4 text-[#006039]" /> New technician account
        </h3>
        <div className="flex flex-wrap gap-2">
          <input
            placeholder="Full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm flex-1 min-w-[140px]"
          />
          <input
            placeholder="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm flex-1 min-w-[180px]"
          />
          <input
            placeholder="Temporary password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm w-40"
          />
          <button
            type="button"
            disabled={creating}
            onClick={createTechnician}
            className="px-4 py-2 bg-[#006039] text-white text-sm font-semibold rounded-lg disabled:opacity-50"
          >
            Create account
          </button>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border divide-y">
          <h3 className="p-4 font-semibold text-sm text-slate-700">Technicians ({technicians.length})</h3>
          {technicians.map((t) => (
            <div key={t.userId} className="px-4 py-3 text-sm">
              <p className="font-medium">{t.name}</p>
              <p className="text-xs text-slate-500">{t.email}</p>
            </div>
          ))}
          {technicians.length === 0 && <p className="p-4 text-slate-400 text-sm">No technicians yet.</p>}
        </div>

        <div className="bg-white rounded-xl border divide-y max-h-80 overflow-y-auto">
          <h3 className="p-4 font-semibold text-sm text-slate-700 flex items-center gap-2">
            <Package className="w-4 h-4" /> Recent issues (stock collected)
          </h3>
          {usages.map((u) => (
            <div key={u.usageId} className="px-4 py-2 text-xs border-t">
              <span className="font-semibold">{u.userName}</span> — {u.quantityUsed}× {u.materialName}
              <span className="text-slate-400 block">{new Date(u.usedAt).toLocaleString()}</span>
            </div>
          ))}
          {usages.length === 0 && <p className="p-4 text-slate-400 text-sm">No usage recorded yet.</p>}
        </div>
      </div>

      <div className="bg-white rounded-xl border divide-y">
        <h3 className="p-4 font-semibold text-sm text-slate-700 flex items-center gap-2">
          <ClipboardList className="w-4 h-4" /> All shop requests
        </h3>
        {requests.map((r) => (
          <div key={r.requestId} className="px-4 py-3 text-sm flex justify-between gap-2">
            <div>
              <p className="font-medium">
                #{r.requestId} {r.partNumber} — {r.materialName}
              </p>
              <p className="text-xs text-slate-500">
                {r.requestedByName} · Qty {r.quantity} · {requestStatusLabel(r.status)}
              </p>
            </div>
          </div>
        ))}
        {requests.length === 0 && <p className="p-6 text-center text-slate-400 text-sm">No requests.</p>}
      </div>
    </div>
  );
}
