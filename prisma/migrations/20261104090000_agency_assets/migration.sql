CREATE TABLE "AgencyAsset" (
    "id" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "payload" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AgencyAsset_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AgencyAsset_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "AgencyAsset_propertyId_kind_idx" ON "AgencyAsset"("propertyId", "kind");
