export const contactCategories = ["OWNER", "BUYER", "TENANT", "SELLER", "LANDLORD", "INVESTOR", "AGENCY", "DEVELOPER", "PROVIDER", "LEGAL", "PARTNER"] as const;
export const leadStages = ["NEW", "CONTACTED", "QUALIFIED", "SEARCH", "VISIT", "OFFER", "NEGOTIATION", "CONTRACT", "WON", "LOST"] as const;
export const leadSources = ["PUBLIC", "FACEBOOK", "WHATSAPP", "WEBSITE", "DIRECT", "REFERRAL", "PARTNER", "ADVERTISING", "WALK_IN", "OTHER"] as const;
export type ContactProfile = {
  firstName: string; lastName: string; company: string; whatsapp: string; country: string;
  preferredLanguage: string; categories: (typeof contactCategories)[number][];
  source: (typeof leadSources)[number]; assignedAgentId: string | null;
  notes: string; tags: string[]; followUpDate: string | null;
};
export type DemoAgent = {
  id: string; name: string; active: boolean; workdays: number[]; startMinute: number; endMinute: number;
};
export type Lead = {
  id: string; clientId: string; agentId: string; propertyIds: string[]; title: string;
  source: (typeof leadSources)[number]; stage: (typeof leadStages)[number]; score: number;
  expectedCommission: string; expectedClosingDate: string | null; followUpDate: string | null;
  lostReason: string; notes: string; createdAt: string; updatedAt: string;
};
export type Appointment = {
  id: string; title: string; clientId: string; propertyId: string | null; leadId: string | null; agentId: string;
  startAt: string; endAt: string; location: string; notes: string;
  status: "SCHEDULED" | "COMPLETED" | "CANCELLED"; feedback: string;
  interest: "UNKNOWN" | "LOW" | "MEDIUM" | "HIGH"; createdAt: string; updatedAt: string; sequence: number;
};
export type Activity = {
  id: string; at: string; action: string; clientId: string | null; leadId: string | null;
  appointmentId: string | null; channel: "SYSTEM" | "NOTE" | "EMAIL" | "WHATSAPP" | "PHONE"; text: string;
};
export type CrmState = { agents: DemoAgent[]; leads: Lead[]; appointments: Appointment[]; activities: Activity[] };
export type CrmSummary = {
  contacts: number; activeAgents: number; openLeads: number; wonLeads: number; conversionRate: number;
  upcoming: number; overdueFollowUps: number; expiringContracts: number;
  published: number; available: number; sold: number; rented: number; sales: number; rentals: number;
  monthly: { month: string; received: string; realized: string; transactions: number }[];
};
