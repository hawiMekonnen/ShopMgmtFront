import { ViewState } from "./types";

export type AppRole = "Technician" | "ShopManager" | "Procurement" | "Admin" | "Finance";

export type NavViewType = ViewState["type"];

export interface NavItem {
  id: string;
  view: NavViewType;
  label: string;
  roles: AppRole[];
  /** Also active for child routes e.g. material-detail */
  activeWhen?: (view: ViewState) => boolean;
}

export interface RolePermissions {
  canViewDashboard: boolean;
  canViewMaterials: boolean;
  canManageCatalog: boolean;
  canViewCategories: boolean;
  canManageCategories: boolean;
  canSearchAndRequest: boolean;
  canViewRequests: boolean;
  canViewAlerts: boolean;
  canViewProcurement: boolean;
  canViewStockByShop: boolean;
  canReceiveStock: boolean;
  canDeleteMaterial: boolean;
  canSubmitRequest: boolean;
  canReleaseForIssue: boolean;
  canConfirmPickup: boolean;
  canRecordReturn: boolean;
}

const ALL_ROLES: AppRole[] = ["Technician", "ShopManager", "Procurement", "Admin", "Finance"];

export const NAV_ITEMS: NavItem[] = [
  {
    id: "dashboard",
    view: "dashboard",
    label: "Dashboard",
    roles: ["Admin", "ShopManager", "Finance"],
  },
  {
    id: "material-search",
    view: "material-search",
    label: "Search & Request",
    roles: ["Technician", "ShopManager", "Admin"],
  },
  {
    id: "material-requests",
    view: "material-requests",
    label: "Request queue",
    roles: ["Technician", "ShopManager", "Admin"],
  },
  {
    id: "materials",
    view: "materials",
    label: "My shop stock",
    roles: ["ShopManager"],
    activeWhen: (v) =>
      v.type === "materials" ||
      v.type === "material-new" ||
      v.type === "material-edit" ||
      v.type === "material-detail" ||
      v.type === "material-receive",
  },
  {
    id: "materials-admin",
    view: "materials",
    label: "Materials & stock",
    roles: ["Admin"],
    activeWhen: (v) =>
      v.type === "materials" ||
      v.type === "material-new" ||
      v.type === "material-edit" ||
      v.type === "material-detail" ||
      v.type === "material-receive",
  },
  {
    id: "alerts",
    view: "alerts",
    label: "Alerts",
    roles: ["Technician", "ShopManager", "Procurement", "Admin"],
  },
  {
    id: "procurement",
    view: "procurement",
    label: "Procurement inbox",
    roles: ["Procurement", "Admin"],
  },
  {
    id: "stock-by-shop",
    view: "stock-by-shop",
    label: "Stock by shop",
    roles: ["Procurement", "Admin"],
  },
  {
    id: "categories",
    view: "categories",
    label: "Categories (admin)",
    roles: ["Admin"],
  },
];

export function normalizeRole(role: string): AppRole {
  const known: AppRole[] = ["Technician", "ShopManager", "Procurement", "Admin", "Finance"];
  return (known.includes(role as AppRole) ? role : "Technician") as AppRole;
}

export function getDefaultView(role: string): ViewState {
  switch (normalizeRole(role)) {
    case "Technician":
      return { type: "material-search" };
    case "ShopManager":
      return { type: "material-requests" };
    case "Procurement":
      return { type: "procurement" };
    case "Finance":
      return { type: "dashboard" };
    case "Admin":
    default:
      return { type: "dashboard" };
  }
}

export function getHomeView(role: string): ViewState {
  return getDefaultView(role);
}

export function getRolePermissions(role: string): RolePermissions {
  const r = normalizeRole(role);
  const isAdmin = r === "Admin";
  const isManager = r === "ShopManager";
  const isTech = r === "Technician";
  const isProc = r === "Procurement";
  const isFinance = r === "Finance";

  return {
    canViewDashboard: isAdmin || isManager || isFinance,
    canViewMaterials: isAdmin || isManager,
    canManageCatalog: isAdmin || isManager,
    canViewCategories: isAdmin,
    canManageCategories: isAdmin,
    canSearchAndRequest: isAdmin || isManager || isTech,
    canViewRequests: isAdmin || isManager || isTech,
    canViewAlerts: isAdmin || isManager || isTech || isProc,
    canViewProcurement: isAdmin || isProc,
    canViewStockByShop: isAdmin || isProc,
    canReceiveStock: isAdmin || isManager,
    canDeleteMaterial: isAdmin,
    canSubmitRequest: isAdmin || isManager || isTech,
    canReleaseForIssue: isAdmin || isManager,
    canConfirmPickup: isAdmin || isManager || isTech,
    canRecordReturn: isAdmin || isManager || isTech,
  };
}

export function getNavItemsForRole(role: string): NavItem[] {
  const r = normalizeRole(role);
  return NAV_ITEMS.filter((item) => item.roles.includes(r));
}

export function canAccessView(role: string, view: ViewState): boolean {
  const perms = getRolePermissions(role);
  switch (view.type) {
    case "dashboard":
      return perms.canViewDashboard;
    case "materials":
    case "material-new":
    case "material-edit":
    case "material-detail":
    case "material-receive":
      return perms.canViewMaterials;
    case "categories":
      return perms.canViewCategories;
    case "material-search":
      return perms.canSearchAndRequest;
    case "material-requests":
      return perms.canViewRequests;
    case "alerts":
      return perms.canViewAlerts;
    case "procurement":
      return perms.canViewProcurement;
    case "stock-by-shop":
      return perms.canViewStockByShop;
    default:
      return false;
  }
}

export function getRoleSubtitle(role: string): string {
  switch (normalizeRole(role)) {
    case "Technician":
      return "Find parts, submit requests, collect stock when ready.";
    case "ShopManager":
      return "Your shop stock, request queue, and issuing materials.";
    case "Procurement":
      return "Stock by location, inbox actions, and on-order tracking.";
    case "Finance":
      return "Overview and reporting (read-only operations).";
    case "Admin":
      return "Full stores control and catalog administration.";
    default:
      return "";
  }
}
