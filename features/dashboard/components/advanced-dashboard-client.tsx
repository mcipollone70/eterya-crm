"use client";

import Link from "next/link";
import { useCallback, useMemo, useState, useTransition } from "react";
import {
  CalendarDays,
  Clock3,
  GripVertical,
  LayoutDashboard,
  Loader2,
  Route,
  Save,
  Settings2,
  Target,
} from "lucide-react";
import { formatVisitDateShort } from "@/lib/last-visit/format";
import { formatOpportunityAmount } from "@/lib/constants/opportunity-pipeline";
import {
  hasActiveDashboardFilters,
  type CommercialDashboardFilters,
} from "@/lib/constants/dashboard-filters";
import { resolveDashboardPeriodRange } from "../utils/dashboard-period";
import { saveDashboardLayoutAction } from "../actions/dashboard-layout-actions";
import { DASHBOARD_WIDGETS } from "../constants/dashboard-widgets";
import type {
  CommercialDashboardData,
  DashboardLayoutState,
  DashboardWidgetId,
} from "../types/commercial-dashboard";
import { DashboardBarChart } from "./dashboard-bar-chart";
import { DashboardKpiCard } from "./dashboard-kpi-card";

interface AdvancedDashboardClientProps {
  data: CommercialDashboardData;
  initialLayout: DashboardLayoutState;
  filters: CommercialDashboardFilters;
}

function WidgetShell({
  id,
  title,
  href,
  children,
  customizeMode,
  hidden,
  onToggleHidden,
}: {
  id: DashboardWidgetId;
  title: string;
  href?: string;
  children: React.ReactNode;
  customizeMode: boolean;
  hidden: boolean;
  onToggleHidden: () => void;
}) {
  const content = (
    <div
      className={`relative rounded-xl border border-slate-200 bg-white p-4 shadow-sm ${
        hidden ? "opacity-50" : ""
      }`}
    >
      {customizeMode && (
        <>
          <span className="absolute left-3 top-3 cursor-grab text-slate-300">
            <GripVertical className="h-4 w-4" />
          </span>
          <button
            type="button"
            onClick={onToggleHidden}
            className="absolute right-3 top-3 rounded px-2 py-0.5 text-[10px] font-medium text-slate-500 hover:bg-slate-100"
          >
            {hidden ? "Mostra" : "Nascondi"}
          </button>
        </>
      )}
      <h3 className="mb-3 text-sm font-semibold text-slate-900">{title}</h3>
      {children}
    </div>
  );

  if (customizeMode || !href) {
    return <div data-widget-id={id}>{content}</div>;
  }

  return (
    <Link href={href} className="block transition-shadow hover:shadow-md" data-widget-id={id}>
      {content}
    </Link>
  );
}

function ListWidget<T extends { id: string; href: string }>({
  items,
  emptyLabel,
  renderItem,
}: {
  items: T[];
  emptyLabel: string;
  renderItem: (item: T, index: number) => React.ReactNode;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-slate-500">{emptyLabel}</p>;
  }

  return <ul className="space-y-2">{items.map((item, index) => renderItem(item, index))}</ul>;
}

export function AdvancedDashboardClient({
  data,
  initialLayout,
  filters,
}: AdvancedDashboardClientProps) {
  const [layout, setLayout] = useState(initialLayout);
  const [customizeMode, setCustomizeMode] = useState(false);
  const [draggingId, setDraggingId] = useState<DashboardWidgetId | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const periodRange = useMemo(() => resolveDashboardPeriodRange(filters.period), [filters.period]);
  const filteredView = hasActiveDashboardFilters(filters);

  const kpiTitle = useCallback(
    (id: DashboardWidgetId, fallback: string) => {
      if (!filteredView || !periodRange) {
        return fallback;
      }
      if (id === "kpi-visits-week") {
        return `Visite (${periodRange.label})`;
      }
      if (id === "kpi-followups-today") {
        return `Follow-up (${periodRange.label})`;
      }
      if (id === "kpi-open-opportunities") {
        return `Opportunità aperte (${periodRange.label})`;
      }
      return fallback;
    },
    [filteredView, periodRange]
  );

  const hiddenSet = useMemo(() => new Set(layout.hiddenWidgets), [layout.hiddenWidgets]);

  const visibleWidgets = useMemo(
    () => layout.widgetOrder.filter((id) => !hiddenSet.has(id)),
    [hiddenSet, layout.widgetOrder]
  );

  const toggleHidden = useCallback((id: DashboardWidgetId) => {
    setLayout((current) => {
      const isHidden = current.hiddenWidgets.includes(id);
      return {
        ...current,
        hiddenWidgets: isHidden
          ? current.hiddenWidgets.filter((widgetId) => widgetId !== id)
          : [...current.hiddenWidgets, id],
      };
    });
  }, []);

  const handleDragStart = useCallback((id: DashboardWidgetId) => {
    setDraggingId(id);
  }, []);

  const handleDrop = useCallback(
    (targetId: DashboardWidgetId) => {
      if (!draggingId || draggingId === targetId) {
        setDraggingId(null);
        return;
      }

      setLayout((current) => {
        const nextOrder = [...current.widgetOrder];
        const fromIndex = nextOrder.indexOf(draggingId);
        const toIndex = nextOrder.indexOf(targetId);
        if (fromIndex < 0 || toIndex < 0) {
          return current;
        }
        nextOrder.splice(fromIndex, 1);
        nextOrder.splice(toIndex, 0, draggingId);
        return { ...current, widgetOrder: nextOrder };
      });
      setDraggingId(null);
    },
    [draggingId]
  );

  const handleSaveLayout = useCallback(() => {
    setMessage(null);
    startTransition(async () => {
      const result = await saveDashboardLayoutAction(layout);
      setMessage(result.message);
      if (result.success) {
        setCustomizeMode(false);
      }
    });
  }, [layout]);

  const renderWidget = (id: DashboardWidgetId) => {
    const definition = DASHBOARD_WIDGETS[id];
    const hidden = hiddenSet.has(id);
    if (hidden && !customizeMode) {
      return null;
    }

    const shellProps = {
      id,
      title: definition.title,
      href: definition.href,
      customizeMode,
      hidden,
      onToggleHidden: () => toggleHidden(id),
    };

    const wrap = (node: React.ReactNode, span: "kpi" | "chart" | "widget") => (
      <div
        key={id}
        draggable={customizeMode}
        onDragStart={() => handleDragStart(id)}
        onDragOver={(event) => event.preventDefault()}
        onDrop={() => handleDrop(id)}
        className={
          span === "kpi"
            ? ""
            : span === "chart"
              ? "xl:col-span-1"
              : "xl:col-span-1"
        }
      >
        {node}
      </div>
    );

    switch (id) {
      case "kpi-total-companies":
        return wrap(
          <DashboardKpiCard
            title={definition.title}
            value={data.kpis.totalCompanies.toLocaleString("it-IT")}
            href="/companies"
            tone="slate"
            draggable={customizeMode}
            hidden={hidden}
            onToggleHidden={customizeMode ? () => toggleHidden(id) : undefined}
          />,
          "kpi"
        );
      case "kpi-prospects":
        return wrap(
          <DashboardKpiCard
            title={definition.title}
            value={data.kpis.prospects.toLocaleString("it-IT")}
            href="/companies?commercial_status=prospect"
            tone="blue"
            draggable={customizeMode}
            hidden={hidden}
            onToggleHidden={customizeMode ? () => toggleHidden(id) : undefined}
          />,
          "kpi"
        );
      case "kpi-clients":
        return wrap(
          <DashboardKpiCard
            title={definition.title}
            value={data.kpis.clients.toLocaleString("it-IT")}
            href="/companies?commercial_status=cliente"
            tone="emerald"
            draggable={customizeMode}
            hidden={hidden}
            onToggleHidden={customizeMode ? () => toggleHidden(id) : undefined}
          />,
          "kpi"
        );
      case "kpi-ex-clients":
        return wrap(
          <DashboardKpiCard
            title={definition.title}
            value={data.kpis.exClients.toLocaleString("it-IT")}
            href="/companies?commercial_status=ex_cliente"
            tone="slate"
            draggable={customizeMode}
            hidden={hidden}
            onToggleHidden={customizeMode ? () => toggleHidden(id) : undefined}
          />,
          "kpi"
        );
      case "kpi-geocoded":
        return wrap(
          <DashboardKpiCard
            title={definition.title}
            value={data.kpis.geocodedCompanies.toLocaleString("it-IT")}
            href="/maps"
            tone="cyan"
            draggable={customizeMode}
            hidden={hidden}
            onToggleHidden={customizeMode ? () => toggleHidden(id) : undefined}
          />,
          "kpi"
        );
      case "kpi-needs-review":
        return wrap(
          <DashboardKpiCard
            title={definition.title}
            value={data.kpis.needsReviewCompanies.toLocaleString("it-IT")}
            href="/companies/geocoding/review"
            tone="amber"
            draggable={customizeMode}
            hidden={hidden}
            onToggleHidden={customizeMode ? () => toggleHidden(id) : undefined}
          />,
          "kpi"
        );
      case "kpi-visits-today":
        return wrap(
          <DashboardKpiCard
            title={definition.title}
            value={data.kpis.visitsToday.toLocaleString("it-IT")}
            href="/visits"
            tone="violet"
            draggable={customizeMode}
            hidden={hidden}
            onToggleHidden={customizeMode ? () => toggleHidden(id) : undefined}
          />,
          "kpi"
        );
      case "kpi-visits-week":
        return wrap(
          <DashboardKpiCard
            title={kpiTitle(id, definition.title)}
            value={data.kpis.visitsThisWeek.toLocaleString("it-IT")}
            href="/visits"
            tone="indigo"
            draggable={customizeMode}
            hidden={hidden}
            onToggleHidden={customizeMode ? () => toggleHidden(id) : undefined}
          />,
          "kpi"
        );
      case "kpi-followups-today":
        return wrap(
          <DashboardKpiCard
            title={kpiTitle(id, definition.title)}
            value={data.kpis.followUpsToday.toLocaleString("it-IT")}
            href="/activities?section=followups&fperiod=today"
            tone="cyan"
            draggable={customizeMode}
            hidden={hidden}
            onToggleHidden={customizeMode ? () => toggleHidden(id) : undefined}
          />,
          "kpi"
        );
      case "kpi-open-opportunities":
        return wrap(
          <DashboardKpiCard
            title={kpiTitle(id, definition.title)}
            value={data.kpis.openOpportunities.toLocaleString("it-IT")}
            href="/opportunities"
            tone="indigo"
            draggable={customizeMode}
            hidden={hidden}
            onToggleHidden={customizeMode ? () => toggleHidden(id) : undefined}
          />,
          "kpi"
        );
      case "kpi-pipeline-value":
        return wrap(
          <DashboardKpiCard
            title={definition.title}
            value={formatOpportunityAmount(data.kpis.pipelineValue)}
            href="/opportunities"
            tone="violet"
            draggable={customizeMode}
            hidden={hidden}
            onToggleHidden={customizeMode ? () => toggleHidden(id) : undefined}
          />,
          "kpi"
        );
      case "kpi-never-visited":
        return wrap(
          <DashboardKpiCard
            title={definition.title}
            value={data.kpis.neverVisitedCompanies.toLocaleString("it-IT")}
            href="/companies?last_visit=never"
            tone="blue"
            draggable={customizeMode}
            hidden={hidden}
            onToggleHidden={customizeMode ? () => toggleHidden(id) : undefined}
          />,
          "kpi"
        );
      case "kpi-clients-inactive-90":
        return wrap(
          <DashboardKpiCard
            title={definition.title}
            value={data.kpis.clientsWithoutVisit90Days.toLocaleString("it-IT")}
            href="/companies?last_visit=over_90&commercial_status=cliente"
            tone="rose"
            draggable={customizeMode}
            hidden={hidden}
            onToggleHidden={customizeMode ? () => toggleHidden(id) : undefined}
          />,
          "kpi"
        );
      case "chart-province":
        return wrap(
          <WidgetShell {...shellProps}>
            <DashboardBarChart data={data.companiesByProvince} colorClassName="bg-sky-500" />
          </WidgetShell>,
          "chart"
        );
      case "chart-commercial-status":
        return wrap(
          <WidgetShell {...shellProps}>
            <DashboardBarChart data={data.companiesByCommercialStatus} colorClassName="bg-indigo-500" />
          </WidgetShell>,
          "chart"
        );
      case "chart-visits-trend":
        return wrap(
          <WidgetShell {...shellProps}>
            <DashboardBarChart
              data={data.visitsMonthlyTrend}
              horizontal={false}
              colorClassName="bg-violet-500"
            />
          </WidgetShell>,
          "chart"
        );
      case "chart-opportunity-stage":
        return wrap(
          <WidgetShell {...shellProps}>
            <DashboardBarChart data={data.opportunitiesByStage} colorClassName="bg-emerald-500" />
          </WidgetShell>,
          "chart"
        );
      case "chart-product-interests":
        return wrap(
          <WidgetShell {...shellProps}>
            <DashboardBarChart data={data.productInterests} colorClassName="bg-amber-500" />
          </WidgetShell>,
          "chart"
        );
      case "chart-prospect-conversion":
        return wrap(
          <WidgetShell {...shellProps}>
            <p className="mb-3 text-sm text-slate-600">
              Tasso conversione:{" "}
              <span className="font-semibold text-emerald-700">
                {data.prospectConversion.conversionRate.toLocaleString("it-IT")}%
              </span>{" "}
              ({data.prospectConversion.clients.toLocaleString("it-IT")} clienti su{" "}
              {(data.prospectConversion.prospects + data.prospectConversion.clients).toLocaleString("it-IT")})
            </p>
            <DashboardBarChart
              data={data.prospectConversion.monthly}
              horizontal={false}
              colorClassName="bg-emerald-500"
            />
          </WidgetShell>,
          "chart"
        );
      case "widget-upcoming-appointments":
        return wrap(
          <WidgetShell {...shellProps}>
            <ListWidget
              items={data.upcomingAppointments}
              emptyLabel="Nessun appuntamento nei prossimi 7 giorni."
              renderItem={(item) => (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    className="block rounded-lg border border-slate-100 px-3 py-2 text-sm hover:bg-slate-50"
                  >
                    <p className="font-medium text-slate-900">{item.companyName ?? "—"}</p>
                    <p className="text-xs text-slate-500">
                      {item.title} · {formatVisitDateShort(item.scheduledAt)}
                    </p>
                  </Link>
                </li>
              )}
            />
          </WidgetShell>,
          "widget"
        );
      case "widget-overdue-activities":
        return wrap(
          <WidgetShell {...shellProps}>
            <ListWidget
              items={data.overdueActivities}
              emptyLabel="Nessuna attività in ritardo."
              renderItem={(item) => (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    className="block rounded-lg border border-rose-100 bg-rose-50/40 px-3 py-2 text-sm hover:bg-rose-50"
                  >
                    <p className="font-medium text-slate-900">{item.companyName ?? item.title}</p>
                    <p className="text-xs text-rose-700">
                      Scaduta · {formatVisitDateShort(item.dueAt)}
                    </p>
                  </Link>
                </li>
              )}
            />
          </WidgetShell>,
          "widget"
        );
      case "widget-recent-contacts":
        return wrap(
          <WidgetShell {...shellProps}>
            <ListWidget
              items={data.recentContacts}
              emptyLabel="Nessun contatto recente."
              renderItem={(item) => (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    className="block rounded-lg border border-slate-100 px-3 py-2 text-sm hover:bg-slate-50"
                  >
                    <p className="font-medium text-slate-900">{item.companyName ?? "—"}</p>
                    <p className="text-xs text-slate-500">
                      {item.title} · {formatVisitDateShort(item.occurredAt)}
                    </p>
                  </Link>
                </li>
              )}
            />
          </WidgetShell>,
          "widget"
        );
      case "widget-top-opportunities":
        return wrap(
          <WidgetShell {...shellProps}>
            <ListWidget
              items={data.topOpportunities}
              emptyLabel="Nessuna opportunità aperta."
              renderItem={(item) => (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    className="block rounded-lg border border-slate-100 px-3 py-2 text-sm hover:bg-slate-50"
                  >
                    <p className="font-medium text-slate-900">{item.title}</p>
                    <p className="text-xs text-slate-500">
                      {item.companyName ?? "—"} · {item.stage} · {formatOpportunityAmount(item.amount)}
                    </p>
                  </Link>
                </li>
              )}
            />
          </WidgetShell>,
          "widget"
        );
      case "widget-today-tour":
        return wrap(
          <WidgetShell {...shellProps}>
            <ListWidget
              items={data.todayTours}
              emptyLabel="Nessun giro visite salvato per oggi."
              renderItem={(item) => (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    className="block rounded-lg border border-slate-100 px-3 py-2 text-sm hover:bg-slate-50"
                  >
                    <p className="font-medium text-slate-900">
                      Giro · {item.stopsCount} tappe ({item.status})
                    </p>
                    <p className="text-xs text-slate-500">
                      {item.estimatedMinutes ? `${item.estimatedMinutes} min stimati` : "Durata n/d"}
                    </p>
                  </Link>
                </li>
              )}
            />
          </WidgetShell>,
          "widget"
        );
      default:
        return null;
    }
  };

  const kpiWidgets = visibleWidgets.filter((id) => DASHBOARD_WIDGETS[id].span === "kpi");
  const chartWidgets = visibleWidgets.filter((id) => DASHBOARD_WIDGETS[id].span === "chart");
  const listWidgets = visibleWidgets.filter((id) => DASHBOARD_WIDGETS[id].span === "widget");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
            <LayoutDashboard className="h-6 w-6 text-indigo-600" />
            Dashboard Commerciale Avanzata
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            KPI in tempo reale, grafici e widget operativi
            {filteredView ? " · vista filtrata" : ""}.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setCustomizeMode((value) => !value)}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <Settings2 className="h-4 w-4" />
            {customizeMode ? "Fine personalizzazione" : "Personalizza"}
          </button>
          {customizeMode && (
            <button
              type="button"
              onClick={handleSaveLayout}
              disabled={isPending}
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-indigo-600 px-3 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salva layout
            </button>
          )}
        </div>
      </div>

      {message && (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {message}
        </p>
      )}

      {customizeMode && (
        <p className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm text-indigo-800">
          Trascina i widget per riordinarli. Usa &quot;Nascondi&quot; per mostrare solo i pannelli utili.
        </p>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {(customizeMode ? layout.widgetOrder : kpiWidgets)
          .filter((id) => DASHBOARD_WIDGETS[id].span === "kpi")
          .filter((id) => customizeMode || !hiddenSet.has(id))
          .map((id) => renderWidget(id))}
      </section>

      <section className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {(customizeMode ? layout.widgetOrder : chartWidgets)
          .filter((id) => DASHBOARD_WIDGETS[id].span === "chart")
          .filter((id) => customizeMode || !hiddenSet.has(id))
          .map((id) => renderWidget(id))}
      </section>

      <section className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {(customizeMode ? layout.widgetOrder : listWidgets)
          .filter((id) => DASHBOARD_WIDGETS[id].span === "widget")
          .filter((id) => customizeMode || !hiddenSet.has(id))
          .map((id) => renderWidget(id))}
      </section>

      <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600 sm:grid-cols-3">
        <p className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4" />
          Visite e appuntamenti collegati al modulo Visite
        </p>
        <p className="flex items-center gap-2">
          <Clock3 className="h-4 w-4" />
          Attività e follow-up collegati al modulo Attività
        </p>
        <p className="flex items-center gap-2">
          <Route className="h-4 w-4" />
          Giri visite collegati al modulo Giro Visite
        </p>
        <p className="flex items-center gap-2 sm:col-span-3">
          <Target className="h-4 w-4" />
          Ogni KPI, grafico e widget è cliccabile e apre il modulo correlato.
        </p>
      </div>
    </div>
  );
}
