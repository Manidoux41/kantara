import assert from "node:assert/strict";
import test from "node:test";
import {
  parsePropertyQuery,
  propertyQuerySchema,
  propertySorts,
  propertySlugSchema,
} from "../lib/validations/properties";
import {
  buildPublicPropertyQuery,
  publicPropertySelect,
  publicPropertyWhere,
} from "../services/properties/public-query";

test("query defaults are bounded and use the default locale and currency", () => {
  const query = parsePropertyQuery(new URLSearchParams());
  assert.equal(query.locale, "en");
  assert.equal(query.currency, "USD");
  const args = buildPublicPropertyQuery(query);
  assert.equal(args.take, 20);
  assert.equal(args.skip, 0);
});

test("rejects unknown parameters, private filters and duplicated parameters", () => {
  for (const input of ["status=DRAFT", "ownerId=secret", "page=1&page=2", "locale=en&locale=fr"]) {
    assert.throws(() => parsePropertyQuery(new URLSearchParams(input)));
  }
});

test("rejects invalid locales, bounds and decimal prices", () => {
  for (const input of [
    { locale: "xx" }, { page: 0 }, { pageSize: 51 }, { page: 1.5 },
    { page: 10001 }, { minBedrooms: -1 }, { furnished: "yes" },
    { minPrice: "-1" }, { minPrice: "1.001" }, { minPrice: "1e9" },
    { currency: "usd" }, { minPrice: "20", maxPrice: "10" },
    { minPrice: "9999999999999999.99", maxPrice: "9999999999999999.98" },
  ]) {
    assert.equal(propertyQuerySchema.safeParse(input).success, false, JSON.stringify(input));
  }
});

test("preserves exact decimal bounds and false furnished filter", () => {
  const args = buildPublicPropertyQuery(parsePropertyQuery(new URLSearchParams(
    "minPrice=9999999999999999.98&maxPrice=9999999999999999.99&furnished=false&page=3&pageSize=10",
  )));
  assert.equal(args.where.furnished, false);
  assert.equal(args.skip, 20);
  assert.deepEqual(args.where.OR, [
    { transactionType: { in: ["SALE", "SALE_AND_RENT"] }, salePrice: { gte: "9999999999999999.98", lte: "9999999999999999.99" } },
    { transactionType: { in: ["RENT", "SALE_AND_RENT"] }, rentalPrice: { gte: "9999999999999999.98", lte: "9999999999999999.99" } },
  ]);
});

test("publication guard excludes drafts, deleted, future and untranslated listings", () => {
  const where = publicPropertyWhere("fr");
  assert.equal(where.status, "PUBLISHED");
  assert.equal(where.deletedAt, null);
  assert.deepEqual(where.translations, { some: { locale: "fr", published: true } });
  assert.ok(where.publishedAt && typeof where.publishedAt === "object" && "lte" in where.publishedAt);
});

test("all sorting options have a deterministic ID tie-breaker", () => {
  for (const sort of propertySorts) {
    const args = buildPublicPropertyQuery(propertyQuerySchema.parse({ sort, transactionType: "SALE" }));
    assert.deepEqual(args.orderBy.at(-1), { id: "asc" });
  }
});

test("advanced API filters combine location and bounded numeric criteria", () => {
  const args = buildPublicPropertyQuery(parsePropertyQuery(new URLSearchParams(
    "location=Phnom&minArea=100.25&maxArea=200&minBedrooms=2&maxBedrooms=3&minRooms=3&maxRooms=5&sort=areaDesc",
  )));
  assert.deepEqual(args.where.location, { name: { contains: "Phnom", mode: "insensitive" } });
  assert.deepEqual(args.where.livingArea, { gte: "100.25", lte: "200" });
  assert.deepEqual(args.where.bedrooms, { gte: 2, lte: 3 });
  assert.deepEqual(args.where.rooms, { gte: 3, lte: 5 });
  assert.deepEqual(args.orderBy[0], { livingArea: { sort: "desc", nulls: "last" } });
  for (const invalid of [
    "minArea=20&maxArea=10", "minArea=1e2", "minArea=1.001", "maxArea=-1",
    "minBedrooms=4&maxBedrooms=3", "minRooms=4&maxRooms=3", "minRooms=1.5",
    "maxRooms=101", "minBedrooms=", "location=%20", "sort=priceAsc",
    "sort=priceAsc&transactionType=SALE_AND_RENT",
  ]) assert.throws(() => parsePropertyQuery(new URLSearchParams(invalid)), invalid);
});

test("generic price sorts require a transaction and use rent instead of sale when requested", () => {
  for (const transactionType of ["SALE", "RENT"] as const) {
    const args = buildPublicPropertyQuery(propertyQuerySchema.parse({ sort: "priceDesc", transactionType }));
    assert.deepEqual(args.orderBy[0], {
      [transactionType === "SALE" ? "salePrice" : "rentalPrice"]: { sort: "desc", nulls: "last" },
    });
  }
});

test("sale and rent filters use the corresponding price", () => {
  for (const transactionType of ["SALE", "RENT"]) {
    const args = buildPublicPropertyQuery(propertyQuerySchema.parse({
      transactionType, minPrice: "100",
    }));
    assert.deepEqual(args.where.transactionType, { in: [transactionType, "SALE_AND_RENT"] });
    assert.equal(args.where.OR?.length, 1);
    const expected = transactionType === "SALE" ? "salePrice" : "rentalPrice";
    assert.ok(args.where.OR?.[0] && expected in args.where.OR[0]);
  }
});

test("sale-and-rent filter requires dual-purpose listings", () => {
  const args = buildPublicPropertyQuery(propertyQuerySchema.parse({ transactionType: "SALE_AND_RENT" }));
  assert.equal(args.where.transactionType, "SALE_AND_RENT");
});

test("public projection never includes private relations or unpublished translations", () => {
  const select = publicPropertySelect("km");
  for (const key of ["owner", "ownerId", "partner", "partnerId", "agents", "documents", "deletedAt"]) {
    assert.equal(key in select, false);
  }
  assert.deepEqual(select.translations.where, { locale: "km", published: true });
  assert.deepEqual(select.location.select, { id: true, name: true });
});

test("validates slug format", () => {
  assert.equal(propertySlugSchema.safeParse("villa-siem-reap").success, true);
  for (const slug of ["", "../owner", "a/b", "A", "a--b"]) {
    assert.equal(propertySlugSchema.safeParse(slug).success, false);
  }
});
