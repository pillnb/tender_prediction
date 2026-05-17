-- CreateTable
CREATE TABLE "TenderCalculation" (
    "id" TEXT NOT NULL,
    "projectName" TEXT NOT NULL,
    "projectCategory" TEXT NOT NULL,
    "projectLocation" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "companyCategory" TEXT NOT NULL,
    "durationDays" INTEGER NOT NULL,
    "workDate" TIMESTAMP(3) NOT NULL,
    "overheadRate" DECIMAL(5,2) NOT NULL,
    "overheadFixedCost" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "profitMargin" DECIMAL(5,2) NOT NULL,
    "insuranceCost" DECIMAL(18,2) NOT NULL,
    "autoRoundFinalTotal" BOOLEAN NOT NULL DEFAULT true,
    "directCostTotal" DECIMAL(18,2) NOT NULL,
    "overheadAmount" DECIMAL(18,2) NOT NULL,
    "subtotalBeforeProfit" DECIMAL(18,2) NOT NULL,
    "profitAmount" DECIMAL(18,2) NOT NULL,
    "finalTotal" DECIMAL(18,2) NOT NULL,
    "calculationPayload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenderCalculation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TenderCalculation_projectName_idx" ON "TenderCalculation"("projectName");

-- CreateIndex
CREATE INDEX "TenderCalculation_companyName_idx" ON "TenderCalculation"("companyName");

-- CreateIndex
CREATE INDEX "TenderCalculation_createdAt_idx" ON "TenderCalculation"("createdAt");
