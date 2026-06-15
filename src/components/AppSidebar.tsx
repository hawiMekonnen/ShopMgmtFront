import React from "react";
import {
  LayoutDashboard,
  Boxes,
  Layers,
  Search,
  ClipboardList,
  Bell,
  Package,
  Warehouse,
  Users,
  Info,
  LayoutGrid,
  DollarSign,
} from "lucide-react";
import { AuthSession, ViewState } from "../types";
import { getNavItemsForRole, getRoleSubtitle, NavItem } from "../roleConfig";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  dashboard: LayoutDashboard,
  "manager-overview": LayoutGrid,
  "material-search": Search,
  "material-search-mgr": Search,
  "material-requests": ClipboardList,
  materials: Boxes,
  alerts: Bell,
  "procurement-inbox": Package,
  categories: Layers,
  team: Users,
  "user-admin": Users,
  "budget-admin": DollarSign,
};

function isNavActive(item: NavItem, currentView: ViewState): boolean {
  if (item.activeWhen) return item.activeWhen(currentView);
  return currentView.type === item.view;
}

interface AppSidebarProps {
  session: AuthSession;
  currentView: ViewState;
  onNavigate: (view: ViewState) => void;
  lastUpdated?: string;
  alertBadgeCount?: number;
  pendingApprovalCount?: number;
}

export default function AppSidebar({ session, currentView, onNavigate, lastUpdated, alertBadgeCount = 0, pendingApprovalCount = 0 }: AppSidebarProps) {
  const items = getNavItemsForRole(session.role);

  return (
    <aside className="w-full md:w-64 md:shrink-0 flex flex-col gap-2 mb-4 md:mb-0">
      <div className="bg-[#006039]/5 border border-[#006039]/20 rounded-xl px-3 py-2 hidden md:block">
        <p className="text-[10px] font-bold text-[#006039] uppercase tracking-wide">{session.role} workspace</p>
        <p className="text-[11px] text-slate-600 mt-0.5 leading-snug">{getRoleSubtitle(session.role)}</p>
      </div>

      <nav className="bg-white rounded-xl shadow-xs border border-slate-200 p-2 flex flex-row md:flex-col gap-1 overflow-x-auto md:overflow-visible">
        {items.map((item) => {
          const Icon = ICONS[item.id] ?? Boxes;
          const active = isNavActive(item, currentView);
          return (
            <button
              key={item.id}
              id={`sidebar-nav-${item.id}`}
              type="button"
              onClick={() => onNavigate({ type: item.view } as ViewState)}
              className={`flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors whitespace-nowrap w-full focus:outline-none ${
                active
                  ? "bg-[#006039]/10 text-[#006039] border-r-4 border-[#006039]"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="flex-1 text-left">{item.label}</span>
              {item.id === "alerts" && alertBadgeCount > 0 && (
                <span className="min-w-[1.25rem] h-5 px-1.5 flex items-center justify-center rounded-full bg-[#e2b007] text-[#006039] text-[10px] font-bold">
                  {alertBadgeCount > 99 ? "99+" : alertBadgeCount}
                </span>
              )}
              {item.badgeKey === "pendingApprovals" && pendingApprovalCount > 0 && (
                <span className="min-w-[1.25rem] h-5 px-1.5 flex items-center justify-center rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">
                  {pendingApprovalCount > 99 ? "99+" : pendingApprovalCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="bg-slate-100 rounded-xl p-4 border border-slate-200 mt-auto hidden md:block">
        <div className="flex gap-2 items-start text-xs text-slate-500">
          <Info className="w-4 h-4 shrink-0 mt-0.5 text-emerald-700" />
          <div>
            <p className="font-semibold text-slate-700">Your menu is role-based</p>
            <p className="mt-1 leading-relaxed">
              Screens not listed here are hidden for {session.role} users. Sign in with another role to see other workflows.
            </p>
          </div>
        </div>
        {lastUpdated && (
          <p className="text-[10px] text-slate-400 mt-3 font-mono">Last refreshed: {lastUpdated}</p>
        )}
      </div>
    </aside>
  );
}
