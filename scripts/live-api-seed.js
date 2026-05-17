#!/usr/bin/env node
/* eslint-disable no-console */

const baseUrl = (process.env.TENDER_API_BASE_URL || "https://tender-prediction.vercel.app").replace(
  /\/+$/,
  ""
);
const keepRecords = process.argv.includes("--keep");

function createScenarioName() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `Live API Smoke ${timestamp}`;
}

function buildTenderForm() {
  const projectName = createScenarioName();

  return {
    currentStep: "final-summary",
    directCosts: {
      projectInfo: {
        projectName,
        projectCategory: "survey",
        projectLocation: "DKI Jakarta",
        companyName: "PT BKI Test Harness",
        companyCategory: "bki",
        durationDays: 30,
        workDate: "2026-05-17",
      },
      laborCosts: [
        {
          id: "crew-professional-1",
          roleName: "Team Leader Survey",
          mainCategory: "tenaga-ahli-profesional",
          professionalSkkLevel: "ahli-muda",
          supportingRole: "",
          quantity: 1,
          durationDays: 30,
          education: "s1",
          experienceYears: 8,
          isCustomPrice: false,
          manualUnitRate: null,
          notes: "Seeded API test crew leader",
        },
        {
          id: "crew-support-1",
          roleName: "Surveyor Lapangan",
          mainCategory: "tenaga-pendukung",
          professionalSkkLevel: "",
          supportingRole: "surveyor",
          quantity: 2,
          durationDays: 20,
          education: "",
          experienceYears: null,
          isCustomPrice: false,
          manualUnitRate: null,
          notes: "Seeded API test support crew",
        },
      ],
      mobilityCosts: {
        personnelDeployment: {
          id: "mob-personnel",
          label: "Mob Demob Personil",
          qty: 3,
          freq: 2,
          unitPrice: 1250000,
          notes: "PP personel",
        },
        equipmentHandling: {
          id: "mob-equipment",
          label: "Equipment Handling",
          qty: 2,
          freq: 2,
          unitPrice: 1750000,
          notes: "Handling alat survey",
        },
      },
      equipmentCosts: [
        {
          id: "equipment-1",
          equipmentName: "GPS Geodetik",
          qty: 2,
          freq: 15,
          unitPrice: 350000,
          notes: "Peralatan inti survey",
        },
        {
          id: "equipment-2",
          equipmentName: "Drone Mapping",
          qty: 1,
          freq: 6,
          unitPrice: 1250000,
          notes: "Pemetaan area terbatas",
        },
      ],
      supportingCosts: [
        {
          id: "supporting-meal",
          key: "mealAllowance",
          itemName: "Meal Allowance",
          isIncluded: true,
          qty: 3,
          freq: 30,
          unitPrice: 85000,
          isCustomPrice: true,
          notes: "Konsumsi tim",
        },
        {
          id: "supporting-lodging",
          key: "lodging",
          itemName: "Penginapan",
          isIncluded: true,
          qty: 2,
          freq: 10,
          unitPrice: null,
          isCustomPrice: false,
          notes: "Akan pakai default lokasi",
        },
        {
          id: "supporting-reporting",
          key: "reporting",
          itemName: "Reporting",
          isIncluded: true,
          qty: 1,
          freq: 2,
          unitPrice: 1500000,
          isCustomPrice: true,
          notes: "Laporan hardcopy dan softcopy",
        },
        {
          id: "supporting-permit",
          key: "permits",
          itemName: "Permit",
          isIncluded: true,
          qty: 1,
          freq: 1,
          unitPrice: 2500000,
          isCustomPrice: true,
          notes: "Perizinan lapangan",
        },
        {
          id: "supporting-mcu",
          key: "medicalCheckup",
          itemName: "MCU",
          isIncluded: true,
          qty: 3,
          freq: 1,
          unitPrice: 450000,
          isCustomPrice: true,
          notes: "MCU crew",
        },
      ],
    },
    indirectCosts: {
      overheadPercentage: 12,
    },
    profitAndCgl: {
      profitPercentage: 10,
      cglInsuranceNominal: 5000000,
      autoRoundFinalTotal: true,
      roundingIncrement: 1000000,
    },
  };
}

async function requestJson(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const text = await response.text();
  const contentType = response.headers.get("content-type") || "";
  const body = contentType.includes("application/json") && text ? JSON.parse(text) : text;

  if (!response.ok) {
    throw new Error(
      `${options.method || "GET"} ${path} failed with ${response.status}: ${JSON.stringify(body)}`
    );
  }

  return { response, body };
}

function buildAiPayload(record) {
  const { projectInfo } = record.form.directCosts;
  const { summary } = record.computed;

  return {
    projectName: projectInfo.projectName,
    companyName: projectInfo.companyName,
    companyCategory: projectInfo.companyCategory,
    projectLocation: projectInfo.projectLocation,
    projectCategory: projectInfo.projectCategory,
    workDate: projectInfo.workDate,
    totalDurationDays: projectInfo.durationDays,
    ruleBasedSummary: {
      totalPersonnel: summary.directCosts.totalPersonnel,
      directCostSubtotal: summary.directCosts.directCostSubtotal,
      subtotalBeforeProfit: summary.subtotalBeforeProfit,
      finalPriceBeforeRounding: summary.finalPriceBeforeRounding,
      finalRoundedPrice: summary.finalRoundedPrice,
      ruleBasedEstimateBeforeApproval: summary.finalPriceBeforeRounding,
    },
    requestedModels: ["project_only", "hybrid"],
  };
}

async function hardDeleteRecord(id) {
  await requestJson(`/api/tender-calculations/${id}?mode=hard-delete`, {
    method: "DELETE",
  });
}

async function main() {
  console.log(`Base URL: ${baseUrl}`);
  console.log(`Keep records: ${keepRecords ? "yes" : "no"}`);

  const form = buildTenderForm();

  console.log("\n1. Saving tender calculation draft...");
  const createResult = await requestJson("/api/tender-calculations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      form,
      status: "draft",
    }),
  });
  const createdRecord = createResult.body.data;
  console.log(`Created record: ${createdRecord.id}`);
  console.log(
    `Direct cost subtotal: ${createdRecord.computed.summary.directCosts.directCostSubtotal}`
  );
  console.log(`Final rounded price: ${createdRecord.computed.summary.finalRoundedPrice}`);

  console.log("\n2. Requesting AI benchmark...");
  const aiPayload = buildAiPayload(createdRecord);
  const aiResult = await requestJson("/api/ai-benchmark", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(aiPayload),
  });
  const aiBenchmark = aiResult.body;
  console.log(`Project-Only status: ${aiBenchmark.projectOnly.status}`);
  console.log(`Hybrid status: ${aiBenchmark.hybrid.status}`);
  console.log(`Best available model: ${aiBenchmark.bestAvailable}`);

  console.log("\n3. Updating saved record with AI benchmark...");
  const updateResult = await requestJson(`/api/tender-calculations/${createdRecord.id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      form,
      status: "final",
      aiBenchmark,
    }),
  });
  const updatedRecord = updateResult.body.data;
  console.log(`Updated status: ${updatedRecord.status}`);

  console.log("\n4. Fetching saved record...");
  const getResult = await requestJson(`/api/tender-calculations/${createdRecord.id}`);
  console.log(`Fetched project: ${getResult.body.data.form.directCosts.projectInfo.projectName}`);

  console.log("\n5. Fetching latest record...");
  const latestResult = await requestJson("/api/tender-calculations?mode=latest");
  console.log(`Latest record id: ${latestResult.body.data?.id ?? "none"}`);

  console.log("\n6. Requesting PDF export...");
  const pdfResponse = await fetch(`${baseUrl}/api/tender-calculations/${createdRecord.id}/pdf`);
  if (!pdfResponse.ok) {
    throw new Error(
      `GET /api/tender-calculations/${createdRecord.id}/pdf failed with ${pdfResponse.status}`
    );
  }
  console.log(`PDF content-type: ${pdfResponse.headers.get("content-type")}`);

  console.log("\n7. Duplicating record...");
  const duplicateResult = await requestJson(
    `/api/tender-calculations/${createdRecord.id}/duplicate`,
    {
      method: "POST",
    }
  );
  const duplicatedRecord = duplicateResult.body.data;
  console.log(`Duplicated record: ${duplicatedRecord.id}`);

  if (!keepRecords) {
    console.log("\n8. Cleaning up test records...");
    await hardDeleteRecord(duplicatedRecord.id);
    await hardDeleteRecord(createdRecord.id);
    console.log("Cleanup complete.");
  } else {
    console.log("\n8. Keeping created records for manual inspection.");
  }

  console.log("\nLive API flow completed successfully.");
}

main().catch((error) => {
  console.error("\nLive API flow failed.");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
