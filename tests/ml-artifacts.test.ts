import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { readFileSync } from "node:fs";
import {
  calculateTenderWizardComputedState,
  createEmptyTenderFormData,
  createSvrPredictionPayload,
} from "@/lib/tenderCalculations";

function readJson(relativePath: string) {
  const fullPath = path.join(process.cwd(), relativePath);
  return JSON.parse(readFileSync(fullPath, "utf-8")) as Record<string, unknown>;
}

test("project-only artifact remains available internally for historical evaluation", () => {
  const contract = readJson("ml_service/artifacts/project_only_feature_contract.json");

  assert.equal(contract.model_key, "project_only");
  assert.equal(contract.runtime_enabled, true);
  assert.deepEqual(contract.runtime_feature_keys, [
    "Year",
    "Quarter",
    "Month",
    "Type of Client",
    "Type of Project",
  ]);
});

test("hybrid artifact exposes an aligned runtime contract based on estimated price semantics", () => {
  const contract = readJson("ml_service/artifacts/hybrid_feature_contract.json");

  assert.equal(contract.model_key, "hybrid");
  assert.equal(contract.runtime_enabled, true);
  assert.equal(contract.validation_state, "limited");
  assert.deepEqual(contract.runtime_feature_keys, [
    "Year",
    "Quarter",
    "Month",
    "Type of Client",
    "Type of Project",
    "EstimatedPriceLog",
  ]);
});

test("website benchmark payload only sends runtime fields used by the current ML models", () => {
  const form = createEmptyTenderFormData();
  form.currentStep = "final-summary";
  form.directCosts.projectInfo = {
    projectName: "Runtime Contract Test",
    projectCategory: "survey",
    projectLocation: "DKI Jakarta",
    companyName: "PT Contract Test",
    companyCategory: "bki",
    durationDays: 30,
    workDate: "2026-05-17",
  };
  form.directCosts.laborCosts = [
    {
      id: "crew-1",
      roleName: "Team Leader",
      mainCategory: "tenaga-ahli-profesional",
      professionalSkkLevel: "ahli-muda",
      supportingRole: "",
      quantity: 1,
      durationDays: 30,
      education: "s1",
      experienceYears: 8,
      isCustomPrice: false,
      manualUnitRate: null,
      notes: null,
    },
  ];
  form.directCosts.mobilityCosts.personnelDeployment = {
    id: "mob-personnel",
    label: "Mob Demob Personil",
    qty: 1,
    freq: 1,
    unitPrice: 1000000,
    notes: null,
  };
  form.directCosts.mobilityCosts.equipmentHandling = {
    id: "mob-equipment",
    label: "Equipment Handling",
    qty: 1,
    freq: 1,
    unitPrice: 1000000,
    notes: null,
  };
  form.directCosts.equipmentCosts = [
    {
      id: "equipment-1",
      equipmentName: "GPS Geodetik",
      qty: 1,
      freq: 1,
      unitPrice: 1000000,
      notes: null,
    },
  ];
  form.directCosts.supportingCosts = [
    {
      id: "supporting-meal",
      key: "mealAllowance",
      itemName: "Meal Allowance",
      isIncluded: true,
      qty: 1,
      freq: 1,
      unitPrice: 100000,
      isCustomPrice: true,
      notes: null,
    },
  ];
  form.indirectCosts.overheadPercentage = 10;
  form.profitAndCgl.profitPercentage = 10;
  form.profitAndCgl.cglInsuranceNominal = 500000;
  form.profitAndCgl.autoRoundFinalTotal = true;
  form.profitAndCgl.roundingIncrement = 100000;

  const computed = calculateTenderWizardComputedState(form);
  const payload = createSvrPredictionPayload(
    form,
    computed.summary.finalPriceBeforeRounding,
    computed.summary.finalRoundedPrice,
    computed.summary.subtotalBeforeProfit
  );

  assert.equal(payload.requestedModels.includes("hybrid"), true);
  assert.equal(payload.requestedModels.includes("project_only"), false);
  assert.equal(typeof payload.ruleBasedSummary.ruleBasedEstimateBeforeApproval, "number");
  assert.equal("totalDurationDays" in payload, false);
  assert.deepEqual(Object.keys(payload.ruleBasedSummary), ["ruleBasedEstimateBeforeApproval"]);
});
