import { Suspense } from "react";
import { Mic } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/ui";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { isVoiceIntent } from "@/lib/voice/constants";
import { listVisitCompanyOptions } from "@/features/visits/services/visits.service";
import { VoiceOperationalHub } from "./components/voice-operational-hub";

interface VoicePageProps {
  company?: string;
  intent?: string;
}

export async function VoicePage({ company, intent }: VoicePageProps) {
  if (!isSupabaseConfigured()) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Funzioni vocali"
          subtitle="Dettatura operativa con riconoscimento vocale del browser."
        />
        <EmptyState
          icon={Mic}
          title="Database non configurato"
          message="Configura Supabase in .env.local per usare le funzioni vocali."
        />
      </div>
    );
  }

  const { data: companies, error } = await listVisitCompanyOptions();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Funzioni vocali"
        subtitle="Detta note di visita, follow-up e promemoria. Il testo trascritto è sempre modificabile prima del salvataggio."
      />

      {error ? (
        <EmptyState icon={Mic} title="Impossibile caricare le aziende" message={error} />
      ) : (
        <Suspense fallback={null}>
          <VoiceOperationalHub
            companies={companies}
            defaultCompanyId={company ?? ""}
            defaultIntent={isVoiceIntent(intent) ? intent : "visit_note"}
          />
        </Suspense>
      )}

      <p className="text-xs text-slate-500">
        Usa il riconoscimento vocale integrato nel browser (Web Speech API). Su mobile e desktop
        Chrome/Edge funziona al meglio; su Safari puoi digitare manualmente se la dettatura non è
        disponibile.
      </p>
    </div>
  );
}
