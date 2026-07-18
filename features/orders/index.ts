/** Orders module — ordini commerciali. */
export const ORDERS_MODULE = "orders" as const;

export { OrdersPage } from "./orders-page";
export {
  listOrders,
  getOrderById,
  saveOrder,
  updateOrder,
  getOrderDashboardMetrics,
  listOrderFilterOptions,
  type OrderListItem,
} from "./services/orders.service";
export type { SaveOrderInput, UpdateOrderInput } from "./types";
