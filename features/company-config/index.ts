/** Company config module — configurazione azienda. */
export const COMPANY_CONFIG_MODULE = "company-config" as const;

export { CompanyConfigPage } from "./company-config-page";
export {
  getCompanyConfig,
  saveCompanyConfig,
  DEFAULT_COMPANY_CONFIG,
  type CompanyConfig,
} from "./services/company-config.service";
