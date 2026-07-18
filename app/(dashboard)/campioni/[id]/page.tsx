import { notFound } from "next/navigation";
import { Boxes } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/ui";
import { SampleDetail } from "@/features/samples";
import { getSampleById } from "@/features/samples/services/samples.service";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";

export const metadata = { title: "Dettaglio campione" };

export default async function SamplePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  if (!isSupabaseConfigured()) {
    return (
      <div className="space-y-6">
        <PageHeader title="Dettaglio campione" />
        <EmptyState icon={Boxes} title="Database non configurato" message="Configura Supabase." />
      </div>
    );
  }

  const sample = await getSampleById(id);
  if (!sample) {
    notFound();
  }

  return <SampleDetail sample={sample} />;
}
