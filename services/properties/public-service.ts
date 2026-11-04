import "server-only";
import type { Locale } from "@/lib/i18n/routing";
import type { PropertyQuery } from "@/lib/validations/properties";
import { ApiError } from "@/lib/api/errors";
import { getPrisma } from "@/lib/prisma";
import { buildPublicPropertyQuery, publicPropertySelect, publicPropertyWhere } from "./public-query";

export async function listPublicProperties(query: PropertyQuery) {
  const prisma = getPrisma();
  const args = buildPublicPropertyQuery(query);
  const [data, total] = await prisma.$transaction([
    prisma.property.findMany(args),
    prisma.property.count({ where: args.where }),
  ], { isolationLevel: "RepeatableRead" });

  return {
    data,
    meta: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize),
      locale: query.locale,
      currency: query.currency,
    },
  };
}

export async function getPublicProperty(slug: string, locale: Locale) {
  const data = await getPrisma().property.findFirst({
    where: { ...publicPropertyWhere(locale), slug },
    select: publicPropertySelect(locale),
  });
  if (!data) throw new ApiError(404, "NOT_FOUND", "Property not found.");
  return { data };
}
