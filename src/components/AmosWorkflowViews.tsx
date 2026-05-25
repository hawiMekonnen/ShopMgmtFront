import React, { useState, useEffect, useCallback } from "react";
import { Search, RefreshCw, Loader2, Package, Bell, Clock } from "lucide-react";
import { api, ApiError } from "../client";
import { Material, MaterialRequest, AuthSession } from "../types";
import { requestStatusLabel } from "../requestStatus";

type ToastFn = (type: "success" | "error" | "warning" | "info", title: string, message?: string) => void;

export function MaterialSearchView({
  session,
  addToast,
  onRequest,
}: {
  session: AuthSession;
  addToast: ToastFn;
  onRequest: (materialId: number) => void;
}) {
  const [partNumber, setPartNumber] = useState("");
  const [aircraft, setAircraft] = useState("");
  const [results, setResults] = useState<Material[]>([]);
  const [loading, setLoading] = useState(false);

  const runSearch = useCallback(async () => {
    setLoading(true);
    try {
      const items = await api.searchMaterials({
        partNumber: partNumber || undefined,
        aircraft: aircraft || undefined,
        shopId: session.shopId,
      });
      setResults(items);
    } catch (e) {
      addToast("error", "Search failed", e instanceof ApiError ? e.detail : undefined);
    } finally {
      setLoading(false);
    }
  }, [partNumber, aircraft, session.shopId, addToast]);

  useEffect(() => {
    runSearch();
  }, []);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-slate-800">Material search</h2>
      <p className="text-sm text-slate-500">Search by part number or aircraft type (radio shop)</p>
      <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-wrap gap-3">
        <input
          placeholder="Part number"
          value={partNumber}
          onChange={(e) => setPartNumber(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm flex-1 min-w-[140px]"
        />
        <input
          placeholder="Aircraft e.g. B737"
          value={aircraft}
          onChange={(e) => setAircraft(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm flex-1 min-w-[120px]"
        />
        <button onClick={runSearch} className="flex items-center gap-2 px-4 py-2 bg-[#006039] text-white rounded-lg text-sm font-semibold">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          Search
        </button>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-2 text-left">Part No</th>
              <th className="px-4 py-2 text-left">Name</th>
              <th className="px-4 py-2 text-center">On hand</th>
              <th className="px-4 py-2 text-center">Available</th>
              <th className="px-4 py-2 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {results.map((m) => {
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
                <td className="px-4 py-3 text-center">{m.onHand}</td>
                <td className="px-4 py-3 text-center font-bold">{m.available}</td>
                <td className="px-4 py-3 text-right">
                  {canOrder ? (
                    <button
                      onClick={() => onRequest(m.id)}
                      className="text-xs font-semibold text-[#006039] hover:underline"
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
        {results.length === 0 && !loading && (
          <p className="p-8 text-center text-slate-400 text-sm">No materials match your search.</p>
        )}
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
  const [wo, setWo] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const list = await executeApiCall(() => api.getMaterialRequests(session.shopId));
    if (list) setRequests(list);
    setLoading(false);
  }, [session.shopId, executeApiCall]);

  const submitRequest = async () => {
    if (!requestMaterialId || !session.shopId) return;
    const workOrder = wo.trim();
    if (!workOrder) {
      addToast("warning", "Work order required", "Enter an aircraft registration or work order number before submitting.");
      return;
    }
    const ok = await executeApiCall(
      () =>
        api.submitMaterialRequest({
          materialId: requestMaterialId,
          shopId: session.shopId!,
          quantity: parseFloat(qty),
          aircraftOrWorkOrder: workOrder,
        }),
      "Request submitted"
    );
    if (ok) {
      setRequestMaterialId(null);
      load();
    }
  };

  const isManager = session.role === "ShopManager" || session.role === "Admin";
  const isTech = session.role === "Technician";

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-800">
          {isManager ? "Approve technician requests" : "My material requests"}
        </h2>
        <button onClick={load} className="p-2 border rounded-lg hover:bg-slate-50">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {session.role === "Technician" && requestMaterialId && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
          <p className="text-sm font-semibold">New request for material #{requestMaterialId}</p>
          <input type="number" value={qty} onChange={(e) => setQty(e.target.value)} className="border rounded px-2 py-1 text-sm w-24" />
          <input
            placeholder="Work order * (e.g. ET-AUE / WO-4401)"
            value={wo}
            onChange={(e) => setWo(e.target.value)}
            required
            className="border rounded px-2 py-1 text-sm ml-2 min-w-[200px]"
          />
          <button onClick={submitRequest} className="ml-2 px-3 py-1 bg-[#006039] text-white text-xs rounded-lg font-semibold">
            Submit
          </button>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 divide-y">
        {requests.map((r) => (
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
              </p>
              <p className="text-xs mt-1.5">
                <span className="font-bold text-slate-800">Requested by:</span>{" "}
                <span className="text-slate-700">{r.requestedByName || "Unknown"}</span>
              </p>
              {r.aircraftOrWorkOrder && (
                <p className="text-xs mt-0.5 text-slate-500">
                  <span className="font-semibold text-slate-600">Work order:</span> {r.aircraftOrWorkOrder}
                </p>
              )}
            </div>
            <div className="flex gap-2 shrink-0">
              {isManager && r.status === "Submitted" && (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      executeApiCall(() => api.releaseRequest(r.requestId), "Approved — awaiting procurement ready").then(load)
                    }
                    className="text-xs px-2 py-1 bg-emerald-100 text-emerald-900 font-semibold rounded-lg hover:bg-emerald-200"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      executeApiCall(() => api.cancelRequest(r.requestId, "Rejected by shop manager"), "Request rejected").then(load)
                    }
                    className="text-xs px-2 py-1 bg-rose-100 text-rose-800 font-semibold rounded-lg hover:bg-rose-200"
                  >
                    Reject
                  </button>
                </>
              )}
              {(isTech || isManager) && r.status === "ReadyForPickup" && (
                <button
                  onClick={() =>
                    executeApiCall(
                      () => api.issueRequest(r.requestId, r.requestedByUserId, r.aircraftOrWorkOrder),
                      "Issued — stock collected"
                    ).then(load)
                  }
                  className="text-xs px-2 py-1 bg-[#006039] text-white rounded-lg"
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
  onCountChange,
  refreshToken,
}: {
  executeApiCall: <T,>(call: () => Promise<T>) => Promise<T | null>;
  role: string;
  userId?: number;
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
      const list =
        role === "Technician"
          ? a.filter((x) => x.type === "PickupReady" || x.type === "NewMaterialAdded")
          : a;
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
      case "LowStock":
        return "bg-amber-50 text-amber-800 border-amber-200";
      case "ExpiryWarning":
        return "bg-orange-50 text-orange-800 border-orange-200";
      case "PickupReady":
        return "bg-emerald-50 text-emerald-800 border-emerald-200";
      case "NewMaterialAdded":
        return "bg-blue-50 text-blue-800 border-blue-200";
      case "QuarantineReview":
        return "bg-red-50 text-red-800 border-red-200";
      default:
        return "bg-slate-50 text-slate-700 border-slate-200";
    }
  };

  const typeLabel = (type: string) => {
    switch (type) {
      case "LowStock":
        return "Low stock";
      case "ExpiryWarning":
        return "Expiry";
      case "PickupReady":
        return "Pickup ready";
      case "NewMaterialAdded":
        return "New material";
      case "QuarantineReview":
        return "Quarantine";
      default:
        return type;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <Bell className="w-6 h-6" /> Alerts
        </h2>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="text-sm font-medium text-[#006039] hover:underline disabled:opacity-50"
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>
      {role === "Technician" && (
        <p className="text-sm text-slate-500">
          Pickup-ready requests and newly added catalog materials. You will also get a toast when new stock is registered.
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
              className="shrink-0 text-xs text-[#006039] font-semibold border border-[#006039]/30 px-3 py-1.5 rounded-lg hover:bg-[#006039]/5"
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

export function ProcurementView({
  executeApiCall,
}: {
  executeApiCall: <T,>(call: () => Promise<T>, successMessage?: string) => Promise<T | null>;
}) {
  const [actions, setActions] = useState<any[]>([]);
  const [shops, setShops] = useState<{ id: number; name: string; location?: string }[]>([]);
  const [shopId, setShopId] = useState<number | "">("");
  const [requests, setRequests] = useState<any[]>([]);
  const [requestNotes, setRequestNotes] = useState<Record<number, string>>({});

  const load = async () => {
    const sid = shopId === "" ? undefined : shopId;
    const a = await executeApiCall(() => api.getProcurementActions(sid));
    if (a) setActions(a);

    const rList = await executeApiCall(() => api.getMaterialRequests(sid));
    if (rList) {
      // Filter requests that are in Approved or Submitted status so Procurement can coordinate them
      const pending = rList.filter(
        (x) => x.status === "Approved" || x.status === "Submitted"
      );
      setRequests(pending);
    }
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

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
        <Package className="w-6 h-6" /> Procurement inbox
      </h2>
      <p className="text-sm text-slate-500">Actions for the selected shop location. Use Stock by shop for full on-hand / on-order view.</p>
      {shops.length > 0 && (
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-slate-600">Shop</label>
          <select
            value={shopId}
            onChange={(e) => setShopId(e.target.value ? Number(e.target.value) : "")}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
          >
            {shops.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="bg-white rounded-xl border divide-y">
        {actions.map((a, i) => (
          <div key={i} className="p-4 text-sm flex justify-between gap-4">
            <div>
              <p className="font-semibold">{a.actionType} — {a.partNumber}</p>
              <p className="text-slate-500 text-xs">{a.summary}</p>
            </div>
            {!a.reorderPlaced && (
              <button
                onClick={() =>
                  executeApiCall(
                    () => api.markReorder(a.materialId, "Reorder placed (demo)"),
                    "Reorder flagged"
                  ).then(load)
                }
                className="text-xs px-2 py-1 border rounded-lg shrink-0"
              >
                Mark reorder
              </button>
            )}
          </div>
        ))}
        {actions.length === 0 && <p className="p-6 text-center text-slate-400">No procurement actions.</p>}
      </div>

      {/* Material Requests Delivery Coordination section */}
      <div className="space-y-4 pt-4">
        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <Clock className="w-5 h-5 text-[#006039]" /> Material Requests Coordination
        </h3>
        <p className="text-xs text-slate-500">
          Coordinate and state delivery/pickup details for active technician requests. Marking ready notifies the shop manager and technician.
        </p>

        <div className="bg-white rounded-xl border divide-y overflow-hidden shadow-xs">
          {requests.map((r) => (
            <div key={r.requestId} className="p-4 text-sm flex flex-col sm:flex-row justify-between gap-4 items-start sm:items-center">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-900">
                    #{r.requestId} — {r.partNumber} — {r.materialName}
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    r.status === "Approved" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                  }`}>
                    {r.status}
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  Requested Qty: <span className="font-bold text-slate-700">{r.quantity}</span> 
                  <span className="mx-2">·</span> 
                  Shop: <span className="font-bold text-slate-700">{r.shopName || `Shop #${r.shopId}`}</span>
                  <span className="mx-2">·</span> 
                  By: <span className="font-bold text-[#006039]">{r.requestedByName || "Technician"}</span>
                </p>
                {r.aircraftOrWorkOrder && (
                  <p className="text-xs text-slate-500 font-mono bg-slate-50 px-2 py-0.5 rounded inline-block">
                    Work Order: {r.aircraftOrWorkOrder}
                  </p>
                )}
                {r.notes && (
                  <p className="text-xs italic text-slate-400">
                    Tech/Manager Notes: "{r.notes}"
                  </p>
                )}
              </div>

              {/* Delivery coordination input and action */}
              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                <input
                  type="text"
                  placeholder="State delivery/pickup time (e.g. 2:00 PM)"
                  value={requestNotes[r.requestId] || ""}
                  onChange={(e) => setRequestNotes({ ...requestNotes, [r.requestId]: e.target.value })}
                  className="border border-slate-200 rounded-lg px-3 py-1.5 text-xs flex-1 sm:w-64 focus:outline-none focus:ring-1 focus:ring-[#006039]"
                />
                <button
                  onClick={() =>
                    executeApiCall(
                      () => api.markRequestReady(r.requestId, requestNotes[r.requestId]),
                      "Material marked ready & delivery scheduled"
                    ).then(load)
                  }
                  disabled={r.status !== "Approved"}
                  className="text-xs px-3 py-1.5 bg-[#006039] text-white font-semibold rounded-lg hover:bg-[#006039]/90 disabled:bg-slate-200 disabled:text-slate-400 select-none shadow-sm transition-colors cursor-pointer"
                  title={r.status !== "Approved" ? "Must be approved/released by Shop Manager first" : "Mark ready and dispatch"}
                >
                  Mark Ready
                </button>
              </div>
            </div>
          ))}
          {requests.length === 0 && (
            <p className="p-6 text-center text-slate-400 text-sm">No material requests currently require coordination.</p>
          )}
        </div>
      </div>
    </div>
  );
}
