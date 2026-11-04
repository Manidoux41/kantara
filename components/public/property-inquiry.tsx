"use client";

import Script from "next/script";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { z } from "zod";
import type { Locale } from "@/lib/i18n/routing";
import { propertyMessages } from "@/lib/i18n/property";
import { inquiryInput } from "@/lib/properties/inquiry";
import { cambodiaDate } from "@/lib/demo/calendar";

type Turnstile = {
  render: (container: HTMLElement, options: { sitekey: string; action: string; cData: string; language: string;
    callback: (token: string) => void; "expired-callback": () => void; "error-callback": () => void }) => string;
  remove: (id: string) => void;
};
declare global { interface Window { turnstile?: Turnstile } }
const statusSchema = z.object({ enabled: z.boolean(), siteKey: z.string().nullable(), agentName: z.string().nullable() });
const envelope = z.object({ data: z.unknown().optional(), error: z.object({ code: z.string(), message: z.string() }).optional() });

export function PropertyInquiry({ propertyId, locale, available, production = false }: { propertyId: string; locale: Locale; available: boolean; production?: boolean }) {
  const t = propertyMessages(locale);
  const [config, setConfig] = useState<z.infer<typeof statusSchema> | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [verify, setVerify] = useState(false);
  const [scriptReady, setScriptReady] = useState(false);
  const [token, setToken] = useState("");
  const [requestId, setRequestId] = useState("");
  const [challengeVersion, setChallengeVersion] = useState(0);
  const [purpose, setPurpose] = useState<"VISIT" | "INFORMATION">(available ? "VISIT" : "INFORMATION");
  const [minimumDate, setMinimumDate] = useState("");
  const widget = useRef<HTMLDivElement>(null);
  const endpoint = !production && process.env.NODE_ENV === "development" ? "/api/demo/inquiries" : "/api/v1/inquiries";

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch(`${endpoint}?propertyId=${encodeURIComponent(propertyId)}`, { cache: "no-store", signal: controller.signal });
        const body = envelope.parse(await response.json());
        if (!response.ok) throw new Error(body.error?.code === "CONTACT_SETUP" ? t.unavailable : t.error);
        setConfig(statusSchema.parse(body.data));
        setMinimumDate(cambodiaDate());
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : t.error);
      }
    })();
    return () => controller.abort();
  }, [propertyId, endpoint, t.unavailable, t.error]);

  useEffect(() => {
    if (!verify || !scriptReady || !config?.siteKey || !widget.current || !window.turnstile || !requestId) return;
    const turnstile = window.turnstile;
    const id = turnstile.render(widget.current, { sitekey: config.siteKey, action: "property_inquiry", cData: requestId,
      language: locale === "km" ? "auto" : locale, callback: setToken,
      "expired-callback": () => { setToken(""); setError(t.verifyError); },
      "error-callback": () => { setToken(""); setError(t.verifyError); } });
    return () => turnstile.remove(id);
  }, [verify, scriptReady, config?.siteKey, requestId, challengeVersion, locale, t.verifyError]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || sent) return;
    setError("");
    if (!config?.enabled) { setError(t.unavailable); return; }
    const form = new FormData(event.currentTarget);
    const get = (name: string) => String(form.get(name) ?? "");
    const input = inquiryInput.safeParse({ requestId, propertyId, locale, name: get("name"), email: get("email"),
      phone: get("phone"), purpose, preferredDate: purpose === "VISIT" ? get("preferredDate") : "",
      message: get("message"), consent: form.get("consent") === "on", website: get("website"), turnstileToken: token });
    if (!token) { setError(t.verifyError); return; }
    if (!input.success) { setError(t.error); return; }
    setBusy(true);
    try {
      const response = await fetch(endpoint, { method: "POST",
        headers: { "Content-Type": "application/json", "X-Kantara-Demo": "local" }, body: JSON.stringify(input.data) });
      const body = envelope.parse(await response.json());
      if (!response.ok) throw new Error(body.error?.code === "CONTACT_SETUP" ? t.unavailable : body.error?.code === "ANTISPAM_REQUIRED" ? t.verifyError : t.error);
      z.object({ id: z.uuid(), delivery: z.literal("ACCEPTED") }).parse(body.data);
      setSent(true);
    } catch (cause) { setError(cause instanceof Error ? cause.message : t.error); }
    finally { setBusy(false); setToken(""); setChallengeVersion((value) => value + 1); }
  }
  return <aside className="property-contact" id="contact-agent" aria-labelledby="contact-title">
    <h2 id="contact-title">{t.contact}</h2>
    <p><strong>{config?.agentName ? `${t.agent} : ${config.agentName}` : t.agency}</strong></p><p>{t.routing}</p>
    {config && !config.enabled && <p className="information-notice">{t.unavailable}</p>}
    {error && <p className="tools-error" role="alert">{error}</p>}
    {sent ? <p role="status" className="team-success">{t.accepted} · {requestId}</p> : <form className="inquiry-form" onSubmit={(event) => void submit(event)}
      onChange={() => { if (!busy) { setRequestId(crypto.randomUUID()); setToken(""); } }}>
      <fieldset disabled={busy}>
        <label>{t.name}<input name="name" autoComplete="name" minLength={2} maxLength={120} required /></label>
        <label>{t.email}<input name="email" type="email" autoComplete="email" maxLength={254} required /></label>
        <label>{t.phone}<input name="phone" type="tel" autoComplete="tel" maxLength={40} /></label>
        <label>{t.purpose}<select name="purpose" value={purpose} onChange={(event) => setPurpose(event.target.value === "VISIT" ? "VISIT" : "INFORMATION")}>
          {available && <option value="VISIT">{t.VISIT}</option>}<option value="INFORMATION">{t.INFORMATION}</option>
        </select></label>
        {purpose === "VISIT" && <><label>{t.preferredDate}<input name="preferredDate" type="date" min={minimumDate || undefined} max="2099-12-31" /></label><small>{t.dateHelp}</small></>}
        <label>{t.message}<textarea name="message" rows={5} minLength={10} maxLength={2000} required /></label>
        <div className="inquiry-trap" aria-hidden="true"><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
        <label className="inquiry-consent"><input name="consent" type="checkbox" required />{t.consent}</label>
        <Link href={`/${locale}/information/privacy`}>{t.privacy}</Link>
        {config?.enabled && <><button type="button" className="button button-outline" onClick={() => {
          if (!requestId) setRequestId(crypto.randomUUID());
          setVerify(true); setToken(""); setChallengeVersion((value) => value + 1); setError("");
        }}>{t.verification}</button><div ref={widget} className="inquiry-verification" /></>}
        <button className="button button-dark" disabled={!config?.enabled || !token}>{busy ? t.sending : t.send}</button>
      </fieldset>
    </form>}
    {verify && <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" strategy="afterInteractive"
      onReady={() => setScriptReady(true)} onError={() => setError(t.verifyError)} />}
  </aside>;
}
