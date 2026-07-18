/** Notifications module — notifiche intelligenti cross-modulo. */
export const NOTIFICATIONS_MODULE = "notifications" as const;

export { NotificationsPage } from "./notifications-page";
export {
  getIntelligentNotifications,
  type IntelligentNotification,
  type IntelligentNotificationsResult,
} from "./services/notifications.service";
