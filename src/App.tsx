import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  LayoutDashboard,
  Boxes,
  Layers,
  Plus,
  Search,
  RefreshCw,
  Trash2,
  Edit2,
  Eye,
  ArrowLeft,
  Calendar,
  AlertTriangle,
  Info,
  ChevronRight,
  HelpCircle,
  TrendingUp,
  TrendingDown,
  Warehouse,
  History,
  CheckCircle,
  XCircle,
  Loader2,
  X,
  PlusCircle,
  Filter
} from "lucide-react";
import { api, ApiError } from "./client";
import { Category, Material, MaterialDetail, StockBatch, DashboardStats, ViewState } from "./types";
import ToastContainer, { ToastMessage } from "./components/Toast";

export default function App() {
  // Navigation Routing State
  const [currentView, setCurrentView] = useState<ViewState>({ type: "dashboard" });

  // Core Data Lists
  const [categories, setCategories] = useState<Category[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);

  // Loaders and State Trackers
  const [loading, setLoading] = useState<boolean>(false);
  const [connectionStatus, setConnectionStatus] = useState<"connected" | "unreachable" | "connecting">("connecting");
  const [lastUpdated, setLastUpdated] = useState<string>("");
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);

  // Filter criteria for Materials List
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>("all");

  // Interactive UI feedback
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
    destructive?: boolean;
  } | null>(null);

  // Categories Operations view specific states
  const [catFormName, setCatFormName] = useState<string>("");
  const [catFormDesc, setCatFormDesc] = useState<string>("");
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [catFieldErrors, setCatFieldErrors] = useState<Record<string, string[]>>({});

  // Helper timer reference for 12,000ms live auto-refresh
  const autoRefreshTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Custom Toast helper
  const addToast = useCallback((type: "success" | "error" | "warning" | "info", title: string, message?: string) => {
    const id = Date.now().toString() + Math.random().toString().slice(2, 6);
    setToasts((prev) => [...prev, { id, type, title, message }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // API Call helper wrapper to handle connectivity indicators & global error mapping
  const executeApiCall = useCallback(async <T,>(
    call: () => Promise<T>,
    successMessage?: string,
    errorHandler?: (err: ApiError) => void
  ): Promise<T | null> => {
    try {
      setConnectionStatus("connecting");
      const result = await call();
      setConnectionStatus("connected");
      if (successMessage) {
        addToast("success", successMessage);
      }
      return result;
    } catch (error) {
      setConnectionStatus("unreachable");
      if (error instanceof ApiError) {
        if (errorHandler) {
          errorHandler(error);
        } else {
          // Standard Toast feedback
          addToast("error", error.title, error.detail || "Something went wrong. Please check your inputs or network connection.");
        }
      } else {
        addToast("error", "Network Failure", "Unable to establish secure handshake with the inventory service.");
      }
      return null;
    }
  }, [addToast]);

  // Global load initial statistics and dictionaries
  const loadGlobalDashboardStats = useCallback(async () => {
    const stats = await executeApiCall(() => api.getDashboardStats());
    if (stats) setDashboardStats(stats);
  }, [executeApiCall]);

  const loadAllCategories = useCallback(async () => {
    const cats = await executeApiCall(() => api.getCategories());
    if (cats) setCategories(cats);
  }, [executeApiCall]);

  const loadAllMaterials = useCallback(async () => {
    const mats = await executeApiCall(() => api.getMaterials());
    if (mats) {
      setMaterials(mats);
      setLastUpdated(new Date().toLocaleTimeString());
    }
  }, [executeApiCall]);

  // Combine load ops
  const refreshAllContext = useCallback(async () => {
    setLoading(true);
    await Promise.all([
      loadGlobalDashboardStats(),
      loadAllCategories(),
      loadAllMaterials()
    ]);
    setLoading(false);
  }, [loadGlobalDashboardStats, loadAllCategories, loadAllMaterials]);

  // Setup periodic live update cycle (required to keep 12s live updates like old Blazor)
  useEffect(() => {
    refreshAllContext();
  }, [refreshAllContext]);

  useEffect(() => {
    if (autoRefresh && (currentView.type === "materials" || currentView.type === "dashboard")) {
      autoRefreshTimerRef.current = setInterval(() => {
        loadAllMaterials();
        loadGlobalDashboardStats();
      }, 12000);
    } else {
      if (autoRefreshTimerRef.current) {
        clearInterval(autoRefreshTimerRef.current);
      }
    }

    return () => {
      if (autoRefreshTimerRef.current) {
        clearInterval(autoRefreshTimerRef.current);
      }
    };
  }, [autoRefresh, currentView.type, loadAllMaterials, loadGlobalDashboardStats]);

  // Navigate utility with automated clear state
  const navigate = (view: ViewState) => {
    setCurrentView(view);
    setSearchQuery("");
    setSelectedCategoryFilter("all");
    setCatFieldErrors({});
    // Reload state context is extremely useful during navigation updates
    if (view.type === "dashboard" || view.type === "materials" || view.type === "categories") {
      refreshAllContext();
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 transition-colors duration-150">
      
      {/* 3. App Shell Header */}
      <header className="sticky top-0 z-40 bg-[#006039] text-white shadow-md border-b-2 border-[#e2b007]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate({ type: "dashboard" })}>
            <div className="bg-[#e2b007] text-[#006039] p-1.5 rounded-lg flex items-center justify-center font-bold">
              <Boxes className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight flex items-center gap-2">
                Ethiopian Airlines <span className="text-[#e2b007] font-semibold text-xs py-0.5 px-2 bg-black/25 rounded-full">Stock HQ</span>
              </h1>
              <p className="text-[10px] text-emerald-100 hidden sm:block">Aviation Maintenance & Materials Control Tower</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Live Indicator Switch and Refresh state */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-emerald-100 hidden md:inline">Auto-Polling (12s)</span>
              <button
                type="button"
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={`w-10 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors duration-200 focus:outline-none ${
                  autoRefresh ? "bg-[#e2b007]" : "bg-emerald-800"
                }`}
                title="Toggle real-time stock value engine"
              >
                <div
                  className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${
                    autoRefresh ? "translate-x-4" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {/* Connection Status Label */}
            <div className="flex items-center gap-1.5 bg-black/20 px-3 py-1 rounded-full text-xs">
              <span className={`w-2.5 h-2.5 rounded-full animate-pulse ${
                connectionStatus === "connected"
                  ? "bg-emerald-400"
                  : connectionStatus === "connecting"
                  ? "bg-amber-400"
                  : "bg-red-400"
              }`} />
              <span className="font-mono text-[11px] uppercase tracking-wider text-slate-100 hidden sm:inline">
                {connectionStatus === "connected" && "API Online"}
                {connectionStatus === "connecting" && "Syncing..."}
                {connectionStatus === "unreachable" && "Offline"}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container Wrapper */}
      <div className="flex-1 max-w-7xl w-full mx-auto flex flex-col md:flex-row gap-0 sm:gap-4 md:p-6 p-3">
        
        {/* Sidebar Component */}
        <aside className="w-full md:w-64 md:shrink-0 flex flex-col gap-2 mb-4 md:mb-0">
          <nav className="bg-white rounded-xl shadow-xs border border-slate-200 p-2 flex flex-row md:flex-col gap-1 overflow-x-auto md:overflow-visible">
            <button
              id="sidebar-nav-dashboard"
              onClick={() => navigate({ type: "dashboard" })}
              className={`flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors whitespace-nowrap w-full focus:outline-none ${
                currentView.type === "dashboard"
                  ? "bg-[#006039]/10 text-[#006039] border-r-4 border-[#006039]"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <LayoutDashboard className="w-4 h-4 shrink-0" />
              <span>Dashboard Overview</span>
            </button>
            <button
              id="sidebar-nav-materials"
              onClick={() => navigate({ type: "materials" })}
              className={`flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors whitespace-nowrap w-full focus:outline-none ${
                currentView.type === "materials" || currentView.type.startsWith("material-")
                  ? "bg-[#006039]/10 text-[#006039] border-r-4 border-[#006039]"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <Boxes className="w-4 h-4 shrink-0" />
              <span>Materials Inventory</span>
            </button>
            <button
              id="sidebar-nav-categories"
              onClick={() => navigate({ type: "categories" })}
              className={`flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors whitespace-nowrap w-full focus:outline-none ${
                currentView.type === "categories"
                  ? "bg-[#006039]/10 text-[#006039] border-r-4 border-[#006039]"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <Layers className="w-4 h-4 shrink-0" />
              <span>Stock Categories</span>
            </button>
          </nav>

          {/* Ethiopian Airlines Brand Statement and dynamic time stamp info */}
          <div className="bg-slate-100 rounded-xl p-4 border border-slate-200 mt-auto hidden md:block">
            <div className="flex gap-2 items-start text-xs text-slate-500">
              <Info className="w-4 h-4 shrink-0 mt-0.5 text-emerald-700" />
              <div>
                <p className="font-semibold text-slate-700">Aviation Standard</p>
                <p className="mt-1 leading-relaxed">Ensure safe storage codes & flight-ready certifications on aerospace batches.</p>
              </div>
            </div>
            {lastUpdated && (
              <p className="text-[10px] text-slate-400 mt-3 font-mono">Last refreshed: {lastUpdated}</p>
            )}
          </div>
        </aside>

        {/* 4. Main Page Body Outlet */}
        <main className="flex-1 min-w-0">
          
          {/* View Dispatcher */}
          {currentView.type === "dashboard" && (
            <DashboardView
              stats={dashboardStats}
              loading={loading}
              onNavigate={navigate}
              onRefresh={refreshAllContext}
            />
          )}

          {currentView.type === "materials" && (
            <MaterialsListView
              materials={materials}
              categories={categories}
              loading={loading}
              lastUpdated={lastUpdated}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              selectedCategoryFilter={selectedCategoryFilter}
              setSelectedCategoryFilter={setSelectedCategoryFilter}
              onNavigate={navigate}
              onRefresh={loadAllMaterials}
              addToast={addToast}
            />
          )}

          {currentView.type === "material-new" && (
            <MaterialFormView
              categories={categories}
              onNavigate={navigate}
              addToast={addToast}
              executeApiCall={executeApiCall}
            />
          )}

          {currentView.type === "material-edit" && (
            <MaterialFormView
              materialId={currentView.id}
              categories={categories}
              onNavigate={navigate}
              addToast={addToast}
              executeApiCall={executeApiCall}
            />
          )}

          {currentView.type === "material-detail" && (
            <MaterialDetailView
              materialId={currentView.id}
              onNavigate={navigate}
              addToast={addToast}
              executeApiCall={executeApiCall}
              setConfirmDialog={setConfirmDialog}
            />
          )}

          {currentView.type === "material-receive" && (
            <ReceiveStockView
              materialId={currentView.id}
              onNavigate={navigate}
              addToast={addToast}
              executeApiCall={executeApiCall}
              setConfirmDialog={setConfirmDialog}
            />
          )}

          {currentView.type === "categories" && (
            <CategoriesView
              categories={categories}
              loading={loading}
              onRefresh={loadAllCategories}
              addToast={addToast}
              executeApiCall={executeApiCall}
              setConfirmDialog={setConfirmDialog}
            />
          )}

        </main>
      </div>

      {/* Footer System Details */}
      <footer className="bg-slate-900 text-slate-400 py-4 mt-auto border-t border-slate-800 text-xs font-mono">
        <div className="max-w-7xl mx-auto px-4 text-center sm:flex sm:justify-between sm:items-center">
          <p>ET-SM © 2026 Flight Operations Stock Ledger</p>
          <div className="flex items-center justify-center gap-4 mt-2 sm:mt-0">
            <span>Terminal: ADDIS_BOLO_HQ</span>
            <span>Refreshes: 12,000ms</span>
          </div>
        </div>
      </footer>

      {/* Global Toast Provider */}
      <ToastContainer toasts={toasts} onClose={removeToast} />

      {/* Global Confirmation Prompt */}
      {confirmDialog && confirmDialog.isOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-lg border border-slate-100 max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-rose-600" />
              {confirmDialog.title}
            </h3>
            <p className="text-sm text-slate-500 mt-2 leading-relaxed">
              {confirmDialog.description}
            </p>
            <div className="flex justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={() => setConfirmDialog(null)}
                className="px-4 py-2 border border-slate-200 text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 rounded-lg"
              >
                No, Keep It
              </button>
              <button
                type="button"
                onClick={() => {
                  confirmDialog.onConfirm();
                  setConfirmDialog(null);
                }}
                className={`px-4 py-2 text-sm font-medium text-white rounded-lg select-none ${
                  confirmDialog.destructive ? "bg-red-700 hover:bg-red-800" : "bg-teal-700 hover:bg-teal-800"
                }`}
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// 4.7 DASHBOARD VIEW
// ==========================================
interface DashboardViewProps {
  stats: DashboardStats | null;
  loading: boolean;
  onNavigate: (view: ViewState) => void;
  onRefresh: () => void;
}

function DashboardView({ stats, loading, onNavigate, onRefresh }: DashboardViewProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Operational Dashboard</h2>
          <p className="text-sm text-slate-500">Overview of fleet material volumes, values and constraints</p>
        </div>
        <button
          onClick={onRefresh}
          className="flex items-center gap-2 px-3 py-1.5 border border-slate-200 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 rounded-lg transition-all"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          Force Refresh
        </button>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Metric 1 */}
        <div className="bg-white rounded-xl p-5 shadow-xs border border-slate-200 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-teal-500/5 rounded-full translate-x-12 -translate-y-12" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 tracking-wider uppercase">Active Catalog</span>
            <Boxes className="w-5 h-5 text-[#006039]" />
          </div>
          <div className="mt-4">
            {stats ? (
              <h3 className="text-3xl font-bold text-slate-900">{stats.totalMaterials}</h3>
            ) : (
              <div className="h-9 w-16 bg-slate-200 animate-pulse rounded" />
            )}
            <p className="text-xs text-slate-400 mt-1">Stored line items & spares</p>
          </div>
        </div>

        {/* Metric 2 - Hero Metric: Stock Value */}
        <div className="bg-white rounded-xl p-5 shadow-xs border border-slate-200 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full translate-x-12 -translate-y-12" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 tracking-wider uppercase">Aggregate Stock Value</span>
            <span className="text-xs font-bold text-[#e2b007] bg-[#e2b007]/10 px-2 py-0.5 rounded">ETB</span>
          </div>
          <div className="mt-4">
            {stats ? (
              <h3 className="text-3xl font-extrabold text-[#006039]">
                {stats.totalStockValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h3>
            ) : (
              <div className="h-9 w-32 bg-slate-200 animate-pulse rounded" />
            )}
            <div className="flex items-center gap-1 text-[11px] text-[#006039] font-medium mt-1">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Real-time on-hand assets value</span>
            </div>
          </div>
        </div>

        {/* Metric 3 */}
        <div className="bg-white rounded-xl p-5 shadow-xs border border-slate-200 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full translate-x-12 -translate-y-12" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 tracking-wider uppercase">Categories Count</span>
            <Layers className="w-5 h-5 text-[#006039]" />
          </div>
          <div className="mt-4">
            {stats ? (
              <h3 className="text-3xl font-bold text-slate-900">{stats.totalCategories}</h3>
            ) : (
              <div className="h-9 w-16 bg-slate-200 animate-pulse rounded" />
            )}
            <p className="text-xs text-slate-400 mt-1">Aviation divisions & zones</p>
          </div>
        </div>

        {/* Metric 4 */}
        <div className="bg-white rounded-xl p-5 shadow-xs border border-slate-200 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/5 rounded-full translate-x-12 -translate-y-12" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 tracking-wider uppercase">Critical Warnings</span>
            <AlertTriangle className={`w-5 h-5 ${stats && stats.lowStockCount > 0 ? "text-rose-500 animate-bounce" : "text-slate-300"}`} />
          </div>
          <div className="mt-4">
            {stats ? (
              <h3 className={`text-3xl font-bold ${stats.lowStockCount > 0 ? "text-rose-600" : "text-slate-900"}`}>
                {stats.lowStockCount}
              </h3>
            ) : (
              <div className="h-9 w-16 bg-slate-200 animate-pulse rounded" />
            )}
            <p className="text-xs text-slate-400 mt-1">Lines with quantity under 10</p>
          </div>
        </div>

      </div>

      {/* Quick Launch & Guidelines Bento Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Quick Launchpad list */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-xs border border-slate-200 p-6 space-y-4">
          <h3 className="text-base font-bold text-slate-900">Control Actions</h3>
          <p className="text-xs text-slate-500">Fast access to active catalog logging and receive sequences</p>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              id="dash-cta-new-material"
              onClick={() => onNavigate({ type: "material-new" })}
              className="flex items-start gap-3 p-4 border border-slate-200 hover:border-[#006039] rounded-xl hover:bg-[#006039]/5 transition-all text-left focus:outline-none focus:ring-1 focus:ring-[#006039]"
            >
              <div className="bg-[#006039]/10 text-[#006039] p-2.5 rounded-lg">
                <Plus className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-semibold text-sm text-slate-900">Add New Material</h4>
                <p className="text-xs text-slate-400 mt-0.5">Register critical aviation spare parts, lubricants or safety components.</p>
              </div>
            </button>

            <button
              id="dash-cta-categories"
              onClick={() => onNavigate({ type: "categories" })}
              className="flex items-start gap-3 p-4 border border-slate-200 hover:border-amber-600 hover:bg-amber-50/20 rounded-xl transition-all text-left focus:outline-none focus:ring-1 focus:ring-amber-500"
            >
              <div className="bg-amber-100 text-[#e2b007] p-2.5 rounded-lg">
                <Layers className="w-5 h-5 text-amber-700" />
              </div>
              <div>
                <h4 className="font-semibold text-sm text-slate-900">Configure Divisions</h4>
                <p className="text-xs text-slate-400 mt-0.5">Define material groups, safety rules, and warehouse layouts.</p>
              </div>
            </button>
          </div>

          <div className="border-t border-slate-100 pt-4 mt-2">
            <h4 className="text-sm font-semibold text-slate-800 mb-2">Fleet Operational Flow Guides:</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-slate-500">
              <div className="p-2 bg-slate-50 rounded-lg flex items-center gap-1.5">
                <span className="font-bold text-[#006039]">No. 1</span> Establish Category
              </div>
              <div className="p-2 bg-slate-50 rounded-lg flex items-center gap-1.5">
                <span className="font-bold text-[#e2b007]">No. 2</span> Define Material Line
              </div>
              <div className="p-2 bg-slate-50 rounded-lg flex items-center gap-1.5">
                <span className="font-bold text-slate-700">No. 3</span> Receive Batch Stock
              </div>
            </div>
          </div>
        </div>

        {/* Ethiopian Airlines Info Banner */}
        <div className="bg-[#006039] text-white rounded-xl p-6 flex flex-col justify-between relative overflow-hidden border-2 border-[#e2b007]">
          <div className="absolute -bottom-10 -right-10 w-44 h-44 bg-emerald-800/20 rounded-full" />
          <div className="space-y-4">
            <span className="text-[10px] font-bold tracking-wider text-[#e2b007] bg-black/30 px-2.5 py-1 rounded-full uppercase">
              Bole Terminal Guard
            </span>
            <h4 className="text-lg font-bold">Standard Safety Notice</h4>
            <p className="text-xs text-emerald-100 leading-relaxed">
              All aviation materials must match matching physical batches with accurate shelf life tracking. Do not delete batches without checking flight logs.
            </p>
          </div>
          <div className="mt-8 pt-4 border-t border-emerald-800 flex items-center justify-between">
            <span className="text-xs font-mono text-[#e2b007]">Ref: HQ-ET-QA-STD</span>
            <button
              onClick={() => onNavigate({ type: "materials" })}
              className="text-[#e2b007] hover:text-[#e2b007]/80 text-xs font-semibold flex items-center gap-1 focus:outline-none"
            >
              Verify Spares <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

// ==========================================
// 4.1 MATERIALS LIST VIEW
// ==========================================
interface MaterialsListViewProps {
  materials: Material[];
  categories: Category[];
  loading: boolean;
  lastUpdated: string;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedCategoryFilter: string;
  setSelectedCategoryFilter: (catId: string) => void;
  onNavigate: (view: ViewState) => void;
  onRefresh: () => void;
  addToast: (type: "success" | "error" | "warning" | "info", title: string, message?: string) => void;
}

function MaterialsListView({
  materials,
  categories,
  loading,
  lastUpdated,
  searchQuery,
  setSearchQuery,
  selectedCategoryFilter,
  setSelectedCategoryFilter,
  onNavigate,
  onRefresh,
  addToast
}: MaterialsListViewProps) {
  // Compute totals based on current filtered/unfiltered elements
  const totalRawValue = materials.reduce((sum, item) => sum + item.stockValue, 0);

  // Filter items
  const filteredMaterials = materials.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.categoryName && item.categoryName.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesCategory =
      selectedCategoryFilter === "all" || item.categoryId === parseInt(selectedCategoryFilter);

    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Materials Inventory</h2>
          <div className="flex items-center gap-1 mt-1 text-sm text-slate-500">
            <span>Operational list of parts & maintenance materials.</span>
            {lastUpdated && (
              <span className="text-xs text-slate-400 font-mono italic">(Updated: {lastUpdated})</span>
            )}
          </div>
        </div>
        
        <button
          id="btn-add-material-list"
          onClick={() => onNavigate({ type: "material-new" })}
          className="bg-[#006039] hover:bg-[#006039]/90 text-white font-semibold text-sm px-4 py-2 rounded-lg flex items-center justify-center gap-2 select-none shadow-sm transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Add Material
        </button>
      </div>

      {/* Hero Stock Value Component Card */}
      <div className="bg-gradient-to-r from-teal-900 to-[#006039] text-white p-6 rounded-xl border-l-8 border-[#e2b007] shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] font-bold text-[#e2b007] uppercase tracking-wider bg-black/25 px-2 py-0.5 rounded">
            Total Aggregate Worth
          </span>
          <h3 className="text-3xl font-extrabold text-white mt-2">
            {totalRawValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-xs font-normal text-teal-200">ETB</span>
          </h3>
          <p className="text-xs text-teal-100 mt-1">Sum of calculated stock values across active registered elements</p>
        </div>

        {/* Small operational tooltip details requested by plan */}
        <div className="bg-black/20 p-3 rounded-lg max-w-sm flex items-start gap-2.5">
          <HelpCircle className="w-5 h-5 text-[#e2b007] shrink-0 mt-0.5" />
          <p className="text-xs text-slate-200 leading-normal">
            <span className="font-semibold text-white">Stock Rule:</span> Individual item stock value is continuously calculated using the exact formula: <span className="font-mono text-[#e2b007]">On Hand Count × Catalog Price</span>.
          </p>
        </div>
      </div>

      {/* Toolbar controls */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-4 flex flex-col sm:flex-row gap-3 items-center justify-between">
        
        {/* Search controls */}
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            id="material-search"
            type="text"
            placeholder="Search material/category..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#006039] focus:border-[#006039]"
          />
        </div>

        {/* Filter Controls */}
        <div className="flex items-center gap-3 w-full sm:w-auto shrink-0 justify-end">
          <Filter className="w-4 h-4 text-slate-400 hidden sm:block" />
          
          <select
            id="category-filter"
            value={selectedCategoryFilter}
            onChange={(e) => setSelectedCategoryFilter(e.target.value)}
            className="w-full sm:w-48 py-1.5 px-3 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#006039]"
          >
            <option value="all">All Category Groups</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          <button
            onClick={onRefresh}
            className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 focus:outline-none shrink-0"
            title="Reload items from storage catalog"
          >
            <RefreshCw className={`w-4 h-4 text-slate-600 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Materials Table */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
        {loading && materials.length === 0 ? (
          /* Loading Placeholder Skeleton rows */
          <div className="p-8 space-y-4">
            <div className="h-5 bg-slate-200 animate-pulse rounded w-1/4" />
            <div className="h-10 bg-slate-100 animate-pulse rounded" />
            <div className="h-10 bg-slate-100 animate-pulse rounded animate-delay-150" />
            <div className="h-10 bg-slate-100 animate-pulse rounded animate-delay-300" />
          </div>
        ) : filteredMaterials.length === 0 ? (
          /* Empty Catalog screen condition with link to Categories first or new material */
          <div className="p-12 text-center max-w-md mx-auto space-y-4">
            <div className="bg-slate-50 inline-flex p-4 rounded-full text-slate-400">
              <Boxes className="w-8 h-8" />
            </div>
            <div>
              <h4 className="text-base font-bold text-slate-900">No Materials Yet</h4>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Start dynamic tracking by creating a stock categorization first, then save material details.
              </p>
            </div>
            <div className="flex justify-center gap-3 pt-2">
              <button
                id="empty-cta-categories"
                onClick={() => onNavigate({ type: "categories" })}
                className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold hover:bg-slate-50"
              >
                Setup Categories
              </button>
              <button
                id="empty-cta-new-material"
                onClick={() => onNavigate({ type: "material-new" })}
                className="px-3 py-1.5 bg-[#006039] hover:bg-[#006039]/90 text-white rounded-lg text-xs font-semibold"
              >
                Log New Material
              </button>
            </div>
          </div>
        ) : (
          /* Master Table */
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-slate-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Material Name
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Category group
                  </th>
                  <th scope="col" className="px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Unit
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Unit Price
                  </th>
                  <th scope="col" className="px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    On Hand
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Stock Value
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredMaterials.map((item) => {
                  const outOfStock = item.onHand <= 0;
                  const lowStock = item.onHand > 0 && item.onHand < 10;

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/50 transition-colors select-none">
                      {/* Name link directly to details */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => onNavigate({ type: "material-detail", id: item.id })}
                          className="font-semibold text-[#006039] hover:underline text-sm focus:outline-none text-left font-sans"
                        >
                          {item.name}
                        </button>
                      </td>

                      {/* Category Badge */}
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                          {item.categoryName || "Uncategorized"}
                        </span>
                      </td>

                      {/* Unit measure */}
                      <td className="px-6 py-4 whitespace-nowrap text-center text-xs text-slate-500 font-medium">
                        {item.unit}
                      </td>

                      {/* Unit Price right aligned with currency label */}
                      <td className="px-6 py-4 whitespace-nowrap text-right font-mono text-sm font-medium text-slate-900">
                        {item.unitPrice.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-[10px] text-slate-400 font-sans">ETB</span>
                      </td>

                      {/* On Hand status metrics with specific alerts as requested */}
                      <td className="px-6 py-4 whitespace-nowrap text-center text-sm">
                        <div className="flex flex-col items-center justify-center">
                          <span className={`font-bold font-mono text-sm px-2 py-0.5 rounded ${
                            outOfStock 
                              ? "bg-rose-100 text-[#d62d20]" 
                              : lowStock 
                              ? "bg-amber-100 text-amber-800" 
                              : "text-slate-900"
                          }`}>
                            {item.onHand}
                          </span>
                          {outOfStock && (
                            <span className="text-[9px] text-[#d62d20] font-sans font-bold uppercase mt-0.5">Out of Stock</span>
                          )}
                          {lowStock && (
                            <span className="text-[9px] text-amber-700 font-sans font-semibold uppercase mt-0.5">Low Stock</span>
                          )}
                        </div>
                      </td>

                      {/* Stock Value bold accent */}
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <span className="font-extrabold text-[#006039] font-mono text-sm">
                          {item.stockValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </td>

                      {/* Row operational actions */}
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => onNavigate({ type: "material-detail", id: item.id })}
                            className="p-1 text-slate-400 hover:text-[#006039] rounded hover:bg-slate-100"
                            title="Verify Spares Logs"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onNavigate({ type: "material-edit", id: item.id })}
                            className="p-1 text-slate-400 hover:text-amber-600 rounded hover:bg-slate-100"
                            title="Edit Spares Spec"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onNavigate({ type: "material-receive", id: item.id })}
                            className="p-1 text-slate-400 hover:text-emerald-700 rounded hover:bg-slate-100"
                            title="Receive Stock Batch"
                          >
                            <PlusCircle className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ==========================================
// 4.2 & 4.3 CREATE / EDIT MATERIAL VIEW
// ==========================================
interface MaterialFormViewProps {
  materialId?: number;
  categories: Category[];
  onNavigate: (view: ViewState) => void;
  addToast: (type: "success" | "error" | "warning" | "info", title: string, message?: string) => void;
  executeApiCall: <T,>(call: () => Promise<T>, successMessage?: string, errorHandler?: (err: ApiError) => void) => Promise<T | null>;
}

function MaterialFormView({ materialId, categories, onNavigate, addToast, executeApiCall }: MaterialFormViewProps) {
  const isEditMode = !!materialId;

  // Form local hooks
  const [name, setName] = useState<string>("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [unit, setUnit] = useState<string>("");
  const [unitPrice, setUnitPrice] = useState<string>("");

  const [saving, setSaving] = useState<boolean>(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  // Prefill hook if in edit mode
  useEffect(() => {
    if (isEditMode && materialId) {
      const fetchPreValue = async () => {
        const mat = await api.getMaterial(materialId);
        if (mat) {
          setName(mat.name);
          setCategoryId(mat.categoryId.toString());
          setUnit(mat.unit);
          setUnitPrice(mat.unitPrice.toString());
        }
      };
      fetchPreValue();
    }
  }, [isEditMode, materialId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFieldErrors({});

    const normalizedPrice = parseFloat(unitPrice);
    const payload = {
      name: name.trim(),
      categoryId: parseInt(categoryId),
      unit: unit.trim(),
      unitPrice: isNaN(normalizedPrice) ? 0 : normalizedPrice,
    };

    // Client side guard
    if (categories.length === 0) {
      addToast("error", "Action Prohibited", "Define a category group first before materials.");
      setSaving(false);
      return;
    }

    const errorHandler = (err: ApiError) => {
      setSaving(false);
      if (err.status === 400 && err.errors) {
        // Map pascal validator fields to lowercase keys safely
        const normalizedErrors: Record<string, string[]> = {};
        Object.entries(err.errors).forEach(([key, value]) => {
          normalizedErrors[key.toLowerCase()] = value;
        });
        setFieldErrors(normalizedErrors);
        addToast("error", "Validation Failed", "Check form attributes and retry.");
      } else {
        addToast("error", err.title, err.detail || "Unable to save Material specifications.");
      }
    };

    const action = isEditMode && materialId
      ? () => api.updateMaterial(materialId, payload)
      : () => api.createMaterial(payload);

    const successMessage = isEditMode
      ? "Material records successfully revised!"
      : "Excellent. New cargo material registered.";

    const savedResult = await executeApiCall(action, successMessage, errorHandler);
    setSaving(false);

    if (savedResult) {
      // Direct back route
      onNavigate({ type: "materials" });
    }
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Breadcrumb section */}
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <button onClick={() => onNavigate({ type: "materials" })} className="hover:text-[#006039] hover:underline">
          Materials
        </button>
        <span>/</span>
        {isEditMode ? (
          <>
            <span className="font-mono text-slate-700 bg-slate-100 px-2 py-0.5 rounded">ID: #{materialId}</span>
            <span>/</span>
            <span className="text-slate-800 font-semibold">Edit Spares Spec</span>
          </>
        ) : (
          <span className="text-slate-800 font-semibold">New Material Catalog Entry</span>
        )}
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-800">
          {isEditMode ? "Edit Spares Spec" : "Log New Material"}
        </h2>
        <button
          onClick={() => onNavigate(isEditMode && materialId ? { type: "material-detail", id: materialId } : { type: "materials" })}
          className="flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-900 border border-slate-200 px-3 py-1.5 rounded-lg bg-white"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
      </div>

      {categories.length === 0 ? (
        /* Block form if no categories exist */
        <div className="bg-amber-50 border border-amber-200 p-6 rounded-xl flex items-start gap-4">
          <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-2">
            <h4 className="font-bold text-amber-900">Define Category Context First</h4>
            <p className="text-xs text-amber-700 leading-relaxed">
              Before setting up aeronautical parts, you must configure associated stock maintenance divisions or warehouse storage sections.
            </p>
            <button
              onClick={() => onNavigate({ type: "categories" })}
              className="bg-amber-700 text-white font-semibold text-xs px-3 py-1.5 rounded-md hover:bg-amber-800"
            >
              Configure Divisions Now
            </button>
          </div>
        </div>
      ) : (
        /* Main Input form */
        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-xs border border-slate-200 p-6 space-y-4">
          
          {/* Section 1: Name */}
          <div className="space-y-1">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
              Material Name <span className="text-red-500">*</span>
            </label>
            <input
              id="form-mat-name"
              type="text"
              placeholder="e.g. Pratt & Whitney Turbine Blade, etc."
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={`w-full p-2.5 text-sm border rounded-lg focus:outline-none focus:ring-1 ${
                fieldErrors["name"] 
                  ? "border-rose-300 focus:ring-rose-500 bg-rose-50/20" 
                  : "border-slate-200 focus:ring-[#006039] focus:border-[#006039]"
              }`}
            />
            {fieldErrors["name"] && (
              <p className="text-xs text-rose-600 flex items-center gap-1.5 mt-1 font-medium">
                <AlertTriangle className="w-3.5 h-3.5" /> {fieldErrors["name"][0]}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Section 2: Category select */}
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
                Stock Category <span className="text-red-500">*</span>
              </label>
              <select
                id="form-mat-category"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className={`w-full p-2.5 text-sm border rounded-lg focus:outline-none focus:ring-1 ${
                  fieldErrors["categoryid"] 
                    ? "border-rose-300 focus:ring-rose-500" 
                    : "border-slate-200 focus:ring-[#006039]"
                }`}
              >
                <option value="">-- Choose Air Group --</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              {fieldErrors["categoryid"] && (
                <p className="text-xs text-rose-600 flex items-center gap-1.5 mt-1 font-medium">
                  <AlertTriangle className="w-3.5 h-3.5" /> {fieldErrors["categoryid"][0]}
                </p>
              )}
            </div>

            {/* Section 3: Unit measure */}
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
                Measurement Unit <span className="text-red-500">*</span>
              </label>
              <input
                id="form-mat-unit"
                type="text"
                placeholder="e.g. ea, kg, L, boxes"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className={`w-full p-2.5 text-sm border rounded-lg focus:outline-none focus:ring-1 ${
                  fieldErrors["unit"] 
                    ? "border-rose-300 focus:ring-rose-500 bg-rose-50/20" 
                    : "border-slate-200 focus:ring-[#006039] focus:border-[#006039]"
                }`}
              />
              {fieldErrors["unit"] && (
                <p className="text-xs text-rose-600 flex items-center gap-1.5 mt-1 font-medium">
                  <AlertTriangle className="w-3.5 h-3.5" /> {fieldErrors["unit"][0]}
                </p>
              )}
            </div>
          </div>

          {/* Section 4: Unit Price */}
          <div className="space-y-1">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
              Catalog Unit Price (ETB) <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                id="form-mat-price"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
                className={`w-full p-2.5 pl-12 text-sm border rounded-lg focus:outline-none focus:ring-1 ${
                  fieldErrors["unitprice"] 
                    ? "border-rose-300 focus:ring-rose-500 bg-rose-50/20" 
                    : "border-slate-200 focus:ring-[#006039] focus:border-[#006039]"
                }`}
              />
              <span className="absolute left-3.5 top-2.5 font-bold text-[#e2b007] text-sm">ETB</span>
            </div>
            {fieldErrors["unitprice"] && (
              <p className="text-xs text-rose-600 flex items-center gap-1.5 mt-1 font-medium">
                <AlertTriangle className="w-3.5 h-3.5" /> {fieldErrors["unitprice"][0]}
              </p>
            )}
            <p className="text-[10px] text-slate-400">Used as the multiplier against physical batch quantities to calculate inventory worth.</p>
          </div>

          {/* Action Row */}
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => onNavigate({ type: "materials" })}
              className="px-4 py-2 border border-slate-200 rounded-lg text-sm bg-white hover:bg-slate-50 text-slate-700"
            >
              Discard Changes
            </button>
            <button
              id="form-mat-submit"
              type="submit"
              disabled={saving}
              className="bg-[#006039] hover:bg-[#006039]/90 text-white font-semibold text-sm px-5 py-2 rounded-lg flex items-center gap-2 select-none shadow-sm cursor-pointer disabled:bg-emerald-800"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Specifications"}
            </button>
          </div>

        </form>
      )}
    </div>
  );
}

// ==========================================
// 4.4 MATERIAL DETAIL VIEW
// ==========================================
interface MaterialDetailViewProps {
  materialId: number;
  onNavigate: (view: ViewState) => void;
  addToast: (type: "success" | "error" | "warning" | "info", title: string, message?: string) => void;
  executeApiCall: <T,>(call: () => Promise<T>, successMessage?: string, errorHandler?: (err: ApiError) => void) => Promise<T | null>;
  setConfirmDialog: (dialog: { isOpen: boolean; title: string; description: string; onConfirm: () => void; destructive?: boolean } | null) => void;
}

function MaterialDetailView({ materialId, onNavigate, addToast, executeApiCall, setConfirmDialog }: MaterialDetailViewProps) {
  const [loading, setLoading] = useState<boolean>(true);
  const [detail, setDetail] = useState<MaterialDetail | null>(null);

  const fetchFullDetails = useCallback(async () => {
    setLoading(true);
    const detailData = await executeApiCall(() => api.getMaterial(materialId));
    if (detailData) {
      setDetail(detailData);
    }
    setLoading(false);
  }, [materialId, executeApiCall]);

  useEffect(() => {
    fetchFullDetails();
  }, [fetchFullDetails]);

  const handleDelete = () => {
    if (!detail) return;

    setConfirmDialog({
      isOpen: true,
      title: "Remove Catalog Item?",
      description: `Please confirm you want to delete '${detail.name}'. This action is permanent and only allowed if there are no existing batches or usage logs.`,
      destructive: true,
      onConfirm: async () => {
        const errorHandler = (err: ApiError) => {
          if (err.status === 409) {
            // Check specific back-end messages requested in specifications
            addToast("error", "Integrity Guard Constraint", err.detail || "Cannot delete catalog line item.");
          } else {
            addToast("error", err.title, err.detail || "Unable to remove item records.");
          }
        };

        const result = await executeApiCall(() => api.deleteMaterial(materialId), "Material record deleted.", errorHandler);
        if (result !== null) {
          onNavigate({ type: "materials" });
        }
      }
    });
  };

  if (loading) {
    return (
      <div className="p-12 text-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#006039] mx-auto mb-4" />
        <p className="text-sm text-slate-500">Retrieving operational records...</p>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="p-12 text-center space-y-4">
        <XCircle className="w-8 h-8 text-rose-500 mx-auto" />
        <h3 className="text-base font-bold text-slate-800">Operational Log Missing</h3>
        <p className="text-xs text-slate-500">Record details have either been deleted or are cataloged elsewhere.</p>
        <button onClick={() => onNavigate({ type: "materials" })} className="px-4 py-2 bg-[#006039] text-white rounded-lg text-sm">
          Return to Ledger
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* Top Bar Navigation Breadcrumbs */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <button onClick={() => onNavigate({ type: "materials" })} className="hover:text-[#006039] hover:underline">
            Materials
          </button>
          <span>/</span>
          <span className="font-semibold text-slate-800">{detail.name}</span>
        </div>
        
        <button
          onClick={() => onNavigate({ type: "materials" })}
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 border border-slate-200 px-3 py-1.5 rounded-lg bg-white"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Spares List
        </button>
      </div>

      {/* Main Material Card */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
        
        {/* Card Header section with quick details */}
        <div className="p-6 bg-slate-50 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider text-[#006039] bg-[#006039]/10 uppercase">
              {detail.categoryName}
            </span>
            <h2 className="text-2xl font-bold text-slate-900">{detail.name}</h2>
            <p className="text-xs text-slate-400 font-mono">Product ID: #{detail.id}</p>
          </div>

          <div className="flex flex-wrap gap-2 text-xs">
            <button
              id="btn-edit-detail"
              onClick={() => onNavigate({ type: "material-edit", id: detail.id })}
              className="px-3.5 py-2 border border-slate-200 bg-white hover:bg-slate-50 font-bold rounded-lg text-slate-700 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Edit2 className="w-3.5 h-3.5" /> Edit Specs
            </button>
            <button
              id="btn-delete-detail"
              onClick={handleDelete}
              className="px-3.5 py-2 border border-red-200 bg-rose-50 text-[#d62d20] hover:bg-rose-100 font-bold rounded-lg flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete Catalog Item
            </button>
          </div>
        </div>

        {/* Inventory Analytics Dashboard Card */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          
          {/* Section A: Hand count */}
          <div className="p-4 bg-slate-50 rounded-xl space-y-2 border border-slate-100 relative">
            <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Physical On-Hand Stock</span>
            <div className="flex items-baseline gap-2 pt-1">
              <span className="text-4xl font-extrabold text-slate-900">{detail.onHand}</span>
              <span className="text-xs text-slate-500 font-medium">{detail.unit}</span>
            </div>
            
            {/* Warning tag */}
            {detail.onHand <= 0 ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-rose-100 text-[#d62d20]">
                Out of Stock
              </span>
            ) : detail.onHand < 10 ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-100 text-amber-800">
                Low stock limit alarm
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800">
                Sufficient Spares
              </span>
            )}
          </div>

          {/* Section B: Asset Stock value */}
          <div className="p-4 bg-teal-50 rounded-xl space-y-2 border border-teal-100/50">
            <span className="block text-[10px] font-bold text-teal-800 uppercase tracking-wider">Calculated Assets Value</span>
            <div className="flex items-baseline gap-1 pt-1 text-emerald-950">
              <span className="text-3xl font-black font-mono">
                {detail.stockValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className="text-xs font-bold text-teal-800">ETB</span>
            </div>
            <p className="text-[10px] text-teal-700 font-sans">Formula: {detail.onHand} {detail.unit} × {detail.unitPrice.toFixed(2)} ETB</p>
          </div>

          {/* Section C: Unit Prices and Actions */}
          <div className="p-4 bg-slate-50 rounded-xl flex flex-col justify-between border border-slate-100 gap-3">
            <div>
              <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Listed Spares Unit Price</span>
              <p className="text-xl font-bold text-slate-950 mt-1">
                {detail.unitPrice.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{" "}
                <span className="text-xs font-medium text-slate-500">ETB/{detail.unit}</span>
              </p>
            </div>
            
            <button
              id="btn-detail-receive-stock"
              onClick={() => onNavigate({ type: "material-receive", id: detail.id })}
              className="bg-[#006039] hover:bg-[#006039]/90 text-white font-semibold text-xs px-4 py-2 rounded-lg flex items-center justify-center gap-1.5 shadow-sm select-none cursor-pointer"
            >
              <PlusCircle className="w-4.5 h-4.5" />
              Manage & Receive Stocks
            </button>
          </div>

        </div>

      </div>

      {/* Recent Batches History (Top 5 batches from Detail DTO) */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <History className="w-5 h-5 text-[#006039]" />
            Recent Stock Inflow Batches
          </h3>
          <span className="text-xs text-slate-400">Showing top 5 active batches</span>
        </div>

        {detail.recentBatches.length === 0 ? (
          <div className="p-6 text-center text-slate-400 border border-dashed border-slate-200 rounded-xl text-xs">
            No received stock batches are currently mapped against this item.
            <button
              onClick={() => onNavigate({ type: "material-receive", id: detail.id })}
              className="text-[#006039] font-bold underline hover:text-[#006039]/80 ml-1.5 block sm:inline"
            >
              Log your first batch now
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-100">
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-slate-50">
                <tr>
                  <th scope="col" className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500">Batch Code</th>
                  <th scope="col" className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500">Received Date</th>
                  <th scope="col" className="px-4 py-2.5 text-center text-xs font-semibold text-slate-500">Qty Received</th>
                  <th scope="col" className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500 font-mono">Total Cargo Cost</th>
                  <th scope="col" className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500">Expiry Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {detail.recentBatches.map((b) => (
                  <tr key={b.batchId} className="hover:bg-slate-50 text-xs">
                    <td className="px-4 py-3 font-mono font-bold text-[#006039]">BATCH-{b.batchId}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {new Date(b.receivedAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-center text-slate-800 font-bold font-mono">
                      {b.quantityReceived} {detail.unit}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-[#038550] font-semibold">
                      {b.costTotal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {b.expiryDate ? (
                        <div className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" />
                          <span>{new Date(b.expiryDate).toLocaleDateString()}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">No Expiry Limit</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}

// ==========================================
// 4.5 RECEIVE STOCK & BATCH HISTORY VIEW
// ==========================================
interface ReceiveStockViewProps {
  materialId: number;
  onNavigate: (view: ViewState) => void;
  addToast: (type: "success" | "error" | "warning" | "info", title: string, message?: string) => void;
  executeApiCall: <T,>(call: () => Promise<T>, successMessage?: string, errorHandler?: (err: ApiError) => void) => Promise<T | null>;
  setConfirmDialog: (dialog: { isOpen: boolean; title: string; description: string; onConfirm: () => void; destructive?: boolean } | null) => void;
}

function ReceiveStockView({ materialId, onNavigate, addToast, executeApiCall, setConfirmDialog }: ReceiveStockViewProps) {
  const [detail, setDetail] = useState<MaterialDetail | null>(null);
  const [batches, setBatches] = useState<StockBatch[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Form states
  const [qty, setQty] = useState<string>("");
  const [cost, setCost] = useState<string>("");
  const [receivedAt, setReceivedAt] = useState<string>(() => {
    // Current date format YYYY-MM-DD
    return new Date().toISOString().split("T")[0];
  });
  const [expiry, setExpiry] = useState<string>("");
  
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  const reloadContextData = useCallback(async () => {
    setLoading(true);
    const [detailData, batchesData] = await Promise.all([
      api.getMaterial(materialId),
      api.getBatches(materialId)
    ]);
    if (detailData && batchesData) {
      setDetail(detailData);
      setBatches(batchesData);
    }
    setLoading(false);
  }, [materialId]);

  useEffect(() => {
    reloadContextData();
  }, [reloadContextData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFieldErrors({});

    const normalizedQty = parseFloat(qty);
    const normalizedCost = parseFloat(cost);

    const payload = {
      quantityReceived: isNaN(normalizedQty) ? 0 : normalizedQty,
      costTotal: isNaN(normalizedCost) ? 0 : normalizedCost,
      receivedAt: new Date(receivedAt).toISOString(),
      expiryDate: expiry ? new Date(expiry).toISOString() : undefined,
    };

    const errorHandler = (err: ApiError) => {
      setSubmitting(false);
      if (err.status === 400 && err.errors) {
        const normalized: Record<string, string[]> = {};
        Object.entries(err.errors).forEach(([key, value]) => {
          normalized[key.toLowerCase()] = value;
        });
        setFieldErrors(normalized);
        addToast("error", "Invalid Attributes", "Could not commit batch values.");
      } else {
        addToast("error", err.title, err.detail || "Unable to receive bulk cargo batch.");
      }
    };

    const result = await executeApiCall(
      () => api.receiveStock(materialId, payload),
      `Successfully received ${qty} Units!`,
      errorHandler
    );
    
    setSubmitting(false);

    if (result) {
      // Clear inputs
      setQty("");
      setCost("");
      setExpiry("");
      // Reload lists
      reloadContextData();
    }
  };

  const deleteBatch = (batchId: number, batchCode: string) => {
    setConfirmDialog({
      isOpen: true,
      title: "Revoke Stock Intake?",
      description: `Please confirm you want to remove '${batchCode}'. This reduces current on-hand quantities immediately.`,
      destructive: true,
      onConfirm: async () => {
        const result = await executeApiCall(
          () => api.deleteBatch(materialId, batchId),
          "Inflow batch successfully deleted."
        );
        if (result !== null) {
          reloadContextData();
        }
      }
    });
  };

  if (loading && !detail) {
    return (
      <div className="p-12 text-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#006039] mx-auto mb-4" />
        <p className="text-sm text-slate-500">Retrieving aviation batch files...</p>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="p-12 text-center">
        <p className="text-sm text-slate-500">Material catalog record is invalid.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* Title Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <button onClick={() => onNavigate({ type: "materials" })} className="hover:text-[#006039] hover:underline">
            Materials
          </button>
          <span>/</span>
          <button onClick={() => onNavigate({ type: "material-detail", id: detail.id })} className="hover:text-[#006039] hover:underline">
            {detail.name}
          </button>
          <span>/</span>
          <span className="font-semibold text-slate-800">Receive Stock</span>
        </div>
        
        <button
          onClick={() => onNavigate({ type: "material-detail", id: detail.id })}
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 border border-slate-200 px-3 py-1.5 rounded-lg bg-white"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Specs
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* Left pane form receive cargo */}
        <div className="lg:col-span-1 bg-white rounded-xl shadow-xs border border-slate-200 p-6 space-y-4">
          <div className="pb-3 border-b border-slate-100">
            <h3 className="text-base font-bold text-slate-900">Receive Stock Cargo</h3>
            <p className="text-xs text-slate-400 mt-0.5">Increases current on-hand worth immediately</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* Section: Quantity */}
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
                Quantity Received <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  id="receive-qty"
                  type="number"
                  step="0.1"
                  placeholder="0.0"
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                  className={`w-full p-2.5 pr-14 text-sm border rounded-lg focus:outline-none focus:ring-1 ${
                    fieldErrors["quantityreceived"] 
                      ? "border-rose-300 focus:ring-rose-500" 
                      : "border-slate-200 focus:ring-[#006039]"
                  }`}
                />
                <span className="absolute right-3.5 top-2.5 text-xs font-bold text-slate-400 font-sans">{detail.unit}</span>
              </div>
              {fieldErrors["quantityreceived"] && (
                <p className="text-xs text-rose-600 flex items-center gap-1.5 mt-1 font-medium">
                  <AlertTriangle className="w-3.5 h-3.5" /> {fieldErrors["quantityreceived"][0]}
                </p>
              )}
            </div>

            {/* Section: Cost total */}
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
                Total Inflow Cost (ETB) <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  id="receive-cost"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={cost}
                  onChange={(e) => setCost(e.target.value)}
                  className={`w-full p-2.5 pl-12 text-sm border rounded-lg focus:outline-none focus:ring-1 ${
                    fieldErrors["costtotal"] 
                      ? "border-rose-300 focus:ring-rose-500" 
                      : "border-slate-200 focus:ring-[#006039]"
                  }`}
                />
                <span className="absolute left-3.5 top-2.5 font-bold text-[#e2b007] text-sm">ETB</span>
              </div>
              {fieldErrors["costtotal"] && (
                <p className="text-xs text-rose-600 flex items-center gap-1.5 mt-1 font-medium">
                  <AlertTriangle className="w-3.5 h-3.5" /> {fieldErrors["costtotal"][0]}
                </p>
              )}
            </div>

            {/* Date Picker Section */}
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
                Received At <span className="text-red-500">*</span>
              </label>
              <input
                id="receive-date"
                type="date"
                value={receivedAt}
                onChange={(e) => setReceivedAt(e.target.value)}
                className={`w-full p-2.5 text-sm border rounded-lg focus:outline-none focus:ring-1 ${
                  fieldErrors["receivedat"] 
                    ? "border-rose-300 focus:ring-[#006039]" 
                    : "border-slate-200 focus:ring-[#006039]"
                }`}
              />
              {fieldErrors["receivedat"] && (
                <p className="text-xs text-rose-600 flex items-center gap-1.5 mt-1 font-medium">
                  <AlertTriangle className="w-3.5 h-3.5" /> {fieldErrors["receivedat"][0]}
                </p>
              )}
            </div>

            {/* Expiry Date Section */}
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide font-sans">
                Expiry Date <span className="text-xs font-normal text-slate-400 italic">(Optional)</span>
              </label>
              <input
                id="receive-expiry"
                type="date"
                value={expiry}
                onChange={(e) => setExpiry(e.target.value)}
                className="w-full p-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#006039]"
              />
            </div>

            <button
              id="btn-receive-submit"
              type="submit"
              disabled={submitting}
              className="w-full bg-[#006039] hover:bg-[#006039]/90 text-white font-semibold text-sm py-2.5 rounded-lg flex items-center justify-center gap-2 select-none shadow-sm cursor-pointer disabled:bg-emerald-800"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Commit Stock Quantity"}
            </button>

          </form>

        </div>

        {/* Right pane history and delete capabilities */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-xs border border-slate-200 p-6 space-y-4">
          <div className="pb-3 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">Physical Stock History</h3>
              <p className="text-xs text-slate-400 mt-0.5">Real-time log of received lots for ID: #{detail.id}</p>
            </div>
            <span className="text-xs font-bold bg-[#006039]/10 text-[#006039] px-2.5 py-0.5 rounded-full">
              On Hand: {detail.onHand} {detail.unit}
            </span>
          </div>

          {batches.length === 0 ? (
            <div className="p-12 text-center text-slate-400 border border-dashed border-slate-200 rounded-xl text-xs space-y-2">
              <Warehouse className="w-8 h-8 text-slate-300 mx-auto" />
              <p>No lot batches recorded. Use Left Form panel to receive stocks.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-100">
              <table className="min-w-full divide-y divide-slate-100">
                <thead className="bg-slate-50 text-xs text-slate-500 font-semibold">
                  <tr>
                    <th scope="col" className="px-4 py-2 text-left">Batch Code</th>
                    <th scope="col" className="px-4 py-2 text-left">Received Date</th>
                    <th scope="col" className="px-4 py-2 text-center">Batch Quantity</th>
                    <th scope="col" className="px-4 py-2 text-right">Inflow Cost</th>
                    <th scope="col" className="px-4 py-2 text-left">Expiry</th>
                    <th scope="col" className="px-4 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white text-xs">
                  {batches.map((b) => (
                    <tr key={b.batchId} className="hover:bg-slate-50/50 select-none">
                      <td className="px-4 py-3 font-mono font-bold text-[#006039]">BATCH-{b.batchId}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {new Date(b.receivedAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-center text-slate-800 font-bold font-mono">
                        {b.quantityReceived} {detail.unit}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-medium text-slate-800">
                        {b.costTotal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {b.expiryDate ? (
                          <span className="text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded font-mono">
                            {new Date(b.expiryDate).toLocaleDateString()}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">None</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => deleteBatch(b.batchId, `BATCH-${b.batchId}`)}
                          className="text-slate-400 hover:text-red-600 rounded p-1 hover:bg-slate-100"
                          title="Revoke Inflow Receipt"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

// ==========================================
// 4.6 CATEGORIES PAGE AND OPERATIONS VIEW
// ==========================================
interface CategoriesViewProps {
  categories: Category[];
  loading: boolean;
  onRefresh: () => void;
  addToast: (type: "success" | "error" | "warning" | "info", title: string, message?: string) => void;
  executeApiCall: <T,>(call: () => Promise<T>, successMessage?: string, errorHandler?: (err: ApiError) => void) => Promise<T | null>;
  setConfirmDialog: (dialog: { isOpen: boolean; title: string; description: string; onConfirm: () => void; destructive?: boolean } | null) => void;
}

function CategoriesView({ categories, loading, onRefresh, addToast, executeApiCall, setConfirmDialog }: CategoriesViewProps) {
  // Input fields hooks
  const [name, setName] = useState<string>("");
  const [desc, setDesc] = useState<string>("");
  const [editingCat, setEditingCat] = useState<Category | null>(null);

  const [saving, setSaving] = useState<boolean>(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  const handleCreateOrUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFieldErrors({});

    const payload = {
      name: name.trim(),
      description: desc.trim(),
    };

    const errorHandler = (err: ApiError) => {
      setSaving(false);
      if (err.status === 400 && err.errors) {
        const normalized: Record<string, string[]> = {};
        Object.entries(err.errors).forEach(([key, value]) => {
          normalized[key.toLowerCase()] = value;
        });
        setFieldErrors(normalized);
        addToast("error", "Validation Error", "Invalid category spec formats.");
      } else if (err.status === 409) {
        addToast("error", "Duplicate Registered Name", err.detail || "Category name exists.");
      } else {
        addToast("error", err.title, err.detail || "Unable to configure category record.");
      }
    };

    const action = editingCat
      ? () => api.updateCategory(editingCat.id, payload)
      : () => api.createCategory(payload);

    const successMsg = editingCat
      ? "Category details modified successfully."
      : "New stock division registered.";

    const result = await executeApiCall(action, successMsg, errorHandler);
    setSaving(false);

    if (result) {
      setName("");
      setDesc("");
      setEditingCat(null);
      onRefresh();
    }
  };

  const startEdit = (cat: Category) => {
    setEditingCat(cat);
    setName(cat.name);
    setDesc(cat.description || "");
    setFieldErrors({});
  };

  const cancelEdit = () => {
    setEditingCat(null);
    setName("");
    setDesc("");
    setFieldErrors({});
  };

  const handleDelete = (cat: Category) => {
    setConfirmDialog({
      isOpen: true,
      title: "Remove Division Category?",
      description: `Are you sure you want to delete '${cat.name}'? This operation fails automatically if there are materials registered in this group under standard security filters.`,
      destructive: true,
      onConfirm: async () => {
        const errHandler = (err: ApiError) => {
          if (err.status === 409) {
            addToast("error", "Integrity Lock Activated", err.detail || "Category is currently in use by materials.");
          } else {
            addToast("error", err.title, err.detail || "Unable to delete category division.");
          }
        };

        const deleteResult = await executeApiCall(() => api.deleteCategory(cat.id), "Category successfully removed.", errHandler);
        if (deleteResult !== null) {
          onRefresh();
        }
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Configure Stock Categories</h2>
          <p className="text-sm text-slate-500">Define operational divisions, storage rules and maintenance associations</p>
        </div>
        <button
          onClick={onRefresh}
          className="flex items-center gap-2 px-3 py-1.5 border border-slate-200 text-xs font-semibold text-slate-600 bg-white rounded-lg hover:bg-slate-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          Sync
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* Left column Input Form */}
        <div className="lg:col-span-1 bg-white rounded-xl shadow-xs border border-slate-200 p-6 space-y-4">
          <div className="pb-3 border-b border-slate-100">
            <h3 className="text-base font-bold text-slate-900">
              {editingCat ? "Edit Category Details" : "Register New Division"}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">Define material groups for strict warehouse routing rules</p>
          </div>

          <form onSubmit={handleCreateOrUpdate} className="space-y-4">
            
            {/* Field: Name */}
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
                Category Name <span className="text-red-500">*</span>
              </label>
              <input
                id="cat-name-input"
                type="text"
                placeholder="e.g. Avionics, Lubricants, etc."
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={`w-full p-2.5 text-sm border rounded-lg focus:outline-none focus:ring-1 ${
                  fieldErrors["name"] 
                    ? "border-rose-300 focus:ring-rose-500" 
                    : "border-slate-200 focus:ring-[#006039]"
                }`}
              />
              {fieldErrors["name"] && (
                <p className="text-xs text-rose-600 flex items-center gap-1.5 mt-1 font-medium">
                  <AlertTriangle className="w-3.5 h-3.5" /> {fieldErrors["name"][0]}
                </p>
              )}
            </div>

            {/* Field: Description */}
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
                Division Description <span className="text-slate-400 font-normal italic">(Optional)</span>
              </label>
              <textarea
                id="cat-desc-input"
                placeholder="Purpose, safety guidelines, and hangar storage rules..."
                rows={4}
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                className={`w-full p-2.5 text-sm border rounded-lg focus:outline-none focus:ring-1 ${
                  fieldErrors["description"] 
                    ? "border-rose-300 focus:ring-rose-500" 
                    : "border-slate-200 focus:ring-[#006039]"
                }`}
              />
              {fieldErrors["description"] && (
                <p className="text-xs text-rose-600 flex items-center gap-1.5 mt-1 font-medium">
                  <AlertTriangle className="w-3.5 h-3.5" /> {fieldErrors["description"][0]}
                </p>
              )}
            </div>

            <div className="flex gap-2.5 justify-end pt-3 border-t border-slate-100">
              {editingCat && (
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="px-4 py-2 border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold rounded-lg"
                >
                  Cancel
                </button>
              )}
              <button
                id="btn-cat-submit"
                type="submit"
                disabled={saving}
                className="bg-[#006039] hover:bg-[#006039]/90 text-white font-semibold text-xs px-4 py-2 rounded-lg flex items-center gap-1.5 select-none shadow-sm cursor-pointer disabled:bg-emerald-800"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : editingCat ? "Save Edits" : "Register Division"}
              </button>
            </div>

          </form>
        </div>

        {/* Right column list Categories Table */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-xs border border-slate-200 p-6 space-y-4">
          <div className="pb-3 border-b border-slate-100">
            <h3 className="text-base font-bold text-slate-900">Configured Divisions & Counts</h3>
            <p className="text-xs text-slate-400 mt-0.5">Review registered divisions and active aviation catalog ratios</p>
          </div>

          {categories.length === 0 ? (
            <div className="p-12 text-center text-slate-400 border border-dashed border-slate-200 rounded-xl text-xs">
              No aviation categories registered.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-100">
              <table className="min-w-full divide-y divide-slate-100">
                <thead className="bg-slate-50 text-xs text-slate-500 font-semibold">
                  <tr>
                    <th scope="col" className="px-4 py-3 text-left">Division Title</th>
                    <th scope="col" className="px-4 py-3 text-left">Description</th>
                    <th scope="col" className="px-4 py-3 text-center">Materials linked</th>
                    <th scope="col" className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white text-xs text-slate-700">
                  {categories.map((cat) => (
                    <tr key={cat.id} className="hover:bg-slate-50/50">
                      <td className="px-4 py-4 font-bold text-slate-900">{cat.name}</td>
                      <td className="px-4 py-4 text-slate-500 max-w-xs truncate" title={cat.description}>
                        {cat.description || <span className="text-slate-350 italic">No storage description provided.</span>}
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className="font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-900 font-mono">
                          {cat.materialCount || 0}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => startEdit(cat)}
                            className="p-1 text-slate-400 hover:text-amber-600 hover:bg-slate-150 rounded transition-colors"
                            title="Edit Division specs"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(cat)}
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-slate-150 rounded transition-colors"
                            title="Delete Division"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
