"use client";

import { useState } from "react";
import type { Locale } from "@/lib/i18n/routing";
import { TeamWorkspace } from "./team-workspace";
import { BusinessWorkspace } from "./business-workspace";
import { DossierWorkspace } from "./dossier-workspace";

export function AgencyWorkspace({ locale }: { locale: Locale }) {
  const [role, setRole] = useState<"ADMIN" | "AGENT" | null>(null);
  return <>
    <TeamWorkspace locale={locale} production onAccount={setRole} />
    {role === "ADMIN" && <BusinessWorkspace production />}
    {role === "AGENT" && <BusinessWorkspace production readOnly />}
    {role && <DossierWorkspace locale={locale} />}
  </>;
}
