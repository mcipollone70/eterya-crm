import "server-only";

import {
  listContacts,
  listContactsByCompany,
  type ContactListItem,
} from "@/features/contacts/services/contacts.service";
import { emptyToolResult, successToolResult, type JoyToolResult } from "./types";

export interface JoyContactRecord {
  id: string;
  fullName: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  isPrimary: boolean;
  companyId: string;
  companyName: string | null;
}

export interface GetContactsOptions {
  companyId?: string;
  limit?: number;
}

function mapContact(row: ContactListItem): JoyContactRecord {
  return {
    id: row.id,
    fullName: row.full_name,
    role: row.role,
    email: row.email,
    phone: row.phone,
    mobile: row.mobile,
    isPrimary: row.is_primary,
    companyId: row.company_id,
    companyName: row.company?.name ?? null,
  };
}

export async function getContacts(
  options: GetContactsOptions = {}
): Promise<JoyToolResult<{ rows: JoyContactRecord[]; total: number }>> {
  const limit = options.limit ?? 12;

  try {
    if (options.companyId) {
      const { data, error } = await listContactsByCompany(options.companyId);
      if (error) {
        return emptyToolResult({ rows: [], total: 0 }, error);
      }
      const rows = (data ?? []).slice(0, limit).map(mapContact);
      return successToolResult({ rows, total: data?.length ?? 0 });
    }

    const { data, count, error } = await listContacts(limit);
    if (error) {
      return emptyToolResult({ rows: [], total: 0 }, error);
    }

    const rows = (data ?? []).map(mapContact);
    return successToolResult({ rows, total: count ?? rows.length });
  } catch (error) {
    return emptyToolResult(
      { rows: [], total: 0 },
      error instanceof Error ? error.message : "Impossibile caricare i contatti."
    );
  }
}
