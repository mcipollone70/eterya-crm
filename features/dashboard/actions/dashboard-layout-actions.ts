"use server";

import {
  getCommercialDashboardData,
  getUserDashboardLayout,
  saveUserDashboardLayout,
} from "../services/commercial-dashboard.service";
import type { DashboardLayoutState, DashboardWidgetId } from "../types/commercial-dashboard";

export async function fetchCommercialDashboardAction() {
  return getCommercialDashboardData();
}

export async function fetchDashboardLayoutAction(): Promise<{
  data: DashboardLayoutState;
  error: string | null;
}> {
  return getUserDashboardLayout();
}

export async function saveDashboardLayoutAction(input: {
  widgetOrder: DashboardWidgetId[];
  hiddenWidgets: DashboardWidgetId[];
}): Promise<{ success: boolean; message: string }> {
  return saveUserDashboardLayout(input);
}
