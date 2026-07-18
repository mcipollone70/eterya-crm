/** Chiave sessionStorage: proposta Joy Drive → Giro Visite (non è un salvataggio CRM). */
export const JOY_TOUR_PROPOSAL_STORAGE_KEY = "eterya-joy-tour-proposal";

export interface JoyTourProposalPayload {
  stopCompanyIds: string[];
  origin: { lat: number; lng: number; label: string };
  destination: { lat: number; lng: number; label: string };
  day: "today" | "tomorrow";
  totalDistanceKm?: number;
  estimatedMinutes?: number;
  createdAt: string;
}

export function persistJoyTourProposal(payload: JoyTourProposalPayload): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.sessionStorage.setItem(JOY_TOUR_PROPOSAL_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // quota / private mode — URL query params restano il fallback
  }
}

export function loadJoyTourProposal(): JoyTourProposalPayload | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.sessionStorage.getItem(JOY_TOUR_PROPOSAL_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as JoyTourProposalPayload;
    if (!Array.isArray(parsed.stopCompanyIds) || parsed.stopCompanyIds.length === 0) {
      return null;
    }
    if (
      !parsed.origin ||
      !Number.isFinite(parsed.origin.lat) ||
      !Number.isFinite(parsed.origin.lng)
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearJoyTourProposal(): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.sessionStorage.removeItem(JOY_TOUR_PROPOSAL_STORAGE_KEY);
  } catch {
    // ignore
  }
}
