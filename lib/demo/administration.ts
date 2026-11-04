import { demoProperties } from "./properties";

export const adminModules = [
  "dashboard", "properties", "crm", "partners", "documents", "contracts",
  "finance", "appointments", "team", "reports", "settings", "activity",
] as const;
export type AdminModule = (typeof adminModules)[number];
export type RecordModule = Exclude<AdminModule, "dashboard">;
export const demoStatuses = ["active", "pending", "completed"] as const;
export type DemoStatus = (typeof demoStatuses)[number];

export type AdminDemoRecord = {
  id: string;
  module: RecordModule;
  titleKey: string;
  propertyId?: string;
  assignedTo: string;
  status: DemoStatus;
  amount?: number;
  amountUnit?: "sale" | "rent" | "commission";
};

// Separate from real API services. References link only to other fictional fixtures.
export const adminDemoRecords: readonly AdminDemoRecord[] = [
  ...demoProperties.map((property): AdminDemoRecord => ({
    id: property.id, module: "properties", titleKey: `property:${property.key}`,
    propertyId: property.id, assignedTo: property.location === "kampot" ? "Agent B02" : "Agent A01",
    status: "active", amount: property.price, amountUnit: property.transaction,
  })),
  { id: "LEAD-001", module: "crm", titleKey: "buyer", propertyId: "DEMO-001", assignedTo: "Agent A01", status: "active" },
  { id: "LEAD-002", module: "crm", titleKey: "tenant", propertyId: "DEMO-002", assignedTo: "Agent A01", status: "pending" },
  { id: "LEAD-003", module: "crm", titleKey: "investor", propertyId: "DEMO-003", assignedTo: "Agent B02", status: "active" },
  { id: "LEAD-004", module: "crm", titleKey: "owner", propertyId: "DEMO-006", assignedTo: "Agent B02", status: "completed" },
  { id: "PARTNER-001", module: "partners", titleKey: "agency", propertyId: "DEMO-001", assignedTo: "Agent A01", status: "active" },
  { id: "PARTNER-002", module: "partners", titleKey: "referral", propertyId: "DEMO-004", assignedTo: "Agent B02", status: "pending" },
  { id: "DOC-001", module: "documents", titleKey: "ownership", propertyId: "DEMO-001", assignedTo: "Agent A01", status: "completed" },
  { id: "DOC-002", module: "documents", titleKey: "identity", propertyId: "DEMO-006", assignedTo: "Agent B02", status: "pending" },
  { id: "DOC-003", module: "documents", titleKey: "inspection", propertyId: "DEMO-002", assignedTo: "Agent A01", status: "active" },
  { id: "CONTRACT-001", module: "contracts", titleKey: "saleMandate", propertyId: "DEMO-001", assignedTo: "Agent A01", status: "completed" },
  { id: "CONTRACT-002", module: "contracts", titleKey: "lease", propertyId: "DEMO-002", assignedTo: "Agent A01", status: "pending" },
  { id: "CONTRACT-003", module: "contracts", titleKey: "partnership", propertyId: "DEMO-004", assignedTo: "Agent B02", status: "active" },
  { id: "FIN-001", module: "finance", titleKey: "agencyCommission", propertyId: "DEMO-001", assignedTo: "Finance C03", status: "completed", amount: 6000, amountUnit: "commission" },
  { id: "FIN-002", module: "finance", titleKey: "agentCommission", propertyId: "DEMO-001", assignedTo: "Agent A01", status: "pending", amount: 1800, amountUnit: "commission" },
  { id: "FIN-003", module: "finance", titleKey: "partnerCommission", propertyId: "DEMO-001", assignedTo: "Finance C03", status: "active", amount: 900, amountUnit: "commission" },
  { id: "VISIT-001", module: "appointments", titleKey: "viewing", propertyId: "DEMO-001", assignedTo: "Agent A01", status: "pending" },
  { id: "VISIT-002", module: "appointments", titleKey: "handover", propertyId: "DEMO-002", assignedTo: "Agent B02", status: "completed" },
  { id: "USER-A01", module: "team", titleKey: "salesAgent", assignedTo: "Agent A01", status: "active" },
  { id: "USER-B02", module: "team", titleKey: "propertyManager", assignedTo: "Agent B02", status: "active" },
  { id: "USER-C03", module: "team", titleKey: "accountant", assignedTo: "Finance C03", status: "pending" },
  { id: "REPORT-001", module: "reports", titleKey: "commercialReport", assignedTo: "Agent A01", status: "completed" },
  { id: "REPORT-002", module: "reports", titleKey: "financialReport", assignedTo: "Finance C03", status: "active" },
  { id: "SETTING-001", module: "settings", titleKey: "languages", assignedTo: "KANTARA", status: "active" },
  { id: "SETTING-002", module: "settings", titleKey: "currencies", assignedTo: "KANTARA", status: "active" },
  { id: "SETTING-003", module: "settings", titleKey: "storage", assignedTo: "KANTARA", status: "pending" },
  { id: "LOG-001", module: "activity", titleKey: "propertyPublished", propertyId: "DEMO-001", assignedTo: "Agent A01", status: "completed" },
  { id: "LOG-002", module: "activity", titleKey: "documentRequested", propertyId: "DEMO-006", assignedTo: "Agent B02", status: "pending" },
  { id: "LOG-003", module: "activity", titleKey: "contractReviewed", propertyId: "DEMO-002", assignedTo: "Agent A01", status: "active" },
];

export function getAdminDemoSummary() {
  const finance = adminDemoRecords.filter((record) => record.module === "finance");
  return {
    properties: demoProperties.length,
    leads: adminDemoRecords.filter((record) => record.module === "crm" && record.status !== "completed").length,
    pendingDocuments: adminDemoRecords.filter((record) => record.module === "documents" && record.status === "pending").length,
    commissions: finance.reduce((sum, record) => sum + (record.amount ?? 0), 0),
    completedCommissions: finance.filter((record) => record.status === "completed").reduce((sum, record) => sum + (record.amount ?? 0), 0),
  };
}

export function filterAdminRecords(
  module: RecordModule,
  query: string,
  status: "all" | DemoStatus,
  getTitle: (record: AdminDemoRecord) => string,
) {
  const search = query.trim().toLocaleLowerCase();
  return adminDemoRecords.filter((record) =>
    record.module === module
    && (status === "all" || record.status === status)
    && [record.id, record.assignedTo, record.propertyId ?? "", getTitle(record)]
      .some((value) => value.toLocaleLowerCase().includes(search)),
  );
}
