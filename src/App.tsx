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
  Filter,
  LogOut,
  ClipboardList,
  Bell,
  Package
} from "lucide-react";
import { api, ApiError, setOnUnauthorized } from "./client";
import { Category, Material, MaterialDetail, StockBatch, DashboardStats, ViewState, AuthSession, Shop, Alert } from "./types";
import { startRealtimeHub, stopRealtimeHub, filterAlertsForRole, alertTypeLabel } from "./realtime";
import ToastContainer, { ToastMessage } from "./components/Toast";
import LoginView from "./components/LoginView";
import { MaterialSearchView, MaterialRequestsView, AlertsView, ProcurementInboxView } from "./components/AmosWorkflowViews";
import TeamManagementView from "./components/TeamManagementView";
import ManagerOverviewView from "./components/ManagerOverviewView";
import UserAdminView from "./components/UserAdminView";
import AdminBudgetView from "./components/AdminBudgetView";
import {
  canAccessView,
  getDefaultView,
  getHomeView,
  getRolePermissions,
  normalizeRole,
  type RolePermissions,
} from "./roleConfig";
import AppSidebar from "./components/AppSidebar";
import AccessDenied from "./components/AccessDenied";

export default function App() {
  const [session, setSession] = useState<AuthSession | null>(() => api.getSession());
  const [pendingRequestMaterialId, setPendingRequestMaterialId] = useState<number | null>(null);

  // Navigation Routing State — role-based home
  const [currentView, setCurrentView] = useState<ViewState>(() => {
    const s = api.getSession();
    return s ? getDefaultView(s.role) : { type: "dashboard" };
  });

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
  const [shops, setShops] = useState<Shop[]>([]);
  /** Admin: null = all locations; Shop manager: fixed via session.shopId */
  const [inventoryShopId, setInventoryShopId] = useState<number | null>(null);

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
  const [activeAlertCount, setActiveAlertCount] = useState(0);
  const [alertsRefreshToken, setAlertsRefreshToken] = useState(0);

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
        if (error.status === 401) {
          return null;
        }
        if (errorHandler) {
          errorHandler(error);
        } else {
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

  const resolveInventoryShopId = useCallback((): number | undefined => {
    if (!session) return undefined;
    if (session.role === "ShopManager" && session.shopId) return session.shopId;
    const role = normalizeRole(session.role);
    if (role === "Admin" && inventoryShopId != null) return inventoryShopId;
    return undefined;
  }, [session, inventoryShopId]);

  const loadShops = useCallback(async () => {
    const list = await executeApiCall(() => api.getShops());
    if (list) setShops(list);
  }, [executeApiCall]);

  const loadAllMaterials = useCallback(async () => {
    const shopId = resolveInventoryShopId();
    const mats = await executeApiCall(() => api.getMaterials(shopId));
    if (mats) {
      setMaterials(mats);
      setLastUpdated(new Date().toLocaleTimeString());
    }
  }, [executeApiCall, resolveInventoryShopId]);

  // Combine load ops (dashboard + catalog screens only)
  const refreshAllContext = useCallback(async () => {
    setLoading(true);
    await Promise.all([
      loadGlobalDashboardStats(),
      loadAllCategories(),
      loadAllMaterials(),
    ]);
    setLoading(false);
  }, [loadGlobalDashboardStats, loadAllCategories, loadAllMaterials]);

  /** Load only what the current screen needs — avoids technician hitting /api/dashboard. */
  const loadDataForView = useCallback(
    async (viewType: ViewState["type"]) => {
      if (!session) return;
      switch (viewType) {
        case "dashboard":
          await loadGlobalDashboardStats();
          break;
        case "materials":
        case "material-new":
        case "material-edit":
        case "material-detail":
        case "material-receive":
          setLoading(true);
          await Promise.all([loadAllCategories(), loadAllMaterials()]);
          setLoading(false);
          break;
        case "categories":
          setLoading(true);
          await loadAllCategories();
          setLoading(false);
          break;
        case "stock-by-shop":
          break;
        default:
          break;
      }
    },
    [session, loadGlobalDashboardStats, loadAllCategories, loadAllMaterials]
  );

  const permissions = session ? getRolePermissions(session.role) : null;

  const refreshAlertCount = useCallback(async () => {
    if (!session || !permissions?.canViewAlerts) return;
    try {
      const alerts = await api.getAlerts();
      setActiveAlertCount(filterAlertsForRole(alerts, session.role, session.userId, session.shopId).length);
    } catch {
      // ignore — main API helper shows errors elsewhere
    }
  }, [session, permissions?.canViewAlerts]);

  useEffect(() => {
    if (!session?.token) return;

    refreshAlertCount();

    const handleAlert = (alert: Alert) => {
      if (session.role === "Technician" && alert.type === "NewMaterialAdded") return;
      if (!filterAlertsForRole([alert], session.role, session.userId, session.shopId).length) return;
      setActiveAlertCount((c) => c + 1);
      setAlertsRefreshToken((t) => t + 1);
      addToast(
        "info",
        alertTypeLabel(alert.type),
        alert.note ?? `${alert.materialName}${alert.requestId ? ` (request #${alert.requestId})` : ""}`
      );
    };

    const handleNewMaterial = (payload: { materialId: number; name: string; partNumber?: string }) => {
      if (session.role !== "Technician") return;
      setActiveAlertCount((c) => c + 1);
      setAlertsRefreshToken((t) => t + 1);
      addToast(
        "success",
        "New material available",
        `${payload.name}${payload.partNumber ? ` (${payload.partNumber})` : ""} was added to the catalog.`
      );
    };

    startRealtimeHub(session.token, {
      onAlertCreated: handleAlert,
      onNewMaterial: handleNewMaterial,
    }).catch(() => {
      // Hub optional when API offline
    });

    return () => {
      stopRealtimeHub();
    };
  }, [session?.token, session?.role, refreshAlertCount, addToast]);

  useEffect(() => {
    setOnUnauthorized(() => {
      setSession(null);
      addToast("warning", "Session expired", "Please sign in again.");
    });
    return () => setOnUnauthorized(null);
  }, [addToast]);

  useEffect(() => {
    if (session) {
      loadDataForView(currentView.type);
    }
  }, [session, currentView.type, loadDataForView]);

  useEffect(() => {
    if (session && (normalizeRole(session.role) === "Admin" || permissions?.canViewMaterials)) {
      loadShops();
    }
  }, [session, permissions?.canViewMaterials, loadShops]);

  useEffect(() => {
    if (session && normalizeRole(session.role) === "Admin" && inventoryShopId !== null) {
      loadAllMaterials();
    }
  }, [inventoryShopId, session, loadAllMaterials]);

  // Redirect if user lands on a view their role cannot access
  useEffect(() => {
    if (session && !canAccessView(session.role, currentView)) {
      setCurrentView(getDefaultView(session.role));
    }
  }, [session, currentView]);

  useEffect(() => {
    if (autoRefresh && (currentView.type === "materials" || currentView.type === "dashboard")) {
      autoRefreshTimerRef.current = setInterval(() => {
        loadAllMaterials();
        if (permissions?.canViewDashboard) loadGlobalDashboardStats();
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
  }, [autoRefresh, currentView.type, loadAllMaterials, loadGlobalDashboardStats, permissions?.canViewDashboard]);

  // Navigate utility with automated clear state
  const navigate = (view: ViewState) => {
    if (session && !canAccessView(session.role, view)) {
      addToast("warning", "Access restricted", `That screen is not available for ${session.role} users.`);
      setCurrentView(getDefaultView(session.role));
      return;
    }
    setCurrentView(view);
    setSearchQuery("");
    setSelectedCategoryFilter("all");
    setCatFieldErrors({});
  };

  const handleLogin = (s: AuthSession) => {
    setSession(s);
    setCurrentView(getDefaultView(s.role));
  };

  if (!session) {
    return <LoginView onLogin={handleLogin} />;
  }

  const viewAllowed = canAccessView(session.role, currentView);
  const goHome = () => navigate(getHomeView(session.role));

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 transition-colors duration-150">
      
      {/* 3. App Shell Header */}
      <header className="sticky top-0 z-40 bg-[#006039] text-white shadow-md border-b-2 border-[#e2b007]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={goHome}>
            <div className="bg-[#e2b007] text-[#006039] p-1.5 rounded-lg flex items-center justify-center font-bold">
              <Boxes className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight flex items-center gap-2">
                Airline Store Management System
              </h1>
              <p className="text-[10px] text-emerald-100 hidden sm:block">Aviation Maintenance & Materials Control Tower</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-[10px] bg-black/25 px-2 py-0.5 rounded font-mono">{session.role}</span>
            <button
              type="button"
              onClick={() => { api.logout(); setSession(null); }}
              className="text-xs flex items-center gap-1 text-emerald-100 hover:text-white"
              title="Sign out"
            >
              <LogOut className="w-3.5 h-3.5" /> Logout
            </button>
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
        
        <AppSidebar
          session={session}
          currentView={currentView}
          onNavigate={navigate}
          lastUpdated={lastUpdated}
          alertBadgeCount={permissions?.canViewAlerts ? activeAlertCount : 0}
        />

        {/* 4. Main Page Body Outlet */}
        <main className="flex-1 min-w-0">
          {!viewAllowed ? (
            <AccessDenied role={session.role} attempted={currentView.type} onGoHome={goHome} />
          ) : (
          <>
          {currentView.type === "dashboard" && permissions && (
            <DashboardView
              stats={dashboardStats}
              loading={loading}
              onNavigate={navigate}
              onRefresh={refreshAllContext}
              permissions={permissions}
              role={session.role}
            />
          )}

          {currentView.type === "materials" && permissions && (
            <MaterialsListView
              materials={materials}
              categories={categories}
              loading={loading}
              lastUpdated={lastUpdated}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              setSelectedCategoryFilter={setSelectedCategoryFilter}
              selectedCategoryFilter={selectedCategoryFilter}
              onNavigate={navigate}
              onRefresh={loadAllMaterials}
              addToast={addToast}
              canManageCatalog={permissions.canManageCatalog}
              canReceiveStock={permissions.canReceiveStock}
              shopScopeLabel={
                session.role === "ShopManager"
                  ? shops.find((s) => s.id === session.shopId)?.name ?? "Your shop"
                  : inventoryShopId != null
                  ? shops.find((s) => s.id === inventoryShopId)?.name
                  : "All locations"
              }
              shops={normalizeRole(session.role) === "Admin" ? shops : undefined}
              inventoryShopId={inventoryShopId}
              onInventoryShopChange={(id) => setInventoryShopId(id)}
            />
          )}



          {currentView.type === "material-new" && permissions?.canManageCatalog && (
            <MaterialFormView
              categories={categories}
              onNavigate={navigate}
              addToast={addToast}
              executeApiCall={executeApiCall}
            />
          )}

          {currentView.type === "material-edit" && permissions?.canManageCatalog && (
            <MaterialFormView
              materialId={currentView.id}
              categories={categories}
              onNavigate={navigate}
              addToast={addToast}
              executeApiCall={executeApiCall}
            />
          )}

          {currentView.type === "material-detail" && permissions && (
            <MaterialDetailView
              materialId={currentView.id}
              onNavigate={navigate}
              addToast={addToast}
              executeApiCall={executeApiCall}
              setConfirmDialog={setConfirmDialog}
              canManageCatalog={permissions.canManageCatalog}
              canReceiveStock={permissions.canReceiveStock}
              canDeleteMaterial={permissions.canDeleteMaterial}
            />
          )}

          {currentView.type === "material-receive" && permissions?.canReceiveStock && (
            <ReceiveStockView
              materialId={currentView.id}
              onNavigate={navigate}
              addToast={addToast}
              executeApiCall={executeApiCall}
              setConfirmDialog={setConfirmDialog}
            />
          )}

          {currentView.type === "material-search" && (
            <MaterialSearchView
              session={session}
              addToast={addToast}
              onRequest={(materialId) => {
                setPendingRequestMaterialId(materialId);
                navigate({ type: "material-requests" });
              }}
            />
          )}

          {currentView.type === "material-requests" && (
            <MaterialRequestsView
              session={session}
              addToast={addToast}
              executeApiCall={executeApiCall}
              initialMaterialId={pendingRequestMaterialId}
            />
          )}

          {currentView.type === "team" && permissions?.canManageTeam && (
            <TeamManagementView session={session} addToast={addToast} executeApiCall={executeApiCall} />
          )}

          {currentView.type === "manager-overview" && permissions?.canViewManagerOverview && (
            <ManagerOverviewView session={session} onNavigate={navigate} executeApiCall={executeApiCall} />
          )}

          {currentView.type === "alerts" && (
            <AlertsView
              executeApiCall={executeApiCall}
              role={session.role}
              userId={session.userId}
              shopId={session.shopId}
              refreshToken={alertsRefreshToken}
              onCountChange={setActiveAlertCount}
            />
          )}

          {currentView.type === "procurement-inbox" && (
            <ProcurementInboxView executeApiCall={executeApiCall} />
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

          {currentView.type === "user-admin" && permissions?.canManageUsers && (
            <UserAdminView
              session={session}
              onNavigate={navigate}
              executeApiCall={executeApiCall}
            />
          )}

          {currentView.type === "budget-admin" && permissions?.canViewAdminBudget && (
            <AdminBudgetView
              session={session}
              onNavigate={navigate}
              executeApiCall={executeApiCall}
            />
          )}


          </>
          )}

        </main>
      </div>

      {/* Footer System Details */}
      <footer className="bg-slate-900 text-slate-400 py-4 mt-auto border-t border-slate-800 text-xs font-mono">
        <div className="max-w-7xl mx-auto px-4 text-center sm:flex sm:justify-between sm:items-center">
          <p>Airline Store Management System © 2026 Flight Operations Stock Ledger</p>
          <div className="flex items-center justify-center gap-4 mt-2 sm:mt-0">
            <span>Terminal: ADDIS_BOLE_HQ</span>
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
  permissions: RolePermissions;
  role: string;
}

function DashboardView({ stats, loading, onNavigate, onRefresh, permissions, role }: DashboardViewProps) {
  const [logs, setLogs] = useState<any[]>([]);
  const [logsLoading, setLogsLoading] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<"people" | "catalog" | "stores" | "reports">("reports");

  useEffect(() => {
    if (role === "Admin" && activeTab === "reports") {
      setLogsLoading(true);
      api.getAuditLogs(1, 20)
        .then((res) => {
          if (res && res.items) setLogs(res.items);
          setLogsLoading(false);
        })
        .catch(() => setLogsLoading(false));
    }
  }, [role, stats, activeTab]);

  const isAdmin = role === "Admin";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">
            {isAdmin ? "Airline Store Management System Console" : "Operational Dashboard"}
          </h2>
          <p className="text-sm text-slate-500">
            {isAdmin ? "Unified flight logistics control, safety tracking, and inventory oversight" : "Overview of fleet material volumes, values and constraints"}
          </p>
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
            <p className="text-xs text-slate-400 mt-1">Lines below minimum stock</p>
          </div>
        </div>

      </div>

      {/* Admin Tab Controller */}
      {isAdmin && (
        <div className="flex border-b border-slate-200 gap-1 bg-slate-100/80 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab("reports")}
            className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
              activeTab === "reports"
                ? "bg-white text-[#006039] shadow-xs border border-slate-200/50"
                : "text-slate-600 hover:text-slate-900 hover:bg-white/40"
            }`}
          >
            <History className="w-3.5 h-3.5" /> Reports & Alerts
          </button>
          <button
            onClick={() => setActiveTab("people")}
            className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
              activeTab === "people"
                ? "bg-white text-[#006039] shadow-xs border border-slate-200/50"
                : "text-slate-600 hover:text-slate-900 hover:bg-white/40"
            }`}
          >
            <LayoutDashboard className="w-3.5 h-3.5" /> People & Roles
          </button>
          <button
            onClick={() => setActiveTab("catalog")}
            className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
              activeTab === "catalog"
                ? "bg-white text-[#006039] shadow-xs border border-slate-200/50"
                : "text-slate-600 hover:text-slate-900 hover:bg-white/40"
            }`}
          >
            <Boxes className="w-3.5 h-3.5" /> Catalog & Spares
          </button>
          <button
            onClick={() => setActiveTab("stores")}
            className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
              activeTab === "stores"
                ? "bg-white text-[#006039] shadow-xs border border-slate-200/50"
                : "text-slate-600 hover:text-slate-900 hover:bg-white/40"
            }`}
          >
            <Warehouse className="w-3.5 h-3.5" /> Stores & Stock
          </button>
        </div>
      )}

      {/* Content tabs */}
      {(!isAdmin || activeTab === "reports") && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Quick Launchpad list */}
            <div className="lg:col-span-2 bg-white rounded-xl shadow-xs border border-slate-200 p-6 space-y-4">
              <h3 className="text-base font-bold text-slate-900">Control Actions</h3>
              <p className="text-xs text-slate-500">Fast access to active catalog logging and receive sequences</p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {permissions.canManageCatalog && (
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
                )}

                {permissions.canViewRequests && (
                  <button
                    onClick={() => onNavigate({ type: "material-requests" })}
                    className="flex items-start gap-3 p-4 border border-slate-200 hover:border-[#006039] rounded-xl hover:bg-[#006039]/5 transition-all text-left"
                  >
                    <div className="bg-[#006039]/10 text-[#006039] p-2.5 rounded-lg">
                      <ClipboardList className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-sm text-slate-900">Request queue</h4>
                      <p className="text-xs text-slate-400 mt-0.5">Approve, pick, and release stock to shops.</p>
                    </div>
                  </button>
                )}

                {permissions.canManageCategories && (
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
                )}

                {permissions.canSearchAndRequest && (
                  <button
                    onClick={() => onNavigate({ type: "material-search" })}
                    className="flex items-start gap-3 p-4 border border-slate-200 hover:border-[#006039] rounded-xl hover:bg-[#006039]/5 transition-all text-left"
                  >
                    <div className="bg-[#006039]/10 text-[#006039] p-2.5 rounded-lg">
                      <Search className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-sm text-slate-900">Search & request</h4>
                      <p className="text-xs text-slate-400 mt-0.5">Technician counter — find parts and submit requests.</p>
                    </div>
                  </button>
                )}
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
                {permissions.canViewMaterials && (
                  <button
                    onClick={() => onNavigate({ type: "materials" })}
                    className="text-[#e2b007] hover:text-[#e2b007]/80 text-xs font-semibold flex items-center gap-1 focus:outline-none"
                  >
                    Verify Spares <ChevronRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

          </div>

          {/* System-wide Audit Ledger (Admin Only) */}
          {role === "Admin" && (
            <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <History className="w-5 h-5 text-[#006039]" />
                  System-wide Operational & Audit Ledger
                </h3>
                <span className="text-xs text-slate-400 font-mono">Real-time stock flow & user transaction tracking</span>
              </div>

              {logsLoading && logs.length === 0 ? (
                <div className="p-12 text-center">
                  <Loader2 className="w-8 h-8 animate-spin text-[#006039] mx-auto mb-4" />
                  <p className="text-xs text-slate-500 font-mono">Retrieving secure transaction files...</p>
                </div>
              ) : logs.length === 0 ? (
                <p className="p-6 text-center text-slate-400 text-xs font-mono">No transaction records logged.</p>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-slate-100">
                  <table className="min-w-full divide-y divide-slate-100">
                    <thead className="bg-slate-50 font-mono">
                      <tr>
                        <th scope="col" className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500">Timestamp</th>
                        <th scope="col" className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500">Action</th>
                        <th scope="col" className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 font-sans">Resource</th>
                        <th scope="col" className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 font-sans">Performed By</th>
                        <th scope="col" className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 font-sans">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {logs.map((log) => (
                        <tr key={log.logId} className="hover:bg-slate-50 text-xs">
                          <td className="px-4 py-3 text-slate-500 whitespace-nowrap font-mono">
                            {new Date(log.timestamp).toLocaleString()}
                          </td>
                          <td className="px-4 py-3 font-mono">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              log.action === "Receive" || log.action === "Create"
                                ? "bg-emerald-100 text-emerald-800"
                                : log.action === "IssueRequest"
                                ? "bg-teal-100 text-teal-800"
                                : log.action === "Delete" || log.action === "CancelRequest"
                                ? "bg-rose-100 text-rose-800"
                                : "bg-slate-100 text-slate-700"
                            }`}>
                              {log.action}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-mono text-slate-600">
                            {log.entity} (#{log.entityId})
                          </td>
                          <td className="px-4 py-3 font-semibold text-slate-800 font-sans">
                            {log.performedByName}
                          </td>
                          <td className="px-4 py-3 text-slate-600 leading-relaxed font-sans">
                            {log.details}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {isAdmin && activeTab === "people" && (
        <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">User Account Administration</h3>
              <p className="text-xs text-slate-500">Configure team roles, register staff members, and modify operational limits.</p>
            </div>
            <button
              onClick={() => onNavigate({ type: "team" })}
              className="px-3.5 py-1.5 bg-[#006039] hover:bg-[#004d2e] text-white text-xs font-semibold rounded-lg flex items-center gap-1 cursor-pointer"
            >
              Open Team Control Panel <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="border border-slate-100 rounded-lg p-4 bg-slate-50 space-y-2">
            <h4 className="text-xs font-bold text-[#006039] uppercase tracking-wider">Access Guidelines</h4>
            <ul className="text-xs text-slate-600 space-y-1.5 list-disc pl-4 leading-relaxed">
              <li>Managers can register technician/employee accounts directly under their respective shops.</li>
              <li>Employees/Technicians are constrained by monthly limits: <span className="font-semibold">Max Requests per Month</span> and <span className="font-semibold">Max Quantity per Month</span>.</li>
              <li>Only system administrators can seed managers or procurement roles.</li>
            </ul>
          </div>
        </div>
      )}

      {isAdmin && activeTab === "catalog" && (
        <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">Aviation Material Catalog</h3>
              <p className="text-xs text-slate-500">Maintain the master inventory specifications list of all airline consumable and repair parts.</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => onNavigate({ type: "materials" })}
                className="px-3.5 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg cursor-pointer"
              >
                Browse Materials
              </button>
              <button
                onClick={() => onNavigate({ type: "categories" })}
                className="px-3.5 py-1.5 bg-[#006039] hover:bg-[#004d2e] text-white text-xs font-semibold rounded-lg cursor-pointer"
              >
                Configure Categories
              </button>
            </div>
          </div>
          <div className="border border-slate-100 rounded-lg p-4 bg-slate-50 space-y-2">
            <h4 className="text-xs font-bold text-[#e2b007] uppercase tracking-wider">Master Catalog Integrity Rules</h4>
            <ul className="text-xs text-slate-600 space-y-1.5 list-disc pl-4 leading-relaxed">
              <li>Each material must have a unique Part Number conforming to AMOS/Ethiopian Airlines standards.</li>
              <li>Verify that minimum thresholds (<span className="font-mono text-emerald-800">minStock</span>) are set to trigger automated replenishment tasks.</li>
              <li>Aircraft types compatibility must list models separated by commas (e.g. <span className="font-mono bg-white px-1.5 py-0.5 rounded border text-[10px]">B737,B787</span>).</li>
            </ul>
          </div>
        </div>
      )}

      {isAdmin && activeTab === "stores" && (
        <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">Workshops & Stock Controls</h3>
              <p className="text-xs text-slate-500">Track on-hand balances across maintenance locations, receive deliveries, and evaluate batch serviceability.</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => onNavigate({ type: "stock-by-shop" })}
                className="px-3.5 py-1.5 bg-[#006039] hover:bg-[#004d2e] text-white text-xs font-semibold rounded-lg cursor-pointer"
              >
                View Stock by Shop
              </button>
            </div>
          </div>
          <div className="border border-slate-100 rounded-lg p-4 bg-slate-50 space-y-2">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Stock Handlers Instructions</h4>
            <ul className="text-xs text-slate-600 space-y-1.5 list-disc pl-4 leading-relaxed">
              <li>Receipts create unique batch records to track expiry dates and costs individually.</li>
              <li>Stocks with expired batches will trigger low-stock alerts if the remaining serviceable count falls below the minStock limit.</li>
            </ul>
          </div>
        </div>
      )}
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
  canManageCatalog: boolean;
  canReceiveStock: boolean;
  shopScopeLabel?: string;
  shops?: Shop[];
  inventoryShopId?: number | null;
  onInventoryShopChange?: (shopId: number | null) => void;
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
  addToast,
  canManageCatalog,
  canReceiveStock,
  shopScopeLabel,
  shops,
  inventoryShopId,
  onInventoryShopChange,
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
          <div className="flex flex-wrap items-center gap-2 mt-1 text-sm text-slate-500">
            {shopScopeLabel && (
              <span className="text-xs font-bold text-[#006039] bg-[#006039]/10 px-2 py-0.5 rounded">
                Location: {shopScopeLabel}
              </span>
            )}
            <span>Quantities reflect stock at this location.</span>
            {lastUpdated && (
              <span className="text-xs text-slate-400 font-mono italic">(Updated: {lastUpdated})</span>
            )}
          </div>
          {shops && shops.length > 0 && onInventoryShopChange && (
            <select
              className="mt-2 border border-slate-200 rounded-lg px-3 py-1.5 text-sm"
              value={inventoryShopId ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                onInventoryShopChange(v === "" ? null : Number(v));
              }}
            >
              <option value="">All locations (airline-wide)</option>
              {shops.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          )}
        </div>
        
        {canManageCatalog && (
          <button
            id="btn-add-material-list"
            onClick={() => onNavigate({ type: "material-new" })}
            className="bg-[#006039] hover:bg-[#006039]/90 text-white font-semibold text-sm px-4 py-2 rounded-lg flex items-center justify-center gap-2 select-none shadow-sm transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add Material
          </button>
        )}
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
                  const available = item.available ?? item.onHand ?? 0;
                  const min = item.minStock ?? 10;
                  const outOfStock = available <= 0;
                  const lowStock = available > 0 && min > 0 && available < min;

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
                            {available}
                          </span>
                          <span className="text-[9px] text-slate-400">avail</span>
                          {outOfStock && (
                            <span className="text-[9px] text-[#d62d20] font-sans font-bold uppercase mt-0.5">Out of Stock</span>
                          )}
                          {lowStock && !outOfStock && (
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
                          {canManageCatalog && (
                            <button
                              type="button"
                              onClick={() => onNavigate({ type: "material-edit", id: item.id })}
                              className="p-1 text-slate-400 hover:text-amber-600 rounded hover:bg-slate-100"
                              title="Edit Spares Spec"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                          )}
                          {canReceiveStock && (
                            <button
                              type="button"
                              onClick={() => onNavigate({ type: "material-receive", id: item.id })}
                              className="p-1 text-slate-400 hover:text-emerald-700 rounded hover:bg-slate-100"
                              title="Receive Stock Batch"
                            >
                              <PlusCircle className="w-4 h-4" />
                            </button>
                          )}
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
  const [partNumber, setPartNumber] = useState<string>("");
  const [name, setName] = useState<string>("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [unit, setUnit] = useState<string>("");
  const [unitPrice, setUnitPrice] = useState<string>("");
  const [minStock, setMinStock] = useState<string>("10");
  const [initialQuantity, setInitialQuantity] = useState<string>("1");

  const [saving, setSaving] = useState<boolean>(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  // Prefill hook if in edit mode
  useEffect(() => {
    if (isEditMode && materialId) {
      const fetchPreValue = async () => {
        const mat = await api.getMaterial(materialId);
        if (mat) {
          setPartNumber(mat.partNumber);
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

    const parsedCategory = parseInt(categoryId, 10);
    const normalizedPrice = parseFloat(unitPrice);
    const payload = {
      partNumber: partNumber.trim(),
      name: name.trim(),
      categoryId: isNaN(parsedCategory) ? 0 : parsedCategory,
      unit: unit.trim(),
      unitPrice: isNaN(normalizedPrice) ? 0 : normalizedPrice,
      minStock: parseFloat(minStock) || 0,
      initialQuantity: isEditMode ? 0 : parseFloat(initialQuantity) || 0,
    };

    if (!isEditMode && (payload.initialQuantity ?? 0) <= 0) {
      addToast("warning", "Initial quantity required", "Enter how many units were bought when creating a new material.");
      setSaving(false);
      return;
    }


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
          
          {/* Section 1: Part number */}
          <div className="space-y-1">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
              Part Number <span className="text-red-500">*</span>
            </label>
            <input
              id="form-mat-part"
              type="text"
              placeholder="e.g. ET-AVN-WIRE-22-10"
              value={partNumber}
              onChange={(e) => setPartNumber(e.target.value)}
              className={`w-full p-2.5 text-sm border rounded-lg focus:outline-none focus:ring-1 ${
                fieldErrors["partnumber"]
                  ? "border-rose-300 focus:ring-rose-500 bg-rose-50/20"
                  : "border-slate-200 focus:ring-[#006039] focus:border-[#006039]"
              }`}
            />
          </div>

          {/* Section 2: Name */}
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

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-600">Minimum stock level</label>
              <input
                id="form-mat-minstock"
                type="number"
                min="0"
                value={minStock}
                onChange={(e) => setMinStock(e.target.value)}
                className="w-full mt-1 p-2.5 text-sm border border-slate-200 rounded-lg"
              />
            </div>
            {!isEditMode && (
              <div>
                <label className="text-xs font-semibold text-slate-600">Opening quantity *</label>
                <input
                  id="form-mat-initial-qty"
                  type="number"
                  min="0"
                  step="0.01"
                  value={initialQuantity}
                  onChange={(e) => setInitialQuantity(e.target.value)}
                  className="w-full mt-1 p-2.5 text-sm border border-slate-200 rounded-lg"
                />
                <p className="text-[10px] text-slate-400 mt-1">Serviceable stock added when the part is created. Use 0 if receiving later.</p>
              </div>
            )}
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
  canManageCatalog: boolean;
  canReceiveStock: boolean;
  canDeleteMaterial: boolean;
}

function MaterialDetailView({
  materialId,
  onNavigate,
  addToast,
  executeApiCall,
  setConfirmDialog,
  canManageCatalog,
  canReceiveStock,
  canDeleteMaterial
}: MaterialDetailViewProps) {
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
            {canManageCatalog && (
              <button
                id="btn-edit-detail"
                onClick={() => onNavigate({ type: "material-edit", id: detail.id })}
                className="px-3.5 py-2 border border-slate-200 bg-white hover:bg-slate-50 font-bold rounded-lg text-slate-700 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Edit2 className="w-3.5 h-3.5" /> Edit Specs
              </button>
            )}
            {canDeleteMaterial && (
              <button
                id="btn-delete-detail"
                onClick={handleDelete}
                className="px-3.5 py-2 border border-red-200 bg-rose-50 text-[#d62d20] hover:bg-rose-100 font-bold rounded-lg flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" /> Delete Catalog Item
              </button>
            )}
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
            {(detail.available ?? detail.onHand) <= 0 ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-rose-100 text-[#d62d20]">
                Out of Stock
              </span>
            ) : (detail.minStock ?? 0) > 0 && (detail.available ?? detail.onHand) < (detail.minStock ?? 0) ? (
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
            
            {canReceiveStock && (
              <button
                id="btn-detail-receive-stock"
                onClick={() => onNavigate({ type: "material-receive", id: detail.id })}
                className="bg-[#006039] hover:bg-[#006039]/90 text-white font-semibold text-xs px-4 py-2 rounded-lg flex items-center justify-center gap-1.5 shadow-sm select-none cursor-pointer"
              >
                <PlusCircle className="w-4.5 h-4.5" />
                Manage & Receive Stocks
              </button>
            )}
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
