"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import type { BusinessState, BusinessProperty, ContractKind, RevenueSummary } from "@/lib/demo/business-types";
import { demoLocations, demoTypes, filterDemoProperties, initialDemoFilters, type DemoFilters } from "@/lib/demo/properties";
import { contractLegalSources } from "@/lib/demo/contract-document";
import { PropertyFilters } from "@/components/public/property-filters";
import { ActivityWorkspace, CalendarWorkspace, ContactDetails, CrmDashboard, LeadWorkspace } from "./crm-workspace";
import type { CrmSummary } from "@/lib/demo/crm-types";
import { Icon } from "@/components/public/icon";

type Snapshot = BusinessState & { revenue: RevenueSummary; crm: CrmSummary; storage: string };
export type BusinessTab = "overview" | "clients" | "properties" | "contracts" | "finance" | "leads" | "calendar" | "activity";
type Envelope = { data?: Snapshot; error?: { code: string; message: string; details?: { path: string[]; message: string }[] } };
const today = () => new Date().toISOString().slice(0, 10);

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="business-field"><span>{label}</span>{children}</label>;
}
async function readResponse(response: Response) {
  const body: Envelope = await response.json();
  if (!response.ok || !body.data) {
    const details = body.error?.details?.map((item) => `${item.path.join(".")}: ${item.message}`).join("; ");
    throw new Error([body.error?.message ?? `HTTP ${response.status}`, details].filter(Boolean).join(" "));
  }
  return body.data;
}

export function BusinessWorkspace({ initialTab = "overview" }: { initialTab?: BusinessTab }) {
  const t = useTranslations("Business");
  const c = useTranslations("Crm");
  const p = useTranslations("Preview");
  const ui = useTranslations("Interface");
  const [state, setState] = useState<Snapshot | null>(null);
  const [tab, setTab] = useState<BusinessTab>(initialTab);
  const [contactSearch, setContactSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [contractKind, setContractKind] = useState<ContractKind>("SALE_MANDATE");
  const [ownerId, setOwnerId] = useState("");
  const [propertyIds, setPropertyIds] = useState<string[]>([]);
  const [propertyFilters, setPropertyFilters] = useState<DemoFilters>(initialDemoFilters);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/demo/admin", { cache: "no-store", signal: controller.signal }).then(readResponse).then((value) => {
      setState(value); setOwnerId(value.clients.find((client) => client.role === "OWNER")?.id ?? "");
    }).catch((failure: unknown) => {
      if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : t("requestFailed"));
    });
    return () => controller.abort();
  }, [t]);

  async function refresh() {
    setBusy(true); setError("");
    try { setState(await readResponse(await fetch("/api/demo/admin", { cache: "no-store" }))); }
    catch (failure) { setError(failure instanceof Error ? failure.message : t("requestFailed")); }
    finally { setBusy(false); }
  }
  async function command(payload: Record<string, unknown>, form?: HTMLFormElement) {
    if (!state || busy) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const next = await readResponse(await fetch("/api/demo/admin", {
        method: "POST", headers: { "Content-Type": "application/json", "X-Kantara-Demo": "local" },
        body: JSON.stringify({ ...payload, revision: state.revision }),
      }));
      setState(next); form?.reset(); setPropertyIds([]);
      setNotice(c("saved")); window.dispatchEvent(new Event("kantara-demo-updated"));
    } catch (failure) { setError(failure instanceof Error ? failure.message : t("requestFailed")); }
    finally { setBusy(false); }
  }
  function formValues(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const value = (key: string) => String(data.get(key) ?? "").trim();
    return { form, data, value };
  }
  async function download(id: string) {
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch(`/api/demo/admin/contracts/${id}/pdf`, { cache: "no-store" });
      if (!response.ok) {
        const body: Envelope = await response.json();
        throw new Error(body.error?.message ?? `HTTP ${response.status}`);
      }
      if (!response.headers.get("content-type")?.startsWith("application/pdf")) throw new Error(t("requestFailed"));
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a"); link.href = url; link.download = `kantara-draft-${id}.pdf`;
      document.body.append(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
      setNotice(t("pdfReady"));
    } catch (failure) { setError(failure instanceof Error ? failure.message : t("requestFailed")); }
    finally { setBusy(false); }
  }
  const clientName = (id: string) => state?.clients.find((client) => client.id === id)?.name ?? id;
  const propertyName = (id: string) => state?.properties.find((property) => property.id === id)?.title ?? id;
  const owners = state?.clients.filter((client) => client.role === "OWNER") ?? [];
  const eligible = state?.properties.filter((property) => property.ownerId === ownerId
    && property.transaction === (contractKind === "SALE_MANDATE" ? "sale" : "rent")
    && property.availability === "AVAILABLE") ?? [];
  const properties = state ? filterDemoProperties(propertyFilters, state.properties) : [];
  const propertyChecks = (items: BusinessProperty[], name: string) =>
    <div className="business-checks">{items.map((property) => <label key={property.id}>
      <input type="checkbox" name={name} value={property.id} />{property.title} · {property.id}
    </label>)}</div>;

  return <section className="business-workspace" aria-label={t("title")} aria-busy={busy || (!state && !error)}>
    <div className="business-notice"><strong>{t("title")}</strong><p>{c("persistence")}</p>{state?.storage === "memory" && <p>{c("memory")}</p>}</div>
    <div className="business-tabs" role="group" aria-label={t("navigation")}>
      {(["overview", "clients", "leads", "properties", "calendar", "contracts", "finance", "activity"] as const).map((value) =>
        <button key={value} type="button" disabled={!state} aria-pressed={tab === value} onClick={() => {
          if (value !== tab) setPropertyFilters(initialDemoFilters);
          setTab(value); setNotice("");
        }}>{value === "leads" || value === "calendar" || value === "activity" ? c(value) : t(value)}</button>)}
      <button type="button" disabled={busy} onClick={() => void refresh()}>{t("refresh")}</button>
      <a className="text-button" href="/api/demo/admin/export" download="kantara-demo-workspace.json">{c("backup")}</a>
    </div>
    {error && <p className="tools-error" role="alert">{t("error")} {error}</p>}
    {notice && <p className="business-success" role="status">{notice}</p>}
    {(busy || (!state && !error)) && <p className="business-loading" role="status">{t("working")}</p>}
    {!state ? error && <p>{t("localOnly")}</p> : <>
      {tab === "overview" && <>
        <nav className="business-quick-actions" aria-label={ui("quickAccess")}>
          <h2>{ui("quickAccess")}</h2>
          {([
            ["clients", "users"], ["leads", "chart"], ["properties", "home"], ["calendar", "calendar"],
          ] as const).map(([value, icon]) => <button type="button" key={value}
            aria-label={`${ui("quickAccess")} — ${value === "leads" || value === "calendar" ? c(value) : t(value)}`} onClick={() => setTab(value)}>
            <Icon name={icon} /><span>{value === "leads" || value === "calendar" ? c(value) : t(value)}</span><Icon name="arrow" />
          </button>)}
        </nav>
        <div className="business-kpis">
          {(["expected", "realized", "received", "outstanding"] as const).map((key) =>
            <button type="button" key={key} onClick={() => setTab("finance")}><span>{t(key)}</span><strong>{state.revenue[key]} USD</strong><Icon name="arrow" /></button>)}
        </div>
        <p>{t("revenueHelp")}</p>
        <ol className="business-steps"><li>{t("stepClient")}</li><li>{t("stepProperty")}</li><li>{t("stepContract")}</li><li>{t("stepClose")}</li></ol>
        <p>{state.clients.length} {t("clients")} · {state.properties.length} {t("properties")} · {state.contracts.length} {t("contracts")}</p>
        <CrmDashboard state={state} summary={state.crm} />
      </>}
      {tab === "leads" && <LeadWorkspace state={state} busy={busy} command={command} />}
      {tab === "calendar" && <CalendarWorkspace state={state} busy={busy} command={command} />}
      {tab === "activity" && <ActivityWorkspace state={state} />}
      {tab === "clients" && <>
        <form className="business-form" onSubmit={(event) => {
          const { form, data, value } = formValues(event);
          void command({ action: "createClient", input: {
            name: value("name"), role: value("role"), address: value("address"),
            identityReference: value("identityReference"), nationality: value("nationality"),
            email: value("email"), phone: value("phone"), propertyIds: data.getAll("propertyIds").map(String),
          } }, form);
        }}>
          <h2>{t("newClient")}</h2>
          <fieldset disabled={busy}><div className="business-form-grid">
            <Field label={t("name")}><input name="name" required maxLength={200} /></Field>
            <Field label={t("role")}><select name="role" defaultValue="BUYER">
              {(["OWNER", "BUYER", "TENANT"] as const).map((role) => <option key={role} value={role}>{t(role)}</option>)}
            </select></Field>
            <Field label={t("address")}><input name="address" required maxLength={200} /></Field>
            <Field label={t("identityReference")}><input name="identityReference" required maxLength={200} /></Field>
            <Field label={t("nationality")}><input name="nationality" required maxLength={200} /></Field>
            <Field label={t("email")}><input name="email" type="email" maxLength={200} /></Field>
            <Field label={t("phone")}><input name="phone" type="tel" maxLength={80} /></Field>
          </div><p>{t("clientLinksHelp")}</p>
            <fieldset><legend>{t("linkedProperties")}</legend>{propertyChecks(state.properties, "propertyIds")}</fieldset>
            <button type="submit" className="button button-dark">{t("createClient")}</button>
          </fieldset>
        </form>
        <label className="business-field"><span>{c("search")}</span><input type="search" value={contactSearch} onChange={(event) => setContactSearch(event.target.value)} /></label>
        <div className="business-list">{state.clients.filter((client) => [client.name, client.email, client.phone, client.profile?.company, client.profile?.tags.join(" ")].join(" ").toLocaleLowerCase().includes(contactSearch.trim().toLocaleLowerCase())).map((client) => <article key={client.id}>
          <h3>{client.name} · {t(client.role)}</h3><p>{client.propertyIds.map(propertyName).join(" · ") || t("none")}</p>
          <p>{t("linkedContracts")}: {state.contracts.filter((contract) => contract.ownerId === client.id || contract.counterpartyId === client.id).map((contract) => contract.id).join(" · ") || t("none")}</p>
          {client.role !== "OWNER" && <form onSubmit={(event) => {
            const { form, data } = formValues(event);
            void command({ action: "linkProperties", clientId: client.id, propertyIds: data.getAll("linked").map(String) }, form);
          }}><fieldset key={`${client.id}-${state.revision}`} disabled={busy}><legend>{t("editLinks")}</legend><div className="business-checks">
            {state.properties.map((property) => <label key={`${client.id}-${property.id}`}><input type="checkbox" name="linked" value={property.id}
              defaultChecked={client.propertyIds.includes(property.id)} />{property.title}</label>)}
          </div><button type="submit" className="text-button">{t("saveLinks")}</button></fieldset></form>}
          <ContactDetails client={client} state={state} busy={busy} command={command} />
        </article>)}</div>
      </>}
      {tab === "properties" && <>
        <form className="business-form" onSubmit={(event) => {
          const { form, value } = formValues(event);
          void command({ action: "createProperty", input: {
            title: value("title"), address: value("address"), titleReference: value("titleReference"), ownerId: value("ownerId"),
            location: value("location"), type: value("type"), transaction: value("transaction"), price: value("price"),
            area: Number(value("area")), bedrooms: Number(value("bedrooms")), rooms: Number(value("rooms")), bathrooms: Number(value("bathrooms")),
          } }, form);
        }}>
          <h2>{t("newProperty")}</h2><fieldset disabled={busy}><div className="business-form-grid">
            <Field label={t("propertyTitle")}><input name="title" required maxLength={200} /></Field>
            <Field label={t("OWNER")}><select name="ownerId" required>{owners.map((owner) => <option key={owner.id} value={owner.id}>{owner.name}</option>)}</select></Field>
            <Field label={t("address")}><input name="address" required maxLength={200} /></Field>
            <Field label={t("titleReference")}><input name="titleReference" required maxLength={200} /></Field>
            <Field label={p("locationLabel")}><select name="location">{demoLocations.map((location) => <option key={location} value={location}>{p(`locations.${location}`)}</option>)}</select></Field>
            <Field label={p("typeLabel")}><select name="type">{demoTypes.map((type) => <option key={type} value={type}>{p(`types.${type}`)}</option>)}</select></Field>
            <Field label={p("transactionLabel")}><select name="transaction"><option value="sale">{p("sale")}</option><option value="rent">{p("rent")}</option></select></Field>
            <Field label={t("price")}><input name="price" type="number" min="0.01" max="99999999999.99" step="0.01" required /></Field>
            {(["area", "bedrooms", "rooms", "bathrooms"] as const).map((key) => <Field label={t(key)} key={key}>
              <input name={key} type="number" min={key === "area" ? "0.01" : "0"} max={key === "area" ? "10000000" : "100"} step={key === "area" ? "0.01" : "1"} required />
            </Field>)}
          </div><button type="submit" className="button button-dark">{t("createProperty")}</button></fieldset>
        </form>
        <PropertyFilters onApply={setPropertyFilters} includePublication />
        <div className="business-list">{properties.map((property) => <article key={property.id}>
          <h3>{property.title}</h3><p>{property.id} · {clientName(property.ownerId)}</p>
          <div className="business-badges"><span>{t(property.availability)}</span><span>{t(property.publication)}</span></div>
          <p>{property.price} USD{property.transaction === "rent" ? p("perMonth") : ""} · {property.area} m² · {property.bedrooms} {t("bedrooms")} · {property.rooms} {t("rooms")}</p>
          <p>{t("publicationDate")}: {property.publishedAt?.slice(0, 10) ?? t("none")}</p>
          <button type="button" disabled={busy} className="text-button" onClick={() => void command({
            action: "publish", propertyId: property.id, published: property.publication !== "PUBLISHED",
          })}>{t(property.publication === "PUBLISHED" ? "unpublish" : "publish")}</button>
        </article>)}</div>
      </>}
      {tab === "contracts" && <>
        <div className="business-notice"><p>{t("legalNotice")}</p><ul>{contractLegalSources.map((source) =>
          <li key={source.url}><a href={source.url} target="_blank" rel="noreferrer">{source.title}</a></li>)}</ul></div>
        <form className="business-form" onSubmit={(event) => {
          const { form, value } = formValues(event);
          void command({ action: "createContract", input: {
            kind: contractKind, language: value("language"), ownerId,
            ...(contractKind === "LEASE" ? { counterpartyId: value("counterpartyId") } : {}),
            agencyName: value("agencyName"), agencyAddress: value("agencyAddress"), agencyRegistration: value("agencyRegistration"),
            signedAt: value("signedAt"), signedPlace: value("signedPlace"), startDate: value("startDate"), endDate: value("endDate"),
            exclusive: contractKind !== "LEASE" && value("exclusive") === "on",
            lines: propertyIds.map((propertyId) => ({ propertyId, price: value(`price-${propertyId}`), expectedCommission: value(`commission-${propertyId}`) })),
            deposit: contractKind === "LEASE" ? value("deposit") : "0", rentDueDay: contractKind === "LEASE" ? Number(value("rentDueDay")) : 1,
            permittedUse: value("permittedUse"), terms: value("terms"), commissionTerms: value("commissionTerms"),
          } }, form);
        }}>
          <h2>{t("newContract")}</h2><fieldset disabled={busy}><div className="business-form-grid">
            <Field label={t("contractKind")}><select value={contractKind} onChange={(event) => {
              const next = (["SALE_MANDATE", "RENTAL_MANDATE", "LEASE"] as const).find((value) => value === event.target.value);
              if (next) { setContractKind(next); setPropertyIds([]); }
            }}>{(["SALE_MANDATE", "RENTAL_MANDATE", "LEASE"] as const).map((kind) => <option key={kind} value={kind}>{t(kind)}</option>)}</select></Field>
            <Field label={t("documentLanguage")}><select name="language"><option value="fr-km">Français + ខ្មែរ</option><option value="en-km">English + ខ្មែរ</option></select></Field>
            <Field label={t("OWNER")}><select required value={ownerId} onChange={(event) => { setOwnerId(event.target.value); setPropertyIds([]); }}>
              {owners.map((owner) => <option key={owner.id} value={owner.id}>{owner.name}</option>)}
            </select></Field>
            {contractKind === "LEASE" && <Field label={t("TENANT")}><select name="counterpartyId" required><option value="">{t("choose")}</option>
              {state.clients.filter((client) => client.role === "TENANT").map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
            </select></Field>}
            <Field label={t("agencyName")}><input name="agencyName" required defaultValue="KANTARA DEMO" maxLength={200} /></Field>
            <Field label={t("agencyAddress")}><input name="agencyAddress" required maxLength={200} /></Field>
            <Field label={t("agencyRegistration")}><input name="agencyRegistration" required maxLength={200} /></Field>
            <Field label={t("signedPlace")}><input name="signedPlace" required maxLength={200} /></Field>
            <Field label={t("signedAt")}><input name="signedAt" type="date" required defaultValue={today()} /></Field>
            <Field label={t("startDate")}><input name="startDate" type="date" required defaultValue={today()} /></Field>
            <Field label={t("endDate")}><input name="endDate" type="date" required /></Field>
            {contractKind === "LEASE" && <>
              <Field label={t("deposit")}><input name="deposit" type="number" min="0" max="99999999999.99" step="0.01" required /></Field>
              <Field label={t("rentDueDay")}><input name="rentDueDay" type="number" min="1" max="28" step="1" required /></Field>
            </>}
          </div>
            {contractKind !== "LEASE" && <label className="business-checkbox"><input name="exclusive" type="checkbox" />{t("exclusive")}</label>}
            <fieldset><legend>{t("linkedProperties")}</legend><p>{t("contractPropertiesHelp")}</p>
              <div className="business-checks">{eligible.map((property) => <label key={property.id}><input type="checkbox" checked={propertyIds.includes(property.id)}
                onChange={(event) => setPropertyIds(event.target.checked ? [...propertyIds, property.id] : propertyIds.filter((id) => id !== property.id))} />{property.title}</label>)}</div>
              {propertyIds.map((id) => <div className="business-form-grid contract-property-line" key={id}><strong>{propertyName(id)}</strong>
                <Field label={`${t("price")} — ${propertyName(id)}`}><input name={`price-${id}`} type="number" min="0.01" max="99999999999.99" step="0.01"
                  defaultValue={String(state.properties.find((property) => property.id === id)?.price ?? "")} required /></Field>
                <Field label={`${t("commission")} — ${propertyName(id)}`}><input name={`commission-${id}`} type="number" min="0" max="99999999999.99" step="0.01" required defaultValue="0" /></Field>
              </div>)}
            </fieldset>
            <Field label={t("permittedUse")}><input name="permittedUse" required maxLength={200} /></Field>
            <Field label={t("commissionTerms")}><textarea name="commissionTerms" required minLength={10} maxLength={4000} rows={3} /></Field>
            <Field label={t("terms")}><textarea name="terms" required minLength={10} maxLength={4000} rows={5} /></Field>
            <p>{t("draftHelp")}</p><button type="submit" className="button button-dark" disabled={!propertyIds.length}>{t("createContract")}</button>
          </fieldset>
        </form>
        <div className="business-list">{state.contracts.map((contract) => <article key={contract.id}>
          <h3>{t(contract.kind)} · {contract.language}</h3><p>{contract.id}</p><p>{clientName(contract.ownerId)}{contract.counterpartyId ? ` / ${clientName(contract.counterpartyId)}` : ""}</p>
          <p>{contract.lines.map((line) => `${propertyName(line.propertyId)} · ${line.price} USD · ${t("commission")} ${line.expectedCommission} USD`).join(" / ")}</p>
          <p>{contract.startDate} → {contract.endDate}</p><button type="button" className="button button-dark" disabled={busy} onClick={() => void download(contract.id)}>{t("downloadPdf")}</button>
        </article>)}</div>
      </>}
      {tab === "finance" && <>
        <div className="business-kpis">{(["expected", "realized", "received", "outstanding"] as const).map((key) =>
          <div key={key}><span>{t(key)}</span><strong>{state.revenue[key]} USD</strong></div>)}</div><p>{t("revenueHelp")}</p>
        <h2>{t("closeTransaction")}</h2><p>{t("closingHelp")}</p>
        <div className="business-list">{state.contracts.flatMap((contract) => contract.lines.filter((line) =>
          !state.transactions.some((transaction) => transaction.propertyId === line.propertyId)
          && !(contract.kind === "LEASE" && state.contracts.some((entry) =>
            entry.kind === "RENTAL_MANDATE" && entry.lines.some((item) => item.propertyId === line.propertyId))),
        ).map((line) => <form key={`${contract.id}-${line.propertyId}`} className="business-form" onSubmit={(event) => {
          const { value } = formValues(event);
          void command({ action: "closeTransaction", contractId: contract.id, propertyId: line.propertyId, closedAt: value("closedAt"), commission: value("commission") });
        }}><h3>{t(contract.kind)} — {propertyName(line.propertyId)}</h3>
          <fieldset disabled={busy}><div className="business-form-grid">
            <Field label={t("closedAt")}><input name="closedAt" type="date" min={contract.startDate} max={today() < contract.endDate ? today() : contract.endDate} defaultValue={today()} required /></Field>
            <Field label={t("commission")}><input name="commission" type="number" min="0" max="99999999999.99" step="0.01" defaultValue={line.expectedCommission} required /></Field>
          </div><button type="submit" className="button button-dark">{t("confirmClose")}</button></fieldset>
        </form>))}</div>
        <h2>{t("receipts")}</h2><div className="business-list">{state.transactions.map((transaction) => <article key={transaction.id}>
          <h3>{propertyName(transaction.propertyId)} · {transaction.closedAt}</h3><p>{t("realized")}: {transaction.commission} USD</p>
          <ul>{transaction.receipts.map((receipt) => <li key={receipt.id}>{receipt.paidAt} · {receipt.amount} USD · {receipt.reference}</li>)}</ul>
          <form onSubmit={(event) => {
            const { form, value } = formValues(event);
            void command({ action: "recordReceipt", transactionId: transaction.id, amount: value("amount"), paidAt: value("paidAt"), reference: value("reference") }, form);
          }}><fieldset disabled={busy}><div className="business-form-grid">
            <Field label={t("amount")}><input name="amount" type="number" min="0.01" max="99999999999.99" step="0.01" required /></Field>
            <Field label={t("paidAt")}><input name="paidAt" type="date" min={transaction.closedAt} max={today()} defaultValue={today()} required /></Field>
            <Field label={t("receiptReference")}><input name="reference" required maxLength={200} /></Field>
          </div><button type="submit" className="text-button">{t("recordReceipt")}</button></fieldset></form>
        </article>)}</div>
      </>}
    </>}
  </section>;
}
