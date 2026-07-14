"use server";

import { fetchPriorityContext } from "@/features/companies/services/commercial-priority.service";
import type { PriorityContext } from "@/lib/commercial-priority/types";

export async function fetchPriorityContextAction(): Promise<PriorityContext> {
  return fetchPriorityContext();
}
