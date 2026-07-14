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
  Settings,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  FileUp,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/utils/cn";
import { APP_NAME, NAV_BOTTOM, NAV_ITEMS } from "@/lib/constants/navigation";

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
  Settings,
  FileUp,
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
}

export function Sidebar({ collapsed = false, onToggle }: SidebarProps) {
  const pathname = usePathname();

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

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {NAV_ITEMS.map((item) => {
          const Icon = iconMap[item.icon];
          const isActive = isNavActive(pathname, item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
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
          );
        })}
      </nav>

      <div className="border-t border-slate-800 px-3 py-3">
        {NAV_BOTTOM.map((item) => {
          const Icon = iconMap[item.icon];
          const isActive = isNavActive(pathname, item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
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
