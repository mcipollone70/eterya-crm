import "server-only";

import { listSamples } from "@/features/samples/services/samples.service";
import { SAMPLE_STATUS_LABELS } from "@/lib/constants/samples";
import { emptyToolResult, successToolResult, type JoyToolResult } from "./types";

export interface JoySampleToRecover {
  id: string;
  title: string;
  companyId: string;
  companyName: string | null;
  status: string;
  givenAt: string;
  expectedReturnAt: string;
  daysOverdue: number;
}

export interface JoySamplesToRecoverSnapshot {
  count: number;
  samples: JoySampleToRecover[];
  summaryText: string;
}

function daysSince(isoDate: string): number {
  const target = new Date(isoDate);
  if (Number.isNaN(target.getTime())) return 0;
  const diffMs = Date.now() - target.getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

export async function getSamplesToRecover(options?: {
  companyId?: string;
  limit?: number;
}): Promise<JoyToolResult<JoySamplesToRecoverSnapshot | null>> {
  const limit = options?.limit ?? 30;

  try {
    const { data, error } = await listSamples({
      filters: {
        companyId: options?.companyId,
        status: "consegnato",
      },
      limit: 200,
    });

    if (error) {
      return emptyToolResult(null, error);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const overdue = (data ?? [])
      .filter((item) => {
        if (!item.expected_return_at) return false;
        const due = new Date(item.expected_return_at);
        if (Number.isNaN(due.getTime())) return false;
        due.setHours(0, 0, 0, 0);
        return due.getTime() < today.getTime();
      })
      .map((item) => ({
        id: item.id,
        title: item.title,
        companyId: item.company_id,
        companyName: item.company_name,
        status: SAMPLE_STATUS_LABELS[item.status],
        givenAt: item.given_at,
        expectedReturnAt: item.expected_return_at as string,
        daysOverdue: daysSince(item.expected_return_at as string),
      }))
      .sort((a, b) => b.daysOverdue - a.daysOverdue)
      .slice(0, limit);

    if (overdue.length === 0) {
      return successToolResult({
        count: 0,
        samples: [],
        summaryText: "Nessun campione con rientro previsto superato.",
      });
    }

    const lines = overdue.map(
      (item) =>
        `• **${item.companyName ?? "Azienda"}** — ${item.title} (scaduto da ${item.daysOverdue} gg)`
    );

    return successToolResult({
      count: overdue.length,
      samples: overdue,
      summaryText: `Campioni da recuperare: **${overdue.length}**.\n\n${lines.join("\n")}`,
    });
  } catch (error) {
    return emptyToolResult(
      null,
      error instanceof Error ? error.message : "Impossibile caricare i campioni da recuperare."
    );
  }
}
