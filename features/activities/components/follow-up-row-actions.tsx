"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarClock, Check, Loader2, MapPin } from "lucide-react";
import { Button } from "@/components/ui";
import { companyRegisterVisitHref } from "@/lib/constants/visit-workflow";
import { completeFollowUpAction, postponeFollowUpAction } from "../actions/follow-up-actions";

interface FollowUpRowActionsProps {
  followUpId: string;
  companyId: string;
  canAct: boolean;
}

export function FollowUpRowActions({
  followUpId,
  companyId,
  canAct,
}: FollowUpRowActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  if (!canAct) {
    return (
      <Link
        href={companyRegisterVisitHref(companyId)}
        className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50"
      >
        <MapPin className="h-3.5 w-3.5" />
        Visita
      </Link>
    );
  }

  function handleComplete() {
    startTransition(async () => {
      await completeFollowUpAction(followUpId, companyId);
      router.refresh();
    });
  }

  function handlePostpone() {
    startTransition(async () => {
      await postponeFollowUpAction(followUpId, companyId);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Link
        href={companyRegisterVisitHref(companyId)}
        className="inline-flex h-8 items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-3 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
      >
        <MapPin className="h-3.5 w-3.5" />
        Visita
      </Link>
      <Button type="button" size="sm" disabled={isPending} onClick={handleComplete}>
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
        Completa
      </Button>
      <Button type="button" size="sm" variant="outline" disabled={isPending} onClick={handlePostpone}>
        <CalendarClock className="h-4 w-4" />
        Rimanda
      </Button>
    </div>
  );
}
