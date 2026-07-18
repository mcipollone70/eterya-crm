export function resolveGreetingSalutation(date = new Date()): string {
  const hour = date.getHours();
  if (hour < 12) {
    return "Buongiorno";
  }
  if (hour < 18) {
    return "Buon pomeriggio";
  }
  return "Buonasera";
}

export function formatDashboardDateLabel(date = new Date()): string {
  return new Intl.DateTimeFormat("it-IT", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

export function formatDashboardWeekdayLabel(date = new Date()): string {
  const label = new Intl.DateTimeFormat("it-IT", { weekday: "long" }).format(date);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function resolveDisplayName(
  fullName: string | null | undefined,
  email: string | null | undefined
): string {
  if (fullName?.trim()) {
    return fullName.trim();
  }
  if (email?.trim()) {
    return email.split("@")[0] ?? "Agente";
  }
  return "Agente";
}
