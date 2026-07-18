import "server-only";

import { revalidatePath } from "next/cache";
import {
  agendaCancelItemAction,
  agendaSaveReminderAction,
  agendaUpdateItemAction,
} from "@/features/agenda/actions/agenda-actions";
import { saveFollowUpAction } from "@/features/activities/actions/follow-up-actions";
import { saveContactHistoryActivity } from "@/features/activities/services/contact-history.service";
import { saveOpportunity } from "@/features/opportunities/services/opportunities.service";
import { saveOrder } from "@/features/orders/services/orders.service";
import { saveQuote } from "@/features/quotes/services/quotes.service";
import { saveSample } from "@/features/samples/services/samples.service";
import { saveServiceTicket } from "@/features/service/services/service-tickets.service";
import { scheduleVisitAction, saveVisitAction, completeScheduledVisitAction } from "@/features/visits/actions/visit-mutations";
import type { JoyCopilotExecuteResult, JoyCopilotOperation } from "../types/joy-chat";

function revalidateCopilotPaths(companyId?: string | null) {
  revalidatePath("/joy/chat");
  revalidatePath("/joy");
  revalidatePath("/joy-ai");
  revalidatePath("/joy/autonomous");
  revalidatePath("/command-center");
  revalidatePath("/");
  revalidatePath("/visits");
  revalidatePath("/agenda");
  revalidatePath("/activities");
  revalidatePath("/auto");
  revalidatePath("/companies");
  revalidatePath("/opportunities");
  revalidatePath("/preventivi");
  revalidatePath("/ordini");
  revalidatePath("/campioni");
  revalidatePath("/assistenza");
  revalidatePath("/maps");
  revalidatePath("/routes");
  if (companyId) {
    revalidatePath(`/companies/${companyId}`);
  }
}

export async function executeJoyCopilotOperation(
  operation: JoyCopilotOperation
): Promise<JoyCopilotExecuteResult> {
  switch (operation.type) {
    case "create_visit": {
      const result = await scheduleVisitAction({
        companyId: operation.companyId,
        scheduledAt: operation.scheduledAt,
        notes: operation.notes,
      });
      if (!result.success || !result.visitId) {
        return {
          success: false,
          message: result.message || "Pianificazione visita non confermata dal database.",
        };
      }
      revalidateCopilotPaths(operation.companyId);
      return {
        success: true,
        message: `Visita pianificata per ${operation.companyName} (salvata).`,
        href: `/companies/${operation.companyId}`,
      };
    }

    case "update_visit": {
      const result = await agendaUpdateItemAction({
        compositeId: `visit:${operation.visitId}`,
        companyId: operation.companyId,
        scheduledAt: operation.scheduledAt,
      });
      if (result.success) {
        revalidateCopilotPaths(operation.companyId);
      }
      return {
        success: result.success,
        message: result.success
          ? `Visita di ${operation.companyName} aggiornata.`
          : result.message,
      };
    }

    case "complete_visit": {
      if (operation.visitId) {
        const result = await completeScheduledVisitAction(
          operation.visitId,
          operation.companyId,
          {
            completedAt: operation.completedAt ?? new Date().toISOString(),
            outcome: operation.outcome,
            notes: operation.notes ?? null,
            durationMinutes: null,
            nextCallbackAt: null,
          }
        );
        if (result.success) {
          revalidateCopilotPaths(operation.companyId);
        }
        return {
          success: result.success,
          message: result.success
            ? `Esito visita salvato per ${operation.companyName}.`
            : result.message,
        };
      }

      const result = await saveVisitAction({
        companyId: operation.companyId,
        completedAt: operation.completedAt ?? new Date().toISOString(),
        outcome: operation.outcome,
        notes: operation.notes ?? null,
        durationMinutes: null,
        nextCallbackAt: null,
      });
      if (!result.success || !result.visitId) {
        return {
          success: false,
          message: result.message || "Esito visita non confermato dal database.",
        };
      }
      revalidateCopilotPaths(operation.companyId);
      return {
        success: true,
        message: `Esito visita salvato per ${operation.companyName}.`,
      };
    }

    case "cancel_visit": {
      const result = await agendaCancelItemAction(
        `visit:${operation.visitId}`,
        operation.companyId
      );
      if (result.success) {
        revalidateCopilotPaths(operation.companyId);
      }
      return {
        success: result.success,
        message: result.success
          ? `Visita di ${operation.companyName} annullata.`
          : result.message,
      };
    }

    case "create_follow_up": {
      const result = await saveFollowUpAction({
        companyId: operation.companyId,
        activityType: "call",
        description: operation.description,
        scheduledAt: operation.scheduledAt,
      });
      if (!result.success || !result.followUpId) {
        return {
          success: false,
          message: result.message || "Follow-up non confermato dal database.",
        };
      }
      revalidateCopilotPaths(operation.companyId);
      return {
        success: true,
        message: `Follow-up creato per ${operation.companyName} (salvato).`,
      };
    }

    case "update_follow_up": {
      const result = await agendaUpdateItemAction({
        compositeId: `follow_up:${operation.followUpId}`,
        companyId: operation.companyId,
        scheduledAt: operation.scheduledAt,
      });
      if (result.success) {
        revalidateCopilotPaths(operation.companyId);
      }
      return {
        success: result.success,
        message: result.success
          ? `Follow-up di ${operation.companyName} aggiornato.`
          : result.message,
      };
    }

    case "create_reminder": {
      const result = await agendaSaveReminderAction({
        title: operation.title,
        scheduledAt: operation.scheduledAt,
        notes: operation.notes,
        companyId: operation.companyId,
      });
      if (result.success) {
        revalidateCopilotPaths(operation.companyId);
      }
      return {
        success: result.success,
        message: result.success ? `Promemoria "${operation.title}" creato.` : result.message,
      };
    }

    case "create_opportunity": {
      const { opportunityId, error } = await saveOpportunity({
        companyId: operation.companyId,
        title: operation.title,
        productFamily: "altro",
        stage: "new",
        probability:
          operation.probability != null && Number.isFinite(operation.probability)
            ? Math.round(operation.probability)
            : 50,
        notes: "Creata da Joy AI",
      });
      if (error || !opportunityId) {
        return { success: false, message: error ?? "Creazione opportunità non riuscita." };
      }
      revalidateCopilotPaths(operation.companyId);
      return {
        success: true,
        message: `Opportunità creata per ${operation.companyName}.`,
        href: `/opportunities/${opportunityId}`,
      };
    }

    case "create_quote": {
      const { quoteId, error } = await saveQuote({
        companyId: operation.companyId,
        title: operation.title,
        productFamily: "altro",
        notes: "Bozza creata da Joy AI",
      });
      if (error || !quoteId) {
        return { success: false, message: error ?? "Creazione preventivo non riuscita." };
      }
      revalidateCopilotPaths(operation.companyId);
      return {
        success: true,
        message: `Preventivo bozza creato per ${operation.companyName}.`,
        href: `/preventivi/${quoteId}`,
      };
    }

    case "create_order": {
      const { orderId, error } = await saveOrder({
        companyId: operation.companyId,
        title: operation.title,
        productFamily: "altro",
        orderStatus: "bozza",
        notes: "Bozza creata da Joy AI",
      });
      if (error || !orderId) {
        return { success: false, message: error ?? "Creazione ordine non riuscita." };
      }
      revalidateCopilotPaths(operation.companyId);
      return {
        success: true,
        message: `Ordine bozza creato per ${operation.companyName}.`,
        href: `/ordini/${orderId}`,
      };
    }

    case "create_sample": {
      const { sampleId, error } = await saveSample({
        companyId: operation.companyId,
        title: operation.title,
        status: "consegnato",
        notes: "Registrato da Joy AI",
      });
      if (error || !sampleId) {
        return { success: false, message: error ?? "Creazione campione non riuscita." };
      }
      revalidateCopilotPaths(operation.companyId);
      return {
        success: true,
        message: `Campione registrato per ${operation.companyName}.`,
        href: `/campioni/${sampleId}`,
      };
    }

    case "create_service_ticket": {
      const { ticketId, error } = await saveServiceTicket({
        companyId: operation.companyId,
        title: operation.title,
        description: "Aperto da Joy AI",
        status: "aperto",
        priority: "medium",
      });
      if (error || !ticketId) {
        return { success: false, message: error ?? "Creazione ticket non riuscita." };
      }
      revalidateCopilotPaths(operation.companyId);
      return {
        success: true,
        message: `Ticket assistenza creato per ${operation.companyName}.`,
        href: `/assistenza/${ticketId}`,
      };
    }

    case "create_note": {
      const { activityId, error } = await saveContactHistoryActivity({
        companyId: operation.companyId,
        type: "note",
        title: operation.title,
        description: operation.notes,
        source: "manual",
      });
      if (error || !activityId) {
        return { success: false, message: error ?? "Salvataggio nota non riuscito." };
      }
      revalidateCopilotPaths(operation.companyId);
      return {
        success: true,
        message: `Nota salvata su ${operation.companyName}.`,
        href: `/companies/${operation.companyId}`,
      };
    }

    case "navigate":
      return {
        success: true,
        message: `Apertura ${operation.label}.`,
        href: operation.href,
      };

    default:
      return { success: false, message: "Azione non supportata." };
  }
}
