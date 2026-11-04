CREATE TABLE "AgencyWorkspace" (
    "id" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AgencyWorkspace_pkey" PRIMARY KEY ("id")
);
