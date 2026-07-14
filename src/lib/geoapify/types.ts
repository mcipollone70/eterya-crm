export type GeoapifyConfigLabel = "Geoapify configurato" | "Chiave mancante";

export interface GeoapifyConfigView {
  configured: boolean;
  label: GeoapifyConfigLabel;
}

export const DEFAULT_GEOAPIFY_CONFIG: GeoapifyConfigView = {
  configured: false,
  label: "Chiave mancante",
};
