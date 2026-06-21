import React from "react";
import { RefreshCw, LucideIcon } from "lucide-react";

export function PremiumPageHeader({
  icon: Icon,
  title,
  subtitle,
  onRefresh,
  loading,
  badge,
  children,
}: {
  icon?: LucideIcon;
  title: string;
  subtitle?: string;
  onRefresh?: () => void;
  loading?: boolean;
  badge?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#006039] via-[#005030] to-[#003d24] p-6 text-white shadow-lg shadow-[#006039]/20">
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMyI+PHBhdGggIGQ9Ik0zNiAzNGg0djRoLTR6TTAgMzRoNHY0SDB6TTAgMGg0djRIMHoiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-60" />
      <div className="relative flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4 min-w-0">
          {Icon && (
            <div className="shrink-0 w-12 h-12 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center shadow-inner">
              <Icon className="w-6 h-6 text-[#e2b007]" />
            </div>
          )}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight">{title}</h2>
              {badge}
            </div>
            {subtitle && <p className="text-sm text-white/75 mt-1 max-w-xl leading-relaxed">{subtitle}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {children}
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              className="group flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-sm font-semibold transition-all duration-200 cursor-pointer backdrop-blur-sm"
            >
              <RefreshCw className={`w-4 h-4 transition-transform group-hover:rotate-180 duration-500 ${loading ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">{loading ? "Refreshing…" : "Refresh"}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function PremiumPanel({
  title,
  subtitle,
  icon: Icon,
  badge,
  children,
  className = "",
  noPadding,
}: {
  title?: string;
  subtitle?: string;
  icon?: LucideIcon;
  badge?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  noPadding?: boolean;
}) {
  return (
    <div className={`premium-surface overflow-hidden ${className}`}>
      {title && (
        <div className="premium-surface-header flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {Icon && <Icon className="w-4 h-4 text-[#006039] shrink-0" />}
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-slate-800 truncate">{title}</h3>
              {subtitle && <p className="text-[11px] text-slate-500 truncate">{subtitle}</p>}
            </div>
          </div>
          {badge}
        </div>
      )}
      <div className={noPadding ? "" : "p-4 sm:p-5"}>{children}</div>
    </div>
  );
}

export function PremiumEmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-50 border border-slate-200/80 flex items-center justify-center mb-4 shadow-inner">
        <Icon className="w-8 h-8 text-slate-400" />
      </div>
      <p className="font-semibold text-slate-700 text-sm">{title}</p>
      {description && <p className="text-xs text-slate-400 mt-1 max-w-xs leading-relaxed">{description}</p>}
    </div>
  );
}

export function PremiumFormCard({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon?: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <div className="premium-surface overflow-hidden transition-shadow duration-300 hover:shadow-md">
      <div className="px-5 py-3.5 bg-gradient-to-r from-[#006039]/5 via-white to-[#e2b007]/5 border-b border-slate-100 flex items-center gap-2">
        {Icon && (
          <span className="w-8 h-8 rounded-lg bg-[#006039]/10 flex items-center justify-center">
            <Icon className="w-4 h-4 text-[#006039]" />
          </span>
        )}
        <h3 className="font-semibold text-slate-800 text-sm">{title}</h3>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

export const premiumInput =
  "border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#006039]/25 focus:border-[#006039]/40 transition-all placeholder:text-slate-400";

export const premiumSelect = premiumInput;

export const premiumBtnPrimary =
  "px-4 py-2.5 bg-[#006039] hover:bg-[#004d2e] text-white text-sm font-semibold rounded-xl cursor-pointer transition-all duration-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:hover:translate-y-0";

export const premiumBtnSecondary =
  "px-4 py-2.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-sm font-semibold rounded-xl cursor-pointer transition-all duration-200";

export const premiumBtnDanger =
  "px-4 py-2.5 border-2 border-rose-400/80 text-rose-600 hover:bg-rose-50 text-sm font-semibold rounded-xl cursor-pointer transition-all duration-200";
