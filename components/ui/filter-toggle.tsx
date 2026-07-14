"use client";

import { useState } from "react";
import { ChevronDown, Filter } from "lucide-react";
import { cn } from "@/utils/cn";

interface FilterToggleProps {
  activeCount?: number;
  children: React.ReactNode;
  className?: string;
}

/** Barra filtri collassabile su mobile per ridurre lo scroll iniziale. */
export function FilterToggle({ activeCount = 0, children, className }: FilterToggleProps) {
  const [open, setOpen] = useState(false);
  const label =
    activeCount > 0 ? `Filtri (${activeCount} attivi)` : "Filtri";

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="mb-0 flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900 shadow-sm md:hidden"
        aria-expanded={open}
      >
        <span className="inline-flex items-center gap-2">
          <Filter className="h-4 w-4 text-indigo-600" />
          {label}
        </span>
        <ChevronDown
          className={cn("h-4 w-4 text-slate-500 transition-transform", open && "rotate-180")}
        />
      </button>
      <div className={cn("md:block", open ? "block" : "hidden md:block")}>{children}</div>
    </div>
  );
}
