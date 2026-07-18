import { getCurrentUser } from "@/features/auth/session";
import {
  processJoyChatMessage,
  type JoyChatContext,
} from "@/features/joy/chat/services/joy-chat-engine.service";
import { isSupabaseConfigured } from "@/lib/supabase/env";

const NOT_CONFIGURED_MESSAGE =
  "Database non configurato. Aggiungi NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local e riavvia il server.";

interface JoyChatRequestBody {
  message?: string;
  latitude?: number | null;
  longitude?: number | null;
  companyId?: string | null;
  memory?: JoyChatContext["memory"];
  autoBriefing?: boolean;
  guideMode?: boolean;
  driveMode?: boolean;
}

function encodeLine(payload: Record<string, unknown>): Uint8Array {
  return new TextEncoder().encode(`${JSON.stringify(payload)}\n`);
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return new Response(JSON.stringify({ error: "Non autenticato" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!isSupabaseConfigured()) {
    return new Response(JSON.stringify({ error: NOT_CONFIGURED_MESSAGE }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: JoyChatRequestBody;
  try {
    body = (await request.json()) as JoyChatRequestBody;
  } catch {
    return new Response(JSON.stringify({ error: "Richiesta non valida" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const message = body.message?.trim() ?? "";
  if (!message) {
    return new Response(JSON.stringify({ error: "Messaggio vuoto" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const context: JoyChatContext = {
    latitude: body.latitude ?? null,
    longitude: body.longitude ?? null,
    companyId: body.companyId ?? null,
    memory: body.memory ?? null,
    autoBriefing: Boolean(body.autoBriefing),
    guideMode: Boolean(body.guideMode),
    driveMode: Boolean(body.driveMode),
  };

  const response = await processJoyChatMessage(message, context);

  if (process.env.NODE_ENV !== "production") {
    console.info(
      "[joy-ai/chat]",
      JSON.stringify({
        rawText: message,
        userId: user.id,
        organizationHint: user.app_metadata?.organization_id ?? null,
        contentPreview: response.message.content.slice(0, 240),
        sessionState: response.sessionState ?? null,
        error: response.error ?? null,
        itemCount: response.message.items?.length ?? 0,
        itemNames: (response.message.items ?? []).slice(0, 6).map((i) => i.title),
      })
    );
  }

  const fullMessage = response.message;
  const content = fullMessage.content;
  const chunkSize = 18;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(
        encodeLine({
          type: "meta",
          message: {
            id: fullMessage.id,
            role: fullMessage.role,
            actions: fullMessage.actions,
            items: fullMessage.items,
            pendingAction: fullMessage.pendingAction,
            createdAt: fullMessage.createdAt,
          },
          memoryPatch: response.memoryPatch ?? null,
          sessionState: response.sessionState ?? null,
        })
      );

      for (let index = 0; index < content.length; index += chunkSize) {
        controller.enqueue(
          encodeLine({
            type: "chunk",
            text: content.slice(index, index + chunkSize),
          })
        );
        await new Promise((resolve) => setTimeout(resolve, 12));
      }

      controller.enqueue(
        encodeLine({
          type: "done",
          error: response.error ?? null,
        })
      );
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}
