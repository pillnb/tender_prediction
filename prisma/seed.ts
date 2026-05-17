import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { createEmptyTenderFormData } from "../src/lib/tender";
import { saveTenderCalculation } from "../src/lib/tender-repository";

async function main() {
  const existing = await prisma.tenderCalculation.findFirst({
    where: {
      projectName: "Seeded Tender Calculation Demo",
    },
    select: {
      id: true,
    },
  });

  if (existing) {
    process.stdout.write(
      `${JSON.stringify(
        {
          ok: true,
          skipped: true,
          reason: "Seeded tender calculation already exists.",
          id: existing.id,
          usesAccelerate: process.env.DATABASE_URL?.startsWith("prisma+postgres://") ?? false,
        },
        null,
        2
      )}\n`
    );
    return;
  }

  const form = createEmptyTenderFormData();

  form.currentStep = "final-summary";
  form.directCosts.projectInfo.projectName = "Seeded Tender Calculation Demo";
  form.directCosts.projectInfo.projectCategory = "survey";
  form.directCosts.projectInfo.companyName = "PT Vaskya Tender Digital";
  form.directCosts.projectInfo.projectLocation = "Jawa Barat";
  form.directCosts.projectInfo.companyCategory = "bki";
  form.directCosts.projectInfo.durationDays = 120;
  form.directCosts.projectInfo.workDate = "2026-04-28";

  form.indirectCosts.overheadPercentage = 7.5;
  form.profitAndCgl.profitPercentage = 12.5;
  form.profitAndCgl.cglInsuranceNominal = 12500000;

  form.directCosts.laborCosts[0].roleName = "Lead Site Engineer";
  form.directCosts.laborCosts[0].mainCategory = "tenaga-ahli-profesional";
  form.directCosts.laborCosts[0].professionalSkkLevel = "ahli-madya";
  form.directCosts.laborCosts[0].education = "s1";
  form.directCosts.laborCosts[0].experienceYears = 8;
  form.directCosts.laborCosts[0].quantity = 4;
  form.directCosts.laborCosts[0].durationDays = 120;
  form.directCosts.laborCosts[0].isCustomPrice = true;
  form.directCosts.laborCosts[0].manualUnitRate = 425000;

  form.directCosts.mobilityCosts.personnelDeployment.qty = 4;
  form.directCosts.mobilityCosts.personnelDeployment.freq = 2;
  form.directCosts.mobilityCosts.personnelDeployment.unitPrice = 1200000;
  form.directCosts.mobilityCosts.equipmentHandling.qty = 2;
  form.directCosts.mobilityCosts.equipmentHandling.freq = 2;
  form.directCosts.mobilityCosts.equipmentHandling.unitPrice = 8500000;

  form.directCosts.equipmentCosts[0].equipmentName = "UT Drone LiDAR";
  form.directCosts.equipmentCosts[0].qty = 1;
  form.directCosts.equipmentCosts[0].freq = 30;
  form.directCosts.equipmentCosts[0].unitPrice = 2500000;

  const reporting = form.directCosts.supportingCosts.find((item) => item.key === "reporting");
  const permits = form.directCosts.supportingCosts.find((item) => item.key === "permits");
  const meal = form.directCosts.supportingCosts.find((item) => item.key === "mealAllowance");
  const lodging = form.directCosts.supportingCosts.find((item) => item.key === "lodging");
  const mcu = form.directCosts.supportingCosts.find((item) => item.key === "medicalCheckup");

  if (meal) {
    meal.qty = 4;
    meal.freq = 120;
    meal.unitPrice = 85000;
  }

  if (lodging) {
    lodging.qty = 4;
    lodging.freq = 30;
    lodging.isCustomPrice = false;
  }

  if (reporting) {
    reporting.qty = 1;
    reporting.freq = 1;
    reporting.unitPrice = 3500000;
  }

  if (permits) {
    permits.qty = 1;
    permits.freq = 1;
    permits.unitPrice = 18000000;
  }

  if (mcu) {
    mcu.qty = 4;
    mcu.freq = 1;
    mcu.unitPrice = 500000;
  }

  const record = await saveTenderCalculation(form);

  process.stdout.write(
    `${JSON.stringify(
      {
        ok: true,
        inserted: true,
        id: record.id,
        projectName: record.form.directCosts.projectInfo.projectName,
        finalTotal: record.computed.summary.finalRoundedPrice,
        usesAccelerate: process.env.DATABASE_URL?.startsWith("prisma+postgres://") ?? false,
      },
      null,
      2
    )}\n`
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
