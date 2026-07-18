import Link from "next/link";
import { ArrowRight, Bot, Sparkles } from "lucide-react";
import { Button } from "@/components/ui";
import { DashboardWidgetShell } from "./dashboard-widget-shell";

interface JoyAiWidgetProps {
  suggestions: string[];
  summary?: string | null;
}

export function JoyAiWidget({ suggestions, summary }: JoyAiWidgetProps) {
  const tip =
    summary?.trim() ||
    suggestions[0] ||
    "Apri Joy per priorità, coaching e azioni su dati CRM reali.";

  return (
    <DashboardWidgetShell
      title="JOY Command Center"
      icon={<Bot className="h-4 w-4 text-violet-600" />}
      action={
        <Link href="/joy-ai">
          <Button variant="ghost" size="sm" className="h-8 gap-1 text-indigo-600">
            Apri Joy
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </Link>
      }
    >
      <div className="mb-4 flex items-start gap-3 rounded-xl border border-violet-100 bg-gradient-to-r from-violet-50 to-indigo-50 px-4 py-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-600 text-white">
          <Sparkles className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-800">Sintesi operativa</p>
          <p className="mt-1 text-sm text-slate-600">{tip}</p>
        </div>
      </div>

      <Link href="/joy-ai" className="block">
        <Button className="min-h-11 w-full gap-2">
          <Bot className="h-4 w-4" />
          Apri Joy
        </Button>
      </Link>
    </DashboardWidgetShell>
  );
}
