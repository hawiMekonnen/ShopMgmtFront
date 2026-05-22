import React, { useState, useEffect, useCallback } from "react";
import { Search, RefreshCw, Loader2, Package, Bell } from "lucide-react";
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
            {results.map((m) => (
              <tr key={m.id} className="border-t border-slate-100">
                <td className="px-4 py-3 font-mono text-[#006039]">{m.partNumber}</td>
                <td className="px-4 py-3">{m.name}</td>
                <td className="px-4 py-3 text-center">{m.onHand}</td>
                <td className="px-4 py-3 text-center font-bold">{m.available}</td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => onRequest(m.id)}
                    disabled={m.available <= 0}
                    className="text-xs font-semibold text-[#006039] hover:underline disabled:text-slate-300"
                  >
                    Request
                  </button>
                </td>
              </tr>
            ))}
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

  useEffect(() => {
    load();
  }, [load]);

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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-800">Material requests</h2>
        <button onClick={load} className="p-2 border rounded-lg hover:bg-slate-50">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {(session.role === "Technician" || session.role === "ShopManager" || session.role === "Admin") && requestMaterialId && (
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
              {isManager && (r.status === "Submitted" || r.status === "Approved") && (
                <button
                  onClick={() =>
                    executeApiCall(() => api.releaseRequest(r.requestId), "Released for issue — technician notified").then(load)
                  }
                  className="text-xs px-2 py-1 bg-amber-100 text-amber-900 font-semibold rounded-lg hover:bg-amber-200"
                >
                  Release for issue
                </button>
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
}: {
  executeApiCall: <T,>(call: () => Promise<T>) => Promise<T | null>;
  role: string;
}) {
  const [alerts, setAlerts] = useState<{ alertId: number; materialName: string; type: string; currentQuantity: number; requestId?: number }[]>([]);

  const load = async () => {
    const a = await executeApiCall(() => api.getAlerts());
    if (a) {
      let list = a as { alertId: number; materialName: string; type: string; currentQuantity: number; requestId?: number }[];
      if (role === "Technician") {
        list = list.filter((x) => x.type === "PickupReady");
      }
      setAlerts(list);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
        <Bell className="w-6 h-6" /> Alerts
      </h2>
      {role === "Technician" && (
        <p className="text-sm text-slate-500">Showing pickup-ready notifications for your requests.</p>
      )}
      <div className="bg-white rounded-xl border divide-y">
        {alerts.map((a) => (
          <div key={a.alertId} className="p-4 flex justify-between text-sm">
            <span>
              <strong>{a.type}</strong> — {a.materialName} (qty {a.currentQuantity})
            </span>
            <button onClick={() => executeApiCall(() => api.resolveAlert(a.alertId, "Resolved")).then(load)} className="text-xs text-[#006039] font-semibold">
              Resolve
            </button>
          </div>
        ))}
        {alerts.length === 0 && <p className="p-6 text-center text-slate-400">No active alerts.</p>}
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

  const load = async () => {
    const sid = shopId === "" ? undefined : shopId;
    const a = await executeApiCall(() => api.getProcurementActions(sid));
    if (a) setActions(a);
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
    </div>
  );
}
