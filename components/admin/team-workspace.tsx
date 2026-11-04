"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Image from "next/image";
import { z } from "zod";
import { teamMessages, type TeamMessage } from "@/lib/i18n/team";
import { crmMessages } from "@/lib/i18n/crm";
import type { Locale } from "@/lib/i18n/routing";
import { employmentInput, teamViewSchema, type TeamView, type EmploymentInput } from "@/lib/team/schema";
import { employmentExample } from "@/lib/team/examples";
import { calendarMonth, cambodiaDate, localAppointmentTime } from "@/lib/demo/calendar";
import { propertyMessages } from "@/lib/i18n/property";
import { agencyMessages } from "@/lib/i18n/production";

const envelope = z.object({ data: z.unknown().optional(), error: z.object({ code: z.string(), message: z.string() }).optional() });
const contractFields = Object.keys(employmentExample) as (keyof EmploymentInput)[];
const leadStages = ["CONTACTED", "QUALIFIED", "SEARCH", "VISIT", "OFFER", "NEGOTIATION"];
const loginPattern = "[a-zA-Z0-9][a-zA-Z0-9._\\-]{3,49}";
function values(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();
  return new FormData(event.currentTarget);
}
function string(data: FormData, key: string) { return String(data.get(key) ?? ""); }

export function TeamWorkspace({ locale, production = false, onAccount }: {
  locale: Locale; production?: boolean; onAccount?: (role: "ADMIN" | "AGENT" | null) => void;
}) {
  const endpoint = production ? "/api/agency/team" : "/api/demo/team";
  const agency = agencyMessages(locale);
  const t = { ...teamMessages(locale), ...(production ? {
    file: agency.file, fileHelp: agency.hiringFileHelp, contract: agency.employment,
    generate: agency.generateEmployment, legalNotice: agency.contractHelp, success: agency.saved,
  } : {}) }, crm = crmMessages(locale);
  const contact = propertyMessages(locale);
  const [view, setView] = useState<TeamView | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selected, setSelected] = useState("");
  const [tab, setTab] = useState<"properties" | "prospects" | "calendar" | "commissions" | "hiring" | "inquiries">("properties");
  const [contractValues, setContractValues] = useState<Partial<EmploymentInput>>({});
  const [calendarDay, setCalendarDay] = useState("");
  const [month, setMonth] = useState("");
  const refresh = useCallback(async (signal?: AbortSignal) => {
    const response = await fetch(endpoint, { cache: "no-store", signal });
    const payload = envelope.parse(await response.json());
    if (response.status === 401) { setView(null); onAccount?.(null); return; }
    if (!response.ok) throw new Error(payload.error?.message ?? t.error);
    const next = teamViewSchema.parse(payload.data);
    setView(next); onAccount?.(next.account.mustChangePassword ? null : next.account.role);
  }, [t.error, endpoint, onAccount]);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    refresh(controller.signal).catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : t.error); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; controller.abort(); };
  }, [refresh, t.error]);

  async function send(input: Record<string, unknown>, after?: () => void) {
    if (busy) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch(endpoint, {
        method: "POST", headers: { "Content-Type": "application/json", "X-Kantara-Demo": "local" },
        body: JSON.stringify({ ...input, ...(input.action !== "login" && input.action !== "logout" && input.action !== "changePassword" ? { revision: view?.revision } : {}) }),
      });
      const payload = envelope.parse(await response.json());
      if (!response.ok) {
        if (response.status === 401) { setView(null); onAccount?.(null); }
        throw new Error(payload.error?.message ?? t.error);
      }
      if (input.action === "logout") { setView(null); onAccount?.(null); setSelected(""); setTab("properties"); }
      else { await refresh(); after?.(); setNotice(t.success); }
    } catch (cause) { setError(cause instanceof Error ? cause.message : t.error); }
    finally { setBusy(false); }
  }
  async function upload(event: FormEvent<HTMLFormElement>) {
    const data = values(event), file = data.get("file");
    if (!(file instanceof File) || !file.size) { setError(t.fileHelp); return; }
    if (file.size > (production ? 2.5 : 5) * 1024 * 1024 || !["application/pdf", "image/jpeg", "image/png"].includes(file.type)) { setError(production ? "Maximum 2.5 MiB (PDF, JPG, PNG)." : t.fileHelp); return; }
    setError("");
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error(t.error));
        reader.onload = () => typeof reader.result === "string" ? resolve(reader.result.split(",")[1]) : reject(new Error(t.error));
        reader.readAsDataURL(file);
      });
      await send({ action: "upload", candidateId: selected, input: { kind: string(data, "kind"), name: file.name, mime: file.type, base64 } });
    } catch (cause) { setError(cause instanceof Error ? cause.message : t.error); }
  }
  async function downloadEmployment(candidateId: string, contractId: string) {
    if (busy) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch(`${endpoint}/employment/${candidateId}`, { cache: "no-store" });
      if (!response.ok) {
        const payload = response.headers.get("content-type")?.includes("application/json")
          ? envelope.parse(await response.json()) : null;
        throw new Error(payload?.error ? `${payload.error.message} (${payload.error.code})` : `HTTP ${response.status}`);
      }
      if (!response.headers.get("content-type")?.startsWith("application/pdf")) throw new Error(t.error);
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url; link.download = `kantara-employment-${contractId}-en-km.pdf`;
      document.body.append(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
      setNotice(t.success);
    } catch (cause) { setError(cause instanceof Error ? cause.message : t.error); }
    finally { setBusy(false); }
  }
  const candidate = view?.candidates?.find((item) => item.id === selected);
  const monthGrid = month ? calendarMonth(month) : null;
  const agents = view?.accounts?.filter((item) => item.role === "AGENT" && item.active) ?? [];
  const label = (name: TeamMessage, content: React.ReactNode) => <label>{t[name]}{content}</label>;
  const passwordForm = <form className="team-form" onSubmit={(event) => {
    const form = event.currentTarget;
    const data = values(event); void send({ action: "changePassword", currentPassword: string(data, "currentPassword"), password: string(data, "password") }, () => form.reset());
  }}>
    {label("password", <input name="currentPassword" type="password" autoComplete="current-password" required maxLength={128} />)}
    {label("newPassword", <input name="password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required />)}
    <button className="button button-dark">{t.change}</button>
  </form>;

  return <section className="team-workspace" aria-busy={busy}>
    {error && <p className="team-error" role="alert">{t.error} {error}</p>}
    {notice && <p className="team-success" role="status">{notice}</p>}
    {busy && <p role="status">{t.loading}</p>}
    <fieldset className="team-controls" disabled={busy}>
      {!view ? <form className="team-form team-login" onSubmit={(event) => {
        const data = values(event); void send({ action: "login", login: string(data, "login"), password: string(data, "password") });
      }}>
        <h2>{t.signIn}</h2>
        {label("login", <input name="login" autoComplete="username" required minLength={4} maxLength={production ? 254 : 50} pattern={production ? undefined : loginPattern} />)}
        {label("password", <input name="password" type="password" autoComplete="current-password" required maxLength={128} />)}
        <button className="button button-dark">{t.signIn}</button>
      </form> : <>
        <div className="team-session">
          <div><h2>{view.account.name}</h2><p>{t[view.account.role === "ADMIN" ? "admin" : "agent"]} · <strong>{view.account.login}</strong></p></div>
          <button type="button" className="button button-outline" onClick={() => void send({ action: "logout" })}>{t.signOut}</button>
        </div>
        {view.account.mustChangePassword ? <><p className="information-notice">{t.firstLogin}</p>{passwordForm}</> : <>
          <nav className="team-tabs" aria-label={t.title}>
            {(["properties", ...(!production ? ["prospects", "calendar", "commissions"] as const : []), "inquiries", ...(view.account.role === "ADMIN" ? ["hiring"] as const : [])] as const).map((item) =>
              <button type="button" key={item} aria-current={tab === item ? "page" : undefined} onClick={() => {
                setTab(item); setNotice("");
                if (item === "calendar" && !month) setMonth(cambodiaDate().slice(0, 7));
              }}>{item === "inquiries" ? contact.inquiries : t[item]}</button>)}
            <button type="button" onClick={() => { setBusy(true); setError(""); refresh().catch((cause: unknown) => setError(cause instanceof Error ? cause.message : t.error)).finally(() => setBusy(false)); }}>{t.refresh}</button>
          </nav>
          {tab === "properties" && <section><h2>{t.properties}</h2>
            <div className="team-cards">{view.properties.map((item) => <article key={item.id} data-property-id={item.id} data-agent-id={item.agentId ?? ""}>
              <h3>{item.title}</h3><p>{item.location} · {new Intl.NumberFormat(locale, { style: "currency", currency: "USD" }).format(item.price)}</p><p>{item.id}</p>
              {view.account.role === "ADMIN" && <form className="team-form" onSubmit={(event) => {
                const data = values(event); void send({ action: "assignProperty", propertyId: item.id, agentId: string(data, "agentId") });
              }}>{label("agent", <select name="agentId" required defaultValue={item.agentId ?? ""}>
                <option value="">—</option>{agents.map((agent) => <option key={agent.id} value={agent.agentId ?? ""}>{agent.name}</option>)}
              </select>)}<button>{t.assign}</button>
                {!production && item.agentId && <button type="button" onClick={() => void send({ action: "sampleWork", propertyId: item.id, agentId: item.agentId })}>{t.sample}</button>}
              </form>}
            </article>)}</div>{view.properties.length === 0 && <p>{t.empty}</p>}
          </section>}
          {tab === "prospects" && <section><h2>{t.prospects}</h2><div className="team-cards">{view.work.map((item) => <article key={item.id}>
            <h3>{item.prospect}</h3><p>{item.propertyId} · {crm[item.stage]}</p><form className="team-form" onSubmit={(event) => {
              const data = values(event); void send({ action: "advanceLead", leadId: item.id, stage: string(data, "stage") });
            }}><label>{t.prospects}<select name="stage" defaultValue={item.stage === "NEW" ? "CONTACTED" : item.stage}>
              {leadStages.map((stage) => <option key={stage} value={stage}>{crm[stage]}</option>)}
            </select></label><button>{t.save}</button></form>
          </article>)}</div>{view.work.length === 0 && <p>{t.empty}</p>}</section>}
          {tab === "calendar" && <section><h2>{t.calendar} · Asia/Phnom_Penh</h2>
            <label>{t.calendar}<input type="month" value={month} onChange={(event) => { if (event.target.value) { setMonth(event.target.value); setCalendarDay(""); } }} /></label>
            {monthGrid && <div className="team-calendar" role="group" aria-label={t.calendar}>
              {Array.from({ length: 7 }, (_, index) => <span key={`weekday-${index}`}>{new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" }).format(new Date(Date.UTC(2026, 10, 2 + index)))}</span>)}
              {Array.from({ length: monthGrid.offset }, (_, index) => <span key={`blank-${index}`} />)}
              {Array.from({ length: monthGrid.days }, (_, index) => {
                const day = `${month}-${String(index + 1).padStart(2, "0")}`;
                const count = view.work.filter((item) => localAppointmentTime(item.appointment).startsWith(day)).length;
                return <button type="button" key={day} aria-label={`${day} · ${count}`} aria-pressed={calendarDay === day}
                  aria-current={day === cambodiaDate() ? "date" : undefined} data-has-events={count > 0}
                  onClick={() => setCalendarDay(day)}>{index + 1}{count > 0 && <strong>{count}</strong>}</button>;
              })}
            </div>}
            <input type="date" aria-label={t.calendar} value={calendarDay} onChange={(event) => setCalendarDay(event.target.value)} />
            <button type="button" onClick={() => setCalendarDay("")}>{t.refresh}</button>
            <div className="team-cards">{view.work.filter((item) => !calendarDay || localAppointmentTime(item.appointment).startsWith(calendarDay)).map((item) => <article key={item.id}>
              <h3>{item.prospect}</h3><time dateTime={item.appointment}>{new Intl.DateTimeFormat(locale, { timeZone: "Asia/Phnom_Penh", dateStyle: "full", timeStyle: "short" }).format(new Date(item.appointment))}</time>
              <p>{item.location} · {item.propertyId}</p>
            </article>)}</div>{view.work.length === 0 && <p>{t.empty}</p>}
          </section>}
          {tab === "commissions" && <section><h2>{t.commissions}</h2><div className="team-cards">{view.work.map((item) => <article key={item.id}>
            <h3>{item.prospect} · {item.propertyId}</h3><dl><dt>{t.expected}</dt><dd>{item.expectedCommission}</dd><dt>{t.realized}</dt><dd>{item.realizedCommission}</dd><dt>{t.received}</dt><dd>{item.receivedCommission}</dd></dl>
          </article>)}</div>{view.work.length === 0 && <p>{t.empty}</p>}</section>}
          {tab === "inquiries" && <section><h2>{contact.inquiries}</h2><div className="team-cards">{view.inquiries.map((item) => <article key={item.id}>
            <h3>{item.name} · {item.propertyId}</h3><p>{contact[item.purpose]} · {item.delivery === "ACCEPTED" ? contact.accepted : contact.pending}</p>
            <p><a href={`mailto:${item.email}`}>{item.email}</a>{item.phone && <> · <span>{item.phone}</span></>}</p>
            {item.preferredDate && <p>{contact.preferredDate} : <time>{item.preferredDate}</time> · {contact.dateHelp}</p>}
            <p className="inquiry-message">{item.message}</p><time dateTime={item.createdAt}>{new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Phnom_Penh" }).format(new Date(item.createdAt))}</time>
          </article>)}</div>{view.inquiries.length === 0 && <p>{t.empty}</p>}</section>}
          {tab === "hiring" && view.account.role === "ADMIN" && <section className="team-hiring"><h2>{t.hiring}</h2>
            <details><summary>{t.candidate}</summary><form className="team-form" onSubmit={(event) => {
              const data = values(event); void send({ action: "candidate", input: { name: string(data, "name"), address: string(data, "address"), identityReference: string(data, "identityReference") } });
            }}>{(["name", "address", "identityReference"] as const).map((key) => <label key={key}>{t[key]}<input name={key} required maxLength={200} /></label>)}<button>{t.create}</button></form></details>
            <nav className="team-tabs" aria-label={t.hiring}>{view.candidates?.map((item) => <button key={item.id} type="button" aria-current={item.id === selected ? "page" : undefined}
              onClick={() => { setSelected(item.id); setContractValues(item.contract?.input ?? {}); }}>{item.name} · {item.activation ? t.active : t.pending}</button>)}</nav>
            {candidate && <article className="team-dossier"><h3>{candidate.name}</h3><p>{candidate.address} · {candidate.identityReference}</p>
              <h4>{t.documents}</h4><p>{t.fileHelp}</p>
              {candidate.documents.map((document) => <div className="team-document" key={document.id}>
                {document.mime.startsWith("image/") && <Image
                  className="team-document-preview" src={`${endpoint}/documents/${document.id}?preview=1`}
                  alt={document.kind === "IDENTITY" ? t.identity : t.residency}
                  width={640} height={420} unoptimized
                  onError={() => setError(t.error)} />}
                <p><strong>{document.kind === "IDENTITY" ? t.identity : t.residency}</strong><br />{document.name} · {document.approvedBy ? t.approved : t.pending}</p>
                <a className="text-link" href={`${endpoint}/documents/${document.id}`}>{t.download}</a>
                {!candidate.activation && <button type="button" onClick={() => void send({ action: "review", candidateId: selected, documentId: document.id, approved: !document.approvedBy })}>{document.approvedBy ? t.revoke : t.approve}</button>}
              </div>)}
              {!candidate.activation && <>
                <form className="team-form" onSubmit={(event) => void upload(event)}>
                  {label("documents", <select name="kind"><option value="IDENTITY">{t.identity}</option><option value="RESIDENCY">{t.residency}</option></select>)}
                  {label("file", <input name="file" type="file" accept=".pdf,.png,.jpg,.jpeg" required />)}
                  <button>{t.upload}</button>
                </form>
                <h4>{t.contract}</h4><p className="information-notice">{t.legalNotice}</p>
                <details><summary>{t.contract}</summary>
                  {!production && <button type="button" onClick={() => setContractValues(employmentExample)}>{t.example}</button>}
                  <form className="team-form team-contract-form" onSubmit={(event) => {
                    event.preventDefault();
                    const input = employmentInput.safeParse(contractValues);
                    if (!input.success) { setError(input.error.issues.map((item) => `${item.path.join(".")}: ${item.message}`).join("; ")); return; }
                    void send({ action: "contract", candidateId: selected, input: input.data });
                  }}>{contractFields.map((key) => <label key={key}>{t[key]}
                    <input name={key} value={contractValues[key] ?? ""} lang={key.endsWith("Khmer") ? "km" : key.endsWith("English") ? "en" : undefined}
                      required type={key === "startDate" ? "date" : ["payDay", "weeklyHours", "monthlySalary"].includes(key) ? "number" : "text"}
                      min={key === "monthlySalary" ? ".01" : "1"} max={key === "payDay" ? "28" : key === "weeklyHours" ? "48" : undefined}
                      step={key === "monthlySalary" ? ".01" : undefined} maxLength={key.startsWith("duties") ? 2000 : 200}
                      onChange={(event) => setContractValues((current) => ({ ...current, [key]: key === "payDay" || key === "weeklyHours" ? Number(event.target.value) : event.target.value }))} />
                  </label>)}<button>{t.generate}</button></form>
                </details>
              </>}
              {candidate.contract && <p><a className="button button-dark" href={`${endpoint}/employment/${candidate.id}`}
                aria-disabled={busy} onClick={(event) => {
                  event.preventDefault();
                  if (candidate.contract) void downloadEmployment(candidate.id, candidate.contract.id);
                }}>{t.download} · EN–KM PDF</a></p>}
              {candidate.contract && !candidate.activation && <form className="team-form" onSubmit={(event) => {
                const data = values(event); void send({ action: "activate", candidateId: selected, contractId: candidate.contract?.id,
                  login: string(data, "login"), temporaryPassword: string(data, "temporaryPassword"), signedOn: string(data, "signedOn"),
                  legalReviewConfirmed: data.has("legalReviewConfirmed"), signatureConfirmed: data.has("signatureConfirmed") });
              }}>
                <h4>{t.activate}</h4>
                {label("login", <input name="login" autoComplete="off" required minLength={4} maxLength={50} pattern={loginPattern} />)}
                {label("temporaryPassword", <input name="temporaryPassword" type="password" autoComplete="new-password" minLength={12} maxLength={128} required />)}
                {label("signedOn", <input name="signedOn" type="date" max={new Date().toISOString().slice(0, 10)} required />)}
                <label className="team-check"><input name="legalReviewConfirmed" type="checkbox" required />{t.reviewConfirmed}</label>
                <label className="team-check"><input name="signatureConfirmed" type="checkbox" required />{t.signatureConfirmed}</label>
                <button>{t.activate}</button>
              </form>}
            </article>}
            <div className="team-cards">{view.accounts?.filter((account) => account.role === "AGENT").map((account) => <article key={account.id}>
              <h3>{account.name}</h3><p>{account.login} · {account.active ? t.active : t.disabled}</p>
              <form className="team-form" onSubmit={(event) => {
                const data = values(event); void send({ action: "notificationEmail", accountId: account.id, email: string(data, "notificationEmail").trim() });
              }}><label>{contact.notificationEmail}<input name="notificationEmail" type="email" maxLength={254} defaultValue={account.notificationEmail ?? ""} /></label><button>{t.save}</button></form>
              {account.active && <><button type="button" onClick={() => void send({ action: "disable", accountId: account.id })}>{t.disable}</button>
                <form className="team-form" onSubmit={(event) => {
                  const data = values(event); void send({ action: "resetPassword", accountId: account.id, temporaryPassword: string(data, "temporaryPassword") });
                }}>{label("temporaryPassword", <input name="temporaryPassword" type="password" minLength={12} maxLength={128} autoComplete="new-password" required />)}<button>{t.reset}</button></form></>}
            </article>)}</div>
            <details><summary>{t.audit}</summary><ul>{view.audit?.slice(-30).reverse().map((item, index) => <li key={`${item.at}-${index}`}><time>{item.at}</time> · {item.action} · {item.targetId}</li>)}</ul></details>
          </section>}
          <details className="team-password"><summary>{t.change}</summary>{passwordForm}</details>
        </>}
      </>}
    </fieldset>
  </section>;
}
