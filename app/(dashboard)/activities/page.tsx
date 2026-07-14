import { ActivitiesPage } from "@/features/activities";

export const dynamic = "force-dynamic";

export const metadata = { title: "Attività" };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    section?: string;
    view?: string;
    type?: string;
    period?: string;
    operator?: string;
    q?: string;
    fstatus?: string;
    fpriority?: string;
    fperiod?: string;
    fcompany?: string;
  }>;
}) {
  const params = await searchParams;
  return (
    <ActivitiesPage
      section={params.section}
      view={params.view}
      type={params.type}
      period={params.period}
      operator={params.operator}
      search={params.q}
      fstatus={params.fstatus}
      fpriority={params.fpriority}
      fperiod={params.fperiod}
      fcompany={params.fcompany}
    />
  );
}
