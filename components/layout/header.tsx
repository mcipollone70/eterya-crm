"use client";

import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { PAGE_TITLES } from "@/lib/constants/navigation";
import { Avatar } from "@/components/ui";
import { SignOutButton } from "@/features/auth/components/sign-out-button";
import { SearchTrigger } from "./command-palette";

interface HeaderProps {
  onMenuClick?: () => void;
  onSearchClick?: () => void;
  userEmail?: string | null;
}

export function Header({ onMenuClick, onSearchClick, userEmail }: HeaderProps) {
  const pathname = usePathname();
  const title = PAGE_TITLES[pathname] ?? "Eterya CRM";

  const today = new Intl.DateTimeFormat("it-IT", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());

  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 lg:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onMenuClick}
          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden"
          aria-label="Apri menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold text-slate-900">{title}</h1>
          <p className="hidden text-xs capitalize text-slate-500 sm:block">
            {today}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        {onSearchClick ? (
          <>
            <SearchTrigger onClick={onSearchClick} className="hidden sm:inline-flex" />
            <SearchTrigger onClick={onSearchClick} compact className="sm:hidden" />
          </>
        ) : null}

        {userEmail && (
          <>
            <div className="hidden items-center gap-2 md:flex">
              <Avatar name={userEmail} size="sm" />
              <span className="hidden max-w-[180px] truncate text-sm text-slate-600 lg:inline">
                {userEmail}
              </span>
            </div>
            <SignOutButton />
          </>
        )}
      </div>
    </header>
  );
}
