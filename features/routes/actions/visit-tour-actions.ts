"use server";

import {
  fetchVisitTourOptimizeContext,
  saveVisitTour,
  type SaveVisitTourInput,
} from "../services/visit-tour-optimize.service";
import type { VisitTourOptimizeContext } from "@/lib/visit-tour/scoring";

export async function fetchVisitTourOptimizeContextAction(): Promise<VisitTourOptimizeContext> {
  return fetchVisitTourOptimizeContext();
}

export async function saveVisitTourAction(
  input: SaveVisitTourInput
): Promise<{ success: boolean; message: string; tourId?: string }> {
  return saveVisitTour(input);
}
