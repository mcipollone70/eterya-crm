import Link from "next/link";
import { Bot } from "lucide-react";
import { cn } from "@/utils/cn";

interface JoyAiPageLinkProps {
  companyId?: string;
  prompt?: string;
  className?: string;
}

export function JoyAiPageLink({ companyId, prompt, className }: JoyAiPageLinkProps) {
  const params = new URLSearchParams();
  if (companyId) {
    params.set("company", companyId);
  }
  if (prompt) {
    params.set("q", prompt);
  }
  const href = params.toString() ? `/joy-ai?${params.toString()}` : "/joy-ai";

  return (
    <Link
      href={href}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-lg border border-indigo-200 bg-white px-3 text-xs font-medium text-indigo-700 transition-colors hover:bg-indigo-50",
        className
      )}
    >
      <Bot className="h-4 w-4" />
      Joy AI
    </Link>
  );
}
