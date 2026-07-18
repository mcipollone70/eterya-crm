"use client";

import {
  Check,
  HelpCircle,
  MapPin,
  Pencil,
  Play,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui";
import type {
  JoyCommandCenterCard,
  JoyCommandCenterFreeTimeItem,
  JoyCommandCenterSnapshot,
  JoyCommandCenterStrategyChip,
  JoyDayOpsState,
} from "@/features/joy/os/client";

const URGENCY_TONE: Record<string, string> = {
  critical: "border-rose-300 bg-rose-50 text-rose-900",
  high: "border-amber-300 bg-amber-50 text-amber-950",
  medium: "border-sky-200 bg-sky-50 text-sky-950",
  low: "border-slate-200 bg-slate-50 text-slate-800",
};

interface JoyCommandCenterPanelProps {
  snapshot: JoyCommandCenterSnapshot | null;
  loading: boolean;
  dayOps: JoyDayOpsState | null;
  dayOpsBrief: string | null;
  onPrompt: (prompt: string) => void;
  onIgnoreCard: (id: string) => void;
  onResumeDay: () => void;
  onEditDay: () => void;
  onClearDay: () => void;
  dismissedIds: Set<string>;
}

function MetaRow({ card }: { card: JoyCommandCenterCard }) {
  const bits = [
    card.urgency,
    card.distanceKm != null ? `${card.distanceKm.toFixed(1)} km` : null,
    card.timeHint,
    card.commercialValueEur != null
      ? `~€${Math.round(card.commercialValueEur)}`
      : null,
  ].filter(Boolean);

  return bits.length > 0 ? (
    <p className="mt-1 text-[11px] text-slate-500">{bits.join(" · ")}</p>
  ) : null;
}

function AdviceCard({
  card,
  onPrompt,
  onIgnore,
}: {
  card: JoyCommandCenterCard;
  onPrompt: (prompt: string) => void;
  onIgnore: () => void;
}) {
  return (
    <article
      className={`rounded-xl border p-3 ${URGENCY_TONE[card.urgency] ?? URGENCY_TONE.medium}`}
    >
      <p className="text-sm font-semibold leading-snug">{card.title}</p>
      <p className="mt-1 text-xs opacity-90">{card.reason}</p>
      <MetaRow card={card} />
      <div className="mt-2 flex flex-wrap gap-1.5">
        <Button
          type="button"
          size="sm"
          className="min-h-9 rounded-lg px-2.5 text-xs"
          onClick={() => onPrompt(card.action)}
        >
          <Play className="h-3.5 w-3.5" />
          Esegui
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="min-h-9 rounded-lg px-2.5 text-xs"
          onClick={() => onPrompt(card.explainPrompt)}
        >
          <HelpCircle className="h-3.5 w-3.5" />
          Spiegami
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="min-h-9 rounded-lg px-2.5 text-xs"
          onClick={onIgnore}
        >
          <X className="h-3.5 w-3.5" />
          Ignora
        </Button>
      </div>
    </article>
  );
}

function FreeTimeCard({
  item,
  onPrompt,
}: {
  item: JoyCommandCenterFreeTimeItem;
  onPrompt: (prompt: string) => void;
}) {
  return (
    <article className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-3">
      <p className="text-sm font-semibold text-emerald-950">{item.title}</p>
      <p className="mt-1 text-xs text-emerald-900/80">{item.reason}</p>
      <p className="mt-1 text-[11px] text-emerald-700">~{item.estimatedMinutes} min</p>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="mt-2 min-h-9 rounded-lg border-emerald-300 bg-white px-2.5 text-xs"
        onClick={() => onPrompt(item.prompt)}
      >
        <MapPin className="h-3.5 w-3.5" />
        Usa slot
      </Button>
    </article>
  );
}

function StrategyChip({
  chip,
  onPrompt,
}: {
  chip: JoyCommandCenterStrategyChip;
  onPrompt: (prompt: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onPrompt(chip.prompt)}
      className="min-h-10 rounded-full border border-indigo-200 bg-white px-3 py-1.5 text-left text-xs font-medium text-indigo-900 transition hover:bg-indigo-50"
    >
      {chip.label}
    </button>
  );
}

function EmptyHint({
  text,
  actionLabel,
  onAction,
  className,
}: {
  text: string;
  actionLabel: string;
  onAction: () => void;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-3 py-3 ${className ?? ""}`}
    >
      <p className="text-xs text-slate-600">{text}</p>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="mt-2 min-h-9 rounded-lg px-2.5 text-xs"
        onClick={onAction}
      >
        {actionLabel}
      </Button>
    </div>
  );
}

export function JoyCommandCenterPanel({
  snapshot,
  loading,
  dayOps,
  dayOpsBrief,
  onPrompt,
  onIgnoreCard,
  onResumeDay,
  onEditDay,
  onClearDay,
  dismissedIds,
}: JoyCommandCenterPanelProps) {
  if (loading && !snapshot) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500">
        Carico il quadro operativo Joy…
      </div>
    );
  }

  if (!snapshot) {
    return null;
  }

  const advice = snapshot.adviceNow.filter((card) => !dismissedIds.has(card.id));
  const freeTime = snapshot.freeTime.filter((item) => !dismissedIds.has(item.id));

  return (
    <div className="space-y-4">
      {snapshot.error ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {snapshot.error}. Puoi comunque parlare con Joy o usare i pulsanti sotto.
        </p>
      ) : null}

      <section className="rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50 via-white to-slate-50 p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-indigo-700">
          Inizia la giornata
        </p>
        <h3 className="mt-1 text-base font-semibold text-slate-900">
          {snapshot.dayStart.headline}
        </h3>
        <p className="mt-1 text-sm text-slate-700">{snapshot.dayStart.recommendation}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            className="min-h-10 rounded-xl"
            onClick={() => onPrompt(snapshot.dayStart.followPrompt)}
          >
            <Check className="h-4 w-4" />
            Segui
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="min-h-10 rounded-xl"
            onClick={() => onPrompt(snapshot.dayStart.organizePrompt)}
          >
            Organizza diversamente
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="min-h-10 rounded-xl"
            onClick={() => onPrompt("Parla con Joy")}
          >
            Parla
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="min-h-10 rounded-xl"
            onClick={() => onIgnoreCard("day-start")}
          >
            Ignora
          </Button>
        </div>
      </section>

      {dayOpsBrief || (dayOps && dayOps.slots.length > 0) ? (
        <section className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-slate-600">
              <span className="font-semibold text-slate-800">Memoria giorno</span>
              {dayOpsBrief ? ` — ${dayOpsBrief}` : null}
            </p>
            <div className="flex flex-wrap gap-1">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-8 rounded-lg px-2 text-[11px]"
                onClick={onResumeDay}
              >
                <RotateCcw className="h-3 w-3" />
                Riprendi
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-8 rounded-lg px-2 text-[11px]"
                onClick={onEditDay}
              >
                <Pencil className="h-3 w-3" />
                Modifica
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-8 rounded-lg px-2 text-[11px] text-rose-600"
                onClick={onClearDay}
              >
                <Trash2 className="h-3 w-3" />
                Cancella
              </Button>
            </div>
          </div>
        </section>
      ) : null}

      <section>
        <h3 className="mb-2 text-sm font-semibold text-slate-900">Ti consiglio adesso</h3>
        {advice.length > 0 ? (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {advice.map((card) => (
              <AdviceCard
                key={card.id}
                card={card}
                onPrompt={onPrompt}
                onIgnore={() => onIgnoreCard(card.id)}
              />
            ))}
          </div>
        ) : (
          <EmptyHint
            text="Nessun consiglio urgente dai dati CRM di oggi. Avvia la giornata o organizza il giro."
            actionLabel="Inizia la giornata"
            onAction={() => onPrompt(snapshot.dayStart.followPrompt)}
          />
        )}
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold text-slate-900">Priorità di oggi</h3>
        {snapshot.prioritiesToday.length > 0 ? (
          <ul className="space-y-1.5">
            {snapshot.prioritiesToday.slice(0, 5).map((card, index) => (
              <li key={card.id}>
                <button
                  type="button"
                  onClick={() => onPrompt(card.action)}
                  className="flex w-full items-start gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm transition hover:border-indigo-200 hover:bg-indigo-50/40"
                >
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-[11px] font-bold text-indigo-700">
                    {index + 1}
                  </span>
                  <span className="min-w-0">
                    <span className="font-medium text-slate-900">{card.title}</span>
                    <span className="mt-0.5 block text-xs text-slate-500">{card.reason}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyHint
            text="Nessuna priorità calcolata: agenda e pipeline potrebbero essere vuote."
            actionLabel="Organizza il giro"
            onAction={() => onPrompt("Organizza il giro di oggi")}
          />
        )}
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold text-slate-900">Tempo libero utile</h3>
        {freeTime.length > 0 ? (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {freeTime.map((item) => (
              <FreeTimeCard key={item.id} item={item} onPrompt={onPrompt} />
            ))}
          </div>
        ) : (
          <EmptyHint
            text="Nessuno slot libero utile rilevato nell’agenda di oggi."
            actionLabel="Apri Agenda"
            onAction={() => onPrompt("Mostra la mia agenda di oggi")}
          />
        )}
      </section>

      <section className="rounded-xl border border-violet-200 bg-violet-50/70 p-3">
        <h3 className="text-sm font-semibold text-violet-950">Prossima azione</h3>
        {snapshot.nextAction ? (
          <>
            <p className="mt-1 text-sm text-violet-900">{snapshot.nextAction.action}</p>
            <p className="mt-1 text-xs text-violet-800/80">{snapshot.nextAction.reason}</p>
            <MetaRow card={snapshot.nextAction} />
            <Button
              type="button"
              size="sm"
              className="mt-2 min-h-10 rounded-xl"
              onClick={() => onPrompt(snapshot.nextAction!.action)}
            >
              <Play className="h-4 w-4" />
              Esegui
            </Button>
          </>
        ) : (
          <EmptyHint
            text="Nessuna prossima azione suggerita. Parla con Joy o registra una visita."
            actionLabel="Parla con Joy"
            onAction={() => onPrompt("Parla con Joy")}
            className="mt-2 border-violet-200 bg-white/80"
          />
        )}
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold text-slate-900">Strategia commerciale</h3>
        {snapshot.strategyChips.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {snapshot.strategyChips.map((chip) => (
              <StrategyChip key={chip.id} chip={chip} onPrompt={onPrompt} />
            ))}
          </div>
        ) : (
          <EmptyHint
            text="Strategia non disponibile al momento. Riprova dopo il caricamento dei dati CRM."
            actionLabel="Come vendiamo di più oggi?"
            onAction={() => onPrompt("Come vendiamo di più oggi?")}
          />
        )}
      </section>
    </div>
  );
}
