"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { GripVertical, Loader2, MapPin } from "lucide-react";
import { Badge } from "@/components/ui";
import { companyRegisterVisitHref } from "@/lib/constants/visit-workflow";
import {
  formatOpportunityAmount,
  OPPORTUNITY_STAGE_LABELS,
  OPPORTUNITY_STAGES,
  type OpportunityStage,
} from "@/lib/constants/opportunity-pipeline";
import { PRODUCT_FAMILY_LABELS } from "@/lib/constants/product-catalog";
import { groupOpportunitiesByStage } from "@/lib/opportunities/kanban";
import { updateOpportunityStageAction } from "../actions/opportunity-actions";
import type { OpportunityListItem } from "../services/opportunities.service";
import {
  OpportunityKanbanToast,
  type OpportunityKanbanToastVariant,
} from "./opportunity-kanban-toast";

interface OpportunityKanbanProps {
  items: OpportunityListItem[];
}

const OPPORTUNITY_DRAG_MIME = "application/x-eterya-opportunity-id";

function priorityVariant(probability: number | null) {
  if (probability == null) {
    return "muted" as const;
  }
  if (probability >= 70) {
    return "success" as const;
  }
  if (probability >= 40) {
    return "warning" as const;
  }
  return "danger" as const;
}

export function OpportunityKanban({ items }: OpportunityKanbanProps) {
  const router = useRouter();
  const [boardItems, setBoardItems] = useState(items);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTargetStage, setDropTargetStage] = useState<OpportunityStage | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; variant: OpportunityKanbanToastVariant } | null>(
    null
  );
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (!savingId) {
      setBoardItems(items);
    }
  }, [items, savingId]);

  const grouped = useMemo(() => groupOpportunitiesByStage(boardItems), [boardItems]);

  const dismissToast = useCallback(() => {
    setToast(null);
  }, []);

  const moveOpportunityStage = useCallback(
    async (opportunityId: string, companyId: string, nextStage: OpportunityStage) => {
      const current = boardItems.find((item) => item.id === opportunityId);
      if (!current || current.stage === nextStage) {
        return;
      }

      const previousItems = boardItems;
      setSavingId(opportunityId);
      setBoardItems((currentItems) =>
        currentItems.map((item) =>
          item.id === opportunityId ? { ...item, stage: nextStage } : item
        )
      );

      const result = await updateOpportunityStageAction(opportunityId, companyId, nextStage);
      setSavingId(null);

      if (result.success) {
        setToast({ message: result.message, variant: "success" });
        startTransition(() => {
          router.refresh();
        });
        return;
      }

      setBoardItems(previousItems);
      setToast({ message: result.message, variant: "error" });
    },
    [boardItems, router]
  );

  function handleDragStart(event: React.DragEvent<HTMLElement>, opportunityId: string) {
    event.dataTransfer.setData(OPPORTUNITY_DRAG_MIME, opportunityId);
    event.dataTransfer.effectAllowed = "move";
    setDraggingId(opportunityId);
  }

  function handleDragEnd() {
    setDraggingId(null);
    setDropTargetStage(null);
  }

  function handleColumnDragOver(event: React.DragEvent<HTMLDivElement>, stage: OpportunityStage) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDropTargetStage(stage);
  }

  function handleColumnDrop(event: React.DragEvent<HTMLDivElement>, stage: OpportunityStage) {
    event.preventDefault();
    setDropTargetStage(null);
    setDraggingId(null);

    const opportunityId = event.dataTransfer.getData(OPPORTUNITY_DRAG_MIME);
    if (!opportunityId) {
      return;
    }

    const item = boardItems.find((entry) => entry.id === opportunityId);
    if (!item) {
      return;
    }

    void moveOpportunityStage(item.id, item.company_id, stage);
  }

  return (
    <>
      <div className="overflow-x-auto pb-2">
        <div className="flex min-w-max gap-4">
          {OPPORTUNITY_STAGES.map((stage) => (
            <div
              key={stage}
              className={`w-72 shrink-0 rounded-xl border bg-slate-50/80 transition-colors ${
                dropTargetStage === stage
                  ? "border-indigo-300 bg-indigo-50/80 ring-2 ring-indigo-200"
                  : "border-slate-200"
              }`}
              onDragOver={(event) => handleColumnDragOver(event, stage)}
              onDragLeave={() => {
                if (dropTargetStage === stage) {
                  setDropTargetStage(null);
                }
              }}
              onDrop={(event) => handleColumnDrop(event, stage)}
            >
              <div className="border-b border-slate-200 px-3 py-3">
                <h3 className="text-sm font-semibold text-slate-900">
                  {OPPORTUNITY_STAGE_LABELS[stage]}
                </h3>
                <p className="text-xs text-slate-500">{grouped[stage].length} opportunità</p>
              </div>

              <div className="min-h-24 space-y-3 p-3">
                {grouped[stage].map((item) => {
                  const isDragging = draggingId === item.id;
                  const isSaving = savingId === item.id;

                  return (
                    <article
                      key={item.id}
                      draggable={!isSaving}
                      onDragStart={(event) => handleDragStart(event, item.id)}
                      onDragEnd={handleDragEnd}
                      className={`rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition-opacity ${
                        isDragging ? "opacity-40" : "opacity-100"
                      } ${isSaving ? "pointer-events-none" : ""}`}
                    >
                      <div className="flex items-start gap-2">
                        <button
                          type="button"
                          draggable={false}
                          aria-label="Trascina opportunità"
                          className="mt-0.5 cursor-grab rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 active:cursor-grabbing"
                          onMouseDown={(event) => event.stopPropagation()}
                        >
                          <GripVertical className="h-4 w-4" />
                        </button>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <Link
                              href={`/opportunities/${item.id}`}
                              draggable={false}
                              className="text-sm font-semibold text-slate-900 hover:text-indigo-700"
                            >
                              {item.title}
                            </Link>
                            {isSaving && (
                              <Loader2 className="h-4 w-4 shrink-0 animate-spin text-indigo-600" />
                            )}
                          </div>
                          {item.company_name && (
                            <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                              <Link
                                href={`/companies/${item.company_id}`}
                                draggable={false}
                                className="text-indigo-600 hover:underline"
                              >
                                {item.company_name}
                              </Link>
                              <Link
                                href={companyRegisterVisitHref(item.company_id)}
                                draggable={false}
                                className="inline-flex items-center gap-1 rounded-md border border-indigo-200 bg-indigo-50 px-2 py-0.5 font-medium text-indigo-700 hover:bg-indigo-100"
                              >
                                <MapPin className="h-3 w-3" />
                                Visita
                              </Link>
                            </p>
                          )}
                          {item.contact_name && (
                            <p className="mt-1 text-xs text-slate-500">
                              Referente: {item.contact_name}
                            </p>
                          )}
                          <Badge variant="info">{PRODUCT_FAMILY_LABELS[item.product_family]}</Badge>
                          {item.product_names.length > 0 && (
                            <p className="mt-1 text-xs text-slate-500">
                              {item.product_names.join(", ")}
                            </p>
                          )}
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium text-slate-800">
                              {formatOpportunityAmount(item.total_amount, item.currency)}
                            </span>
                            <Badge variant={priorityVariant(item.probability)}>
                              {item.probability ?? 0}%
                            </Badge>
                          </div>
                          {item.expected_close_at && (
                            <p className="mt-2 text-xs text-slate-500">
                              Chiusura prevista:{" "}
                              {new Date(item.expected_close_at).toLocaleDateString("it-IT")}
                            </p>
                          )}

                          <label className="mt-3 block text-xs text-slate-500">
                            Sposta fase
                            <select
                              value={item.stage}
                              disabled={Boolean(savingId)}
                              onChange={(event) =>
                                void moveOpportunityStage(
                                  item.id,
                                  item.company_id,
                                  event.target.value as OpportunityStage
                                )
                              }
                              className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1 text-sm text-slate-700"
                            >
                              {OPPORTUNITY_STAGES.map((option) => (
                                <option key={option} value={option}>
                                  {OPPORTUNITY_STAGE_LABELS[option]}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {toast ? (
        <OpportunityKanbanToast
          message={toast.message}
          variant={toast.variant}
          onDismiss={dismissToast}
        />
      ) : null}
    </>
  );
}
