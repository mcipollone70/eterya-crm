/** Service module — gestione assistenza post-vendita. */
export const SERVICE_MODULE = "service" as const;

export { ServicePage } from "./service-page";
export { ServiceTicketForm } from "./components/service-ticket-form";
export { ServiceTicketDetail } from "./components/service-ticket-detail";
export {
  saveServiceTicketAction,
  updateServiceTicketAction,
  deleteServiceTicketAction,
} from "./actions/service-ticket-actions";
export {
  listServiceTickets,
  getServiceTicketById,
  saveServiceTicket,
  updateServiceTicket,
  deleteServiceTicket,
  getServiceTicketsDashboardMetrics,
  listServiceTicketFilterOptions,
  type ServiceTicketListItem,
} from "./services/service-tickets.service";
