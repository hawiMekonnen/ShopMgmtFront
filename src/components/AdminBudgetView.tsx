import React, { useEffect, useState } from "react";
import { 
  TrendingUp, 
  Printer, 
  RefreshCw, 
  DollarSign, 
  Warehouse, 
  Layers,
  ArrowUpRight,
  TrendingDown
} from "lucide-react";
import { api } from "../client";
import { AuthSession, ProcurementBudgetReport, ViewState } from "../types";

interface AdminBudgetViewProps {
  session: AuthSession;
  onNavigate: (view: ViewState) => void;
  executeApiCall: <T,>(call: () => Promise<T>) => Promise<T | null>;
}

export default function AdminBudgetView({ session, onNavigate, executeApiCall }: AdminBudgetViewProps) {
  const [budgetReport, setBudgetReport] = useState<ProcurementBudgetReport | null>(null);
  const [loading, setLoading] = useState(true);

  const loadBudget = async () => {
    setLoading(true);
    const data = await executeApiCall(() => api.getProcurementBudgetReport());
    if (data) setBudgetReport(data);
    setLoading(false);
  };

  useEffect(() => {
    loadBudget();
  }, []);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Print-only Container */}
      {budgetReport && (
        <div className="hidden print:block bg-white p-8 space-y-6 text-black">
          <div className="border-b-2 border-slate-900 pb-4 text-center">
            <h1 className="text-2xl font-bold uppercase tracking-wide">Airline Store Management System</h1>
            <p className="text-sm text-slate-600 mt-1">Official Spares Procurement Budget Report</p>
            <p className="text-xs text-slate-400 mt-0.5">Date Generated: {new Date().toLocaleString()}</p>
          </div>

          <div className="grid grid-cols-3 gap-4 border border-slate-300 p-4 rounded bg-slate-50 text-xs">
            <div>
              <span className="block font-semibold text-slate-500 uppercase">Total Procurement Spend</span>
              <span className="text-lg font-bold text-slate-900">
                ${budgetReport.totalSpent.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div>
              <span className="block font-semibold text-slate-500 uppercase">Monthly Spend</span>
              <span className="text-lg font-bold text-slate-900">
                ${budgetReport.monthlySpent.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div>
              <span className="block font-semibold text-slate-500 uppercase">Total Items Ordered</span>
              <span className="text-lg font-bold text-slate-900">
                {budgetReport.totalQuantityPurchased.toLocaleString("en-US")} units
              </span>
            </div>
          </div>

          {/* Shop Breakdown - Print */}
          <div className="space-y-2">
            <h3 className="text-sm font-bold border-b border-slate-350 pb-1">Spend Breakdown by Location</h3>
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-400 font-bold bg-slate-100">
                  <th className="py-2 px-3">Shop/Location Name</th>
                  <th className="py-2 px-3 text-right">Items Purchased</th>
                  <th className="py-2 px-3 text-right">Total Spent</th>
                </tr>
              </thead>
              <tbody>
                {budgetReport.byShop.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-4 text-center text-slate-500">No shop-scoped records.</td>
                  </tr>
                ) : (
                  budgetReport.byShop.map((shop, i) => (
                    <tr key={`print-shop-${shop.shopId ?? i}`} className="border-b border-slate-200">
                      <td className="py-2 px-3">{shop.shopName || "Global / Unassigned"}</td>
                      <td className="py-2 px-3 text-right">{shop.totalQuantity.toLocaleString("en-US")}</td>
                      <td className="py-2 px-3 text-right font-semibold">
                        ${shop.totalSpent.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Purchases List - Print */}
          <div className="space-y-2">
            <h3 className="text-sm font-bold border-b border-slate-350 pb-1">Procurement Purchase Order Log</h3>
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-400 font-bold bg-slate-100">
                  <th className="py-2 px-3">Batch ID</th>
                  <th className="py-2 px-3">Material Name / Part No</th>
                  <th className="py-2 px-3">Shop Location</th>
                  <th className="py-2 px-3 text-right">Quantity</th>
                  <th className="py-2 px-3 text-right">Unit Price</th>
                  <th className="py-2 px-3 text-right">Total Cost</th>
                  <th className="py-2 px-3">Date Received</th>
                </tr>
              </thead>
              <tbody>
                {budgetReport.purchases.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-4 text-center text-slate-500">No purchases found.</td>
                  </tr>
                ) : (
                  budgetReport.purchases.map(p => (
                    <tr key={`print-purchase-${p.batchId}`} className="border-b border-slate-200">
                      <td className="py-2 px-3 font-mono">#{p.batchId}</td>
                      <td className="py-2 px-3">
                        <span className="font-semibold block">{p.materialName}</span>
                        <span className="text-[10px] text-slate-500 font-mono">{p.partNumber}</span>
                      </td>
                      <td className="py-2 px-3">{p.shopName || "Global"}</td>
                      <td className="py-2 px-3 text-right">{p.quantityReceived} {p.unit}</td>
                      <td className="py-2 px-3 text-right">${p.unitPrice.toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
                      <td className="py-2 px-3 text-right font-semibold">${p.costTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
                      <td className="py-2 px-3">{new Date(p.receivedAt).toLocaleDateString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-12 text-center text-[10px] text-slate-400 border-t border-slate-200 pt-4">
            <p>CONFIDENTIAL — INTERNAL AIRLINE STORES USE ONLY</p>
          </div>
        </div>
      )}

      {/* Screen Interface */}
      <div className="space-y-6 print:hidden">
        {/* Top Header Panel */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Spares Procurement Budget</h2>
            <p className="text-sm text-slate-500">
              Track flight spares cost metrics, analyze departmental spend allocation, and export budget statements.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={loadBudget}
              disabled={loading}
              className="flex items-center gap-2 px-3 py-1.5 border border-slate-200 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 rounded-lg transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
            {budgetReport && (
              <button
                onClick={handlePrint}
                className="flex items-center gap-2 bg-[#006039] hover:bg-[#004d2e] text-white text-xs font-semibold px-4 py-1.5 rounded-lg shadow-sm transition-colors cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" /> Export PDF
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="py-16 text-center text-sm text-slate-500">Loading budget telemetry...</div>
        ) : !budgetReport ? (
          <div className="py-16 text-center text-slate-500 border border-dashed border-slate-200 rounded-xl">
            Could not fetch budget statistics. Check API connection.
          </div>
        ) : (
          <>
            {/* Stat Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
                <div className="space-y-1.5">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Total Spent (Overall)</span>
                  <span className="text-2xl font-bold text-slate-900 block">
                    ${budgetReport.totalSpent.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <span className="text-[10px] text-emerald-700 bg-emerald-50 font-semibold px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" /> Cumulative Spares Cost
                  </span>
                </div>
                <div className="bg-[#006039]/10 text-[#006039] p-3 rounded-lg">
                  <DollarSign className="w-6 h-6" />
                </div>
              </div>

              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
                <div className="space-y-1.5">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Monthly Spares Spend</span>
                  <span className="text-2xl font-bold text-slate-900 block">
                    ${budgetReport.monthlySpent.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <span className="text-[10px] text-emerald-700 bg-emerald-50 font-semibold px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                    <ArrowUpRight className="w-3 h-3" /> Active Fiscal Month
                  </span>
                </div>
                <div className="bg-blue-55/10 text-blue-800 p-3 rounded-lg">
                  <TrendingUp className="w-6 h-6" />
                </div>
              </div>

              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
                <div className="space-y-1.5">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Total Quantity Purchased</span>
                  <span className="text-2xl font-bold text-slate-900 block">
                    {budgetReport.totalQuantityPurchased.toLocaleString("en-US")}
                  </span>
                  <span className="text-[10px] text-amber-700 bg-amber-50 font-semibold px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                    <Layers className="w-3 h-3" /> Spares Received
                  </span>
                </div>
                <div className="bg-amber-100/60 text-amber-800 p-3 rounded-lg">
                  <Warehouse className="w-6 h-6" />
                </div>
              </div>
            </div>

            {/* Layout Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Location/Shop breakdown list */}
              <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4 lg:col-span-1">
                <div>
                  <h3 className="font-bold text-slate-800 text-lg">Spend by Location</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Budget utilization metrics grouped by shop.</p>
                </div>

                <div className="divide-y divide-slate-100">
                  {budgetReport.byShop.length === 0 ? (
                    <p className="text-xs text-slate-400 py-4 text-center">No shop allocations detected.</p>
                  ) : (
                    budgetReport.byShop.map((shop, idx) => {
                      const percentage = budgetReport.totalSpent > 0 
                        ? (shop.totalSpent / budgetReport.totalSpent) * 100 
                        : 0;
                      return (
                        <div key={`shop-row-${shop.shopId ?? idx}`} className="py-3.5 space-y-1.5">
                          <div className="flex justify-between items-center text-xs">
                            <span className="font-semibold text-slate-700">{shop.shopName || "Global / Unassigned"}</span>
                            <span className="font-bold text-slate-900">
                              ${shop.totalSpent.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                            </span>
                          </div>
                          <div className="flex justify-between items-center text-[10px] text-slate-500">
                            <span>{shop.totalQuantity} items</span>
                            <span>{percentage.toFixed(1)}%</span>
                          </div>
                          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                            <div 
                              className="bg-[#006039] h-full rounded-full" 
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Transactions List */}
              <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4 lg:col-span-2">
                <div>
                  <h3 className="font-bold text-slate-800 text-lg">Recent Spares Purchases</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Audit log of batch entries received by Procurement.</p>
                </div>

                <div className="border border-slate-100 rounded-lg overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100 font-semibold text-slate-600">
                        <th className="py-2.5 px-3">Batch</th>
                        <th className="py-2.5 px-3">Material Details</th>
                        <th className="py-2.5 px-3">Shop</th>
                        <th className="py-2.5 px-3 text-right">Quantity</th>
                        <th className="py-2.5 px-3 text-right">Total Cost</th>
                        <th className="py-2.5 px-3">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {budgetReport.purchases.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-slate-400">No purchases logged.</td>
                        </tr>
                      ) : (
                        budgetReport.purchases.map(p => (
                          <tr key={`purchase-${p.batchId}`} className="hover:bg-slate-50/50">
                            <td className="py-2.5 px-3 font-mono text-slate-500">#{p.batchId}</td>
                            <td className="py-2.5 px-3">
                              <span className="font-semibold text-slate-700 block">{p.materialName}</span>
                              <span className="text-[10px] text-slate-400 font-mono">{p.partNumber}</span>
                            </td>
                            <td className="py-2.5 px-3 text-slate-600">{p.shopName || "Global"}</td>
                            <td className="py-2.5 px-3 text-right text-slate-700">
                              {p.quantityReceived} <span className="text-[10px] text-slate-400">{p.unit}</span>
                            </td>
                            <td className="py-2.5 px-3 text-right font-semibold text-slate-900">
                              ${p.costTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                            </td>
                            <td className="py-2.5 px-3 text-slate-500">{new Date(p.receivedAt).toLocaleDateString()}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}