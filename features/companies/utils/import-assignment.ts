import type { CompanyInsert } from "./build-db-rows";

/** Assegna l'agente corrente alle nuove righe, senza sovrascrivere un valore già presente. */
export function resolveAssignedUserIdForInsert(
  row: CompanyInsert,
  currentUserId: string | null
): CompanyInsert {
  if (row.assigned_user_id || !currentUserId) {
    return row;
  }

  return { ...row, assigned_user_id: currentUserId };
}

/** Preserva l'assegnazione esistente in aggiornamento; assegna solo se ancora nulla. */
export function resolveAssignedUserIdForUpdate(
  row: CompanyInsert,
  existingAssignedUserId: string | null,
  currentUserId: string | null
): CompanyInsert {
  const payload = { ...row };

  if (existingAssignedUserId) {
    delete payload.assigned_user_id;
    return payload;
  }

  if (payload.assigned_user_id || !currentUserId) {
    return payload;
  }

  payload.assigned_user_id = currentUserId;
  return payload;
}
