import React, { useState, useEffect, useCallback } from "react";
import { Search, RefreshCw, Loader2, Package, Bell, Clock, DollarSign, ClipboardList, CheckCircle, XCircle, History, X, AlertTriangle, Sparkles, Building2, Inbox, ChevronRight, User } from "lucide-react";
import { api, ApiError } from "../client";
import { Material, MaterialRequest, AuthSession } from "../types";
import { requestStatusLabel, normalizeRequestStatus } from "../requestStatus";
import { filterAlertsForRole } from "../realtime";
import {
  PremiumPageHeader,
  PremiumPanel,
  PremiumEmptyState,
  premiumSelect,
  premiumBtnPrimary,
  premiumBtnDanger,
  premiumInput,
} from "./PremiumUI";

type ToastFn = (type: "success" | "error" | "warning" | "info", title: string, message?: string) => void;

const MAX_DISPLAY = 5;

/** Levenshtein edit distance — used for client-side fuzzy matching on typos. */
function editDistance(a: string, b: string): number {
  const la = a.length, lb = b.length;
  if (la === 0) return lb;
  if (lb === 0) return la;
  const dp: number[][] = Array.from({ length: la + 1 }, (_, i) =>
    Array.from({ length: lb + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= la; i++)
    for (let j = 1; j <= lb; j++)
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
  return dp[la][lb];
}

/** Score a material against a query — lower is better. Uses best substring distance. */
function fuzzyScore(query: string, material: { name: string; partNumber: string; description?: string }): number {
  const q = query.toLowerCase();
  const fields = [material.name, material.partNumber, material.description ?? ""].map(f => f.toLowerCase());
  let best = Infinity;
  for (const field of fields) {
    // Check direct substring first (distance 0)
    if (field.includes(q)) return 0;
    // Check each word in the field
    const words = field.split(/[\s\-\/,._]+/);
    for (const w of words) {
      if (w.length === 0) continue;
      const d = editDistance(q, w);
      // Allow up to ~40% character difference
      const threshold = Math.max(2, Math.floor(q.length * 0.4));
      if (d <= threshold && d < best) best = d;
    }
    // Also check edit distance against the whole field if it's short
    if (field.length <= q.length + 5) {
      const d = editDistance(q, field);
      if (d < best) best = d;
    }
  }
  return best;
}

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

  // Employee Dashboard Landing stats
  const [profile, setProfile] = useState<any | null>(null);
  const [activeCount, setActiveCount] = useState(0);
  const [readyCount, setReadyCount] = useState(0);
  const [monthQtyUsed, setMonthQtyUsed] = useState(0);
  const [monthRequestsCount, setMonthRequestsCount] = useState(0);

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

      if (items.length > 0) {
        setResults(items.slice(0, MAX_DISPLAY));
        items.slice(0, MAX_DISPLAY).forEach((m) => recordMaterialAccess(session.userId, m));
      } else if (materialQuery.trim()) {
        // Fuzzy fallback — fetch all materials and rank by edit distance
        try {
          const all = await api.searchMaterials({ shopId: session.shopId });
          const query = materialQuery.trim();
          const scored = all
            .map((m) => ({ material: m, score: fuzzyScore(query, m) }))
            .filter((s) => s.score < Infinity)
            .sort((a, b) => a.score - b.score)
            .slice(0, MAX_DISPLAY);
          if (scored.length > 0) {
            const fuzzyResults = scored.map((s) => s.material);
            setResults(fuzzyResults);
            fuzzyResults.forEach((m) => recordMaterialAccess(session.userId, m));
            addToast("info", "Showing closest matches", "No exact match found — displaying similar results.");
          } else {
            setResults([]);
          }
        } catch {
          setResults([]);
        }
      } else {
        setResults([]);
      }

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

  const loadDashboardData = useCallback(async () => {
    try {
      if (session.role === "Employee" || session.role === "Technician") {
        const me = await api.getMe();
        setProfile(me);
      }

      const list = await api.getMaterialRequests(session.shopId);
      const mine = list
        .filter((r) => !session.userId || r.requestedByUserId === session.userId)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      setLastRequest(mine[0] ?? null);

      const active = mine.filter(
        (r) =>
          r.status === "PendingManagerApproval" ||
          r.status === "Submitted" ||
          r.status === "Approved"
      );
      setActiveCount(active.length);

      const ready = mine.filter((r) => r.status === "ReadyForPickup");
      setReadyCount(ready.length);

      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const thisMonthRequests = mine.filter(
        (r) =>
          new Date(r.createdAt) >= startOfMonth &&
          r.status !== "Cancelled" &&
          r.status !== "Rejected"
      );

      setMonthRequestsCount(thisMonthRequests.length);
      const qtySum = thisMonthRequests.reduce((sum, r) => sum + r.quantity, 0);
      setMonthQtyUsed(qtySum);
    } catch {
      // silent fail if some endpoints unavailable
    }
  }, [session.shopId, session.userId, session.role]);

  useEffect(() => {
    setSearchHistory(loadSearchHistory(session.userId));
    loadRecent();
    loadDashboardData();
  }, [session.userId, loadRecent, loadDashboardData]);

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
      loadDashboardData();
    } catch (e) {
      addToast("error", "Request failed", e instanceof ApiError ? e.detail : undefined);
    }
  };

  return (
    <div className="space-y-6">

      {/* Employee Welcome Dashboard — only shown for employee/technician role */}
      {!isManager && (
        <>
          {/* Welcome Banner */}
          <div className="relative rounded-2xl overflow-hidden bg-gradient-to-r from-[#006039] to-[#004d2e] text-white p-6 shadow-lg border border-[#e2b007]/30">
            <div className="absolute inset-0 pointer-events-none opacity-10">
              <div className="absolute -top-10 -right-10 w-64 h-64 rounded-full bg-[#e2b007]" />
              <div className="absolute bottom-0 left-1/3 w-48 h-48 rounded-full bg-emerald-300" />
            </div>
            <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <p className="text-[#e2b007] text-xs font-bold tracking-wider uppercase mb-1">Airline Store Management</p>
                <h2 className="text-2xl font-bold">
                  Welcome back{profile?.name ? `, ${profile.name.split(" ")[0]}` : ""}!
                </h2>
                <p className="text-emerald-200 text-sm mt-1">
                  {readyCount > 0
                    ? `🔔 You have ${readyCount} request${readyCount !== 1 ? "s" : ""} ready for pickup.`
                    : activeCount > 0
                    ? `${activeCount} active request${activeCount !== 1 ? "s" : ""} in progress.`
                    : "No pending requests. Search below to request a material."}
                </p>
              </div>
              <div className="flex gap-3 shrink-0">
                <div className="bg-black/20 rounded-xl px-4 py-3 text-center min-w-[80px]">
                  <p className="text-2xl font-extrabold text-[#e2b007]">{activeCount}</p>
                  <p className="text-[10px] text-emerald-200 mt-0.5 uppercase tracking-wide">Active</p>
                </div>
                <div className="bg-black/20 rounded-xl px-4 py-3 text-center min-w-[80px]">
                  <p className="text-2xl font-extrabold text-amber-300">{readyCount}</p>
                  <p className="text-[10px] text-emerald-200 mt-0.5 uppercase tracking-wide">Ready</p>
                </div>
              </div>
            </div>
          </div>

          {/* KPI Cards Row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Requests this month */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Requests / Month</span>
                <div className="w-8 h-8 rounded-lg bg-[#006039]/10 flex items-center justify-center">
                  <ClipboardList className="w-4 h-4 text-[#006039]" />
                </div>
              </div>
              <p className="text-3xl font-extrabold text-slate-900">{monthRequestsCount}</p>
              <p className="text-xs text-slate-400 mt-1">
                {profile?.maxRequestsPerMonth
                  ? `of ${profile.maxRequestsPerMonth} limit`
                  : "this calendar month"}
              </p>
              {profile?.maxRequestsPerMonth && (
                <div className="mt-2 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#006039] rounded-full transition-all"
                    style={{ width: `${Math.min(100, (monthRequestsCount / profile.maxRequestsPerMonth) * 100)}%` }}
                  />
                </div>
              )}
            </div>

            {/* Qty used this month */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Qty / Month</span>
                <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
                  <Package className="w-4 h-4 text-[#e2b007]" />
                </div>
              </div>
              <p className="text-3xl font-extrabold text-slate-900">{monthQtyUsed}</p>
              <p className="text-xs text-slate-400 mt-1">
                {profile?.maxQuantityPerMonth
                  ? `of ${profile.maxQuantityPerMonth} limit`
                  : "units requested"}
              </p>
              {profile?.maxQuantityPerMonth && (
                <div className="mt-2 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#e2b007] rounded-full transition-all"
                    style={{ width: `${Math.min(100, (monthQtyUsed / profile.maxQuantityPerMonth) * 100)}%` }}
                  />
                </div>
              )}
            </div>

            {/* Active requests */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">In Progress</span>
                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                  <RefreshCw className="w-4 h-4 text-blue-500" />
                </div>
              </div>
              <p className="text-3xl font-extrabold text-slate-900">{activeCount}</p>
              <p className="text-xs text-slate-400 mt-1">active requests</p>
            </div>

            {/* Ready for pickup */}
            <div className={`rounded-xl border p-4 shadow-xs hover:shadow-md transition-shadow ${readyCount > 0 ? "bg-emerald-50 border-emerald-200" : "bg-white border-slate-200"}`}>
              <div className="flex items-center justify-between mb-3">
                <span className={`text-xs font-bold uppercase tracking-wider ${readyCount > 0 ? "text-emerald-700" : "text-slate-500"}`}>Ready Pickup</span>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${readyCount > 0 ? "bg-emerald-100" : "bg-slate-50"}`}>
                  <Bell className={`w-4 h-4 ${readyCount > 0 ? "text-emerald-600 animate-bounce" : "text-slate-400"}`} />
                </div>
              </div>
              <p className={`text-3xl font-extrabold ${readyCount > 0 ? "text-emerald-700" : "text-slate-900"}`}>{readyCount}</p>
              <p className={`text-xs mt-1 ${readyCount > 0 ? "text-emerald-600 font-semibold" : "text-slate-400"}`}>
                {readyCount > 0 ? "Go collect your items!" : "none ready yet"}
              </p>
            </div>
          </div>

          {/* Quick Action Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-start gap-3 hover:border-[#006039] hover:bg-[#006039]/5 transition-all cursor-pointer group" onClick={() => onRequest(0)}>
              <div className="bg-[#006039]/10 text-[#006039] p-2.5 rounded-lg group-hover:bg-[#006039] group-hover:text-white transition-colors">
                <Search className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-slate-800">Search & Request</h4>
                <p className="text-xs text-slate-400 mt-0.5 leading-snug">Find parts by name, ID, or aircraft model</p>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-start gap-3 hover:border-[#e2b007] hover:bg-amber-50/30 transition-all">
              <div className="bg-amber-100 text-amber-700 p-2.5 rounded-lg">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-slate-800">My Last Request</h4>
                {lastRequest ? (
                  <div className="mt-1">
                    <p className="text-xs font-semibold text-slate-700">{lastRequest.partNumber} — {lastRequest.materialName}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Qty {lastRequest.quantity} · <span className="font-medium text-slate-600">{requestStatusLabel(lastRequest.status)}</span>
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 mt-0.5">No requests yet</p>
                )}
              </div>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-start gap-3 hover:border-slate-300 transition-all">
              <div className="bg-slate-100 text-slate-600 p-2.5 rounded-lg">
                <DollarSign className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-slate-800">Monthly Limits</h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  {profile?.maxRequestsPerMonth
                    ? `${monthRequestsCount}/${profile.maxRequestsPerMonth} req · ${monthQtyUsed}/${profile.maxQuantityPerMonth ?? "∞"} qty`
                    : "No limits set for your account"}
                </p>
              </div>
            </div>
          </div>

          {/* Search section heading */}
          <div className="flex items-center gap-3 pt-2 border-t border-slate-100">
            <Search className="w-5 h-5 text-[#006039]" />
            <h3 className="text-base font-bold text-slate-800">Search Materials</h3>
            <p className="text-xs text-slate-400">Find parts by name, part number, or aircraft type</p>
          </div>
        </>
      )}

      {isManager && (
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Material search</h2>
          <p className="text-sm text-slate-500 mt-1">
            Search and request materials — manager requests go directly to procurement.
          </p>
        </div>
      )}
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
  onStockChanged,
}: {
  session: AuthSession;
  addToast: ToastFn;
  executeApiCall: <T,>(call: () => Promise<T>, msg?: string) => Promise<T | null>;
  initialMaterialId?: number | null;
  onStockChanged?: () => void;
}) {
  const [requests, setRequests] = useState<MaterialRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [requestMaterialId, setRequestMaterialId] = useState<number | null>(initialMaterialId ?? null);
  const [qty, setQty] = useState("1");
  const [purpose, setPurpose] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showHistoryForUserId, setShowHistoryForUserId] = useState<number | null>(null);
  const [showHistoryForUserName, setShowHistoryForUserName] = useState<string>("");
  const [rejectingRequestId, setRejectingRequestId] = useState<number | null>(null);
  const [rejectionNotes, setRejectionNotes] = useState<string>("");
  const [editingRequestId, setEditingRequestId] = useState<number | null>(null);
  const [editQty, setEditQty] = useState("");
  const [editPurpose, setEditPurpose] = useState("");
  const [editNotes, setEditNotes] = useState("");

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
    <div className="space-y-6 page-enter">
      <PremiumPageHeader
        icon={isManager ? ClipboardList : ClipboardList}
        title={isManager ? "Approve employee requests" : "My material requests"}
        subtitle={
          isManager
            ? "Review and action pending requests from your team."
            : "Track all your material requests and their current status."
        }
        onRefresh={load}
        loading={loading}
        badge={
          requests.length > 0 ? (
            <span className="premium-stat-chip bg-white/10 text-white border-white/20">
              {requests.filter((r) => statusFilter === "all" ? true : String(r.status) === statusFilter).length} shown
            </span>
          ) : undefined
        }
      />

      {showHistoryForUserId !== null && (
        <PremiumPanel
          title={`Request history — ${showHistoryForUserName}`}
          icon={History}
          badge={
            <button
              onClick={() => setShowHistoryForUserId(null)}
              className="text-xs font-semibold text-slate-500 hover:text-[#006039] cursor-pointer"
            >
              Close
            </button>
          }
        >
          <div className="divide-y max-h-48 overflow-y-auto premium-surface border-0 shadow-none">
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
        </PremiumPanel>
      )}

      {isManager && (
        <div className="premium-surface px-4 py-3 flex items-center gap-3">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wide shrink-0">Filter</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={`${premiumSelect} flex-1 max-w-xs`}
          >
            <option value="all">All statuses</option>
            <option value="Submitted">Submitted</option>
            <option value="Approved">Approved</option>
            <option value="ReadyForPickup">Ready for pickup</option>
            <option value="Issued">Issued</option>
            <option value="Cancelled">Cancelled</option>
            <option value="Rejected">Rejected</option>
          </select>
        </div>
      )}

      {/* New request form (employee) */}
      {isEmployee && requestMaterialId && (
        <div className="bg-gradient-to-r from-[#006039]/5 to-[#e2b007]/5 border border-[#006039]/25 rounded-xl p-5 space-y-3 shadow-xs">
          <p className="text-sm font-bold text-[#006039]">📦 New request for material #{requestMaterialId}</p>
          <div className="flex flex-wrap gap-2">
            <input type="number" value={qty} onChange={(e) => setQty(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 text-sm w-24 bg-white focus:outline-none focus:ring-2 focus:ring-[#006039]/30" />
            <input
              placeholder="Purpose / reference *"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              required
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm flex-1 min-w-[200px] bg-white focus:outline-none focus:ring-2 focus:ring-[#006039]/30"
            />
            <button onClick={submitRequest} className="px-5 py-2 bg-[#006039] hover:bg-[#004d2e] text-white text-xs rounded-lg font-bold cursor-pointer transition-colors shadow-sm">
              Submit Request
            </button>
          </div>
        </div>
      )}

      {/* Request cards */}
      <div className="space-y-3">
        {requests
          .filter((r) => (statusFilter === "all" ? true : String(r.status) === statusFilter))
          .map((r) => {
            const status = normalizeRequestStatus(r.status);
            const borderColor =
              status === "Issued"                ? "border-l-emerald-500" :
              status === "ReadyForPickup"         ? "border-l-[#006039]"  :
              status === "Approved"               ? "border-l-blue-400"   :
              status === "PendingManagerApproval" ? "border-l-amber-400"  :
              status === "Rejected"               ? "border-l-rose-400"   :
              status === "Cancelled"              ? "border-l-slate-300"  :
                                                    "border-l-slate-400";
            const badgeCls =
              status === "Issued"                ? "bg-emerald-100 text-emerald-800 border-emerald-200"  :
              status === "ReadyForPickup"         ? "bg-[#006039]/10 text-[#006039] border-[#006039]/20" :
              status === "Approved"               ? "bg-blue-100 text-blue-800 border-blue-200"          :
              status === "PendingManagerApproval" ? "bg-amber-100 text-amber-800 border-amber-200"       :
              status === "Rejected"               ? "bg-rose-100 text-rose-700 border-rose-200"          :
              status === "Cancelled"              ? "bg-slate-100 text-slate-500 border-slate-200"       :
                                                    "bg-slate-100 text-slate-600 border-slate-200";
            return (
              <div
                key={r.requestId}
                className={`bg-white rounded-xl border border-slate-200 border-l-4 ${borderColor} shadow-xs hover:shadow-md transition-all duration-150 overflow-hidden`}
              >
                {editingRequestId === r.requestId ? (
                  /* ── Edit form ── */
                  <div className="p-5 space-y-4 bg-slate-50">
                    <p className="text-xs font-bold text-[#006039] uppercase tracking-wide">✏ Edit Request REQ-{r.requestId}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Quantity</label>
                        <input
                          type="number" min="1" value={editQty}
                          onChange={(e) => setEditQty(e.target.value)}
                          className="border border-slate-200 rounded-lg px-2.5 py-2 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#006039]/30"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Purpose / Work Order</label>
                        <input
                          value={editPurpose} onChange={(e) => setEditPurpose(e.target.value)}
                          className="border border-slate-200 rounded-lg px-2.5 py-2 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#006039]/30"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Notes (Optional)</label>
                        <input
                          value={editNotes} onChange={(e) => setEditNotes(e.target.value)}
                          placeholder="e.g. urgent, replacement"
                          className="border border-slate-200 rounded-lg px-2.5 py-2 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#006039]/30"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <button
                        type="button"
                        onClick={() => setEditingRequestId(null)}
                        className="text-xs px-4 py-1.5 bg-white border border-slate-200 text-slate-700 font-semibold rounded-lg cursor-pointer hover:bg-slate-50 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          executeApiCall(
                            () => api.editMaterialRequest(r.requestId, {
                              quantity: parseFloat(editQty) || 1,
                              aircraftOrWorkOrder: editPurpose.trim(),
                              notes: editNotes.trim() || undefined,
                            }),
                            "Request edited successfully"
                          ).then(() => { setEditingRequestId(null); load(); });
                        }}
                        className="text-xs px-4 py-1.5 bg-[#006039] hover:bg-[#004d2e] text-white font-bold rounded-lg cursor-pointer shadow-sm transition-colors"
                      >
                        Save Changes
                      </button>
                    </div>
                  </div>
                ) : (
                  /* ── Card view ── */
                  <div className="p-4">
                    {/* Top row: REQ-ID + status badge + timestamp */}
                    <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-bold text-[#006039] font-mono tracking-wide">REQ-{r.requestId}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border ${badgeCls}`}>
                          {requestStatusLabel(r.status)}
                        </span>
                        {status === "Issued" && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200">
                            <CheckCircle className="w-3 h-3" /> Collected
                          </span>
                        )}
                        {status === "ReadyForPickup" && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#006039] animate-pulse">
                            🟢 Ready for pickup
                          </span>
                        )}
                      </div>
                      {r.createdAt && (
                        <span className="text-[11px] text-slate-400 shrink-0">{new Date(r.createdAt).toLocaleString()}</span>
                      )}
                    </div>

                    {/* Material name */}
                    <p className="font-bold text-slate-800 text-sm leading-snug">
                      {r.partNumber} <span className="text-slate-400 font-normal mx-1">—</span> {r.materialName}
                    </p>

                    {/* Details row */}
                    <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-slate-500">
                      <span>
                        <span className="font-semibold text-slate-700">Qty</span>{" "}
                        <span className="font-bold text-slate-900">{r.quantity}</span>
                      </span>
                      <span>
                        <span className="font-semibold text-slate-700">By:</span>{" "}
                        {r.requestedByName || "Employee"}
                      </span>
                      {r.aircraftOrWorkOrder && (
                        <span>
                          <span className="font-semibold text-slate-700">Purpose:</span>{" "}
                          {r.aircraftOrWorkOrder}
                        </span>
                      )}
                    </div>

                    {/* Rejection reason */}
                    {r.notes && status === "Rejected" && (
                      <div className="mt-3 flex items-start gap-2 p-2.5 bg-rose-50 border border-rose-200 rounded-lg">
                        <XCircle className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
                        <p className="text-xs">
                          <span className="font-bold text-rose-800">Rejection reason: </span>
                          <span className="text-rose-700 italic">"{r.notes}"</span>
                        </p>
                      </div>
                    )}

                    {/* General note */}
                    {r.notes && status !== "Rejected" && (
                      <div className="mt-3 p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                        <p className="text-xs">
                          <span className="font-semibold text-slate-600">Note: </span>
                          <span className="text-slate-500 italic">"{r.notes}"</span>
                        </p>
                      </div>
                    )}

                    {/* Action buttons */}
                    <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap gap-2 items-center">

                      {/* Manager approve/reject */}
                      {isManager && status === "PendingManagerApproval" && (
                        <>
                          <button
                            type="button"
                            onClick={() => executeApiCall(() => api.managerApproveRequest(r.requestId), "Accepted — sent to procurement").then(load)}
                            className="flex items-center gap-1.5 text-xs px-4 py-1.5 bg-[#006039] hover:bg-[#004d2e] text-white font-bold rounded-lg cursor-pointer shadow-sm transition-all hover:shadow-md"
                          >
                            ✓ Accept
                          </button>
                          {rejectingRequestId === r.requestId ? (
                            <div className="flex flex-wrap gap-1.5 items-center bg-rose-50 border border-rose-200 rounded-lg p-2">
                              <input
                                placeholder="Rejection reason..."
                                value={rejectionNotes}
                                onChange={(e) => setRejectionNotes(e.target.value)}
                                className="text-xs p-1.5 border border-rose-200 rounded-lg min-w-[160px] focus:outline-none focus:ring-1 focus:ring-rose-400 bg-white"
                                autoFocus
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  executeApiCall(() => api.managerRejectRequest(r.requestId, rejectionNotes.trim() || "Rejected by manager"), "Request rejected")
                                    .then(() => { setRejectingRequestId(null); setRejectionNotes(""); load(); });
                                }}
                                className="text-xs px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-lg cursor-pointer transition-colors"
                              >
                                Confirm
                              </button>
                              <button
                                type="button"
                                onClick={() => setRejectingRequestId(null)}
                                className="text-xs px-3 py-1.5 border border-slate-200 text-slate-600 hover:bg-white rounded-lg cursor-pointer transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => { setRejectingRequestId(r.requestId); setRejectionNotes(""); }}
                              className="text-xs px-4 py-1.5 border-2 border-rose-400 text-rose-600 hover:bg-rose-50 font-bold rounded-lg cursor-pointer transition-colors"
                            >
                              ✕ Reject
                            </button>
                          )}
                        </>
                      )}

                      {/* Employee edit / cancel */}
                      {r.requestedByUserId === session.userId &&
                        (status === "Submitted" || status === "PendingManagerApproval" || status === "Approved") && (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingRequestId(r.requestId);
                                setEditQty(String(r.quantity));
                                setEditPurpose(r.aircraftOrWorkOrder || "");
                                setEditNotes(r.notes || "");
                              }}
                              className="text-xs px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg cursor-pointer transition-colors"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (confirm("Are you sure you want to cancel this request?")) {
                                  executeApiCall(() => api.cancelRequest(r.requestId, "Cancelled by user"), "Request cancelled").then(load);
                                }
                              }}
                              className="text-xs px-3.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold rounded-lg cursor-pointer transition-colors border border-rose-200"
                            >
                              Cancel
                            </button>
                          </>
                        )}

                      {/* Confirm pickup */}
                      {(isEmployee || isManager) && r.status === "ReadyForPickup" && (
                        <button
                          type="button"
                          onClick={async () => {
                            const ok = await executeApiCall(
                              () => api.issueRequest(r.requestId, r.requestedByUserId),
                              "Issued — stock collected"
                            );
                            if (ok) { load(); onStockChanged?.(); }
                          }}
                          className="flex items-center gap-1.5 text-xs px-4 py-1.5 bg-[#006039] hover:bg-[#004d2e] text-white font-bold rounded-lg cursor-pointer shadow-sm transition-all hover:shadow-md"
                        >
                          <CheckCircle className="w-3.5 h-3.5" /> Confirm pickup
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

        {/* Empty state */}
        {requests.length === 0 && !loading && (
          <PremiumEmptyState
            icon={ClipboardList}
            title="No requests yet"
            description="Your submitted material requests will appear here."
          />
        )}
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

  const typeIcon = (type: string) => {
    switch (type) {
      case "LowStock": return AlertTriangle;
      case "ExpiryWarning": return Clock;
      case "PickupReady": return CheckCircle;
      case "NewMaterialAdded": return Sparkles;
      case "QuarantineReview": return XCircle;
      default: return Bell;
    }
  };

  const typeAccent = (type: string) => {
    switch (type) {
      case "LowStock": return "border-l-amber-400";
      case "ExpiryWarning": return "border-l-orange-400";
      case "PickupReady": return "border-l-emerald-500";
      case "NewMaterialAdded": return "border-l-blue-400";
      case "QuarantineReview": return "border-l-rose-500";
      default: return "border-l-slate-400";
    }
  };

  return (
    <div className="space-y-6 page-enter">
      <PremiumPageHeader
        icon={Bell}
        title="Alerts"
        subtitle={
          role === "Employee"
            ? "Pickup-ready requests and newly added catalog materials."
            : "Active notifications across your workspace."
        }
        onRefresh={load}
        loading={loading}
        badge={
          alerts.length > 0 ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#e2b007]/20 border border-[#e2b007]/40 text-[#e2b007] text-xs font-bold">
              {alerts.length} active
            </span>
          ) : undefined
        }
      />

      <div className="space-y-3">
        {alerts.map((a) => {
          const Icon = typeIcon(a.type);
          return (
            <div
              key={a.alertId}
              className={`premium-alert-card premium-surface border-l-4 ${typeAccent(a.type)} p-0`}
            >
              <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div className="flex gap-4 min-w-0">
                  <div className={`shrink-0 w-11 h-11 rounded-xl flex items-center justify-center border ${typeStyle(a.type)}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="space-y-1.5 min-w-0">
                    <span className={`inline-block text-[10px] font-bold uppercase tracking-wide px-2.5 py-0.5 rounded-full border ${typeStyle(a.type)}`}>
                      {typeLabel(a.type)}
                    </span>
                    <p className="font-bold text-slate-800 text-sm">{a.materialName}</p>
                    {a.note && <p className="text-slate-600 text-sm leading-relaxed">{a.note}</p>}
                    <p className="text-xs text-slate-400 flex flex-wrap gap-x-2">
                      {a.currentQuantity > 0 && <span>Qty {a.currentQuantity}</span>}
                      {a.requestId != null && <span>Request #{a.requestId}</span>}
                      {a.triggeredAt && <span>{new Date(a.triggeredAt).toLocaleString()}</span>}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    executeApiCall(() => api.resolveAlert(a.alertId, "Acknowledged", userId)).then(load)
                  }
                  className="shrink-0 self-start sm:self-center text-xs text-[#006039] font-bold border-2 border-[#006039]/25 px-4 py-2 rounded-xl hover:bg-[#006039] hover:text-white transition-all duration-200 cursor-pointer shadow-sm hover:shadow-md"
                >
                  Dismiss
                </button>
              </div>
            </div>
          );
        })}
        {alerts.length === 0 && !loading && (
          <PremiumPanel>
            <PremiumEmptyState icon={Bell} title="No active alerts" description="You're all caught up — new alerts will appear here." />
          </PremiumPanel>
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
  const [rejectNotes, setRejectNotes] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);

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
    setRejectNotes("");
    setShowRejectForm(false);
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
    const notes = rejectNotes.trim() || "Rejected by Procurement";
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

  const totalPending = inboxSummaries.reduce((acc, curr) => acc + curr.pendingCount, 0);

  const statusBadge = (status: string) => {
    const s = normalizeRequestStatus(status);
    if (s === "Approved") return "bg-blue-50 text-blue-700 border-blue-200";
    if (s === "Submitted") return "bg-slate-100 text-slate-700 border-slate-200";
    return "bg-slate-100 text-slate-600 border-slate-200";
  };

  return (
    <div className="space-y-6 page-enter">
      <PremiumPageHeader
        icon={Inbox}
        title="Procurement inbox"
        subtitle="Receive and process material orders from different airline departments."
        onRefresh={() => { loadRequests(); loadSummaries(); }}
        loading={loading}
        badge={
          totalPending > 0 ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#e2b007]/20 border border-[#e2b007]/40 text-[#e2b007] text-xs font-bold">
              {totalPending} pending
            </span>
          ) : undefined
        }
      />

      {shops.length > 0 && (
        <div className="premium-surface px-4 py-3 flex flex-wrap items-center gap-3">
          <Building2 className="w-4 h-4 text-[#006039] shrink-0" />
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wide shrink-0">Shop location</label>
          <select
            value={shopId}
            onChange={(e) => setShopId(e.target.value ? Number(e.target.value) : "")}
            className={`${premiumSelect} flex-1 max-w-xs`}
          >
            {shops.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Departments sidebar */}
        <PremiumPanel
          title="Airline departments"
          className="lg:col-span-3"
          noPadding
          badge={
            <span className="text-[10px] font-bold text-slate-400">{inboxSummaries.length} depts</span>
          }
        >
          <div className="divide-y divide-slate-100 max-h-[520px] overflow-y-auto">
            <button
              type="button"
              onClick={() => setSelectedDeptId(null)}
              className={`premium-list-item px-4 py-3.5 flex items-center justify-between gap-2 ${selectedDeptId === null ? "premium-list-item-active" : "premium-list-item-idle"}`}
            >
              <span className="text-sm font-semibold">All requests</span>
              <span className="bg-slate-100 px-2.5 py-0.5 rounded-full text-xs text-slate-600 font-bold">
                {totalPending}
              </span>
            </button>
            {inboxSummaries.map((dept) => (
              <button
                key={dept.departmentId}
                type="button"
                onClick={() => setSelectedDeptId(dept.departmentId)}
                className={`premium-list-item px-4 py-3.5 flex items-center justify-between gap-2 ${selectedDeptId === dept.departmentId ? "premium-list-item-active" : "premium-list-item-idle"}`}
              >
                <div className="min-w-0 pr-2 text-left">
                  <p className="truncate font-medium text-sm text-slate-800">{dept.name}</p>
                  <p className="text-[10px] text-slate-400 truncate">{dept.category}</p>
                </div>
                {dept.pendingCount > 0 ? (
                  <span className="bg-amber-100 px-2 py-0.5 rounded-full text-xs text-amber-800 font-bold shrink-0 ring-2 ring-amber-200/50">
                    {dept.pendingCount}
                  </span>
                ) : (
                  <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
                )}
              </button>
            ))}
          </div>
        </PremiumPanel>

        {/* Request list */}
        <PremiumPanel
          title={activeDept ? `${activeDept.name} requests` : "All department requests"}
          subtitle={`${requests.length} in queue`}
          icon={ClipboardList}
          className="lg:col-span-5"
          noPadding
        >
          <div className="divide-y divide-slate-100 max-h-[520px] overflow-y-auto p-2 space-y-0">
            {requests.map((r) => {
              const active = selectedRequest?.requestId === r.requestId;
              const status = normalizeRequestStatus(r.status);
              return (
                <button
                  key={r.requestId}
                  type="button"
                  onClick={() => selectRequest(r)}
                  className={`w-full text-left rounded-xl p-4 mb-2 transition-all duration-200 border ${
                    active
                      ? "bg-gradient-to-r from-[#006039]/8 to-white border-[#006039]/30 shadow-md ring-1 ring-[#006039]/20"
                      : "bg-white border-slate-200/80 hover:border-[#006039]/20 hover:shadow-sm hover:-translate-y-0.5"
                  }`}
                >
                  <div className="flex justify-between items-start gap-2 mb-2">
                    <span className="text-xs font-bold text-[#006039] font-mono">REQ-{r.requestId}</span>
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${statusBadge(r.status)}`}>
                      {requestStatusLabel(r.status)}
                    </span>
                  </div>
                  <p className="font-bold text-slate-800 text-sm">{r.partNumber}</p>
                  <p className="text-slate-600 text-xs font-medium mt-0.5">{r.materialName}</p>
                  <div className="flex justify-between items-center mt-3 pt-2 border-t border-slate-100 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3" /> {r.requestedByName}
                    </span>
                    <span>Qty <strong className="text-slate-800">{r.quantity}</strong></span>
                    <span className="font-mono text-[10px]">{new Date(r.createdAt).toLocaleDateString()}</span>
                  </div>
                  {status === "Submitted" && (
                    <p className="mt-2 text-[10px] text-amber-700 font-semibold">Awaiting procurement review</p>
                  )}
                </button>
              );
            })}
            {requests.length === 0 && !loading && (
              <PremiumEmptyState
                icon={Inbox}
                title="No pending requests"
                description="No requests in this department queue right now."
              />
            )}
          </div>
        </PremiumPanel>

        {/* Detail panel */}
        <PremiumPanel className="lg:col-span-4 min-h-[520px]" noPadding>
          {!selectedRequest ? (
            <PremiumEmptyState
              icon={Clock}
              title="Select a request"
              description="Choose a request from the list to view employee details, history, and schedule pickup time."
            />
          ) : (
            <div className="p-5 space-y-4 flex flex-col h-full min-h-[480px]">
              <div className="pb-4 border-b border-slate-100">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold text-[#006039] font-mono">REQ-{selectedRequest.requestId}</span>
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${statusBadge(selectedRequest.status)}`}>
                    {requestStatusLabel(selectedRequest.status)}
                  </span>
                </div>
                <h3 className="font-bold text-slate-800 text-base">{selectedRequest.materialName}</h3>
                <p className="text-xs text-slate-400 mt-0.5">{new Date(selectedRequest.createdAt).toLocaleString()}</p>
              </div>

              <div className="text-xs space-y-2 bg-gradient-to-br from-slate-50 to-white p-4 rounded-xl border border-slate-100">
                <p><span className="font-bold text-slate-500">Part No</span> <span className="text-slate-800">{selectedRequest.partNumber}</span></p>
                <p><span className="font-bold text-slate-500">Qty requested</span> <span className="text-slate-800 font-bold">{selectedRequest.quantity}</span></p>
                <p><span className="font-bold text-slate-500">Work order</span> <span className="text-slate-800">{selectedRequest.aircraftOrWorkOrder || "—"}</span></p>
                <p><span className="font-bold text-slate-500">Requested by</span> <span className="text-slate-800">{selectedRequest.requestedByName}</span></p>
                {selectedRequest.notes && (
                  <p className="pt-2 border-t border-slate-200/80"><span className="font-bold text-slate-500">Notes</span> <span className="text-slate-700 italic">{selectedRequest.notes}</span></p>
                )}
              </div>

              <div className="space-y-2">
                <p className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5 text-[#006039]" /> Requester history ({employeeHistory.length})
                </p>
                <div className="premium-surface border-0 shadow-none max-h-[140px] overflow-y-auto divide-y divide-slate-100">
                  {historyLoading ? (
                    <p className="p-4 text-center text-slate-400 text-xs">Loading history…</p>
                  ) : employeeHistory.length === 0 ? (
                    <p className="p-4 text-center text-slate-400 text-xs">No prior requests found.</p>
                  ) : (
                    employeeHistory.map((h) => (
                      <div key={h.requestId} className="p-2.5 flex justify-between gap-2 items-center hover:bg-slate-50/80 transition-colors">
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-800 truncate text-xs">{h.partNumber} — {h.materialName}</p>
                          <p className="text-[10px] text-slate-400">Qty: {h.quantity} · {new Date(h.createdAt).toLocaleDateString()}</p>
                        </div>
                        <span className="text-[9px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 shrink-0 font-medium">{requestStatusLabel(h.status)}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {!showRejectForm ? (
                <div className="space-y-3 pt-2 border-t border-slate-100">
                  <label className="text-xs font-bold text-slate-700 block">Scheduled pickup time (optional)</label>
                  <input
                    type="datetime-local"
                    value={pickupTime}
                    onChange={(e) => setPickupTime(e.target.value)}
                    className={`${premiumInput} text-xs w-full`}
                  />
                  <label className="text-xs font-bold text-slate-700 block">Pickup instructions (optional)</label>
                  <textarea
                    placeholder="Provide instructions on where/how to collect the material..."
                    value={readyNotes}
                    onChange={(e) => setReadyNotes(e.target.value)}
                    className={`${premiumInput} text-xs w-full h-16 resize-none`}
                  />
                </div>
              ) : (
                <div className="space-y-2 pt-2 border-t border-rose-100 bg-rose-50/30 -mx-1 px-1 rounded-xl">
                  <label className="text-xs font-bold text-rose-800 block">Rejection reason</label>
                  <textarea
                    placeholder="Explain why this request is being rejected..."
                    value={rejectNotes}
                    onChange={(e) => setRejectNotes(e.target.value)}
                    className="border border-rose-200 rounded-xl px-3 py-2 text-xs w-full h-20 resize-none focus:outline-none focus:ring-2 focus:ring-rose-300 bg-white"
                  />
                </div>
              )}

              <div className="flex gap-2 pt-2 mt-auto">
                {!showRejectForm ? (
                  <>
                    <button type="button" onClick={handleMarkReady} className={`${premiumBtnPrimary} flex-1 text-xs`}>
                      Confirm & ready
                    </button>
                    <button type="button" onClick={() => setShowRejectForm(true)} className={`${premiumBtnDanger} text-xs`}>
                      Reject
                    </button>
                  </>
                ) : (
                  <>
                    <button type="button" onClick={handleReject} className="flex-1 text-xs px-3 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl cursor-pointer transition-colors shadow-sm">
                      Confirm rejection
                    </button>
                    <button type="button" onClick={() => setShowRejectForm(false)} className="text-xs px-3 py-2.5 border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold rounded-xl cursor-pointer transition-colors">
                      Back
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </PremiumPanel>
      </div>
    </div>
  );
}
