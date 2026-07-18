"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  Users,
  CheckSquare,
  CalendarDays,
  MapPin,
  Map,
  Route,
  Mic,
  Target,
  Package,
  BarChart3,
  FileBarChart,
  LineChart,
  CalendarRange,
  Bell,
  ShieldCheck,
  DatabaseBackup,
  History,
  Settings,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  FileUp,
  FileText,
  ShoppingCart,
  Boxes,
  LifeBuoy,
  FolderOpen,
  Car,
  Bot,
  Shield,
  BookOpen,
  Radar,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/utils/cn";
import { ADMIN_NAV_ITEMS, APP_NAME, NAV_BOTTOM, NAV_ITEMS } from "@/lib/constants/navigation";

const iconMap: Record<string, LucideIcon> = {
  LayoutDashboard,
  Building2,
  Users,
  CheckSquare,
  CalendarDays,
  MapPin,
  Map,
  Route,
  Mic,
  Target,
  Package,
  BarChart3,
  FileBarChart,
  LineChart,
  CalendarRange,
  Bell,
  ShieldCheck,
  DatabaseBackup,
  History,
  Settings,
  FileUp,
  FileText,
  ShoppingCart,
  Boxes,
  LifeBuoy,
  FolderOpen,
  Sparkles,
  Car,
  Bot,
  Shield,
  BookOpen,
  Radar,
};

function isNavActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  if (pathname === href) return true;

  const hasChildNavRoute = NAV_ITEMS.some(
    (item) => item.href !== href && item.href.startsWith(`${href}/`)
  );
  if (hasChildNavRoute) return false;

  return pathname.startsWith(`${href}/`);
}

interface SidebarProps {
  collapsed?: boolean;
  onToggle?: () => void;
  onNavigate?: () => void;
  showAdminNav?: boolean;
}

export function Sidebar({
  collapsed = false,
  onToggle,
  onNavigate,
  showAdminNav = false,
}: SidebarProps) {
  const pathname = usePathname();
  const adminItems = showAdminNav ? ADMIN_NAV_ITEMS : [];

  return (
    <aside
      className={cn(
        "flex h-full flex-col border-r border-slate-800 bg-slate-950 text-slate-300 transition-all duration-300",
        collapsed ? "w-[68px]" : "w-64"
      )}
    >
      <div className="flex h-16 items-center gap-3 border-b border-slate-800 px-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-600">
          <Sparkles className="h-5 w-5 text-white" />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-white">{APP_NAME}</p>
            <p className="truncate text-[10px] text-slate-500">Field Sales CRM</p>
          </div>
        )}
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
        {NAV_ITEMS.map((item, index) => {
          const Icon = iconMap[item.icon];
          const isActive = isNavActive(pathname, item.href);
          const showSectionLabel =
            !collapsed &&
            item.section != null &&
            item.section !== NAV_ITEMS[index - 1]?.section;

          return (
            <div key={item.href}>
              {showSectionLabel && (
                <p className="px-3 pb-1 pt-4 text-[10px] font-semibold uppercase tracking-wider text-slate-600 first:pt-0">
                  {item.section}
                </p>
              )}
              {collapsed && item.section != null && item.section !== NAV_ITEMS[index - 1]?.section && index > 0 && (
                <div className="my-2 border-t border-slate-800" />
              )}
              <Link
                href={item.href}
                onClick={onNavigate}
                className={cn(
                  "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-indigo-600/20 text-indigo-300"
                    : "text-slate-400 hover:bg-slate-800 hover:text-white"
                )}
                title={collapsed ? item.label : undefined}
              >
                {Icon && <Icon className="h-[18px] w-[18px] shrink-0" />}
                {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
              </Link>
            </div>
          );
        })}
      </nav>

      <div className="shrink-0 border-t border-slate-800 px-3 py-3">
        {adminItems.length > 0 && (
          <div className="mb-1 max-h-48 overflow-y-auto">
            {!collapsed && (
              <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-600">
                Amministrazione
              </p>
            )}
            {adminItems.map((item) => {
              const Icon = iconMap[item.icon];
              const isActive = isNavActive(pathname, item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  className={cn(
                    "mb-1 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-indigo-600/20 text-indigo-300"
                      : "text-slate-400 hover:bg-slate-800 hover:text-white"
                  )}
                  title={collapsed ? item.label : undefined}
                >
                  {Icon && <Icon className="h-[18px] w-[18px] shrink-0" />}
                  {!collapsed && <span>{item.label}</span>}
                </Link>
              );
            })}
          </div>
        )}

        {NAV_BOTTOM.map((item) => {
          const Icon = iconMap[item.icon];
          const isActive = isNavActive(pathname, item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-indigo-600/20 text-indigo-300"
                  : "text-slate-400 hover:bg-slate-800 hover:text-white"
              )}
              title={collapsed ? item.label : undefined}
            >
              {Icon && <Icon className="h-[18px] w-[18px] shrink-0" />}
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}

        {onToggle && (
          <button
            type="button"
            onClick={onToggle}
            className="mt-2 flex w-full items-center justify-center rounded-lg py-2 text-slate-500 transition-colors hover:bg-slate-800 hover:text-white"
            aria-label={collapsed ? "Espandi menu" : "Comprimi menu"}
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </button>
        )}
      </div>
    </aside>
  );
}
