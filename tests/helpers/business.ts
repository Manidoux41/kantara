import { contractInput } from "../../lib/validations/demo-business";
import { createBusinessState } from "../../services/demo/business";

export function sampleContract(kind: "SALE_MANDATE" | "RENTAL_MANDATE" | "LEASE" = "SALE_MANDATE") {
  const state = createBusinessState();
  return contractInput.parse({
    kind, language: "fr-km", ownerId: state.clients[0].id,
    ...(kind === "LEASE" ? { counterpartyId: "TENANT-DEMO" } : {}),
    agencyName: "KANTARA DEMO", agencyAddress: "Adresse fictive, Siem Reap",
    agencyRegistration: "REG-DEMO", signedPlace: "Siem Reap",
    signedAt: "2026-11-01", startDate: "2026-11-01", endDate: "2027-10-31",
    exclusive: false,
    lines: [{ propertyId: kind === "SALE_MANDATE" ? "DEMO-001" : "DEMO-002", price: kind === "SALE_MANDATE" ? "285000" : "850", expectedCommission: "1000.25" }],
    deposit: "1700", rentDueDay: 5, permittedUse: "Mission / usage résidentiel à vérifier",
    terms: "Conditions fictives : inventaire, charges et préavis à faire vérifier.",
    commissionTerms: "Commission contractuelle fictive payée après clôture, sous réserve de validation.",
  });
}
