"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import {
  demoLocations, demoTypes, demoSorts, initialDemoFilters, numericFilterPairs,
  validDemoRanges, type DemoFilters,
} from "@/lib/demo/properties";
import { Icon } from "./icon";

export function PropertyFilters({ onApply, onReset, includePublication = false }: {
  onApply: (filters: DemoFilters) => void; onReset?: () => void; includePublication?: boolean;
}) {
  const t = useTranslations("PropertyTools");
  const p = useTranslations("Preview");
  const b = useTranslations("Business");
  const id = useId();
  const [draft, setDraft] = useState(initialDemoFilters);
  const [error, setError] = useState(false);

  function update(key: keyof DemoFilters, value: string) {
    setDraft({ ...draft, [key]: value });
  }

  return (
    <form className="advanced-property-search" onSubmit={(event) => {
      event.preventDefault();
      if (!validDemoRanges(draft)) { setError(true); return; }
      setError(false);
      onApply(draft);
    }}>
      <div className="advanced-primary">
        <label><span id={`${id}-transaction`}>{p("transactionLabel")}</span><select aria-labelledby={`${id}-transaction`} value={draft.transaction} onChange={(event) => {
          const transaction = (["all", "sale", "rent"] as const).find((value) => value === event.target.value);
          if (transaction) setDraft({ ...draft, transaction });
        }}>
          {(["all", "sale", "rent"] as const).map((value) => <option value={value} key={value}>{p(value)}</option>)}
        </select></label>
        <label><span id={`${id}-availability`}>{b("availability")}</span><select aria-labelledby={`${id}-availability`}
          value={draft.availability ?? "all"} onChange={(event) => update("availability", event.target.value)}>
          <option value="all">{b("all")}</option>{(["AVAILABLE", "SOLD", "RENTED"] as const).map((value) =>
            <option key={value} value={value}>{b(value)}</option>)}
        </select></label>
        {includePublication && <label><span id={`${id}-publication`}>{b("publication")}</span><select aria-labelledby={`${id}-publication`}
          value={draft.publication ?? "all"} onChange={(event) => update("publication", event.target.value)}>
          <option value="all">{b("all")}</option>{(["DRAFT", "PUBLISHED"] as const).map((value) =>
            <option key={value} value={value}>{b(value)}</option>)}
        </select></label>}
        <label><span id={`${id}-location`}>{p("locationLabel")}</span><select aria-labelledby={`${id}-location`} value={draft.location} onChange={(event) => update("location", event.target.value)}>
          <option value="">{p("allLocations")}</option>
          {demoLocations.map((value) => <option value={value} key={value}>{p(`locations.${value}`)}</option>)}
        </select></label>
        <label><span id={`${id}-type`}>{p("typeLabel")}</span><select aria-labelledby={`${id}-type`} value={draft.type} onChange={(event) => update("type", event.target.value)}>
          <option value="">{p("allTypes")}</option>
          {demoTypes.map((value) => <option value={value} key={value}>{p(`types.${value}`)}</option>)}
        </select></label>
      </div>
      <div className="advanced-ranges">
        {numericFilterPairs.map(([min, max, field]) => (
          <fieldset key={field}><legend>{t(field)}</legend>
            <label htmlFor={`${id}-${min}`} className="sr-only">{t(`${field}Min`)}</label>
            <input id={`${id}-${min}`} name={min} type="number" min="0" max="999999999999"
              step={field === "rooms" || field === "bedrooms" ? "1" : "0.01"}
              placeholder={t("minimum")} value={draft[min] ?? ""} onChange={(event) => update(min, event.target.value)} />
            <span aria-hidden="true">—</span>
            <label htmlFor={`${id}-${max}`} className="sr-only">{t(`${field}Max`)}</label>
            <input id={`${id}-${max}`} name={max} type="number" min="0" max="999999999999"
              step={field === "rooms" || field === "bedrooms" ? "1" : "0.01"}
              placeholder={t("maximum")} value={draft[max] ?? ""} onChange={(event) => update(max, event.target.value)} />
          </fieldset>
        ))}
      </div>
      <div className="advanced-actions">
        <label><span id={`${id}-sort`}>{t("sort")}</span><select aria-labelledby={`${id}-sort`} value={draft.sort} onChange={(event) => {
          const sort = demoSorts.find((value) => value === event.target.value);
          if (sort) setDraft({ ...draft, sort });
        }}>{demoSorts.map((value) => <option key={value} value={value}>{value === "publishedAsc" ? b("oldest") : value === "publishedDesc" ? b("newest") : t(`sorts.${value}`)}</option>)}</select></label>
        <button type="button" className="text-button" onClick={() => {
          setDraft(initialDemoFilters); setError(false);
          if (onReset) onReset();
          else onApply(initialDemoFilters);
        }}>{p("reset")}</button>
        <button type="submit" className="button button-dark"><Icon name="search" />{p("search")}</button>
      </div>
      <p className="advanced-hint">{t("priceHint")}</p>
      {error && <p className="tools-error" role="alert">{t("rangeError")}</p>}
    </form>
  );
}
