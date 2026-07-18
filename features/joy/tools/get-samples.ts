import "server-only";

import { listSamples } from "@/features/samples/services/samples.service";
import { SAMPLE_STATUS_LABELS } from "@/lib/constants/samples";
import { emptyToolResult, successToolResult, type JoyToolResult } from "./types";

export interface JoySamplesSnapshot {
  total: number;
  outstanding: number;
  purchased: number;
  recentSamples: Array<{
    id: string;
    title: string;
    companyName: string | null;
    status: string;
    givenAt: string;
  }>;
}

export async function getSamples(): Promise<JoyToolResult<JoySamplesSnapshot | null>> {
  try {
    const { data, count, error } = await listSamples({ limit: 50 });

    if (error) {
      return emptyToolResult(null, error);
    }

    return successToolResult({
      total: count,
      outstanding: (data ?? []).filter((item) => item.status === "consegnato").length,
      purchased: (data ?? []).filter((item) => item.status === "acquistato").length,
      recentSamples: (data ?? []).slice(0, 8).map((item) => ({
        id: item.id,
        title: item.title,
        companyName: item.company_name,
        status: SAMPLE_STATUS_LABELS[item.status],
        givenAt: item.given_at,
      })),
    });
  } catch (error) {
    return emptyToolResult(
      null,
      error instanceof Error ? error.message : "Impossibile caricare i campioni."
    );
  }
}
