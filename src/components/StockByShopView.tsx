import React, { useState, useEffect, useCallback } from "react";
import { RefreshCw, Loader2, Warehouse, PackageCheck } from "lucide-react";
import { api } from "../client";
import { Material, Shop, AuthSession } from "../types";
import { normalizeRole } from "../roleConfig";

interface StockByShopViewProps {
  session: AuthSession;
  readOnly: boolean;
  executeApiCall: <T,>(call: () => Promise<T>) => Promise<T | null>;
}

export default function StockByShopView({ session, readOnly, executeApiCall }: StockByShopViewProps) {
  const [shops, setShops] = useState<Shop[]>([]);
  const [selectedShopId, setSelectedShopId] = useState<number | "">("");
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "low" | "on-order">("all");

  const role = normalizeRole(session.role);
  const lockedShopId = role === "ShopManager" ? session.shopId : undefined;

  useEffect(() => {
    (async () => {
      const list = await executeApiCall(() => api.getShops());
      if (list?.length) {
        setShops(list);
        if (lockedShopId) {
          setSelectedShopId(lockedShopId);
        } else if (selectedShopId === "") {
          setSelectedShopId(list[0].id);
        }
      }
    })();
  }, [executeApiCall, lockedShopId]);

  const loadStock = useCallback(async () => {
    if (selectedShopId === "") return;
    setLoading(true);
    const mats = await executeApiCall(() => api.getMaterials(selectedShopId as number));
    if (mats) setMaterials(mats);
    setLoading(false);
  }, [selectedShopId, executeApiCall]);

  useEffect(() => {
    if (selectedShopId !== "") loadStock();
  }, [selectedShopId, loadStock]);

  const shopName = shops.find((s) => s.id === selectedShopId)?.name ?? "Shop";

  const filtered = materials.filter((m) => {
    const low = m.minStock != null && m.minStock > 0 && m.available < m.minStock;
    if (filter === "low") return low;
    if (filter === "on-order") return m.reorderPlaced;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Warehouse className="w-7 h-7 text-[#006039]" />
            {readOnly ? "Stock by shop" : "Materials & stock"}
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            {readOnly
              ? "Read-only inventory and on-order flags per location."
              : "Inventory quantities for your shop location."}
          </p>
        </div>
        <button onClick={loadStock} className="p-2 border rounded-lg hover:bg-slate-50 self-start" title="Refresh">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-wrap gap-3 items-center">
        <label className="text-xs font-semibold text-slate-600">Location</label>
        {lockedShopId ? (
          <span className="text-sm font-bold text-[#006039] px-3 py-1.5 bg-[#006039]/10 rounded-lg">{shopName}</span>
        ) : (
          <select
            value={selectedShopId}
            onChange={(e) => setSelectedShopId(e.target.value ? Number(e.target.value) : "")}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm min-w-[200px]"
          >
            {shops.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.location ? ` — ${s.location}` : ""}
              </option>
            ))}
          </select>
        )}
        <div className="flex gap-1 ml-auto">
          {(["all", "low", "on-order"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`text-xs px-2.5 py-1 rounded-lg font-medium ${
                filter === f ? "bg-[#006039] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {f === "all" ? "All" : f === "low" ? "Low stock" : "On order"}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-2 text-left">Part no</th>
              <th className="px-4 py-2 text-left">Name</th>
              <th className="px-4 py-2 text-center">On hand</th>
              <th className="px-4 py-2 text-center">Available</th>
              <th className="px-4 py-2 text-center">Min</th>
              <th className="px-4 py-2 text-center">On order</th>
              <th className="px-4 py-2 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((m) => {
              const low = m.minStock != null && m.minStock > 0 && m.available < m.minStock;
              const out = m.available <= 0;
              return (
                <tr key={m.id} className="border-t border-slate-100 hover:bg-slate-50/50">
                  <td className="px-4 py-3 font-mono text-[#006039]">{m.partNumber}</td>
                  <td className="px-4 py-3">{m.name}</td>
                  <td className="px-4 py-3 text-center font-mono">{m.onHand}</td>
                  <td className="px-4 py-3 text-center font-bold">{m.available}</td>
                  <td className="px-4 py-3 text-center text-slate-500">{m.minStock ?? "—"}</td>
                  <td className="px-4 py-3 text-center">
                    {m.reorderPlaced ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold text-xs">
                        <PackageCheck className="w-3.5 h-3.5" /> Yes
                      </span>
                    ) : (
                      <span className="text-slate-400 text-xs">No</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {out ? (
                      <span className="text-xs font-bold text-rose-600">Out of stock</span>
                    ) : low ? (
                      <span className="text-xs font-bold text-amber-700">Below minimum</span>
                    ) : (
                      <span className="text-xs text-slate-500">OK</span>
                    )}
                    {m.reorderPlaced && m.reorderNote && (
                      <p className="text-[10px] text-slate-400 mt-0.5 truncate max-w-[180px]" title={m.reorderNote}>
                        {m.reorderNote}
                      </p>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {loading && (
          <p className="p-8 text-center text-slate-400 flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading stock…
          </p>
        )}
        {!loading && filtered.length === 0 && (
          <p className="p-8 text-center text-slate-400 text-sm">No materials match this filter at {shopName}.</p>
        )}
      </div>
    </div>
  );
}
