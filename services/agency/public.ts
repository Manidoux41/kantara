import type { Prisma } from "@/generated/prisma/client";
import type { AgencyState } from "./repository";
import type { Locale } from "@/lib/i18n/routing";
import type { BusinessState } from "@/lib/demo/business-types";

export async function syncPublicProperties(tx: Prisma.TransactionClient, state: AgencyState, previous: BusinessState) {
  const { business } = state;
  for (const owner of business.clients.filter((item) => item.role === "OWNER")) {
    const old = previous.clients.find((item) => item.id === owner.id);
    if (old && old.name === owner.name && old.email === owner.email && old.phone === owner.phone) continue;
    await tx.propertyOwner.upsert({ where: { id: owner.id }, create: { id: owner.id, name: owner.name, email: owner.email || null, phone: owner.phone || null },
      update: { name: owner.name, email: owner.email || null, phone: owner.phone || null } });
  }
  for (const property of business.properties) {
    if (JSON.stringify(previous.properties.find((item) => item.id === property.id)) === JSON.stringify(property)) continue;
    const location = await tx.location.upsert({ where: { id: locationIds[property.location] },
      create: { id: locationIds[property.location], name: property.location }, update: {} });
    const data = { reference: property.id, slug: property.id, type: types[property.type],
      transactionType: property.transaction === "sale" ? "SALE" as const : "RENT" as const,
      status: property.publication, availability: property.availability,
      salePrice: property.transaction === "sale" ? property.price : null,
      rentalPrice: property.transaction === "rent" ? property.price : null,
      livingArea: property.area, bedrooms: property.bedrooms, bathrooms: property.bathrooms, rooms: property.rooms,
      furnished: property.furnishing === "FURNISHED",
      ownerId: property.ownerId, locationId: location.id, publishedAt: property.publishedAt ? new Date(property.publishedAt) : null,
      agencyDetails: { address: property.address, ...(property.furnishing ? { furnishing: property.furnishing } : {}),
        ...(property.coordinates ? { coordinates: property.coordinates } : {}) } };
    await tx.property.upsert({ where: { id: property.id }, create: { id: property.id, ...data }, update: data });
    // The source language is explicit; missing translations are not machine-invented.
    for (const locale of ["en", "fr", "km", "zh", "ja", "de", "es"] as Locale[]) {
      const translation = { title: property.title, description: property.description ?? property.address, published: property.publication === "PUBLISHED" };
      await tx.propertyTranslation.upsert({ where: { propertyId_locale: { propertyId: property.id, locale } },
        create: { propertyId: property.id, locale, ...translation }, update: translation });
    }
  }
}
const types = { villa: "VILLA", house: "HOUSE", apartment: "APARTMENT" } as const;
const locationIds = { "siem-reap": "00000000-0000-4000-8000-000000000001", kampot: "00000000-0000-4000-8000-000000000002", "phnom-penh": "00000000-0000-4000-8000-000000000003" };
