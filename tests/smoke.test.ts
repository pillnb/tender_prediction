import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateTenderWizardComputedState,
  createEmptyTenderFormData,
} from "@/lib/tenderCalculations";

test("default tender form can be computed", () => {
  const form = createEmptyTenderFormData();
  const computed = calculateTenderWizardComputedState(form);

  assert.equal(form.currentStep, "landing");
  assert.equal(typeof computed.summary.finalRoundedPrice, "number");
  assert.equal(Number.isFinite(computed.summary.finalRoundedPrice), true);
});
