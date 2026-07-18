"use server";

import { revalidatePath } from "next/cache";
import {
  agendaSaveFollowUpAction,
  agendaSaveReminderAction,
} from "@/features/agenda/actions/agenda-actions";
import { listAgendaItems } from "@/features/agenda/services/agenda.service";
import {
  addCompanyBrandAction,
  listActiveBrandsAction,
  listCompanyBrandsAction,
  updateCompanyBrandAction,
} from "@/features/brands/actions/company-brand-actions";
import { searchCompanySelectOptionsAction } from "@/features/companies/actions/company-search-actions";
import { getCompanyById } from "@/features/companies/services/companies.service";
import { buildGoogleMapsDestinationUrl } from "@/features/routes/utils/google-maps-tour-url";
import {
  listVisitToursAction,
  loadVisitTourAction,
} from "@/features/routes/actions/visit-tour-actions";
import { saveVisitAction } from "@/features/visits/actions/visit-mutations";
import { logJoyVoiceDiag } from "../diag-logger";
import { validateJoyVoiceIntent } from "../parse-voice-intent";
import type {
  JoyGuideScreenContext,
  JoyVoiceActionUi,
  JoyVoiceExecuteResult,
  JoyVoiceIntentResult,
} from "../types";

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function friendlyError(message: string): string {
  const trimmed = message.replace(/\s+/g, " ").trim().slice(0, 180);
  if (/jwt|auth|permission|rls|policy/i.test(trimmed)) {
    return "Non ho i permessi per questa operazione. Riprova dopo aver ricaricato.";
  }
  if (/network|fetch|timeout/i.test(trimmed)) {
    return "Problema di connessione. Riprova tra poco.";
  }
  return trimmed || "Operazione non riuscita.";
}

function uiNone(): JoyVoiceActionUi {
  return { kind: "none", href: null, label: null };
}

async function resolveCompanyFromQuery(
  query: string
): Promise<{
  companyId: string | null;
  companyName: string | null;
  ambiguous: Array<{ id: string; name: string; city: string | null }>;
  error: string | null;
}> {
  const { data, error } = await searchCompanySelectOptionsAction(query);
  if (error) {
    return { companyId: null, companyName: null, ambiguous: [], error };
  }
  if (data.length === 0) {
    return { companyId: null, companyName: null, ambiguous: [], error: null };
  }
  if (data.length === 1) {
    return {
      companyId: data[0]!.id,
      companyName: data[0]!.name,
      ambiguous: [],
      error: null,
    };
  }
  return {
    companyId: null,
    companyName: null,
    ambiguous: data.slice(0, 5).map((c) => ({
      id: c.id,
      name: c.name,
      city: c.city,
    })),
    error: null,
  };
}

async function loadTodayTourContext(): Promise<{
  tourId: string | null;
  nextStop: {
    companyId: string;
    name: string;
    city: string | null;
    lat: number | null;
    lng: number | null;
  } | null;
  stopCount: number;
  spokenSummary: string;
}> {
  const { data, error } = await listVisitToursAction({
    tourDate: todayIsoDate(),
    sortBy: "date",
    sortAscending: false,
  });

  if (error || data.length === 0) {
    return {
      tourId: null,
      nextStop: null,
      stopCount: 0,
      spokenSummary: error
        ? friendlyError(error)
        : "Non trovo un giro salvato per oggi. Aprilo da Giro visite.",
    };
  }

  const tourMeta = data[0]!;
  const loaded = await loadVisitTourAction(tourMeta.id);
  if (!loaded.success || !loaded.tour) {
    return {
      tourId: tourMeta.id,
      nextStop: null,
      stopCount: 0,
      spokenSummary: friendlyError(loaded.message),
    };
  }

  const stops = loaded.tour.stops ?? [];
  const next = stops[0] ?? null;
  const names = stops
    .slice(0, 4)
    .map((s) => s.company?.name)
    .filter(Boolean);
  const spokenSummary =
    stops.length === 0
      ? "Il giro di oggi non ha tappe."
      : `Oggi hai ${stops.length} tappe. ${names.join(", ")}${stops.length > 4 ? " e altre" : ""}.`;

  return {
    tourId: tourMeta.id,
    nextStop: next
      ? {
          companyId: next.company.id,
          name: next.company.name,
          city: next.company.city ?? null,
          lat: next.company.latitude ?? null,
          lng: next.company.longitude ?? null,
        }
      : null,
    stopCount: stops.length,
    spokenSummary,
  };
}

async function resolveBrandId(brandName: string): Promise<{
  brandId: string | null;
  brandLabel: string | null;
  error: string | null;
}> {
  const { data, error } = await listActiveBrandsAction();
  if (error) {
    return { brandId: null, brandLabel: null, error };
  }
  const needle = brandName.trim().toLowerCase();
  const match = data.find(
    (b) =>
      b.name.toLowerCase() === needle ||
      b.slug?.toLowerCase() === needle ||
      b.short_code?.toLowerCase() === needle ||
      b.name.toLowerCase().includes(needle)
  );
  if (!match) {
    return { brandId: null, brandLabel: null, error: null };
  }
  return { brandId: match.id, brandLabel: match.name, error: null };
}

/**
 * Execute a validated voice intent against existing CRM services.
 * Confirming mutations must be called with `confirmed: true`.
 */
export async function executeJoyVoiceIntentAction(input: {
  intent: JoyVoiceIntentResult;
  context?: JoyGuideScreenContext;
  confirmed?: boolean;
}): Promise<JoyVoiceExecuteResult> {
  const started = Date.now();
  const { intent, context, confirmed = false } = input;

  logJoyVoiceDiag("execute_start", {
    intent: intent.intent,
    confidence: intent.confidence,
    action: intent.proposedAction,
  });

  const validation = validateJoyVoiceIntent(intent);
  if (!validation.ok) {
    return {
      success: false,
      message: validation.reason,
      spokenReply: validation.spokenReply,
      ui: uiNone(),
      needsConfirmation: false,
    };
  }

  if (intent.requiresConfirmation && !confirmed) {
    return {
      success: true,
      message: intent.proposedAction ?? "In attesa di conferma",
      spokenReply: intent.spokenReply,
      ui: uiNone(),
      needsConfirmation: true,
      pendingIntent: intent,
    };
  }

  try {
    switch (intent.intent) {
      case "confirm":
      case "cancel":
        return {
          success: true,
          message: intent.spokenReply,
          spokenReply: intent.spokenReply,
          ui: uiNone(),
        };

      case "read_agenda_today": {
        const { data, error } = await listAgendaItems({
          view: "day",
          date: todayIsoDate(),
          agentId: null,
          kind: "",
          status: "",
        });
        if (error) {
          return {
            success: false,
            message: friendlyError(error),
            spokenReply: friendlyError(error),
            ui: uiNone(),
          };
        }
        const open = data.filter((i) => i.status !== "completed" && i.status !== "cancelled");
        const visits = open.filter((i) => i.kind === "visit").length;
        const followUps = open.filter((i) => i.kind === "follow_up").length;
        const reminders = open.filter((i) => i.kind === "reminder").length;
        const next = open[0];
        const spoken =
          open.length === 0
            ? "Oggi non hai attività in agenda."
            : `Oggi hai ${open.length} attività: ${visits} visite, ${followUps} follow-up e ${reminders} promemoria.${
                next
                  ? ` La prossima è ${next.companyName ?? next.title}.`
                  : ""
              }`;
        return {
          success: true,
          message: spoken,
          spokenReply: spoken,
          data: { count: open.length },
          ui: { kind: "open_href", href: "/agenda", label: "Apri agenda" },
        };
      }

      case "open_tour_today": {
        const tour = await loadTodayTourContext();
        return {
          success: true,
          message: tour.spokenSummary,
          spokenReply: tour.spokenSummary,
          data: {
            tourId: tour.tourId,
            stopCount: tour.stopCount,
            nextStop: tour.nextStop,
          },
          ui: {
            kind: "open_href",
            href: tour.tourId ? `/giro-visite?tour=${tour.tourId}` : "/giro-visite",
            label: "Apri giro",
          },
        };
      }

      case "next_stop": {
        const tour = await loadTodayTourContext();
        if (!tour.nextStop) {
          return {
            success: false,
            message: "Nessuna prossima tappa",
            spokenReply: tour.spokenSummary,
            ui: uiNone(),
          };
        }
        const eta =
          context?.nextStopEtaMinutes != null
            ? ` Circa ${context.nextStopEtaMinutes} minuti.`
            : "";
        const spoken = `La prossima tappa è ${tour.nextStop.name}${
          tour.nextStop.city ? ` a ${tour.nextStop.city}` : ""
        }.${eta}`;
        return {
          success: true,
          message: spoken,
          spokenReply: spoken,
          data: { nextStop: tour.nextStop, tourId: tour.tourId },
          ui: uiNone(),
        };
      }

      case "navigate_next": {
        const tour = await loadTodayTourContext();
        const stop = tour.nextStop;
        if (!stop?.lat || !stop?.lng) {
          return {
            success: false,
            message: "Coordinate mancanti",
            spokenReply:
              "Non ho le coordinate della prossima tappa. Apri il giro e verifica.",
            ui: {
              kind: "open_href",
              href: "/giro-visite",
              label: "Apri giro",
            },
          };
        }
        const href = buildGoogleMapsDestinationUrl({
          lat: stop.lat,
          lng: stop.lng,
        });
        return {
          success: true,
          message: `Navigazione pronta per ${stop.name}`,
          spokenReply: `Ho preparato la navigazione per ${stop.name}. Tocca Avvia navigazione.`,
          data: { nextStop: stop, mapsUrl: href },
          ui: { kind: "navigate", href, label: "Avvia navigazione" },
        };
      }

      case "navigate_company": {
        const query = intent.entities.companyQuery?.trim();
        if (!query) {
          return {
            success: false,
            message: "Query mancante",
            spokenReply: "Verso quale azienda?",
            ui: uiNone(),
          };
        }
        const resolved = await resolveCompanyFromQuery(query);
        if (resolved.error) {
          return {
            success: false,
            message: friendlyError(resolved.error),
            spokenReply: friendlyError(resolved.error),
            ui: uiNone(),
          };
        }
        if (resolved.ambiguous.length > 0) {
          const options = resolved.ambiguous
            .map((c) => `${c.name}${c.city ? ` di ${c.city}` : ""}`)
            .join(" o ");
          return {
            success: false,
            message: "Omonimia",
            spokenReply: `Ho trovato più aziende. Intendi ${options}?`,
            data: { ambiguous: resolved.ambiguous },
            ui: uiNone(),
          };
        }
        if (!resolved.companyId) {
          return {
            success: false,
            message: "Non trovata",
            spokenReply: `Non trovo ${query}.`,
            ui: uiNone(),
          };
        }
        const company = await getCompanyById(resolved.companyId);
        const lat = company.data?.latitude ?? null;
        const lng = company.data?.longitude ?? null;
        if (lat == null || lng == null) {
          return {
            success: false,
            message: "Senza coordinate",
            spokenReply: `${resolved.companyName} non ha coordinate. Apri la scheda.`,
            ui: {
              kind: "open_href",
              href: `/companies/${resolved.companyId}`,
              label: "Apri scheda",
            },
          };
        }
        const href = buildGoogleMapsDestinationUrl({ lat, lng });
        return {
          success: true,
          message: `Navigazione pronta`,
          spokenReply: `Ho preparato la navigazione per ${resolved.companyName}. Tocca Avvia navigazione.`,
          data: { companyId: resolved.companyId, mapsUrl: href },
          ui: { kind: "navigate", href, label: "Avvia navigazione" },
        };
      }

      case "search_company":
      case "open_company": {
        const query = intent.entities.companyQuery?.trim();
        if (!query) {
          return {
            success: false,
            message: "Query mancante",
            spokenReply: "Quale azienda?",
            ui: uiNone(),
          };
        }
        const resolved = await resolveCompanyFromQuery(query);
        if (resolved.error) {
          return {
            success: false,
            message: friendlyError(resolved.error),
            spokenReply: friendlyError(resolved.error),
            ui: uiNone(),
          };
        }
        if (resolved.ambiguous.length > 0) {
          const options = resolved.ambiguous
            .map((c) => `${c.name}${c.city ? ` di ${c.city}` : ""}`)
            .join(" o ");
          return {
            success: false,
            message: "Omonimia",
            spokenReply: `Ho trovato più aziende. Intendi ${options}?`,
            data: { ambiguous: resolved.ambiguous },
            ui: uiNone(),
          };
        }
        if (!resolved.companyId) {
          return {
            success: false,
            message: "Non trovata",
            spokenReply: `Non trovo ${query}.`,
            ui: uiNone(),
          };
        }
        const spoken =
          intent.intent === "open_company"
            ? `Apro la scheda di ${resolved.companyName}.`
            : `Trovata ${resolved.companyName}${
                resolved.ambiguous[0]?.city ? "" : ""
              }.`;
        return {
          success: true,
          message: spoken,
          spokenReply: spoken,
          data: {
            companyId: resolved.companyId,
            companyName: resolved.companyName,
          },
          ui: {
            kind: "open_href",
            href: `/companies/${resolved.companyId}`,
            label: "Apri scheda",
          },
        };
      }

      case "register_visit":
      case "complete_visit": {
        const companyId = intent.companyId;
        if (!companyId) {
          return {
            success: false,
            message: "Azienda mancante",
            spokenReply: "Di quale azienda?",
            ui: uiNone(),
          };
        }
        const save = await saveVisitAction({
          companyId,
          completedAt: new Date().toISOString(),
          outcome: intent.entities.outcome ?? null,
          notes: intent.entities.notes ?? null,
          durationMinutes: null,
          nextCallbackAt: intent.entities.followUpDate ?? null,
        });
        if (!save.success) {
          return {
            success: false,
            message: friendlyError(save.message),
            spokenReply: friendlyError(save.message),
            ui: uiNone(),
          };
        }
        revalidatePath("/visits");
        revalidatePath("/agenda");
        revalidatePath(`/companies/${companyId}`);
        return {
          success: true,
          message: save.message,
          spokenReply: `${save.message} Vuoi la prossima tappa?`,
          data: { visitId: save.visitId, companyId },
          ui: uiNone(),
        };
      }

      case "create_follow_up": {
        const companyId = intent.companyId;
        const scheduledAt = intent.entities.followUpDate;
        if (!companyId || !scheduledAt) {
          return {
            success: false,
            message: "Dati mancanti",
            spokenReply: "Servono azienda e data.",
            ui: uiNone(),
          };
        }
        const save = await agendaSaveFollowUpAction({
          companyId,
          activityType: "call",
          description: intent.entities.notes ?? "Follow-up da Joy guida",
          priority: intent.entities.priority ?? "medium",
          scheduledAt,
        });
        return {
          success: save.success,
          message: friendlyError(save.message),
          spokenReply: save.success
            ? "Follow-up salvato."
            : friendlyError(save.message),
          ui: uiNone(),
        };
      }

      case "create_reminder": {
        const scheduledAt = intent.entities.reminderDate;
        if (!scheduledAt) {
          return {
            success: false,
            message: "Data mancante",
            spokenReply: "Per quando il promemoria?",
            ui: uiNone(),
          };
        }
        const save = await agendaSaveReminderAction({
          title: intent.entities.reminderText?.slice(0, 120) || "Promemoria Joy",
          scheduledAt,
          notes: intent.entities.reminderText ?? null,
          companyId: intent.companyId,
        });
        return {
          success: save.success,
          message: friendlyError(save.message),
          spokenReply: save.success
            ? "Promemoria salvato."
            : friendlyError(save.message),
          ui: uiNone(),
        };
      }

      case "list_brands": {
        const companyId = intent.companyId;
        if (!companyId) {
          return {
            success: false,
            message: "Azienda mancante",
            spokenReply: "Di quale azienda?",
            ui: uiNone(),
          };
        }
        const { data, error } = await listCompanyBrandsAction(companyId);
        if (error) {
          return {
            success: false,
            message: friendlyError(error),
            spokenReply: friendlyError(error),
            ui: uiNone(),
          };
        }
        if (data.length === 0) {
          return {
            success: true,
            message: "Nessun brand",
            spokenReply: "Questa azienda non ha brand associati.",
            ui: uiNone(),
          };
        }
        const labels = data.map((b) => b.brand_name || "brand").join(", ");
        return {
          success: true,
          message: labels,
          spokenReply: `I brand sono: ${labels}.`,
          data: { brands: data.map((b) => b.brand_id) },
          ui: uiNone(),
        };
      }

      case "add_brand":
      case "set_brand_status": {
        const companyId = intent.companyId;
        const brandName = intent.entities.brandName;
        if (!companyId || !brandName) {
          return {
            success: false,
            message: "Dati mancanti",
            spokenReply: "Servono azienda e brand.",
            ui: uiNone(),
          };
        }
        const brand = await resolveBrandId(brandName);
        if (brand.error || !brand.brandId) {
          return {
            success: false,
            message: brand.error ?? "Brand non trovato",
            spokenReply: brand.error
              ? friendlyError(brand.error)
              : `Non trovo il brand ${brandName}.`,
            ui: uiNone(),
          };
        }
        const asCustomer =
          intent.intent === "set_brand_status" ||
          intent.entities.relationshipStatus === "cliente" ||
          intent.entities.relationshipStatus === "customer";
        const isPrimary = intent.entities.notes === "primary";
        const add = await addCompanyBrandAction({
          companyId,
          brandId: brand.brandId,
          relationshipStatus: asCustomer ? "customer" : "prospect",
          isPrimary,
        });
        if (add.error) {
          // Already linked — try update status
          const upd = await updateCompanyBrandAction({
            companyId,
            brandId: brand.brandId,
            relationshipStatus: asCustomer ? "customer" : undefined,
            isPrimary: isPrimary || undefined,
          });
          if (upd.error) {
            return {
              success: false,
              message: friendlyError(add.error),
              spokenReply: friendlyError(add.error),
              ui: uiNone(),
            };
          }
        }
        return {
          success: true,
          message: "Brand aggiornato",
          spokenReply: `${brand.brandLabel} aggiunto a questa azienda.`,
          ui: uiNone(),
        };
      }

      case "call_contact":
      case "open_whatsapp":
      case "prepare_email": {
        const companyId = intent.companyId ?? context?.companyId;
        if (!companyId) {
          return {
            success: false,
            message: "Azienda mancante",
            spokenReply: "Di quale azienda?",
            ui: uiNone(),
          };
        }
        const company = await getCompanyById(companyId);
        if (!company.data) {
          return {
            success: false,
            message: "Azienda non trovata",
            spokenReply: "Non trovo l'azienda.",
            ui: uiNone(),
          };
        }
        const phone =
          company.data.phone ??
          company.data.mobile ??
          company.data.contact_phone ??
          null;
        const email = company.data.email ?? company.data.contact_email ?? null;
        if (intent.intent === "call_contact") {
          if (!phone) {
            return {
              success: false,
              message: "Telefono assente",
              spokenReply: "Non ho un numero di telefono per questa azienda.",
              ui: {
                kind: "open_href",
                href: `/companies/${companyId}`,
                label: "Apri scheda",
              },
            };
          }
          const href = `tel:${phone.replace(/\s+/g, "")}`;
          return {
            success: true,
            message: "Chiamata pronta",
            spokenReply: "Ho preparato la chiamata. Tocca Chiama.",
            ui: { kind: "tel", href, label: "Chiama" },
          };
        }
        if (intent.intent === "open_whatsapp") {
          if (!phone) {
            return {
              success: false,
              message: "Telefono assente",
              spokenReply: "Non ho un numero per WhatsApp.",
              ui: uiNone(),
            };
          }
          const digits = phone.replace(/\D/g, "");
          const href = `https://wa.me/${digits}`;
          return {
            success: true,
            message: "WhatsApp pronto",
            spokenReply: "Ho preparato WhatsApp. Tocca Apri WhatsApp.",
            ui: { kind: "whatsapp", href, label: "Apri WhatsApp" },
          };
        }
        if (!email) {
          return {
            success: false,
            message: "Email assente",
            spokenReply: "Non ho un'email per questa azienda.",
            ui: uiNone(),
          };
        }
        return {
          success: true,
          message: "Email pronta",
          spokenReply: "Ho preparato l'email. Tocca Apri email.",
          ui: {
            kind: "mailto",
            href: `mailto:${email}`,
            label: "Apri email",
          },
        };
      }

      default:
        return {
          success: false,
          message: "Intent non gestito",
          spokenReply: intent.spokenReply,
          ui: uiNone(),
        };
    }
  } catch (error) {
    const message =
      error instanceof Error ? friendlyError(error.message) : "Errore imprevisto.";
    logJoyVoiceDiag("execute_error", {
      intent: intent.intent,
      errorCode: "unexpected",
      interpretMs: Date.now() - started,
    });
    return {
      success: false,
      message,
      spokenReply: message,
      ui: uiNone(),
    };
  } finally {
    logJoyVoiceDiag("execute_done", {
      intent: intent.intent,
      interpretMs: Date.now() - started,
    });
  }
}

/** Interpret utterance then optionally execute (preview path). */
export async function interpretJoyVoiceCommandAction(input: {
  utterance: string;
  context?: JoyGuideScreenContext;
}): Promise<{
  intent: JoyVoiceIntentResult;
  preview: JoyVoiceExecuteResult | null;
}> {
  const { parseJoyVoiceIntent } = await import("../parse-voice-intent");
  const intent = parseJoyVoiceIntent(input.utterance, input.context);
  if (intent.requiresConfirmation || intent.intent === "clarify" || intent.intent === "unknown") {
    return { intent, preview: null };
  }
  const preview = await executeJoyVoiceIntentAction({
    intent,
    context: input.context,
    confirmed: false,
  });
  return { intent, preview };
}
