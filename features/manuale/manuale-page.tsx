import packageJson from "@/package.json";
import { MANUAL_VERSION } from "./content/sections";
import { ManualeScreen } from "./components/manuale-screen";

interface ManualePageProps {
  isAdmin: boolean;
}

export function ManualePage({ isAdmin }: ManualePageProps) {
  const lastUpdated = new Intl.DateTimeFormat("it-IT", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());

  return (
    <ManualeScreen
      isAdmin={isAdmin}
      meta={{
        manualVersion: MANUAL_VERSION,
        crmVersion: packageJson.version,
        lastUpdated,
      }}
    />
  );
}
