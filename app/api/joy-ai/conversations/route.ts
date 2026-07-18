import { getCurrentUser } from "@/features/auth/session";
import {
  createJoyConversation,
  deleteJoyConversation,
  listJoyConversations,
  updateJoyConversation,
} from "@/features/joy/chat/services/joy-conversations-db.service";
import type { JoyChatMessage } from "@/features/joy/chat/types/joy-chat";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export async function GET() {
  if (!isSupabaseConfigured()) {
    return Response.json({ conversations: [], tableMissing: true });
  }

  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: "Non autenticato" }, { status: 401 });
  }

  const result = await listJoyConversations();
  return Response.json({
    conversations: result.data,
    tableMissing: result.tableMissing,
    error: result.error,
  });
}

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return Response.json({ error: "Database non configurato" }, { status: 503 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: "Non autenticato" }, { status: 401 });
  }

  let body: { title?: string };
  try {
    body = (await request.json()) as { title?: string };
  } catch {
    body = {};
  }

  const result = await createJoyConversation(body.title ?? "Nuova chat");
  if (!result.data) {
    return Response.json(
      { error: result.error, tableMissing: result.tableMissing },
      { status: result.tableMissing ? 503 : 500 }
    );
  }

  return Response.json({ conversation: result.data });
}

export async function PATCH(request: Request) {
  if (!isSupabaseConfigured()) {
    return Response.json({ error: "Database non configurato" }, { status: 503 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: "Non autenticato" }, { status: 401 });
  }

  let body: { id?: string; title?: string; messages?: JoyChatMessage[] };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: "Richiesta non valida" }, { status: 400 });
  }

  if (!body.id) {
    return Response.json({ error: "ID conversazione mancante" }, { status: 400 });
  }

  const result = await updateJoyConversation(body.id, {
    title: body.title,
    messages: body.messages,
  });

  if (result.error) {
    return Response.json(
      { error: result.error, tableMissing: result.tableMissing },
      { status: result.tableMissing ? 503 : 500 }
    );
  }

  return Response.json({ ok: true });
}

export async function DELETE(request: Request) {
  if (!isSupabaseConfigured()) {
    return Response.json({ error: "Database non configurato" }, { status: 503 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: "Non autenticato" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return Response.json({ error: "ID conversazione mancante" }, { status: 400 });
  }

  const result = await deleteJoyConversation(id);
  if (result.error) {
    return Response.json(
      { error: result.error, tableMissing: result.tableMissing },
      { status: result.tableMissing ? 503 : 500 }
    );
  }

  return Response.json({ ok: true });
}
