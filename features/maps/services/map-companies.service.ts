import "server-only";

import { normalizeCommercialStatus } from "@/lib/constants/commercial-status";
import { createServerClient } from "@/lib/supabase/server";
import { describeDbError } from "@/lib/supabase/errors";
import type { CommercialStatus, GeocodeStatus, Json } from "@/lib/supabase/types";
import { resolveCompanyDisplayFields } from "@/features/companies/services/companies.service";
import { buildFullAddress } from "@/features/companies/utils/build-full-address";
import type { MapCompany } from "../types/map";

const MAP_COMPANY_COLUMNS =
  "id,name,city,province,latitude,longitude,commercial_status,geocode_status,address,street,street_number,postal_code,country,phone,contact_phone,mobile,phone_secondary,import_headers,import_payload,geocoding_normalized_address";

type MapCompanyRow = {
  id: string;
  name: string;
  city: string | null;
  province: string | null;
  latitude: number | null;
  longitude: number | null;
  commercial_status: CommercialStatus | null;
  geocode_status: GeocodeStatus;
  address: string | null;
  street: string | null;
  street_number: string | null;
  postal_code: string | null;
  country: string | null;
  phone: string | null;
  contact_phone: string | null;
  mobile: string | null;
  phone_secondary: string | null;
  import_headers: string[] | null;
  import_payload: Json | null;
  geocoding_normalized_address: string | null;
};

function mapMapCompany(row: MapCompanyRow): MapCompany | null {
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
    geocode_status: row.geocode_status,
    created_at: "",
    import_headers: row.import_headers,
    import_payload: row.import_payload,
  });
  const originalAddress = buildFullAddress(row);

  return {
    id: row.id,
    name: row.name,
    address: row.geocoding_normalized_address ?? originalAddress,
    phone: display.phone,
    city: row.city,
    province: row.province,
    commercial_status: normalizeCommercialStatus(row.commercial_status),
    geocode_status: row.geocode_status,
    latitude: row.latitude,
    longitude: row.longitude,
  };
}

export async function listMapCompanies(): Promise<{
  data: MapCompany[];
  error: string | null;
}> {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from("companies")
    .select(MAP_COMPANY_COLUMNS)
    .not("latitude", "is", null)
    .not("longitude", "is", null)
    .order("name", { ascending: true });

  if (error) {
    return { data: [], error: describeDbError(error) };
  }

  const companies = (data ?? [])
    .map((row) => mapMapCompany(row as MapCompanyRow))
    .filter((company): company is MapCompany => company !== null);

  return { data: companies, error: null };
}

export function getMapFilterOptions(companies: MapCompany[]): {
  provinces: string[];
  cities: string[];
} {
  const provinces = new Set<string>();
  const cities = new Set<string>();

  for (const company of companies) {
    if (company.province?.trim()) {
      provinces.add(company.province.trim());
    }
    if (company.city?.trim()) {
      cities.add(company.city.trim());
    }
  }

  return {
    provinces: Array.from(provinces).sort((a, b) => a.localeCompare(b, "it")),
    cities: Array.from(cities).sort((a, b) => a.localeCompare(b, "it")),
  };
}
