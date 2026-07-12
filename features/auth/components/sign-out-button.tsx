"use client";

import { LogOut } from "lucide-react";
import { signOutAction } from "../actions/auth";

export function SignOutButton() {
  return (
    <form action={signOutAction}>
      <button
        type="submit"
        className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
        title="Esci"
      >
        <LogOut className="h-4 w-4" />
        <span className="hidden sm:inline">Esci</span>
      </button>
    </form>
  );
}
