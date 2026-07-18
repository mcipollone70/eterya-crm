import { revalidatePath } from "next/cache";

/** Invalida le viste dashboard/Joy dopo mutazioni su entità collegate. */
export function revalidateDashboardPaths() {
  revalidatePath("/");
  revalidatePath("/mission-control");
  revalidatePath("/command-center");
  revalidatePath("/joy");
  revalidatePath("/joy-ai");
  revalidatePath("/joy/chat");
  revalidatePath("/joy/autonomous");
  revalidatePath("/agenda");
  revalidatePath("/visits");
  revalidatePath("/giro-visite");
  revalidatePath("/routes");
  revalidatePath("/maps");
  revalidatePath("/auto");
}
