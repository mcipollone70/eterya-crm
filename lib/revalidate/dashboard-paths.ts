import { revalidatePath } from "next/cache";

/** Invalida le viste dashboard/Joy dopo mutazioni su entità collegate. */
export function revalidateDashboardPaths() {
  revalidatePath("/");
  revalidatePath("/command-center");
  revalidatePath("/joy");
  revalidatePath("/joy/chat");
  revalidatePath("/joy/autonomous");
  revalidatePath("/agenda");
  revalidatePath("/visits");
  revalidatePath("/routes");
  revalidatePath("/maps");
  revalidatePath("/auto");
}
