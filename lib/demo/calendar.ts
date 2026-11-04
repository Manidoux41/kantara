import type { BusinessState } from "./business-types";

export const calendarTimeZone = "Asia/Phnom_Penh";
export function calendarMonth(month: string) {
  const first = new Date(`${month}-01T00:00:00Z`);
  return { first, offset: (first.getUTCDay() + 6) % 7,
    days: new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate() };
}
export function cambodiaDate(instant = new Date()): string {
  return new Date(instant.getTime() + 7 * 3600000).toISOString().slice(0, 10);
}
export function localAppointmentTime(utc: string): string {
  return new Date(Date.parse(utc) + 7 * 3600000).toISOString().slice(0, 16);
}
export function appointmentUtc(local: string): string {
  return new Date(`${local}:00+07:00`).toISOString();
}
function icsText(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\r\n|\r|\n/g, "\\n").replace(/;/g, "\\;").replace(/,/g, "\\,");
}
function fold(line: string) {
  const parts: string[] = [];
  let current = "", bytes = 0;
  for (const char of line) {
    const length = new TextEncoder().encode(char).length;
    if (bytes + length > 75) { parts.push(current); current = " "; bytes = 1; }
    current += char; bytes += length;
  }
  parts.push(current);
  return parts.join("\r\n");
}
const timestamp = (value: string) => new Date(value).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
export function calendarIcs(state: BusinessState, production = false): string {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", `PRODID:-//KANTARA//${production ? "Agency Agenda" : "Local Demo Agenda"}//EN`, "CALSCALE:GREGORIAN", `X-WR-CALNAME:KANTARA${production ? "" : " DEMO"}`, `X-WR-TIMEZONE:${calendarTimeZone}`];
  for (const event of state.appointments) {
    const client = state.clients.find((item) => item.id === event.clientId);
    const agent = state.agents.find((item) => item.id === event.agentId);
    const property = state.properties.find((item) => item.id === event.propertyId);
    lines.push("BEGIN:VEVENT", `UID:${event.id}@${production ? "kantara.agency" : "kantara.demo"}`, `DTSTAMP:${timestamp(event.updatedAt)}`,
      `CREATED:${timestamp(event.createdAt)}`, `LAST-MODIFIED:${timestamp(event.updatedAt)}`, `SEQUENCE:${event.sequence}`,
      `DTSTART:${timestamp(event.startAt)}`, `DTEND:${timestamp(event.endAt)}`,
      `STATUS:${event.status === "CANCELLED" ? "CANCELLED" : "CONFIRMED"}`, `SUMMARY:${icsText(`${production ? "" : "DEMO - "}${event.title}`)}`,
      `LOCATION:${icsText(event.location)}`,
      `DESCRIPTION:${icsText([client?.name, agent?.name, property?.title, event.notes, event.feedback].filter(Boolean).join("\n"))}`,
      "END:VEVENT");
  }
  return lines.map(fold).join("\r\n") + "\r\nEND:VCALENDAR\r\n";
}
