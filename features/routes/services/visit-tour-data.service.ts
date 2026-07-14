import "server-only";

import { normalizeCommercialStatus } from "@/lib/constants/commercial-status";
import { resolveCompanyDisplayFields } from "@/features/companies/services/companies.service";
import { createServerClient } from "@/lib/supabase/server";
import { describeDbError } from "@/lib/supabase/errors";
import type { CommercialStatus, CompanyStatus, Json } from "@/lib/supabase/types";
import type { VisitTourCompany } from "../types/visit-tour";

const TOUR_COMPANY_COLUMNS =
  "id,name,city,province,latitude,longitude,commercial_status,status,revenue,last_visit_at,phone,contact_phone,mobile,phone_secondary,import_headers,import_payload";

type TourCompanyRow = {
  id: string;
  name: string;
  city: string | null;
  province: string | null;
  latitude: number | null;
  longitude: number | null;
  commercial_status: CommercialStatus | null;
  status: CompanyStatus;
  revenue: number | null;
  last_visit_at: string | null;
  phone: string | null;
  contact_phone: string | null;
  mobile: string | null;
  phone_secondary: string | null;
  import_headers: string[] | null;
  import_payload: Json | null;
};

function mapTourCompany(row: TourCompanyRow): VisitTourCompany | null {
  if (row.latitude === null || row.longitude === null) {
    return null;
  }

  const display = resolveCompanyDisplayFields({
    id: row.id,
    name: row.name,
    city: row.city,
    province: row.province,
    vat_number: null,
    phone: row.phone,
    email: null,
    contact_phone: row.contact_phone,
    mobile: row.mobile,
    phone_secondary: row.phone_secondary,
    status: "prospect",
    geocode_status: "completed",
    created_at: "",
    import_headers: row.import_headers,
    import_payload: row.import_payload,
  });

  return {
    id: row.id,
    name: row.name,
    city: row.city,
    province: row.province,
    phone: display.phone,
    commercial_status: normalizeCommercialStatus(row.commercial_status),
    status: row.status,
    latitude: row.latitude,
    longitude: row.longitude,
    revenue: row.revenue,
    lastVisitAt: row.last_visit_at,
    import_payload: row.import_payload,
  };
}

export async function getVisitTourCompanies(): Promise<{
  data: VisitTourCompany[];
  error: string | null;
}> {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from("companies")
    .select(TOUR_COMPANY_COLUMNS)
    .not("latitude", "is", null)
    .not("longitude", "is", null)
    .order("name", { ascending: true });

  if (error) {
    return { data: [], error: describeDbError(error) };
  }

  const companies = (data ?? [])
    .map((row) => mapTourCompany(row as TourCompanyRow))
    .filter((company): company is VisitTourCompany => company !== null);

  return { data: companies, error: null };
}
