import type { DemoProperty } from "@/lib/demo/properties";
import type { BusinessProperty } from "@/lib/demo/business-types";

export type CatalogueProperty = DemoProperty | Omit<BusinessProperty, "ownerId" | "titleReference">;
export type MapPoint = { latitude: number; longitude: number };

// Fictional approximate positions, not actual property addresses.
const positions: Record<string, MapPoint> = {
  "DEMO-001": { latitude: 13.365, longitude: 103.858 },
  "DEMO-002": { latitude: 13.352, longitude: 103.847 },
  "DEMO-003": { latitude: 11.575, longitude: 104.927 },
  "DEMO-004": { latitude: 10.621, longitude: 104.176 },
  "DEMO-005": { latitude: 11.551, longitude: 104.934 },
  "DEMO-006": { latitude: 10.612, longitude: 104.19 },
};
export function propertyPosition(id: string): MapPoint | undefined { return positions[id]; }
export function propertyPath(locale: string, id: string) { return `/${locale}/properties/${encodeURIComponent(id)}`; }
