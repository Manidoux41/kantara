"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, type ComponentProps } from "react";
import { useTranslations } from "next-intl";
import { BrandMark } from "@/components/public/brand-mark";
import { Icon } from "@/components/public/icon";
import {
  adminModules, adminDemoRecords, demoStatuses, filterAdminRecords, getAdminDemoSummary,
  type AdminDemoRecord, type AdminModule, type DemoStatus,
} from "@/lib/demo/administration";
import { demoProperties, filterDemoProperties, initialDemoFilters, type DemoFilters } from "@/lib/demo/properties";
import { locales, type Locale } from "@/lib/i18n/routing";
import { PropertyFilters } from "@/components/public/property-filters";
import { PropertyMedia } from "./property-media";
import { useLocalPropertyMedia } from "./use-local-property-media";
import { BusinessWorkspace, type BusinessTab } from "./business-workspace";
import { teamMessages } from "@/lib/i18n/team";

const icons: Record<AdminModule, ComponentProps<typeof Icon>["name"]> = {
  dashboard: "dashboard", properties: "home", crm: "users", partners: "globe",
  documents: "document", contracts: "document", finance: "finance",
  appointments: "calendar", team: "users", reports: "chart", settings: "settings", activity: "clock",
};

type Props = {
  locale: Locale;
  amounts: Record<string, string>;
  commissionTotal: string;
  commissionPaid: string;
  operational: boolean;
};

export function AdminPreview({ locale, amounts, commissionTotal, commissionPaid, operational }: Props) {
  const t = useTranslations("AdminPreview");
  const p = useTranslations("Preview");
  const tools = useTranslations("PropertyTools");
  const b = useTranslations("Business");
  const ui = useTranslations("Interface");
  const [businessOpen, setBusinessOpen] = useState(operational);
  const [businessTab, setBusinessTab] = useState<BusinessTab>("overview");
  const [module, setModule] = useState<AdminModule>("dashboard");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | DemoStatus>("all");
  const [selected, setSelected] = useState<AdminDemoRecord | null>(null);
  const [mobileMenu, setMobileMenu] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const focusHeading = useRef(false);
  const [propertyFilters, setPropertyFilters] = useState<DemoFilters>(initialDemoFilters);
  const [filterVersion, setFilterVersion] = useState(0);
  const localMedia = useLocalPropertyMedia();
  const summary = getAdminDemoSummary();
  const crmRecords = adminDemoRecords.filter((record) => record.module === "crm");
  const saleCount = demoProperties.filter((property) => property.transaction === "sale").length;
  const rentCount = demoProperties.length - saleCount;

  function title(record: AdminDemoRecord) {
    return record.titleKey.startsWith("property:")
      ? p(`properties.${record.titleKey.slice(9)}.title`)
      : t(`records.${record.titleKey}`);
  }

  const baseRows = module === "dashboard" ? [] : filterAdminRecords(module, query, status, title);
  const propertyResults = filterDemoProperties(propertyFilters);
  const rows = module === "properties"
    ? propertyResults.flatMap((property) => baseRows.filter((record) => record.id === property.id))
    : baseRows;
  const relatedProperty = selected ? demoProperties.find((property) => property.id === selected.propertyId) : undefined;

  useEffect(() => {
    if (selected) dialog.current?.showModal();
  }, [selected]);

  useEffect(() => {
    if (focusHeading.current) {
      heading.current?.focus();
      focusHeading.current = false;
    }
  }, [module]);

  function navigate(next: AdminModule) {
    const liveTabs: Partial<Record<AdminModule, BusinessTab>> = { dashboard: "overview", crm: "clients", properties: "properties", appointments: "calendar", contracts: "contracts", finance: "finance", activity: "activity" };
    const live = operational ? liveTabs[next] : undefined;
    setBusinessOpen(Boolean(live));
    if (live) setBusinessTab(live);
    focusHeading.current = next !== module;
    setModule(next);
    setQuery("");
    setStatus("all");
    setPropertyFilters(initialDemoFilters);
    setFilterVersion((version) => version + 1);
    setMobileMenu(false);
  }

  function badge(value: DemoStatus) {
    return <span className={`admin-badge status-${value}`}><span />{t(`statuses.${value}`)}</span>;
  }

  return (
    <div className="admin-demo">
      <a className="skip-link" href="#admin-main">{p("skip")}</a>
      <div className="admin-demo-notice"><span className="admin-demo-tag">DEMO</span>{t("notice")}</div>
      <div className="admin-frame">
        <aside className={`admin-sidebar${mobileMenu ? " is-open" : ""}`}>
          <Link className="brand admin-brand" href={`/${locale}`}>
            <BrandMark /><span>KANTARA<small>{t("workspace")}</small></span>
          </Link>
          <button type="button" className="admin-mobile-toggle" aria-expanded={mobileMenu} aria-controls="admin-navigation"
            onClick={() => setMobileMenu(!mobileMenu)}>{t("menu")}<Icon name="chevron" /></button>
          <div className="admin-sidebar-content" id="admin-navigation">
            <p className="admin-nav-label">{t("workspace")}</p>
            <nav aria-label={t("navigation")}>
              {adminModules.map((key) => (
                <button key={key} type="button" aria-current={module === key ? "page" : undefined}
                  onClick={() => navigate(key)}>
                  <Icon name={icons[key]} /><span>{t(`modules.${key}`)}</span>
                  {key === "documents" && <span className="nav-count" aria-hidden="true">{summary.pendingDocuments}</span>}
                </button>
              ))}
            </nav>
            <div className="admin-sidebar-bottom">
              <p>{t("language")}</p>
              <nav className="admin-languages" aria-label={t("language")}>
                {locales.map((language) => <Link key={language} href={`/${language}/demo/admin`} lang={language}
                  hrefLang={language} aria-current={locale === language ? "page" : undefined}>{language.toUpperCase()}</Link>)}
              </nav>
              <Link className="admin-public-link" href={`/${locale}`}><Icon name="globe" />{t("publicSite")}<Icon name="arrow" /></Link>
              <div className="admin-demo-profile"><span>DA</span><div><strong>{t("demoAdmin")}</strong><small>{t("noSession")}</small></div></div>
            </div>
          </div>
        </aside>

        <div className="admin-body">
          <header className="admin-topbar">
            <p>KANTARA <span>/</span> {t("workspace")}</p>
            <span className="admin-readonly"><span />{businessOpen ? b("entry") : t("readOnly")}</span>
          </header>
          <main id="admin-main" className="admin-content" tabIndex={-1}>
            <div className="admin-page-heading">
              <div><p className="eyebrow">{t("eyebrow")}</p><h1 ref={heading} tabIndex={-1}>{t(`modules.${module}`)}</h1></div>
              <span className="admin-snapshot">{t("snapshot")}</span>
            </div>
            <p className="admin-page-description">{t(`descriptions.${module}`)}</p>
            <div className="business-entry">{operational ? <button type="button" className="button button-dark"
              onClick={() => setBusinessOpen(!businessOpen)} aria-expanded={businessOpen}>{b(businessOpen ? "back" : "entry")}</button>
              : <p className="admin-deployment-notice">{ui("localWorkspace")}</p>}</div>
            <p><Link className="text-link" href={`/${locale}/demo/team`}>{teamMessages(locale).entry}<Icon name="arrow" /></Link></p>

            {businessOpen ? <BusinessWorkspace key={businessTab} initialTab={businessTab} /> : module === "dashboard" ? (
              <>
                <div className="admin-kpis">
                  {([
                    ["properties", summary.properties, "home"],
                    ["crm", summary.leads, "users"],
                    ["documents", summary.pendingDocuments, "document"],
                    ["finance", commissionTotal, "finance"],
                  ] as const).map(([key, value, icon]) => (
                    <button className="admin-kpi" key={key} type="button" onClick={() => navigate(key)}>
                      <span className="admin-kpi-label">{t(`metrics.${key}`)}<Icon name={icon} /></span>
                      <strong>{value}</strong><span className="admin-kpi-foot">{t("viewModule")}<Icon name="arrow" /></span>
                    </button>
                  ))}
                </div>

                <div className="admin-dashboard-grid">
                  <section className="admin-panel">
                    <div className="admin-panel-heading"><h2>{t("portfolio")}</h2><span>{t("sample")}</span></div>
                    <div className="admin-portfolio">
                      <div className="portfolio-donut" role="img"
                        style={{ background: `conic-gradient(#234e3d 0 ${saleCount / summary.properties * 100}%, #b39c67 0 100%)` }}
                        aria-label={`${p("sale")} : ${saleCount}. ${p("rent")} : ${rentCount}.`}>
                        <div><strong>{summary.properties}</strong><span>{t("modules.properties")}</span></div>
                      </div>
                      <ul className="portfolio-legend">
                        {(["sale", "rent"] as const).map((transaction) => (
                          <li key={transaction}><span className={`legend-dot ${transaction}`} />{p(transaction)}
                            <strong>{demoProperties.filter((property) => property.transaction === transaction).length}</strong></li>
                        ))}
                      </ul>
                    </div>
                    <div className="admin-panel-note">{t("portfolioNote")}</div>
                  </section>
                  <section className="admin-panel">
                    <div className="admin-panel-heading"><h2>{t("pipeline")}</h2><Icon name="users" /></div>
                    <div className="admin-pipeline">
                      {demoStatuses.map((value) => {
                        const count = crmRecords.filter((record) => record.status === value).length;
                        return <div key={value}><div><span>{t(`statuses.${value}`)}</span><strong>{count}</strong></div>
                          <div className="pipeline-track"><span style={{ width: `${count / crmRecords.length * 100}%` }} /></div></div>;
                      })}
                    </div>
                    <button className="admin-panel-link" type="button" onClick={() => navigate("crm")}>{t("openCrm")}<Icon name="arrow" /></button>
                  </section>
                  <section className="admin-panel">
                    <div className="admin-panel-heading"><h2>{t("attention")}</h2><span className="admin-counter">3</span></div>
                    <div className="admin-task-list">
                      {(["documents", "contracts", "appointments"] as const).map((key) => {
                        const pending = adminDemoRecords.find((record) => record.module === key && record.status === "pending")!;
                        return <button type="button" key={key} onClick={() => navigate(key)}>
                          <span className="task-icon"><Icon name={icons[key]} /></span>
                          <span><strong>{title(pending)}</strong><small>{pending.id} · {pending.propertyId}</small></span><Icon name="arrow" />
                        </button>;
                      })}
                    </div>
                  </section>
                  <section className="admin-panel">
                    <div className="admin-panel-heading"><h2>{t("financeOverview")}</h2><span>USD</span></div>
                    <div className="admin-finance-total"><span>{t("commissionTotal")}</span><strong>{commissionTotal}</strong></div>
                    <div className="admin-finance-paid"><span>{t("commissionPaid")}</span><strong>{commissionPaid}</strong></div>
                    <p className="admin-finance-disclaimer">{t("financeNotice")}</p>
                    <button className="admin-panel-link" type="button" onClick={() => navigate("finance")}>{t("modules.finance")}<Icon name="arrow" /></button>
                  </section>
                </div>
                <section className="admin-panel admin-module-overview">
                  <div className="admin-panel-heading"><h2>{t("allModules")}</h2><span>{t("planned")}</span></div>
                  <div className="admin-module-grid">{adminModules.filter((key) => key !== "dashboard").map((key) => (
                    <button key={key} type="button" onClick={() => navigate(key)}><Icon name={icons[key]} />
                      <strong>{t(`modules.${key}`)}</strong><span>{t(`descriptions.${key}`)}</span><Icon name="arrow" /></button>
                  ))}</div>
                </section>
              </>
            ) : (
              <section className="admin-panel admin-resource-panel" aria-label={t(`modules.${module}`)}>
                {module === "properties" && <PropertyFilters key={filterVersion} onApply={setPropertyFilters} includePublication />}
                <div className="admin-resource-toolbar">
                  <label className="admin-search"><Icon name="search" /><span className="sr-only">{t("search")}</span>
                    <input type="search" placeholder={t("searchPlaceholder")} value={query} onChange={(event) => setQuery(event.target.value)} />
                  </label>
                  <label className="admin-status-filter"><span id="admin-status-label">{t("status")}</span><select aria-labelledby="admin-status-label" value={status}
                    onChange={(event) => {
                      const next = (["all", ...demoStatuses] as const).find((value) => value === event.target.value);
                      if (next) setStatus(next);
                    }}>
                    <option value="all">{t("allStatuses")}</option>
                    {demoStatuses.map((value) => <option key={value} value={value}>{t(`statuses.${value}`)}</option>)}
                  </select></label>
                  <button type="button" className="text-button" onClick={() => {
                    setQuery(""); setStatus("all"); setPropertyFilters(initialDemoFilters);
                    setFilterVersion((version) => version + 1);
                  }}>{p("reset")}</button>
                </div>
                <div className="admin-table-summary" role="status">{t("results", { count: rows.length })}</div>
                {rows.length ? <div className="admin-table-scroll" tabIndex={0} role="region" aria-label={t("tableLabel")}>
                  <table className="admin-table">
                    <thead><tr><th scope="col">{t("record")}</th><th scope="col">{t("assignedTo")}</th><th scope="col">{t("linkedProperty")}</th><th scope="col">{t("status")}</th><th scope="col">{t("details")}</th></tr></thead>
                    <tbody>{rows.map((record) => {
                      const property = demoProperties.find((item) => item.id === record.propertyId);
                      return <tr key={record.id}>
                        <th scope="row"><div className="admin-record-title">
                          {module === "properties" && property && <Image src={property.image} alt="" width={60} height={48} />}
                          <div><strong>{title(record)}</strong><small>{record.id}
                            {record.amount !== undefined && <> · {amounts[record.id]}{record.amountUnit === "rent" ? p("perMonth") : ""}</>}
                          </small>{module === "properties" && property && <small>
                            {property.area} m² · {property.bedrooms} {tools("bedrooms")} · {property.rooms} {tools("rooms")}
                            {" · "}{p(`locations.${property.location}`)}
                          </small>}</div>
                        </div></th>
                        <td>{record.assignedTo}</td>
                        <td>{record.propertyId ?? "—"}</td>
                        <td>{badge(record.status)}</td>
                        <td><button type="button" className="detail-button" onClick={() => setSelected(record)}
                          aria-label={`${t("details")} — ${record.id}`}><Icon name="arrow" /></button></td>
                      </tr>;
                    })}</tbody>
                  </table>
                </div> : <div className="admin-empty"><Icon name="search" /><h2>{t("empty")}</h2><p>{t("emptyHint")}</p></div>}
                <div className="admin-panel-note">{t("plannedNotice")}</div>
              </section>
            )}
            <p className="admin-bottom-note"><Icon name="document" />{t("boundary")}</p>
          </main>
        </div>
      </div>

      <dialog ref={dialog} className="property-dialog admin-record-dialog" aria-labelledby="admin-dialog-title"
        onClose={() => setSelected(null)} onKeyDown={(event) => {
          if (event.key === "Escape") { event.preventDefault(); event.currentTarget.close(); }
        }}>
        {selected && <>
          <form method="dialog" className="dialog-close-form"><button className="dialog-close" aria-label={p("close")}><Icon name="close" /></button></form>
          {relatedProperty && <Image className="dialog-art" src={relatedProperty.image} alt="" width={1200} height={1000} />}
          <div className="dialog-content">
            <p className="eyebrow">{t("sample")} · {selected.id}</p>
            <h2 id="admin-dialog-title">{title(selected)}</h2>
            {badge(selected.status)}
            <dl className="admin-detail-list">
              {relatedProperty && <>
                <div><dt>{tools("area")}</dt><dd>{relatedProperty.area} m²</dd></div>
                <div><dt>{tools("bedrooms")}</dt><dd>{relatedProperty.bedrooms}</dd></div>
                <div><dt>{tools("rooms")}</dt><dd>{relatedProperty.rooms}</dd></div>
              </>}
              <div><dt>{t("modulesLabel")}</dt><dd>{t(`modules.${selected.module}`)}</dd></div>
              <div><dt>{t("assignedTo")}</dt><dd>{selected.assignedTo}</dd></div>
              {relatedProperty && <div><dt>{t("linkedProperty")}</dt><dd>{p(`properties.${relatedProperty.key}.title`)} · {relatedProperty.id}</dd></div>}
              {selected.amount !== undefined && <div><dt>{t("amount")}</dt><dd>{amounts[selected.id]}{selected.amountUnit === "rent" ? p("perMonth") : ""}</dd></div>}
            </dl>
            <p className="dialog-description">{t(`descriptions.${selected.module}`)}</p>
            {relatedProperty && (selected.module === "properties" || selected.module === "documents") &&
              <PropertyMedia propertyId={relatedProperty.id} manager={localMedia} />}
            {selected.module === "finance" && <p className="admin-finance-disclaimer">{t("financeNotice")}</p>}
            <p className="dialog-notice">{t("plannedNotice")}</p>
          </div>
        </>}
      </dialog>
    </div>
  );
}
