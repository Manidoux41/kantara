"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { BusinessClient, BusinessState } from "@/lib/demo/business-types";
import { contactCategories, leadSources, leadStages, type CrmSummary } from "@/lib/demo/crm-types";
import { appointmentUtc, calendarMonth, cambodiaDate, localAppointmentTime } from "@/lib/demo/calendar";
import { locales } from "@/lib/i18n/routing";

export type WorkspaceCommand = (payload: Record<string, unknown>, form?: HTMLFormElement) => Promise<void>;
type Props = { state: BusinessState; busy: boolean; command: WorkspaceCommand };
export function CrmField({ label, children }: { label: string; children: ReactNode }) {
  return <label className="business-field"><span>{label}</span>{children}</label>;
}
function values(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();
  const form = event.currentTarget, data = new FormData(form);
  return { form, data, text: (name: string) => String(data.get(name) ?? "").trim() };
}
function RecordSelect({ label, name, items, optional = false, defaultValue }: {
  label: string; name: string; items: { id: string; name: string }[]; optional?: boolean; defaultValue?: string;
}) {
  const t = useTranslations("Crm");
  return <CrmField label={label}><select name={name} required={!optional} defaultValue={defaultValue}>
    {optional && <option value="">{t("none")}</option>}
    {items.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
  </select></CrmField>;
}
function Timeline({ state, clientId }: { state: BusinessState; clientId?: string }) {
  const t = useTranslations("Crm");
  const b = useTranslations("Business");
  const locale = useLocale();
  const activities = state.activities.filter((item) => !clientId || item.clientId === clientId).toReversed().slice(0, 100);
  return <ol className="crm-timeline">{activities.map((item) => <li key={item.id}>
    <time dateTime={item.at}>{new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Phnom_Penh" }).format(new Date(item.at))}</time>
    <strong>{t(item.channel)}</strong>
    <span>{item.channel !== "SYSTEM" ? item.text : item.action.startsWith("lead:")
      ? `${t("stage")} : ${t(item.action.slice(5))}`
      : item.action.startsWith("appointment:") ? `${t("calendar")} : ${t(item.action.slice(12))}`
        : item.action === "createClient" ? b("newClient") : item.action === "createProperty" ? b("newProperty")
          : item.action === "createContract" ? b("newContract") : item.action === "publish" ? b("publication")
            : item.action === "closeTransaction" ? b("closeTransaction") : item.action === "recordReceipt" ? b("recordReceipt")
              : item.action === "linkProperties" ? b("linkedProperties") : item.action === "updateContact" ? t("profile")
                : item.action === "createLead" ? t("newLead") : item.action === "updateAgentAvailability" ? t("availability")
                  : t(item.action === "rescheduleAppointment" ? "reschedule" : "newAppointment")}</span>
    {!clientId && <small>{state.clients.find((client) => client.id === item.clientId)?.name}</small>}
  </li>)}{!activities.length && <li>{t("empty")}</li>}</ol>;
}
export function CrmDashboard({ state, summary }: { state: BusinessState; summary: CrmSummary }) {
  const t = useTranslations("Crm"), b = useTranslations("Business");
  const peak = Math.max(1, ...summary.monthly.map((item) => Number(item.received)));
  return <>
    <div className="business-kpis">{(["contacts", "activeAgents", "openLeads", "conversionRate", "upcoming", "overdueFollowUps", "expiringContracts"] as const).map((key) =>
      <div key={key}><span>{t(key)}</span><strong>{summary[key]}</strong></div>)}
      {(["published", "available", "sold", "rented", "sales", "rentals"] as const).map((key) => <div key={key}>
        <span>{key === "sales" ? b("SALE_MANDATE") : key === "rentals" ? b("RENTAL_MANDATE") : b(({ published: "PUBLISHED", available: "AVAILABLE", sold: "SOLD", rented: "RENTED" } as const)[key])}</span>
        <strong>{summary[key]}</strong>
      </div>)}
    </div>
    <section className="business-form"><h2>{t("monthly")}</h2>
      <div className="crm-chart" aria-hidden="true">{summary.monthly.map((item) => <div key={item.month}>
        <span>{item.month}</span><div className="crm-chart-track"><span style={{ width: `${Number(item.received) / peak * 100}%` }} /></div><strong>{item.received}</strong>
      </div>)}</div>
      <div className="crm-table-scroll"><table><caption>{t("monthly")}</caption><thead><tr><th>{t("monthly")}</th><th>{b("realized")}</th><th>{b("received")}</th><th>{t("transactions")}</th></tr></thead>
        <tbody>{summary.monthly.map((item) => <tr key={item.month}><th scope="row">{item.month}</th><td>{item.realized}</td><td>{item.received}</td><td>{item.transactions}</td></tr>)}</tbody>
      </table></div>
    </section>
    <section className="business-form"><h2>{t("upcoming")}</h2><ul>{state.appointments.filter((item) => item.status === "SCHEDULED" && item.endAt >= new Date().toISOString())
      .sort((a, b) => a.startAt.localeCompare(b.startAt)).slice(0, 5).map((item) => <li key={item.id}>{localAppointmentTime(item.startAt).replace("T", " ")} · {item.title} · {state.clients.find((client) => client.id === item.clientId)?.name}</li>)}</ul></section>
    <section className="business-form"><h2>{t("activity")}</h2><Timeline state={state} /></section>
  </>;
}
export function ContactDetails({ client, state, busy, command }: Props & { client: BusinessClient }) {
  const t = useTranslations("Crm");
  const b = useTranslations("Business");
  const profile = client.profile;
  return <details className="crm-details"><summary>{t("profile")}</summary>
    <form key={`${client.id}-${state.revision}`} onSubmit={(event) => {
      const { form, data, text } = values(event);
      void command({ action: "updateContact", clientId: client.id, details: {
        name: text("editName"), address: text("editAddress"), identityReference: text("editIdentity"), nationality: text("editNationality"),
        email: text("editEmail"), phone: text("editPhone"),
      }, profile: {
        firstName: text("firstName"), lastName: text("lastName"), company: text("company"), whatsapp: text("whatsapp"),
        country: text("country"), preferredLanguage: text("preferredLanguage"), categories: data.getAll("categories").map(String),
        source: text("source"), assignedAgentId: text("assignedAgentId") || null, notes: text("notes"),
        tags: text("tags").split(",").map((item) => item.trim()).filter(Boolean), followUpDate: text("followUpDate") || null,
      } }, form);
    }}><fieldset disabled={busy}><div className="business-form-grid">
      {([
        ["editName", "name", client.name], ["editAddress", "address", client.address],
        ["editIdentity", "identityReference", client.identityReference], ["editNationality", "nationality", client.nationality],
        ["editEmail", "email", client.email], ["editPhone", "phone", client.phone],
      ] as const).map(([name, label, value]) => <CrmField key={name} label={b(label)}><input name={name} type={name === "editEmail" ? "email" : "text"} maxLength={name === "editPhone" ? 80 : 200} required={name !== "editEmail" && name !== "editPhone"} defaultValue={value} /></CrmField>)}
      {(["firstName", "lastName", "company", "whatsapp", "country"] as const).map((name) =>
        <CrmField key={name} label={t(name)}><input name={name} maxLength={name === "company" ? 200 : name === "whatsapp" ? 80 : 100} defaultValue={profile?.[name] ?? ""} /></CrmField>)}
      <CrmField label={t("language")}><select name="preferredLanguage" defaultValue={profile?.preferredLanguage ?? "en"}>{locales.map((locale) => <option key={locale} value={locale}>{locale.toUpperCase()}</option>)}</select></CrmField>
      <RecordSelect label={t("agent")} name="assignedAgentId" optional items={state.agents.filter((item) => item.active)} defaultValue={profile?.assignedAgentId ?? ""} />
      <CrmField label={t("source")}><select name="source" defaultValue={profile?.source ?? "DIRECT"}>{leadSources.map((source) => <option value={source} key={source}>{t(source)}</option>)}</select></CrmField>
      <CrmField label={t("tags")}><input name="tags" maxLength={800} defaultValue={profile?.tags.join(", ") ?? ""} /></CrmField>
      <CrmField label={t("followUp")}><input type="date" name="followUpDate" defaultValue={profile?.followUpDate ?? ""} /></CrmField>
    </div>
      <fieldset><legend>{t("categories")}</legend><div className="business-checks">{contactCategories.map((category) => <label key={category}>
        <input type="checkbox" name="categories" value={category} defaultChecked={profile?.categories.includes(category) ?? category === client.role} />{t(category)}
      </label>)}</div></fieldset>
      <CrmField label={t("notes")}><textarea name="notes" maxLength={4000} defaultValue={profile?.notes ?? ""} /></CrmField>
      <button type="submit" className="button button-dark">{t("save")}</button>
    </fieldset></form>
    <h4>{t("timeline")}</h4><Timeline state={state} clientId={client.id} />
    <form onSubmit={(event) => {
      const { form, text } = values(event);
      void command({ action: "addActivity", clientId: client.id, leadId: null, channel: text("channel"), text: text("text") }, form);
    }}><fieldset disabled={busy}><CrmField label={t("channel")}><select name="channel">{["NOTE", "EMAIL", "WHATSAPP", "PHONE"].map((item) => <option key={item} value={item}>{t(item)}</option>)}</select></CrmField>
      <CrmField label={t("notes")}><textarea name="text" required maxLength={200} /></CrmField><button type="submit" className="button button-dark">{t("addNote")}</button>
    </fieldset></form>
  </details>;
}
export function LeadWorkspace({ state, busy, command }: Props) {
  const t = useTranslations("Crm");
  const [stage, setStage] = useState("");
  return <>
    <p>{t("leadHelp")}</p>
    <form className="business-form" onSubmit={(event) => {
      const { form, data, text } = values(event);
      void command({ action: "createLead", input: {
        title: text("title"), clientId: text("clientId"), agentId: text("agentId"), source: text("source"),
        propertyIds: data.getAll("propertyIds").map(String), score: Number(text("score")), expectedCommission: text("expectedCommission"),
        followUpDate: text("followUpDate") || null, expectedClosingDate: text("expectedClosingDate") || null, notes: text("notes"),
      } }, form);
    }}><h2>{t("newLead")}</h2><fieldset disabled={busy}><div className="business-form-grid">
      <CrmField label={t("title")}><input name="title" required maxLength={200} /></CrmField>
      <RecordSelect label={t("contact")} name="clientId" items={state.clients} />
      <RecordSelect label={t("agent")} name="agentId" items={state.agents.filter((item) => item.active)} />
      <CrmField label={t("source")}><select name="source">{leadSources.map((source) => <option key={source} value={source}>{t(source)}</option>)}</select></CrmField>
      <CrmField label={t("score")}><input name="score" type="number" min="0" max="100" step="1" defaultValue="50" required /></CrmField>
      <CrmField label={t("expected")}><input name="expectedCommission" type="number" min="0" max="99999999999.99" step="0.01" required defaultValue="0" /></CrmField>
      <CrmField label={t("expectedClosing")}><input name="expectedClosingDate" type="date" /></CrmField>
      <CrmField label={t("followUp")}><input name="followUpDate" type="date" /></CrmField>
    </div><div className="business-checks">{state.properties.map((item) => <label key={item.id}><input type="checkbox" name="propertyIds" value={item.id} />{item.title}</label>)}</div>
      <CrmField label={t("notes")}><textarea name="notes" maxLength={4000} /></CrmField>
      <button type="submit" className="button button-dark" disabled={!state.clients.length}>{t("newLead")}</button>
    </fieldset></form>
    <CrmField label={t("stage")}><select value={stage} onChange={(event) => setStage(event.target.value)}><option value="">{t("none")}</option>{leadStages.map((item) => <option key={item} value={item}>{t(item)}</option>)}</select></CrmField>
    <div className="crm-pipeline" aria-label={t("leads")}>{leadStages.map((item) => <button key={item} type="button" aria-pressed={stage === item} onClick={() => setStage(stage === item ? "" : item)}>{t(item)} <strong>{state.leads.filter((lead) => lead.stage === item).length}</strong></button>)}</div>
    <div className="business-list">{state.leads.filter((item) => !stage || item.stage === stage).map((item) => <article key={item.id}>
      <h3>{item.title}</h3><span className="admin-badge">{t(item.stage)}</span>
      <p>{state.clients.find((client) => client.id === item.clientId)?.name} · {state.agents.find((agent) => agent.id === item.agentId)?.name}</p>
      <p>{t("score")}: {item.score} · {t("expected")}: {item.expectedCommission} · {t("followUp")}: {item.followUpDate ?? t("none")}</p>
      <p>{item.propertyIds.map((id) => state.properties.find((property) => property.id === id)?.title).join(" · ")}</p>
      <p>{item.notes} {item.lostReason}</p>
      {!["WON", "LOST"].includes(item.stage) && <form onSubmit={(event) => {
        const { text } = values(event); void command({ action: "advanceLead", leadId: item.id, stage: text("stage"), lostReason: text("lostReason"), followUpDate: text("followUpDate") || null });
      }}><fieldset disabled={busy}>
        <CrmField label={t("stage")}><select name="stage" defaultValue={item.stage}>{leadStages.map((value) => <option key={value} value={value}>{t(value)}</option>)}</select></CrmField>
        <CrmField label={t("lostReason")}><input name="lostReason" maxLength={4000} /></CrmField>
        <CrmField label={t("followUp")}><input name="followUpDate" type="date" defaultValue={item.followUpDate ?? ""} /></CrmField>
        <button type="submit" className="button button-dark">{t("save")}</button>
      </fieldset></form>}
    </article>)}</div>
  </>;
}
export function CalendarWorkspace({ state, busy, command }: Props) {
  const t = useTranslations("Crm"), locale = useLocale();
  const [date, setDate] = useState(cambodiaDate);
  const [month, setMonth] = useState(() => cambodiaDate().slice(0, 7));
  const [agentId, setAgentId] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const edited = state.appointments.find((item) => item.id === editing);
  const { first, offset, days } = calendarMonth(month);
  const events = state.appointments.filter((item) => !agentId || item.agentId === agentId);
  const displayed = events.filter((item) => localAppointmentTime(item.startAt).startsWith(date)).sort((a, b) => a.startAt.localeCompare(b.startAt));
  const changeMonth = (amount: number) => {
    const next = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + amount, 1)).toISOString().slice(0, 7);
    setMonth(next); setDate(`${next}-01`);
  };
  return <>
    <p>{t("timezone")}</p>
    <div className="crm-calendar-toolbar">
      <button type="button" className="text-button" onClick={() => changeMonth(-1)}>{t("previous")}</button>
      <h2>{new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" }).format(first)}</h2>
      <button type="button" className="text-button" onClick={() => changeMonth(1)}>{t("next")}</button>
      <button type="button" className="text-button" onClick={() => { const today = cambodiaDate(); setDate(today); setMonth(today.slice(0, 7)); }}>{t("today")}</button>
      <a className="button button-dark" href="/api/demo/admin/calendar" download="kantara-demo.ics">{t("export")}</a>
    </div>
    <CrmField label={t("agent")}><select value={agentId} onChange={(event) => setAgentId(event.target.value)}><option value="">{t("none")}</option>{state.agents.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></CrmField>
    <div className="crm-calendar" role="group" aria-label={t("calendar")}>
      {Array.from({ length: 7 }, (_, index) => <div key={`weekday-${index}`} className="crm-weekday">{new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" }).format(new Date(Date.UTC(2026, 10, 2 + index)))}</div>)}
      {Array.from({ length: offset }, (_, index) => <span key={`blank-${index}`} />)}
      {Array.from({ length: days }, (_, index) => {
        const day = `${month}-${String(index + 1).padStart(2, "0")}`;
        const count = events.filter((item) => item.status !== "CANCELLED" && localAppointmentTime(item.startAt).startsWith(day)).length;
        return <button key={day} type="button" aria-label={`${day} · ${count}`} aria-pressed={date === day}
          aria-current={day === cambodiaDate() ? "date" : undefined} data-has-events={count > 0}
          onClick={() => { setDate(day); setEditing(null); }}>
          <span>{index + 1}</span>{count > 0 && <strong>{count}</strong>}
        </button>;
      })}
    </div>
    <h3>{date} · {t("calendar")}</h3>
    <div className="business-list">{!displayed.length && <p>{t("empty")}</p>}{displayed.map((item) => <article key={item.id}>
      <h3>{item.title}</h3><span className="admin-badge" data-status={item.status}>{t(item.status)}</span>
      <p>{localAppointmentTime(item.startAt).slice(11)}–{localAppointmentTime(item.endAt).slice(11)} · {item.location}</p>
      <p>{state.clients.find((client) => client.id === item.clientId)?.name} · {state.agents.find((agent) => agent.id === item.agentId)?.name}</p>
      <p>{state.properties.find((property) => property.id === item.propertyId)?.title} · {item.notes}</p>
      <p>{item.feedback} · {t(item.interest)}</p>
      {item.status === "SCHEDULED" && <>
        <button type="button" className="text-button" disabled={busy} onClick={() => setEditing(item.id)}>{t("reschedule")}</button>
        <form onSubmit={(event) => {
          const { text } = values(event); const status = text("status");
          void command({ action: "finishAppointment", appointmentId: item.id, status, feedback: text("feedback"), interest: text("interest") });
        }}><fieldset disabled={busy}>
          <CrmField label={t("feedback")}><textarea name="feedback" required minLength={3} maxLength={4000} /></CrmField>
          <CrmField label={t("interest")}><select name="interest">{["UNKNOWN", "LOW", "MEDIUM", "HIGH"].map((interest) => <option value={interest} key={interest}>{t(interest)}</option>)}</select></CrmField>
          <CrmField label={t("stage")}><select name="status"><option value="CANCELLED">{t("cancel")}</option><option value="COMPLETED">{t("complete")}</option></select></CrmField>
          <button type="submit" className="button button-dark">{t("save")}</button>
        </fieldset></form>
      </>}
    </article>)}</div>
    <form className="business-form" key={`${editing ?? "new"}-${date}`} onSubmit={(event) => {
      const { form, text } = values(event);
      void command({
        action: editing ? "rescheduleAppointment" : "createAppointment", ...(editing ? { appointmentId: editing } : {}),
        input: { title: text("title"), clientId: text("clientId"), agentId: text("agentId"), propertyId: text("propertyId") || null,
          leadId: text("leadId") || null, startAt: appointmentUtc(text("startAt")), endAt: appointmentUtc(text("endAt")), location: text("location"), notes: text("notes") },
      }, form);
    }}><h2>{t(editing ? "reschedule" : "newAppointment")}</h2>
      {editing && <button type="button" className="text-button" onClick={() => setEditing(null)}>{t("newAppointment")}</button>}
      <fieldset disabled={busy}><div className="business-form-grid">
        <CrmField label={t("title")}><input name="title" required maxLength={200} defaultValue={edited?.title ?? ""} /></CrmField>
        <RecordSelect label={t("contact")} name="clientId" items={state.clients} defaultValue={edited?.clientId} />
        <RecordSelect label={t("agent")} name="agentId" items={state.agents.filter((item) => item.active)} defaultValue={edited?.agentId ?? (agentId || undefined)} />
        <RecordSelect label={t("property")} name="propertyId" optional items={state.properties.map((item) => ({ id: item.id, name: item.title }))} defaultValue={edited?.propertyId ?? ""} />
        <RecordSelect label={t("leads")} name="leadId" optional items={state.leads.map((item) => ({ id: item.id, name: item.title }))} defaultValue={edited?.leadId ?? ""} />
        <CrmField label={t("start")}><input type="datetime-local" name="startAt" required defaultValue={edited ? localAppointmentTime(edited.startAt) : `${date}T09:00`} /></CrmField>
        <CrmField label={t("end")}><input type="datetime-local" name="endAt" required defaultValue={edited ? localAppointmentTime(edited.endAt) : `${date}T10:00`} /></CrmField>
        <CrmField label={t("location")}><input name="location" required maxLength={200} defaultValue={edited?.location ?? ""} /></CrmField>
      </div><CrmField label={t("notes")}><textarea name="notes" maxLength={4000} defaultValue={edited?.notes ?? ""} /></CrmField>
        <button type="submit" className="button button-dark" disabled={!state.clients.length}>{t(editing ? "reschedule" : "newAppointment")}</button>
      </fieldset>
    </form>
    <details className="business-form"><summary>{t("availability")}</summary><div className="business-list">
      {state.agents.map((agent) => <form key={`${agent.id}-${state.revision}`} onSubmit={(event) => {
        const { data, text } = values(event);
        const minutes = (value: string) => { const [hour, minute] = value.split(":").map(Number); return hour * 60 + minute; };
        void command({ action: "updateAgentAvailability", agentId: agent.id, input: {
          workdays: data.getAll("workdays").map(Number), startMinute: minutes(text("startTime")), endMinute: minutes(text("endTime")),
        } });
      }}><h3>{agent.name}</h3><fieldset disabled={busy}><div className="business-checks">
        {Array.from({ length: 7 }, (_, index) => <label key={index}><input name="workdays" type="checkbox" value={index} defaultChecked={agent.workdays.includes(index)} />
          {new Intl.DateTimeFormat(locale, { weekday: "long", timeZone: "UTC" }).format(new Date(Date.UTC(2026, 10, 1 + index)))}
        </label>)}
      </div><div className="business-form-grid">
        <CrmField label={t("start")}><input type="time" name="startTime" required defaultValue={`${String(Math.floor(agent.startMinute / 60)).padStart(2, "0")}:${String(agent.startMinute % 60).padStart(2, "0")}`} /></CrmField>
        <CrmField label={t("end")}><input type="time" name="endTime" required defaultValue={`${String(Math.floor(agent.endMinute / 60)).padStart(2, "0")}:${String(agent.endMinute % 60).padStart(2, "0")}`} /></CrmField>
      </div><button type="submit" className="button button-dark">{t("save")}</button></fieldset></form>)}
    </div></details>
  </>;
}
export function ActivityWorkspace({ state }: { state: BusinessState }) {
  const t = useTranslations("Crm");
  return <><h2>{t("activity")}</h2><p>{t("activityHelp")}</p><Timeline state={state} /></>;
}
