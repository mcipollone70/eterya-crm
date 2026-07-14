"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  Car,
  MapPin,
  Menu,
  Mic,
  Search,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/utils/cn";
import { MOBILE_FIELD_NAV_ITEMS } from "@/lib/constants/navigation";

const iconMap: Record<string, LucideIcon> = {
  CalendarDays,
  Car,
  MapPin,
  Mic,
  Menu,
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
              : pathname === item.href || pathname.startsWith(`${item.href}/`);

          if (item.href === "__menu__") {
            return (
              <button
                key="menu"
                type="button"
                onClick={onMenuClick}
                className="flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 px-1 text-[10px] font-medium text-slate-500"
              >
                {Icon && <Icon className="h-5 w-5" />}
                Menu
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
              {Icon && <Icon className="h-5 w-5" />}
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
