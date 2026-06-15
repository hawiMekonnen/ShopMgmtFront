import React, { useState, useEffect, useCallback } from "react";
import { Search, RefreshCw, Loader2, Package, Bell, Clock, DollarSign, CheckCircle, History, X } from "lucide-react";
import { api, ApiError } from "../client";
import { Material, MaterialRequest, AuthSession } from "../types";
import { requestStatusLabel, normalizeRequestStatus } from "../requestStatus";
import { filterAlertsForRole } from "../realtime";

type ToastFn = (type: "success" | "error" | "warning" | "info", title: string, message?: string) => void;

const MAX_DISPLAY = 5;

interface SearchHistoryEntry {
  materialName: string;
  model?: string;
  searchedAt: string;
}

interface RecentMaterialEntry extends Material {
  accessedAt: string;
}

function loadSearchHistory(userId?: number): SearchHistoryEntry[] {
  if (!userId) return [];
  try {
    const raw = localStorage.getItem(`searchHistory_${userId}`);
    return raw ? (JSON.parse(raw) as SearchHistoryEntry[]) : [];
  } catch {
    return [];
  }
}

function saveSearchHistory(userId: number | undefined, materialName: string, model: string) {
  if (!userId || (!materialName.trim() && !model.trim())) return;
  const entry: SearchHistoryEntry = {
    materialName: materialName.trim(),
    model: model.trim() || undefined,
    searchedAt: new Date().toISOString(),
  };
  const prev = loadSearchHistory(userId).filter(
    (h) => !(h.materialName === entry.materialName && h.model === entry.model)
  );
  const next = [entry, ...prev].slice(0, 8);
  localStorage.setItem(`searchHistory_${userId}`, JSON.stringify(next));
}

function removeSearchHistoryEntry(userId: number | undefined, index: number) {
  if (!userId) return [];
  const prev = loadSearchHistory(userId);
  const next = prev.filter((_, i) => i !== index);
  localStorage.setItem(`searchHistory_${userId}`, JSON.stringify(next));
  return next;
}

function loadRecentMaterials(userId?: number): RecentMaterialEntry[] {
  if (!userId) return [];
  try {
    const raw = localStorage.getItem(`recentMaterials_${userId}`);
    return raw ? (JSON.parse(raw) as RecentMaterialEntry[]) : [];
  } catch {
    return [];
  }
}

function recordMaterialAccess(userId: number | undefined, material: Material) {
  if (!userId) return;
  const entry: RecentMaterialEntry = { ...material, accessedAt: new Date().toISOString() };
  const prev = loadRecentMaterials(userId).filter((m) => m.id !== material.id);
  const next = [entry, ...prev].slice(0, MAX_DISPLAY);
  localStorage.setItem(`recentMaterials_${userId}`, JSON.stringify(next));
}

export function MaterialSearchView({
  session,
  addToast,
  onRequest,
  isManager = false,
}: {
  session: AuthSession;
  addToast: ToastFn;
  onRequest: (materialId: number) => void;
  isManager?: boolean;
}) {
  const [materialQuery, setMaterialQuery] = useState("");
  const [modelQuery, setModelQuery] = useState("");
  const [results, setResults] = useState<Material[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchHistory, setSearchHistory] = useState<SearchHistoryEntry[]>([]);
  const [lastRequest, setLastRequest] = useState<MaterialRequest | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [managerPurpose, setManagerPurpose] = useState("");
  const [managerQty, setManagerQty] = useState("1");
  const [managerMaterialId, setManagerMaterialId] = useState<number | null>(null);

  const displayResults = results.slice(0, MAX_DISPLAY);

  const runSearch = useCallback(async () => {
    setLoading(true);
    setHasSearched(true);
    try {
      const items = await api.searchMaterials({
        q: materialQuery.trim() || undefined,
        partNumber: materialQuery.trim() || undefined,
        aircraft: modelQuery.trim() || undefined,
        shopId: session.shopId,
      });
      setResults(items.slice(0, MAX_DISPLAY));
      items.slice(0, MAX_DISPLAY).forEach((m) => recordMaterialAccess(session.userId, m));
      if (materialQuery.trim() || modelQuery.trim()) {
        saveSearchHistory(session.userId, materialQuery, modelQuery);
        setSearchHistory(loadSearchHistory(session.userId));
      }
    } catch (e) {
      addToast("error", "Search failed", e instanceof ApiError ? e.detail : "Could not reach the stores API.");
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [materialQuery, modelQuery, session.shopId, session.userId, addToast]);

  const loadRecent = useCallback(() => {
    const recent = loadRecentMaterials(session.userId).slice(0, MAX_DISPLAY);
    setResults(recent);
    setHasSearched(false);
  }, [session.userId]);

  const loadLastRequest = useCallback(async () => {
    try {
      const list = await api.getMaterialRequests(session.shopId);
      const mine = list
        .filter((r) => !session.userId || r.requestedByUserId === session.userId)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setLastRequest(mine[0] ?? null);
    } catch {
      setLastRequest(null);
    }
  }, [session.shopId, session.userId]);

  useEffect(() => {
    setSearchHistory(loadSearchHistory(session.userId));
    loadRecent();
    loadLastRequest();
  }, [session.userId, loadRecent, loadLastRequest]);

  const applyHistory = (entry: SearchHistoryEntry) => {
    setMaterialQuery(entry.materialName);
    setModelQuery(entry.model ?? "");
  };

  const handleRemoveHistory = (index: number) => {
    setSearchHistory(removeSearchHistoryEntry(session.userId, index));
  };

  const handleRequestClick = (materialId: number, material: Material) => {
    recordMaterialAccess(session.userId, material);
    if (isManager) {
      setManagerMaterialId(materialId);
      setManagerPurpose("");
      setManagerQty("1");
      return;
    }
    onRequest(materialId);
  };

  const submitManagerRequest = async () => {
    if (!managerMaterialId || !session.shopId) return;
    const purpose = managerPurpose.trim() || "Manager request";
    try {
      await api.submitMaterialRequest({
        materialId: managerMaterialId,
        shopId: session.shopId,
        quantity: parseFloat(managerQty) || 1,
        aircraftOrWorkOrder: purpose,
      });
      addToast("success", "Request submitted", "Sent to procurement — no approval needed.");
      setManagerMaterialId(null);
      loadLastRequest();
    } catch (e) {
      addToast("error", "Request failed", e instanceof ApiError ? e.detail : undefined);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-slate-800">Material search</h2>
      <p className="text-sm text-slate-500">
        {isManager
          ? "Search and request materials — manager requests go directly to procurement."
          : "Search store items by name, material ID, or model/type. Up to 5 items shown."}
      </p>
      <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-wrap gap-3">
        <input
          placeholder="Material name or ID"
          value={materialQuery}
          onChange={(e) => setMaterialQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && runSearch()}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm flex-1 min-w-[140px]"
        />
        <input
          placeholder="Model / type (optional)"
          value={modelQuery}
          onChange={(e) => setModelQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && runSearch()}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm flex-1 min-w-[120px]"
        />
        <button onClick={runSearch} className="flex items-center gap-2 px-4 py-2 bg-[#006039] text-white rounded-lg text-sm font-semibold cursor-pointer">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          Search
        </button>
        {!hasSearched && (
          <button type="button" onClick={loadRecent} className="text-xs text-[#006039] font-semibold hover:underline cursor-pointer">
            Show recent
          </button>
        )}
      </div>

      {!hasSearched && displayResults.length > 0 && (
        <p className="text-xs text-slate-500">Showing up to {MAX_DISPLAY} recently accessed materials.</p>
      )}

      {isManager && managerMaterialId && (
        <div className="bg-[#006039]/5 border border-[#006039]/20 rounded-xl p-4 flex flex-wrap gap-2 items-end">
          <p className="text-sm font-semibold text-slate-800 w-full">Request material #{managerMaterialId}</p>
          <input type="number" min="1" value={managerQty} onChange={(e) => setManagerQty(e.target.value)} className="border rounded-lg px-2 py-1.5 text-sm w-20" />
          <input placeholder="Purpose (optional)" value={managerPurpose} onChange={(e) => setManagerPurpose(e.target.value)} className="border rounded-lg px-2 py-1.5 text-sm flex-1 min-w-[160px]" />
          <button type="button" onClick={submitManagerRequest} className="px-3 py-1.5 bg-[#006039] text-white text-xs rounded-lg font-semibold cursor-pointer">Submit to procurement</button>
          <button type="button" onClick={() => setManagerMaterialId(null)} className="text-xs text-slate-500 cursor-pointer">Cancel</button>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-2 text-left">Material ID</th>
              <th className="px-4 py-2 text-left">Name</th>
              <th className="px-4 py-2 text-left">Model</th>
              <th className="px-4 py-2 text-center">On hand</th>
              <th className="px-4 py-2 text-center">Available</th>
              <th className="px-4 py-2 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {displayResults.map((m) => {
              const outOfStock = (m.available ?? 0) <= 0;
              const canOrder = m.isOrderable !== false && !outOfStock;
              return (
              <tr key={m.id} className={`border-t border-slate-100 ${outOfStock ? "bg-slate-50/80" : ""}`}>
                <td className="px-4 py-3 font-mono text-[#006039]">{m.partNumber}</td>
                <td className="px-4 py-3">
                  {m.name}
                  {outOfStock && (
                    <span className="ml-2 text-[10px] font-bold uppercase text-rose-600">Out of stock</span>
                  )}
                </td>
                <td className="px-4 py-3 text-slate-500 text-xs">{m.aircraftTypes || "—"}</td>
                <td className="px-4 py-3 text-center">{m.onHand}</td>
                <td className="px-4 py-3 text-center font-bold">{m.available}</td>
                <td className="px-4 py-3 text-right">
                  {canOrder ? (
                    <button
                      onClick={() => handleRequestClick(m.id, m)}
                      className="text-xs font-semibold text-[#006039] hover:underline cursor-pointer"
                    >
                      Request
                    </button>
                  ) : (
                    <span className="text-xs text-slate-400 font-medium">Out of stock</span>
                  )}
                </td>
              </tr>
            );})}
          </tbody>
        </table>
        {displayResults.length === 0 && !loading && (
          <p className="p-8 text-center text-slate-400 text-sm">
            {hasSearched ? "No materials match your search." : "Search or browse — your 5 most recently accessed items appear here."}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2 mb-3">
            <History className="w-4 h-4 text-[#006039]" /> Search history
          </h3>
          {searchHistory.length === 0 ? (
            <p className="text-xs text-slate-400">Your recent searches will appear here.</p>
          ) : (
            <ul className="divide-y text-xs">
              {searchHistory.map((h, i) => (
                <li key={i} className="py-2 flex justify-between items-center gap-2">
                  <button
                    type="button"
                    onClick={() => applyHistory(h)}
                    className="text-left hover:text-[#006039] font-medium cursor-pointer flex-1 min-w-0"
                  >
                    {h.materialName}
                    {h.model ? <span className="text-slate-400"> · {h.model}</span> : null}
                  </button>
                  <span className="text-slate-400 shrink-0 text-[10px] hidden sm:inline">{new Date(h.searchedAt).toLocaleString()}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveHistory(i)}
                    className="shrink-0 p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                    title="Remove from history"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-[#006039]" /> Last material requested
          </h3>
          {lastRequest ? (
            <div className="text-xs space-y-1">
              <p className="font-semibold text-slate-800">{lastRequest.partNumber} — {lastRequest.materialName}</p>
              <p className="text-slate-500">Qty {lastRequest.quantity} · {requestStatusLabel(lastRequest.status)}</p>
              <p className="text-slate-400">{new Date(lastRequest.createdAt).toLocaleString()}</p>
            </div>
          ) : (
            <p className="text-xs text-slate-400">You have not submitted any requests yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}

export function MaterialRequestsView({
  session,
  addToast,
  executeApiCall,
  initialMaterialId,
}: {
  session: AuthSession;
  addToast: ToastFn;
  executeApiCall: <T,>(call: () => Promise<T>, msg?: string) => Promise<T | null>;
  initialMaterialId?: number | null;
}) {
  const [requests, setRequests] = useState<MaterialRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [requestMaterialId, setRequestMaterialId] = useState<number | null>(initialMaterialId ?? null);
  const [qty, setQty] = useState("1");
  const [purpose, setPurpose] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showHistoryForUserId, setShowHistoryForUserId] = useState<number | null>(null);
  const [showHistoryForUserName, setShowHistoryForUserName] = useState<string>("");

  const load = useCallback(async () => {
    setLoading(true);
    const list = await executeApiCall(() => api.getMaterialRequests(session.shopId));
    if (list) setRequests(list);
    setLoading(false);
  }, [session.shopId, executeApiCall]);

  const submitRequest = async () => {
    if (!requestMaterialId || !session.shopId) return;
    const reference = purpose.trim();
    if (!reference) {
      addToast("warning", "Purpose required", "Enter why you need this material (department, project, or reference).");
      return;
    }
    const ok = await executeApiCall(
      () =>
        api.submitMaterialRequest({
          materialId: requestMaterialId,
          shopId: session.shopId!,
          quantity: parseFloat(qty),
          aircraftOrWorkOrder: reference,
        }),
      "Request submitted"
    );
    if (ok) {
      setRequestMaterialId(null);
      load();
    }
  };

  const isManager = session.role === "Manager" || session.role === "Admin";
  const isEmployee = session.role === "Employee";

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-800">
          {isManager ? "Approve employee requests" : "My material requests"}
        </h2>
        <button onClick={load} className="p-2 border rounded-lg hover:bg-slate-50 cursor-pointer">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {showHistoryForUserId !== null && (
        <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 relative space-y-3">
          <button
            onClick={() => setShowHistoryForUserId(null)}
            className="absolute top-2 right-3 text-slate-400 hover:text-slate-600 text-xs font-semibold cursor-pointer"
          >
            Close history
          </button>
          <h3 className="text-sm font-bold text-slate-700">Request history for {showHistoryForUserName}</h3>
          <div className="divide-y max-h-48 overflow-y-auto bg-white rounded-lg border">
            {requests
              .filter((x) => x.requestedByUserId === showHistoryForUserId)
              .map((h) => (
                <div key={h.requestId} className="p-2.5 text-xs flex justify-between gap-4">
                  <div>
                    <span className="font-semibold text-slate-800">{h.partNumber} — {h.materialName}</span>
                    <span className="text-slate-500 ml-2">(Qty {h.quantity})</span>
                  </div>
                  <div className="flex gap-2 items-center text-slate-400">
                    <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-650 font-medium scale-90">{requestStatusLabel(h.status)}</span>
                    <span>{h.createdAt ? new Date(h.createdAt).toLocaleDateString() : ""}</span>
                  </div>
                </div>
              ))}
            {requests.filter((x) => x.requestedByUserId === showHistoryForUserId).length === 0 && (
              <p className="p-3 text-center text-slate-400 text-xs">No prior request history found.</p>
            )}
          </div>
        </div>
      )}

      {isManager && (
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-slate-600">Status filter</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
          >
            <option value="all">All</option>
            <option value="Submitted">Submitted</option>
            <option value="Approved">Approved</option>
            <option value="ReadyForPickup">Ready for pickup</option>
            <option value="Issued">Issued</option>
            <option value="Cancelled">Cancelled</option>
            <option value="Rejected">Rejected</option>
          </select>
        </div>
      )}

      {isEmployee && requestMaterialId && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
          <p className="text-sm font-semibold">New request for material #{requestMaterialId}</p>
          <input type="number" value={qty} onChange={(e) => setQty(e.target.value)} className="border rounded px-2 py-1 text-sm w-24" />
          <input
            placeholder="Purpose / reference *"
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            required
            className="border rounded px-2 py-1 text-sm ml-2 min-w-[200px]"
          />
          <button onClick={submitRequest} className="ml-2 px-3 py-1 bg-[#006039] text-white text-xs rounded-lg font-semibold cursor-pointer">
            Submit
          </button>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 divide-y">
        {requests
          .filter((r) => (statusFilter === "all" ? true : String(r.status) === statusFilter))
          .map((r) => (
          <div key={r.requestId} className="p-4 flex flex-wrap justify-between gap-2 items-center">
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-sm">
                #{r.requestId} — {r.partNumber} — {r.materialName}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                Qty {r.quantity}
                <span className="mx-1.5 text-slate-300">·</span>
                <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-medium">
                  {requestStatusLabel(r.status)}
                </span>
                {r.status === "Issued" && (
                  <span className="inline-flex items-center gap-1 ml-2 text-[11px] font-semibold text-emerald-700">
                    <CheckCircle className="w-4 h-4" /> Collected
                  </span>
                )}
                {r.createdAt && (
                  <>
                    <span className="mx-1.5 text-slate-300">·</span>
                    <span className="text-slate-400">{new Date(r.createdAt).toLocaleString()}</span>
                  </>
                )}
              </p>
              <p className="text-xs mt-1.5">
                <span className="font-bold text-slate-800">Requested by:</span>{" "}
                <span className="text-slate-700">{r.requestedByName || "Employee"}</span>
              </p>
              {r.aircraftOrWorkOrder && (
                <p className="text-xs mt-0.5 text-slate-500">
                  <span className="font-semibold text-slate-600">Purpose:</span> {r.aircraftOrWorkOrder}
                </p>
              )}
            </div>
            <div className="flex gap-2 shrink-0">
              {isManager && normalizeRequestStatus(r.status) === "PendingManagerApproval" && (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      executeApiCall(() => api.managerApproveRequest(r.requestId), "Accepted — sent to procurement").then(load)
                    }
                    className="text-xs px-2 py-1 bg-emerald-100 text-emerald-900 font-semibold rounded-lg hover:bg-emerald-200 cursor-pointer"
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      executeApiCall(() => api.managerRejectRequest(r.requestId, "Rejected by manager"), "Request rejected").then(load)
                    }
                    className="text-xs px-2 py-1 bg-rose-100 text-rose-800 font-semibold rounded-lg hover:bg-rose-200 cursor-pointer"
                  >
                    Reject
                  </button>
                </>
              )}
              {(isEmployee || isManager) && r.status === "ReadyForPickup" && (
                <button
                  onClick={() =>
                    executeApiCall(
                      () => api.issueRequest(r.requestId, r.requestedByUserId),
                      "Issued — stock collected"
                    ).then(load)
                  }
                  className="text-xs px-2 py-1 bg-[#006039] text-white rounded-lg cursor-pointer"
                >
                  Confirm pickup
                </button>
              )}
            </div>
          </div>
        ))}
        {requests.length === 0 && !loading && <p className="p-6 text-center text-slate-400 text-sm">No requests.</p>}
      </div>
    </div>
  );
}

export function AlertsView({
  executeApiCall,
  role,
  userId,
  shopId,
  onCountChange,
  refreshToken,
}: {
  executeApiCall: <T,>(call: () => Promise<T>) => Promise<T | null>;
  role: string;
  userId?: number;
  shopId?: number;
  onCountChange?: (count: number) => void;
  refreshToken?: number;
}) {
  const [alerts, setAlerts] = useState<import("../types").Alert[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    const a = await executeApiCall(() => api.getAlerts());
    setLoading(false);
    if (a) {
      const list = filterAlertsForRole(a, role, userId, shopId);
      setAlerts(list);
      onCountChange?.(list.length);
    }
  };

  useEffect(() => {
    load();
    const timer = setInterval(load, 30000);
    return () => clearInterval(timer);
  }, [refreshToken]);

  const typeStyle = (type: string) => {
    switch (type) {
      case "LowStock": return "bg-amber-50 text-amber-800 border-amber-200";
      case "ExpiryWarning": return "bg-orange-50 text-orange-800 border-orange-200";
      case "PickupReady": return "bg-emerald-50 text-emerald-800 border-emerald-200";
      case "NewMaterialAdded": return "bg-blue-50 text-blue-800 border-blue-200";
      case "QuarantineReview": return "bg-red-50 text-red-800 border-red-200";
      default: return "bg-slate-50 text-slate-700 border-slate-200";
    }
  };

  const typeLabel = (type: string) => {
    switch (type) {
      case "LowStock": return "Low stock";
      case "ExpiryWarning": return "Expiry";
      case "PickupReady": return "Pickup ready";
      case "NewMaterialAdded": return "New material";
      case "QuarantineReview": return "Quarantine";
      default: return type;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <Bell className="w-6 h-6" /> Alerts
        </h2>
        <button type="button" onClick={load} disabled={loading} className="text-sm font-medium text-[#006039] hover:underline disabled:opacity-50 cursor-pointer">
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>
      {role === "Employee" && (
        <p className="text-sm text-slate-500">
          Pickup-ready requests and newly added catalog materials.
        </p>
      )}
      <div className="bg-white rounded-xl border divide-y shadow-xs">
        {alerts.map((a) => (
          <div key={a.alertId} className="p-4 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 text-sm">
            <div className="space-y-1.5 min-w-0">
              <span className={`inline-block text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded border ${typeStyle(a.type)}`}>
                {typeLabel(a.type)}
              </span>
              <p className="font-semibold text-slate-800">{a.materialName}</p>
              {a.note && <p className="text-slate-600">{a.note}</p>}
              <p className="text-xs text-slate-400">
                {a.currentQuantity > 0 && <>Qty {a.currentQuantity} · </>}
                {a.requestId != null && <>Request #{a.requestId} · </>}
                {a.triggeredAt && new Date(a.triggeredAt).toLocaleString()}
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                executeApiCall(() => api.resolveAlert(a.alertId, "Acknowledged", userId)).then(load)
              }
              className="shrink-0 text-xs text-[#006039] font-semibold border border-[#006039]/30 px-3 py-1.5 rounded-lg hover:bg-[#006039]/5 cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        ))}
        {alerts.length === 0 && !loading && (
          <p className="p-6 text-center text-slate-400">No active alerts.</p>
        )}
      </div>
    </div>
  );
}

export function ProcurementBudgetView({
  executeApiCall,
}: {
  executeApiCall: <T,>(call: () => Promise<T>, successMessage?: string) => Promise<T | null>;
}) {
  const [shops, setShops] = useState<{ id: number; name: string; location?: string }[]>([]);
  const [shopId, setShopId] = useState<number | "">("");
  const [budget, setBudget] = useState<any | null>(null);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [actions, setActions] = useState<any[]>([]);
  const [purchaseMaterialId, setPurchaseMaterialId] = useState<number | "">("");
  const [purchaseQty, setPurchaseQty] = useState("0");
  const [purchaseCost, setPurchaseCost] = useState("0");
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    const sid = shopId === "" ? undefined : shopId;
    const [b, mats, actList] = await Promise.all([
      executeApiCall(() => api.getProcurementBudgetReport(sid)),
      executeApiCall(() => api.getMaterials(sid)),
      executeApiCall(() => api.getProcurementActions(sid)),
    ]);

    if (b) setBudget(b);
    if (mats) setMaterials(mats);
    if (actList) setActions(actList);
    setLoading(false);
  };

  useEffect(() => {
    (async () => {
      const list = await executeApiCall(() => api.getShops());
      if (list?.length) {
        setShops(list);
        if (shopId === "") setShopId(list[0].id);
      }
    })();
  }, [executeApiCall]);

  useEffect(() => {
    if (shopId !== "") load();
  }, [shopId]);

  const recordPurchase = async () => {
    if (!purchaseMaterialId || shopId === "") return;
    const quantity = parseFloat(purchaseQty);
    const cost = parseFloat(purchaseCost);
    if (quantity <= 0 || cost <= 0) return;
    const ok = await executeApiCall(
      () =>
        api.receiveStock(Number(purchaseMaterialId), {
          quantityReceived: quantity,
          costTotal: cost,
          receivedAt: new Date().toISOString(),
          shopId: Number(shopId),
        }),
      "Purchase recorded"
    );
    if (ok) {
      setPurchaseQty("0");
      setPurchaseCost("0");
      setPurchaseMaterialId("");
      load();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <DollarSign className="w-6 h-6 text-[#006039]" /> Budget & purchases
          </h2>
          <p className="text-sm text-slate-500">
            Track airline spending, set budgets, and record material purchases.
          </p>
        </div>
        <button onClick={load} className="p-2 border rounded-lg hover:bg-slate-50 cursor-pointer">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="flex flex-wrap gap-4 items-center bg-white border border-slate-200 p-4 rounded-xl">
        {shops.length > 0 && (
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-slate-600">Shop Location</label>
            <select
              value={shopId}
              onChange={(e) => setShopId(e.target.value ? Number(e.target.value) : "")}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#006039]"
            >
              {shops.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {budget && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs relative overflow-hidden">
            <div className="absolute top-0 right-0 w-16 h-16 bg-[#006039]/5 rounded-full translate-x-4 -translate-y-4" />
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total spent</p>
            <p className="text-3xl font-extrabold text-[#006039] mt-2">{budget.totalSpent?.toLocaleString?.() ?? budget.totalSpent} ETB</p>
            <p className="text-xs text-slate-400 mt-1">Cumulative store purchases</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs relative overflow-hidden">
            <div className="absolute top-0 right-0 w-16 h-16 bg-amber-700/5 rounded-full translate-x-4 -translate-y-4" />
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">This month</p>
            <p className="text-3xl font-extrabold text-amber-700 mt-2">{budget.monthlySpent?.toLocaleString?.() ?? budget.monthlySpent} ETB</p>
            <p className="text-xs text-slate-400 mt-1">Current calendar month</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs relative overflow-hidden">
            <div className="absolute top-0 right-0 w-16 h-16 bg-slate-800/5 rounded-full translate-x-4 -translate-y-4" />
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total quantity purchased</p>
            <p className="text-3xl font-extrabold text-slate-800 mt-2">{budget.totalQuantityPurchased}</p>
            <p className="text-xs text-slate-400 mt-1">Total units received into stock</p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-[#006039]" /> Record purchase
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <select
            value={purchaseMaterialId}
            onChange={(e) => setPurchaseMaterialId(e.target.value ? Number(e.target.value) : "")}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#006039]"
          >
            <option value="">Select material</option>
            {materials.map((m) => (
              <option key={m.id} value={m.id}>{m.partNumber} — {m.name}</option>
            ))}
          </select>
          <input type="number" min="1" value={purchaseQty} onChange={(e) => setPurchaseQty(e.target.value)} placeholder="Quantity" className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#006039]" />
          <input type="number" min="1" value={purchaseCost} onChange={(e) => setPurchaseCost(e.target.value)} placeholder="Cost ETB" className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#006039]" />
          <button onClick={recordPurchase} className="bg-[#006039] text-white rounded-lg text-sm font-semibold cursor-pointer hover:bg-[#004d2e] py-2 transition-all">Record</button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
          <h3 className="text-sm font-bold text-slate-700">Procurement action logs & audit</h3>
        </div>
        <div className="divide-y divide-slate-100">
          {actions.map((a, i) => (
            <div key={i} className="p-4 text-sm hover:bg-slate-55/20 transition-colors flex justify-between items-center">
              <div>
                <p className="font-semibold text-slate-800">{a.actionType} — {a.partNumber}</p>
                <p className="text-xs text-slate-500 mt-0.5">{a.materialName}</p>
              </div>
              <span className="text-xs font-semibold text-amber-800 px-2 py-0.5 bg-amber-50 rounded-full border border-amber-100">
                {a.summary}
              </span>
            </div>
          ))}
          {actions.length === 0 && <p className="p-8 text-center text-slate-400 text-sm">No procurement actions recorded.</p>}
        </div>
      </div>
    </div>
  );
}

export function ProcurementInboxView({
  executeApiCall,
}: {
  executeApiCall: <T,>(call: () => Promise<T>, successMessage?: string) => Promise<T | null>;
}) {
  const [shops, setShops] = useState<{ id: number; name: string }[]>([]);
  const [shopId, setShopId] = useState<number | "">("");
  const [inboxSummaries, setInboxSummaries] = useState<any[]>([]);
  const [selectedDeptId, setSelectedDeptId] = useState<number | null>(null);
  const [requests, setRequests] = useState<MaterialRequest[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<MaterialRequest | null>(null);
  const [employeeHistory, setEmployeeHistory] = useState<MaterialRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Mark ready form state
  const [readyNotes, setReadyNotes] = useState("");
  const [pickupTime, setPickupTime] = useState("");

  const loadSummaries = async () => {
    const summs = await executeApiCall(() => api.getDepartmentInboxSummary());
    if (summs) setInboxSummaries(summs);
  };

  const loadRequests = async () => {
    setLoading(true);
    const sid = shopId === "" ? undefined : shopId;
    const deptId = selectedDeptId ?? undefined;
    
    // Get all requests for this shop and department
    const list = await executeApiCall(() => api.getMaterialRequests(sid, undefined, deptId));
    if (list) {
      // Filter for inbox (Submitted or Approved)
      const inboxList = list.filter((r) => r.status === "Approved" || r.status === "Submitted");
      setRequests(inboxList);
    }
    setLoading(false);
  };

  useEffect(() => {
    (async () => {
      const list = await executeApiCall(() => api.getShops());
      if (list?.length) {
        setShops(list);
        if (shopId === "") setShopId(list[0].id);
      }
    })();
    loadSummaries();
  }, [executeApiCall]);

  useEffect(() => {
    loadRequests();
  }, [shopId, selectedDeptId]);

  const selectRequest = async (req: MaterialRequest) => {
    setSelectedRequest(req);
    setHistoryLoading(true);
    setReadyNotes("");
    setPickupTime("");
    try {
      const allReqs = await api.getMaterialRequests(undefined, undefined, undefined);
      const history = allReqs
        .filter((r) => r.requestedByUserId === req.requestedByUserId)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setEmployeeHistory(history);
    } catch {
      setEmployeeHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleMarkReady = async () => {
    if (!selectedRequest) return;
    const timeVal = pickupTime ? new Date(pickupTime).toISOString() : undefined;
    const ok = await executeApiCall(
      () => api.markRequestReady(selectedRequest.requestId, readyNotes, timeVal),
      "Request marked ready for pickup"
    );
    if (ok) {
      setSelectedRequest(null);
      loadRequests();
      loadSummaries();
    }
  };

  const handleReject = async () => {
    if (!selectedRequest) return;
    const notes = readyNotes || "Rejected by Procurement";
    const ok = await executeApiCall(
      () => api.rejectRequest(selectedRequest.requestId, notes),
      "Request rejected"
    );
    if (ok) {
      setSelectedRequest(null);
      loadRequests();
      loadSummaries();
    }
  };

  const activeDept = inboxSummaries.find((d) => d.departmentId === selectedDeptId);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Package className="w-6 h-6 text-[#006039]" /> Procurement inbox
          </h2>
          <p className="text-sm text-slate-500">
            Receive and process material orders from different airline departments.
          </p>
        </div>
        <button onClick={() => { loadRequests(); loadSummaries(); }} className="p-2 border rounded-lg hover:bg-slate-50 cursor-pointer">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="flex flex-wrap gap-4 items-center bg-white border border-slate-200 p-4 rounded-xl justify-between">
        {shops.length > 0 && (
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-slate-600">Shop Location</label>
            <select
              value={shopId}
              onChange={(e) => setShopId(e.target.value ? Number(e.target.value) : "")}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#006039]"
            >
              {shops.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar: Departments list */}
        <div className="lg:col-span-1 bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col min-h-[300px]">
          <div className="px-4 py-3 bg-slate-50 border-b font-bold text-xs uppercase tracking-wider text-slate-500">
            Airline Departments
          </div>
          <div className="flex-1 divide-y divide-slate-100 overflow-y-auto max-h-[500px]">
            <button
              onClick={() => setSelectedDeptId(null)}
              className={`w-full text-left px-4 py-3 text-sm flex items-center justify-between transition-colors ${selectedDeptId === null ? "bg-[#006039]/5 border-l-4 border-[#006039] font-semibold text-[#006039]" : "hover:bg-slate-50"}`}
            >
              <span>All requests</span>
              <span className="bg-slate-100 px-2 py-0.5 rounded-full text-xs text-slate-600 font-bold">
                {inboxSummaries.reduce((acc, curr) => acc + curr.pendingCount, 0)}
              </span>
            </button>
            {inboxSummaries.map((dept) => (
              <button
                key={dept.departmentId}
                onClick={() => setSelectedDeptId(dept.departmentId)}
                className={`w-full text-left px-4 py-3 text-sm flex items-center justify-between transition-colors ${selectedDeptId === dept.departmentId ? "bg-[#006039]/5 border-l-4 border-[#006039] font-semibold text-[#006039]" : "hover:bg-slate-50"}`}
              >
                <div className="min-w-0 pr-2">
                  <p className="truncate font-medium">{dept.name}</p>
                  <p className="text-[10px] text-slate-400 truncate">{dept.category}</p>
                </div>
                {dept.pendingCount > 0 && (
                  <span className="bg-amber-100 px-2 py-0.5 rounded-full text-xs text-amber-800 font-bold shrink-0">
                    {dept.pendingCount}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Center: Department requests list */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col min-h-[400px]">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
            <h3 className="text-sm font-bold text-slate-700">
              {activeDept ? `${activeDept.name} requests` : "All department requests"} ({requests.length})
            </h3>
          </div>
          <div className="flex-1 divide-y divide-slate-100 overflow-y-auto max-h-[500px]">
            {requests.map((r) => {
              const active = selectedRequest?.requestId === r.requestId;
              return (
                <button
                  key={r.requestId}
                  onClick={() => selectRequest(r)}
                  className={`w-full text-left p-4 text-sm hover:bg-slate-50 transition-colors flex flex-col gap-1 border-l-4 ${active ? "bg-[#006039]/5 border-[#006039]" : "border-transparent"}`}
                >
                  <div className="flex justify-between items-start w-full">
                    <p className="font-bold text-slate-800">#{r.requestId} — {r.partNumber}</p>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-650">
                      {requestStatusLabel(r.status)}
                    </span>
                  </div>
                  <p className="text-slate-600 text-xs font-semibold">{r.materialName}</p>
                  <div className="flex justify-between items-center w-full mt-2 text-xs text-slate-500">
                    <p>Qty: <span className="font-bold text-slate-700">{r.quantity}</span> · By: {r.requestedByName}</p>
                    <p className="font-mono text-[10px]">{new Date(r.createdAt).toLocaleDateString()}</p>
                  </div>
                </button>
              );
            })}
            {requests.length === 0 && !loading && (
              <p className="p-8 text-center text-slate-400 text-sm">No pending requests for this department.</p>
            )}
          </div>
        </div>

        {/* Right Panel: Detail, History & Collection scheduler */}
        <div className="lg:col-span-1 bg-white border border-slate-200 rounded-xl p-4 flex flex-col gap-4 min-h-[400px]">
          {!selectedRequest ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 text-sm p-4 text-center">
              <Clock className="w-8 h-8 opacity-45 mb-2" />
              Select a request from the list to view employee details, history, and schedule pickup time.
            </div>
          ) : (
            <div className="space-y-4 flex-1 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="border-b pb-2">
                  <h3 className="font-bold text-slate-800 text-base">Request details</h3>
                  <p className="text-xs text-slate-400 mt-0.5">#{selectedRequest.requestId} — {new Date(selectedRequest.createdAt).toLocaleString()}</p>
                </div>
                <div className="text-xs space-y-1.5 bg-slate-50 p-2.5 rounded-lg border">
                  <p><span className="font-bold text-slate-600">Material:</span> {selectedRequest.materialName}</p>
                  <p><span className="font-bold text-slate-600">Part No:</span> {selectedRequest.partNumber}</p>
                  <p><span className="font-bold text-slate-600">Qty requested:</span> {selectedRequest.quantity}</p>
                  <p><span className="font-bold text-slate-600">Work order:</span> {selectedRequest.aircraftOrWorkOrder || "—"}</p>
                  <p><span className="font-bold text-slate-600">Requested by:</span> {selectedRequest.requestedByName}</p>
                  {selectedRequest.notes && <p><span className="font-bold text-slate-600">Notes:</span> {selectedRequest.notes}</p>}
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                    <History className="w-3.5 h-3.5" /> Requester History ({employeeHistory.length})
                  </p>
                  <div className="border rounded-lg max-h-[140px] overflow-y-auto divide-y divide-slate-100 text-xs">
                    {historyLoading ? (
                      <p className="p-3 text-center text-slate-400">Loading history...</p>
                    ) : employeeHistory.length === 0 ? (
                      <p className="p-3 text-center text-slate-400">No prior requests found.</p>
                    ) : (
                      employeeHistory.map((h) => (
                        <div key={h.requestId} className="p-2 flex justify-between gap-2 items-center hover:bg-slate-50">
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-850 truncate">{h.partNumber} — {h.materialName}</p>
                            <p className="text-[10px] text-slate-400">Qty: {h.quantity} · {new Date(h.createdAt).toLocaleDateString()}</p>
                          </div>
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 shrink-0 font-medium">{requestStatusLabel(h.status)}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t">
                  <label className="text-xs font-bold text-slate-700 block">Scheduled Pickup Time (Optional)</label>
                  <input
                    type="datetime-local"
                    value={pickupTime}
                    onChange={(e) => setPickupTime(e.target.value)}
                    className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs w-full focus:outline-none focus:ring-1 focus:ring-[#006039]"
                  />
                  <label className="text-xs font-bold text-slate-700 block mt-2">Notes / Reason</label>
                  <textarea
                    placeholder="Provide pick-up instructions or reject reason..."
                    value={readyNotes}
                    onChange={(e) => setReadyNotes(e.target.value)}
                    className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs w-full h-16 resize-none focus:outline-none focus:ring-1 focus:ring-[#006039]"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-4 mt-auto">
                <button
                  onClick={handleMarkReady}
                  className="flex-1 text-xs px-3 py-2 bg-[#006039] text-white font-bold rounded-lg cursor-pointer hover:bg-[#004d2e] transition-colors"
                >
                  Confirm & Ready
                </button>
                <button
                  onClick={handleReject}
                  className="text-xs px-3 py-2 bg-rose-100 text-rose-800 font-bold rounded-lg cursor-pointer hover:bg-rose-200 transition-colors"
                >
                  Reject
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
