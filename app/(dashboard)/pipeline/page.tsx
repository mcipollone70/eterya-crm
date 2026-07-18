import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata = { title: "Pipeline Commerciale" };

/** Alias route for the commercial pipeline Kanban view. */
export default function PipelinePage() {
  redirect("/opportunities");
}
