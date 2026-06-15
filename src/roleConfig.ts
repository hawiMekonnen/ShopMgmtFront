import { ViewState } from "./types";

export type AppRole = "Employee" | "Manager" | "Procurement" | "Admin" | "Finance";

export type NavViewType = ViewState["type"];

export interface NavItem {
  id: string;
  view: NavViewType;
  label: string;
  roles: AppRole[];
  /** Also active for child routes e.g. material-detail */
  activeWhen?: (view: ViewState) => boolean;
  /** Show pending-request badge (manager team nav) */
  badgeKey?: "pendingApprovals";
}

export interface RolePermissions {
  canViewDashboard: boolean;
  canViewManagerOverview: boolean;
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
  canRejectRequest: boolean;
  canManageTeam: boolean;
  canReleaseForIssue: boolean;
  canConfirmPickup: boolean;
  canRecordReturn: boolean;
  canManageUsers: boolean;
  canViewAdminBudget: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  {
    id: "dashboard",
    view: "dashboard",
    label: "Dashboard",
    roles: ["Admin", "Finance", "Procurement"],
  },
  {
    id: "manager-overview",
    view: "manager-overview",
    label: "Overview",
    roles: ["Manager"],
  },
  {
    id: "material-search",
    view: "material-search",
    label: "Search & Request",
    roles: ["Employee"],
  },
  {
    id: "material-search-mgr",
    view: "material-search",
    label: "Request materials",
    roles: ["Manager"],
  },
  {
    id: "material-requests",
    view: "material-requests",
    label: "Request queue",
    roles: ["Employee"],
  },
  {
    id: "team",
    view: "team",
    label: "Team & requests",
    roles: ["Manager"],
    badgeKey: "pendingApprovals",
  },
  {
    id: "user-admin",
    view: "user-admin",
    label: "User accounts & reports",
    roles: ["Admin"],
  },
  {
    id: "materials-admin",
    view: "materials",
    label: "Materials & stock",
    roles: ["Admin", "Procurement"],
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
    roles: ["Employee", "Manager", "Procurement", "Admin"],
  },
  {
    id: "procurement-inbox",
    view: "procurement-inbox",
    label: "Procurement inbox",
    roles: ["Procurement"],
  },
  {
    id: "categories",
    view: "categories",
    label: "Categories (admin)",
    roles: ["Admin"],
  },
  {
    id: "budget-admin",
    view: "budget-admin",
    label: "Budget report",
    roles: ["Admin"],
  },
];

export function normalizeRole(role: string): AppRole {
  const known: AppRole[] = ["Employee", "Manager", "Procurement", "Admin", "Finance"];
  if (role === "Technician") return "Employee";
  if (role === "ShopManager") return "Manager";
  return (known.includes(role as AppRole) ? role : "Employee") as AppRole;
}

export function getDefaultView(role: string): ViewState {
  switch (normalizeRole(role)) {
    case "Employee":
      return { type: "material-search" };
    case "Manager":
      return { type: "manager-overview" };
    case "Procurement":
      return { type: "procurement-inbox" };
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
  const isManager = r === "Manager";
  const isEmployee = r === "Employee";
  const isProc = r === "Procurement";
  const isFinance = r === "Finance";

  return {
    canViewDashboard: isAdmin || isFinance || isProc,
    canViewManagerOverview: isManager,
    canViewMaterials: isAdmin || isProc,
    canManageCatalog: isAdmin || isProc,
    canViewCategories: isAdmin,
    canManageCategories: isAdmin,
    canSearchAndRequest: isEmployee || isManager,
    canViewRequests: isAdmin || isManager || isEmployee,
    canViewAlerts: isAdmin || isManager || isProc || isEmployee,
    canViewProcurement: isProc,
    canReceiveStock: isAdmin,
    canDeleteMaterial: isAdmin,
    canSubmitRequest: isEmployee || isManager,
    canRejectRequest: isAdmin || isManager,
    canManageTeam: isManager,
    canReleaseForIssue: isAdmin,
    canConfirmPickup: isAdmin || isManager || isEmployee,
    canRecordReturn: isAdmin || isManager || isEmployee,
    canManageUsers: isAdmin,
    canViewAdminBudget: isAdmin,
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
    case "manager-overview":
      return perms.canViewManagerOverview;
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
    case "team":
      return perms.canManageTeam;
    case "alerts":
      return perms.canViewAlerts;
    case "procurement-inbox":
      return perms.canViewProcurement;
    case "user-admin":
      return perms.canManageUsers;
    case "budget-admin":
      return perms.canViewAdminBudget;
    default:
      return false;
  }
}

export function getRoleSubtitle(role: string): string {
  switch (normalizeRole(role)) {
    case "Employee":
      return "Request materials, check limits, and get collection alerts.";
    case "Manager":
      return "Approve employee requests, manage your team, and request materials.";
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
