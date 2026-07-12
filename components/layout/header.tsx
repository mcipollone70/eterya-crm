"use client";

import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { PAGE_TITLES } from "@/lib/constants/navigation";
import { Avatar } from "@/components/ui";
import { SignOutButton } from "@/features/auth/components/sign-out-button";

interface HeaderProps {
  onMenuClick?: () => void;
  userEmail?: string | null;
}

export function Header({ onMenuClick, userEmail }: HeaderProps) {
  const pathname = usePathname();
  const title = PAGE_TITLES[pathname] ?? "Eterya CRM";

  const today = new Intl.DateTimeFormat("it-IT", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 lg:px-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onMenuClick}
          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden"
          aria-label="Apri menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-lg font-semibold text-slate-900">{title}</h1>
          <p className="hidden text-xs capitalize text-slate-500 sm:block">
            {today}
          </p>
        </div>
      </div>

      {userEmail && (
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Avatar name={userEmail} size="sm" />
            <span className="hidden max-w-[180px] truncate text-sm text-slate-600 sm:inline">
              {userEmail}
            </span>
          </div>
          <SignOutButton />
        </div>
      )}
    </header>
  );
}
