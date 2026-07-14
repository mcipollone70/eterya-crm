"use client";

import { useState } from "react";
import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { MobileBottomNav } from "./mobile-bottom-nav";
import { cn } from "@/utils/cn";

interface DashboardShellProps {
  children: React.ReactNode;
  userEmail?: string | null;
}

export function DashboardShell({ children, userEmail }: DashboardShellProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <div className="hidden lg:block">
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed((prev) => !prev)}
        />
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            onClick={() => setMobileOpen(false)}
            aria-label="Chiudi menu"
          />
          <div className="relative z-50 h-full w-64">
            <Sidebar onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex flex-1 flex-col overflow-hidden">
        <Header onMenuClick={() => setMobileOpen(true)} userEmail={userEmail} />
        <main className={cn("flex-1 overflow-y-auto p-3 pb-24 sm:p-4 sm:pb-24 lg:p-6 lg:pb-6")}>
          {children}
        </main>
        <MobileBottomNav onMenuClick={() => setMobileOpen(true)} />
      </div>
    </div>
  );
}
