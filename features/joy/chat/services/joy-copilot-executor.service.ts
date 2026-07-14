import "server-only";

import { revalidatePath } from "next/cache";
import {
  agendaCancelItemAction,
  agendaSaveReminderAction,
  agendaUpdateItemAction,
} from "@/features/agenda/actions/agenda-actions";
import { saveFollowUpAction } from "@/features/activities/actions/follow-up-actions";
import { scheduleVisitAction } from "@/features/visits/actions/visit-mutations";
import type { JoyCopilotExecuteResult, JoyCopilotOperation } from "../types/joy-chat";

function revalidateCopilotPaths(companyId?: string | null) {
  revalidatePath("/joy/chat");
  revalidatePath("/joy");
  revalidatePath("/joy/autonomous");
  revalidatePath("/command-center");
  revalidatePath("/");
  revalidatePath("/visits");
  revalidatePath("/agenda");
  revalidatePath("/activities");
  revalidatePath("/auto");
  revalidatePath("/companies");
  revalidatePath("/opportunities");
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
      if (result.success) {
        revalidateCopilotPaths(operation.companyId);
      }
      return {
        success: result.success,
        message: result.success
          ? `Visita pianificata per ${operation.companyName}.`
          : result.message,
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
      if (result.success) {
        revalidateCopilotPaths(operation.companyId);
      }
      return {
        success: result.success,
        message: result.success
          ? `Follow-up creato per ${operation.companyName}.`
          : result.message,
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
