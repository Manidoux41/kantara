import type { DemoProperty } from "./properties";
import type { ContactProfile, CrmState } from "./crm-types";

export type ClientRole = "OWNER" | "BUYER" | "TENANT";
export type BusinessClient = {
  id: string; name: string; role: ClientRole; address: string;
  identityReference: string; nationality: string; email: string; phone: string;
  propertyIds: string[];
  profile?: ContactProfile;
};
export type BusinessProperty = Omit<DemoProperty, "key" | "image"> & {
  image: string;
  title: string; address: string; titleReference: string; ownerId: string;
  availability: "AVAILABLE" | "SOLD" | "RENTED";
  publication: "DRAFT" | "PUBLISHED"; publishedAt: string | null;
  description?: string;
  coordinates?: { latitude: number; longitude: number };
};
export type ContractKind = "SALE_MANDATE" | "RENTAL_MANDATE" | "LEASE";
export type ContractLine = { propertyId: string; price: string; expectedCommission: string };
export type BusinessContract = {
  id: string; kind: ContractKind; language: "fr-km" | "en-km"; ownerId: string;
  counterpartyId?: string; agencyName: string; agencyAddress: string; agencyRegistration: string;
  signedAt: string; signedPlace: string; startDate: string; endDate: string;
  exclusive: boolean; lines: ContractLine[]; deposit: string; rentDueDay: number;
  permittedUse: string; terms: string; commissionTerms: string; createdAt: string;
  ownerSnapshot: BusinessClient; counterpartySnapshot?: BusinessClient;
  propertySnapshots: BusinessProperty[];
};
export type BusinessTransaction = {
  id: string; contractId: string; propertyId: string; closedAt: string;
  commission: string; receipts: { id: string; amount: string; paidAt: string; reference: string }[];
};
export type BusinessState = CrmState & {
  revision: number; clients: BusinessClient[]; properties: BusinessProperty[];
  contracts: BusinessContract[]; transactions: BusinessTransaction[];
};
export type RevenueSummary = {
  expected: string; realized: string; received: string; outstanding: string;
};
