-- CreateTable
CREATE TABLE "CompanyDirectory" (
    "id" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "companyCategory" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual_input',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyDirectory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CompanyDirectory_normalizedName_key" ON "CompanyDirectory"("normalizedName");

-- CreateIndex
CREATE INDEX "CompanyDirectory_companyName_idx" ON "CompanyDirectory"("companyName");

-- CreateIndex
CREATE INDEX "CompanyDirectory_companyCategory_idx" ON "CompanyDirectory"("companyCategory");
