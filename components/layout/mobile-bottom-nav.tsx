"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bot,
  Building2,
  CalendarDays,
  Menu,
  Route,
  Search,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/utils/cn";
import { MOBILE_FIELD_NAV_ITEMS } from "@/lib/constants/navigation";

const iconMap: Record<string, LucideIcon> = {
  Bot,
  Building2,
  CalendarDays,
  Menu,
  Route,
  Search,
};

interface MobileBottomNavProps {
  onMenuClick: () => void;
  onSearchClick?: () => void;
}

export function MobileBottomNav({ onMenuClick, onSearchClick }: MobileBottomNavProps) {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white safe-bottom lg:hidden"
      aria-label="Navigazione rapida"
    >
      <div className="flex items-stretch justify-around">
        {onSearchClick ? (
          <button
            type="button"
            onClick={onSearchClick}
            className="flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 px-1 text-[10px] font-medium text-slate-500"
          >
            <Search className="h-5 w-5" />
            Cerca
          </button>
        ) : null}
        {MOBILE_FIELD_NAV_ITEMS.map((item) => {
          const Icon = iconMap[item.icon];
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : item.href === "/joy-ai"
                ? pathname === "/joy-ai" || pathname.startsWith("/joy-ai/")
                : pathname === item.href || pathname.startsWith(`${item.href}/`);
          const isJoy = item.href === "/joy-ai";

          if (item.href === "__menu__") {
            return (
              <button
                key="menu"
                type="button"
                onClick={onMenuClick}
                className="flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 px-1 text-[10px] font-medium text-slate-500"
              >
                {Icon && <Icon className="h-5 w-5" />}
                Altro
              </button>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 px-1 text-[10px] font-medium transition-colors",
                isActive ? "text-indigo-600" : "text-slate-500"
              )}
            >
              <span
                className={cn(
                  "flex items-center justify-center",
                  isJoy &&
                    "-mt-3 mb-0.5 h-12 w-12 rounded-full bg-indigo-600 text-white shadow-md ring-4 ring-white"
                )}
              >
                {Icon && <Icon className={isJoy ? "h-6 w-6" : "h-5 w-5"} />}
              </span>
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
