"use client";

import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import type { Locale } from "@/lib/i18n/routing";
import { dossierMessages } from "@/lib/i18n/dossiers";
import { dossierInput, dossierKinds, type DossierDocument } from "@/lib/agency/dossiers";
import type { dossierSnapshot } from "@/services/agency/dossiers";

type Snapshot = ReturnType<typeof dossierSnapshot>;
type Asset = { id: string; name: string; kind: string };
const endpoint = "/api/agency/dossiers";
async function responseData<T>(response: Response): Promise<T> {
  const body: { data?: T; error?: { message?: string; code?: string; details?: { path: string[]; message: string }[] } } =
    response.headers.get("content-type")?.includes("application/json") ? await response.json() : {};
  if (!response.ok || !body.data) throw new Error(body.error
    ? [body.error.message, body.error.code, ...(body.error.details?.map((item) => `${item.path.join(".")}: ${item.message}`) ?? [])].join(" · ")
    : `HTTP ${response.status}`);
  return body.data;
}
export function DossierWorkspace({ locale }: { locale: Locale }) {
  const t = dossierMessages(locale), b = useTranslations("Business"), a = useTranslations("Agency");
  const [state, setState] = useState<Snapshot | null>(null);
  const [propertyId, setPropertyId] = useState("");
  const [kind, setKind] = useState<DossierDocument["input"]["kind"]>("HANDOVER");
  const [assets, setAssets] = useState<Asset[]>([]);
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const refresh = useCallback(async (signal?: AbortSignal) => {
    const data = await responseData<Snapshot>(await fetch(endpoint, { cache: "no-store", signal }));
    setState(data);
    setPropertyId((id) => data.properties.some((item) => item.id === id) ? id : data.properties[0]?.id ?? "");
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    const updated = () => {
      void refresh(controller.signal).catch((cause: unknown) => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : b("requestFailed")); });
    };
    window.addEventListener("kantara-agency-updated", updated);
    void fetch(endpoint, { cache: "no-store", signal: controller.signal }).then(responseData<Snapshot>).then((data) => {
      setState(data);
      setPropertyId((id) => data.properties.some((item) => item.id === id) ? id : data.properties[0]?.id ?? "");
    }).catch((cause: unknown) => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : b("requestFailed")); });
    return () => { controller.abort(); window.removeEventListener("kantara-agency-updated", updated); };
  }, [b, refresh]);
  const loadAssets = useCallback(async (id: string, signal?: AbortSignal) => {
    setAssets(await responseData<Asset[]>(await fetch(`/api/agency/media?propertyId=${id}`, { cache: "no-store", signal })));
  }, []);
  useEffect(() => {
    if (!propertyId) return;
    const controller = new AbortController();
    void fetch(`/api/agency/media?propertyId=${propertyId}`, { cache: "no-store", signal: controller.signal })
      .then(responseData<Asset[]>).then(setAssets)
      .catch((cause: unknown) => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : b("requestFailed")); });
    return () => controller.abort();
  }, [propertyId, state?.revision, loadAssets, b]);
  async function send(input: Record<string, unknown>, form?: HTMLFormElement) {
    if (!state || busy) return;
    setBusy(true); setError(""); setNotice("");
    try {
      setState(await responseData<Snapshot>(await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...input, revision: state.revision }) })));
      form?.reset(); setNotice(b("saved")); window.dispatchEvent(new Event("kantara-agency-updated"));
    } catch (cause) { setError(cause instanceof Error ? cause.message : b("requestFailed")); }
    finally { setBusy(false); }
  }
  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget, file = new FormData(form).get("file");
    if (!(file instanceof File) || !file.size || file.size > 2.5 * 1024 * 1024) { setError(a("fileHelp")); return; }
    setBusy(true); setError(""); setNotice("");
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error(b("requestFailed")));
        reader.onload = () => typeof reader.result === "string" ? resolve(reader.result.split(",")[1]) : reject(new Error(b("requestFailed")));
        reader.readAsDataURL(file);
      });
      await responseData(await fetch("/api/agency/media", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ propertyId, kind: "DOCUMENT", name: file.name, mime: file.type, base64 }) }));
      form.reset(); await loadAssets(propertyId); await refresh(); setNotice(b("saved")); window.dispatchEvent(new Event("kantara-agency-updated"));
    } catch (cause) { setError(cause instanceof Error ? cause.message : b("requestFailed")); }
    finally { setBusy(false); }
  }
  async function download(document: DossierDocument) {
    setBusy(true); setError("");
    try {
      const response = await fetch(`${endpoint}/documents/${document.id}/pdf`, { cache: "no-store" });
      if (!response.ok) { await responseData(response); return; }
      if (!response.headers.get("content-type")?.startsWith("application/pdf")) throw new Error(b("requestFailed"));
      const url = URL.createObjectURL(await response.blob()), link = window.document.createElement("a");
      link.href = url; link.download = `kantara-${document.input.kind.toLowerCase()}-${document.id}-en-km.pdf`;
      window.document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 30000);
      setNotice(b("pdfReady"));
    } catch (cause) { setError(cause instanceof Error ? cause.message : b("requestFailed")); }
    finally { setBusy(false); }
  }
  const property = state?.properties.find((item) => item.id === propertyId);
  const clients = state?.clients.filter((item) => item.propertyIds.includes(propertyId) && item.role === (property?.transaction === "sale" ? "BUYER" : "TENANT")) ?? [];
  const documents = state?.documents.filter((item) => item.property.id === propertyId) ?? [];
  const transfers = state?.transfers.filter((item) => item.propertyId === propertyId) ?? [];
  const transactions = state?.transactions.filter((item) => item.propertyId === propertyId) ?? [];
  const field = (label: string, content: ReactNode) => <label className="business-field"><span>{label}</span>{content}</label>;
  const today = new Date().toISOString().slice(0, 10);
  return <section className="business-workspace dossier-workspace" aria-label={t.title} aria-busy={busy}>
    <h2>{t.title}</h2><p>{t.scope}</p><p>{t.models}</p>
    <button type="button" className="text-button" disabled={busy} onClick={() => void refresh().catch((cause: unknown) => setError(cause instanceof Error ? cause.message : b("requestFailed")))}>{b("refresh")}</button>
    {error && <p className="tools-error" role="alert">{error}</p>}
    {notice && <p className="business-success" role="status">{notice}</p>}
    {busy && <p role="status">{b("working")}</p>}
    {field(b("properties"), <select value={propertyId} disabled={busy} onChange={(event) => {
      const item = state?.properties.find((entry) => entry.id === event.target.value);
      setPropertyId(event.target.value); setKind(item?.transaction === "rent" ? "LEASE" : "SALE_AGREEMENT"); setAssets([]); setError(""); setNotice("");
    }}><option value="">{b("choose")}</option>{state?.properties.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select>)}
    {state && property && <>
      <p>{b("availability")}: {b(property.availability)}</p>
      <details className="business-form"><summary>{t.files}</summary>
        <p>{a("fileHelp")}</p>
        <form onSubmit={(event) => void upload(event)}><fieldset disabled={busy}>
          {field(a("file"), <input type="file" name="file" accept=".pdf,.png,.jpg,.jpeg" required />)}
          <button type="submit" className="button button-dark">{a("upload")}</button>
        </fieldset></form>
        <ul>{assets.filter((item) => item.kind === "DOCUMENT").map((item) => <li key={item.id}><a className="text-link" href={`/api/agency/media/${item.id}`}>{item.name}</a></li>)}</ul>
      </details>
      <p>{t.clientHelp}</p>
      <form className="business-form dossier-document-form" key={property.id} onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget, data = new FormData(form), value = (name: string) => String(data.get(name) ?? "");
        const input = dossierInput.safeParse({
          propertyId, counterpartyId: value("counterpartyId"), kind,
          agencyName: value("agencyName"), agencyAddress: value("agencyAddress"), agencyRegistration: value("agencyRegistration"),
          representative: value("representative"), date: value("date"), place: value("place"), price: value("price"), deposit: value("deposit"),
          startDate: value("startDate") || value("date"), endDate: value("endDate") || value("date"), rentDueDay: Number(value("rentDueDay") || "1"),
          titleType: value("titleType"), titleReference: value("titleReference"), termsEnglish: value("termsEnglish"), termsKhmer: value("termsKhmer"),
        });
        if (!input.success) { setError(input.error.issues.map((item) => `${item.path.join(".")}: ${item.message}`).join(" · ")); return; }
        void send({ action: "createDocument", input: input.data });
      }}><fieldset disabled={busy}><div className="business-form-grid">
        {field(b("contractKind"), <select value={kind} onChange={(event) => {
          const next = dossierKinds.find((item) => item === event.target.value); if (next) setKind(next);
        }}>{dossierKinds.filter((item) => property.transaction === "sale" ? item !== "LEASE" : !["SALE_AGREEMENT", "PRELIMINARY_SALE"].includes(item))
          .map((item) => <option key={item} value={item}>{t[item]}</option>)}</select>)}
        {field(t.counterparty, <select name="counterpartyId" required><option value="">{b("choose")}</option>{clients.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>)}
        {(["agencyName", "agencyAddress", "agencyRegistration"] as const).map((name) => <label className="business-field" key={name}><span>{b(name)}</span><input name={name} maxLength={200} required /></label>)}
        {field(t.representative, <input name="representative" maxLength={200} required />)}
        {field(b("signedAt"), <input name="date" type="date" defaultValue={today} required />)}
        {field(b("signedPlace"), <input name="place" maxLength={200} required />)}
        {field(t.titleType, <select name="titleType">{(["REGISTERED_TITLE", "POSSESSION_DOCUMENT", "STRATA_TITLE", "OTHER"] as const).map((item) => <option key={item} value={item}>{t[item]}</option>)}</select>)}
        {field(b("titleReference"), <input name="titleReference" defaultValue={property.titleReference} maxLength={200} required />)}
        {field(kind === "COMMISSION_STATEMENT" ? b("commission") : b("price"), <input name="price" type="number" step=".01" min=".01" max="99999999999.99" defaultValue={property.price.toFixed(2)} required />)}
        {field(b("deposit"), <input name="deposit" type="number" step=".01" min="0" max="99999999999.99" defaultValue="0" required />)}
        {kind === "LEASE" && <>
          {field(b("startDate"), <input name="startDate" type="date" required />)}
          {field(b("endDate"), <input name="endDate" type="date" required />)}
          {field(b("rentDueDay"), <input name="rentDueDay" type="number" min="1" max="28" defaultValue="1" required />)}
        </>}
      </div>
        {field(t.termsEnglish, <textarea name="termsEnglish" lang="en" minLength={10} maxLength={4000} required />)}
        {field(t.termsKhmer, <textarea name="termsKhmer" lang="km" minLength={10} maxLength={4000} required />)}
        <button type="submit" className="button button-dark" disabled={!clients.length}>{t.generate}</button>
      </fieldset></form>
      <div className="business-list">{documents.map((document) => <article key={document.id}>
        <h3>{t[document.input.kind]}</h3><p>{document.counterparty.name} · {document.input.date}</p>
        <button type="button" className="button button-dark" disabled={busy} onClick={() => void download(document)}>{b("downloadPdf")}</button>
        {state.role === "ADMIN" && property.availability === "AVAILABLE" && ["LEASE", "SALE_AGREEMENT"].includes(document.input.kind) && <form className="business-form" onSubmit={(event) => {
          event.preventDefault(); const data = new FormData(event.currentTarget);
          void send({ action: "closeDossier", documentId: document.id, closedAt: data.get("closedAt"), commission: data.get("commission"),
            signedConfirmed: data.has("signedConfirmed"), legalReviewConfirmed: data.has("legalReviewConfirmed"), formalitiesConfirmed: data.has("formalitiesConfirmed") });
        }}><fieldset disabled={busy}>
          {field(b("closedAt"), <input name="closedAt" type="date" max={today} defaultValue={today} required />)}
          {field(b("commission"), <input name="commission" type="number" min="0" step=".01" max="99999999999.99" required />)}
          {(["signedConfirmed", "legalReviewConfirmed", "formalitiesConfirmed"] as const).map((name, index) => <label className="business-checkbox" key={name}>
            <input name={name} type="checkbox" required />{[t.signed, t.reviewed, t.formalities][index]}</label>)}
          <button className="button button-dark">{t.close}</button>
        </fieldset></form>}
      </article>)}</div>
      <h3>{b("receipts")}</h3><p>{t.bankHelp}</p>
      <div className="business-kpis">{(["realized", "received", "outstanding"] as const).map((key) => <div key={key}><span>{b(key)}</span><strong>{state.revenue[key]} USD</strong></div>)}</div>
      {transactions.map((transaction) => <form className="business-form dossier-transfer-form" key={transaction.id} onSubmit={(event) => {
        event.preventDefault(); const form = event.currentTarget, data = new FormData(form);
        void send({ action: "submitTransfer", transactionId: transaction.id, amount: data.get("amount"), paidAt: data.get("paidAt"),
          reference: data.get("reference"), bankName: data.get("bankName"), payer: data.get("payer"), evidenceId: data.get("evidenceId") }, form);
      }}><h4>{property.title} · {transaction.commission} USD</h4><fieldset disabled={busy}><div className="business-form-grid">
        {field(b("amount"), <input name="amount" type="number" min=".01" step=".01" max="99999999999.99" required />)}
        {field(b("paidAt"), <input name="paidAt" type="date" min={transaction.closedAt} max={today} defaultValue={today} required />)}
        {field(b("receiptReference"), <input name="reference" maxLength={200} required />)}
        {field(t.bank, <input name="bankName" maxLength={200} required />)}
        {field(t.payer, <input name="payer" maxLength={200} required />)}
        {field(t.evidence, <select name="evidenceId" required><option value="">{b("choose")}</option>{assets.filter((item) => item.kind === "DOCUMENT").map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>)}
      </div><button className="button button-dark">{t.submit}</button></fieldset></form>)}
      <div className="business-list">{transfers.map((transfer) => <article key={transfer.id}>
        <h4>{transfer.amount} USD · {t[transfer.status]}</h4><p>{transfer.bankName} · {transfer.reference} · {transfer.paidAt}</p>
        <a className="text-link" href={`/api/agency/media/${transfer.evidenceId}`}>{t.evidence}</a>
        {transfer.reviewNote && <p>{transfer.reviewNote}</p>}
        {state.role === "ADMIN" && transfer.status === "PENDING" && <form className="dossier-review-form" onSubmit={(event) => {
          event.preventDefault(); const form = event.currentTarget, data = new FormData(form);
          void send({ action: "reviewTransfer", transferId: transfer.id, approved: data.get("decision") === "APPROVED", note: data.get("note") });
        }}><fieldset disabled={busy}>
          {field(t.reviewNote, <textarea name="note" minLength={1} maxLength={1000} required />)}
          <label className="business-field"><span>{t.reviewNote}</span><select name="decision"><option value="APPROVED">{t.approve}</option><option value="REJECTED">{t.reject}</option></select></label>
          <button className="button button-dark">{a("save")}</button>
        </fieldset></form>}
      </article>)}</div>
    </>}
  </section>;
}
