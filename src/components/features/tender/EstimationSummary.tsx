import { Bot, Landmark, RefreshCcw, Save, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatIdr } from "@/lib/currency";
import type { ProjectInfoInput, TenderWizardComputedState } from "@/types/tender";

type EstimationSummaryProps = {
  projectInfo: ProjectInfoInput;
  computed: TenderWizardComputedState;
  hasSavedRecord: boolean;
  isSaving: boolean;
  isPredicting: boolean;
  lastSavedAt: string | null;
  saveMessage: string | null;
  onSave: () => void;
  onReset: () => void;
  onRefreshPrediction: () => void;
};

function SummaryRow({
  label,
  value,
  emphasized = false,
}: {
  label: string;
  value: string;
  emphasized?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className={emphasized ? "text-on-surface font-semibold" : "text-on-surface-variant"}>
        {label}
      </span>
      <span
        className={
          emphasized ? "text-on-surface text-base font-bold" : "text-on-surface font-semibold"
        }
      >
        {value}
      </span>
    </div>
  );
}

function BreakdownGroup({
  eyebrow,
  title,
  description,
  rows,
  totalLabel,
  totalValue,
}: {
  eyebrow: string;
  title: string;
  description: string;
  rows: Array<{ label: string; value: string }>;
  totalLabel: string;
  totalValue: string;
}) {
  return (
    <div className="bg-surface-container-low rounded-[1.5rem] border border-black/5 p-5">
      <div className="mb-4">
        <div className="text-primary text-[11px] font-bold tracking-[0.14em] uppercase">
          {eyebrow}
        </div>
        <h5 className="text-on-surface mt-1 text-base font-bold">{title}</h5>
        <p className="text-on-surface-variant mt-1 text-sm">{description}</p>
      </div>

      <div className="space-y-3">
        {rows.map((row) => (
          <SummaryRow key={row.label} label={row.label} value={row.value} />
        ))}
      </div>

      <div className="mt-4 border-t border-dashed border-black/10 pt-4">
        <SummaryRow label={totalLabel} value={totalValue} emphasized />
      </div>
    </div>
  );
}

export function EstimationSummary({
  projectInfo,
  computed,
  hasSavedRecord,
  isSaving,
  isPredicting,
  lastSavedAt,
  saveMessage,
  onSave,
  onReset,
  onRefreshPrediction,
}: EstimationSummaryProps) {
  const { summary, aiBenchmark } = computed;
  const projectOnlyVariance =
    aiBenchmark.projectOnly.predictedPrice === null
      ? null
      : summary.finalRoundedPrice - aiBenchmark.projectOnly.predictedPrice;
  const hybridVariance =
    aiBenchmark.hybrid.predictedPrice === null
      ? null
      : summary.finalRoundedPrice - aiBenchmark.hybrid.predictedPrice;
  const indirectSubtotal =
    summary.overheadAmount + summary.profitAmount + summary.cglInsuranceNominal;
  const roundingAdjustment = summary.finalRoundedPrice - summary.finalPriceBeforeRounding;

  return (
    <div className="space-y-6">
      <div className="glass-card relative overflow-hidden rounded-[2rem] px-10 pt-12 pb-10">
        <div className="from-primary/10 via-surface-container-low/60 pointer-events-none absolute inset-x-0 top-0 h-36 bg-linear-to-b to-white" />
        <div className="absolute top-0 right-0 p-4 opacity-8">
          <Landmark className="h-32 w-32" />
        </div>

        <div className="relative mb-8 flex items-start justify-between gap-8">
          <div>
            <h3 className="text-primary text-[11px] font-bold tracking-[0.14em] uppercase">
              Step 4. Final Summary
            </h3>
            <div className="mt-3">
              <div className="text-on-surface text-3xl font-bold tracking-tight">
                {projectInfo.projectName}
              </div>
              <div className="text-on-surface-variant mt-2 text-sm">
                {projectInfo.companyName || "Perusahaan belum diisi"} |{" "}
                {projectInfo.projectLocation || "Lokasi belum diisi"} |{" "}
                {projectInfo.durationDays?.toLocaleString("id-ID") ?? "-"} hari
              </div>
            </div>
          </div>
          <div className="border-secondary/12 text-on-secondary-container bg-secondary-container/35 rounded-full border px-4 py-2 text-[11px] font-bold tracking-[0.12em] uppercase">
            AI Prediction Active
          </div>
        </div>

        <div className="relative grid gap-10 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-black/5 py-3 text-sm">
              <span className="text-on-surface-variant">Subtotal Biaya Langsung</span>
              <span className="text-on-surface font-semibold">
                {formatIdr(summary.directCosts.directCostSubtotal)}
              </span>
            </div>
            <div className="flex items-center justify-between border-b border-black/5 py-3 text-sm">
              <span className="text-on-surface-variant">Overhead</span>
              <span className="text-on-surface font-semibold">
                {formatIdr(summary.overheadAmount)}
              </span>
            </div>
            <div className="flex items-center justify-between border-b border-black/5 py-3 text-sm">
              <span className="text-on-surface-variant">Subtotal Sebelum Profit</span>
              <span className="text-on-surface font-semibold">
                {formatIdr(summary.subtotalBeforeProfit)}
              </span>
            </div>
            <div className="flex items-center justify-between border-b border-black/5 py-3 text-sm">
              <span className="text-on-surface-variant">Profit</span>
              <span className="text-on-surface font-semibold">
                {formatIdr(summary.profitAmount)}
              </span>
            </div>
            <div className="flex items-center justify-between border-b border-black/5 py-3 text-sm">
              <span className="text-on-surface-variant">Asuransi / CGL</span>
              <span className="text-on-surface font-semibold">
                {formatIdr(summary.cglInsuranceNominal)}
              </span>
            </div>
            <div className="flex items-center justify-between border-b border-black/5 py-3 text-sm">
              <span className="text-on-surface-variant">Harga Sebelum Pembulatan</span>
              <span className="text-on-surface font-semibold">
                {formatIdr(summary.finalPriceBeforeRounding)}
              </span>
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-black/5 bg-white p-8 shadow-xl shadow-blue-900/5">
            <div className="mb-8 text-center">
              <p className="text-on-surface-variant mb-2 text-[11px] font-bold tracking-[0.12em] uppercase">
                Total Harga Akhir
              </p>
              <h1 className="from-primary via-primary-container to-secondary-container bg-linear-to-br bg-clip-text text-4xl font-extrabold tracking-tight text-transparent">
                {formatIdr(summary.finalRoundedPrice)}
              </h1>
            </div>

            <div className="space-y-4 border-t border-dashed border-black/10 pt-6">
              <div className="flex justify-between text-sm"></div>
              <p className="text-on-surface-variant/80 text-center text-[10px] italic">
                Rule-based output remains the primary pricing source. ML model benchmark is shown
                for comparison only.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          <Button variant="outline" className="min-h-12" onClick={onReset}>
            Reset Draft
          </Button>
          <Button className="min-h-12" onClick={onSave} disabled={isSaving}>
            <Save className="mr-2 h-4 w-4" />
            {isSaving ? "Saving..." : hasSavedRecord ? "Update Tender" : "Save Tender"}
          </Button>
        </div>

        <div className="text-on-surface-variant mt-4 text-xs">
          {lastSavedAt
            ? `Draft terakhir tersimpan ${new Date(lastSavedAt).toLocaleString("id-ID")}`
            : "Belum ada draft yang tersimpan."}
        </div>
        {saveMessage ? (
          <div className="text-on-surface mt-2 text-sm font-medium">{saveMessage}</div>
        ) : null}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="glass-card rounded-[2rem] p-6">
          <h4 className="text-on-surface text-lg font-bold">Cost Breakdown</h4>
          <p className="text-on-surface-variant mt-1 text-sm">
            Breakdown komponen penjumlahan yang membentuk Subtotal I, Subtotal II, dan Total akhir.
          </p>

          <div className="mt-6 space-y-5">
            <BreakdownGroup
              eyebrow="Subtotal I"
              title="Direct Cost"
              description="Seluruh biaya langsung operasional proyek yang dihitung dari input utama."
              rows={[
                {
                  label: "Biaya Tenaga Kerja",
                  value: formatIdr(summary.directCosts.laborSubtotal),
                },
                {
                  label: "Mob Demob Personil",
                  value: formatIdr(computed.mobilityCosts.personnelDeployment.subtotal),
                },
                {
                  label: "Equipment Handling",
                  value: formatIdr(computed.mobilityCosts.equipmentHandling.subtotal),
                },
                {
                  label: "Biaya Peralatan",
                  value: formatIdr(summary.directCosts.equipmentSubtotal),
                },
                {
                  label: "Biaya Material / Supporting",
                  value: formatIdr(summary.directCosts.supportingSubtotal),
                },
              ]}
              totalLabel="Subtotal I (Direct Cost)"
              totalValue={formatIdr(summary.directCosts.directCostSubtotal)}
            />

            <BreakdownGroup
              eyebrow="Subtotal II"
              title="Indirect Cost"
              description="Biaya tambahan non-langsung yang dibentuk dari overhead, profit, dan CGL."
              rows={[
                {
                  label: `Overhead (${summary.overheadPercentage.toLocaleString("id-ID")}%)`,
                  value: formatIdr(summary.overheadAmount),
                },
                {
                  label: `Profit (${summary.profitPercentage.toLocaleString("id-ID")}%)`,
                  value: formatIdr(summary.profitAmount),
                },
                {
                  label: "Asuransi / CGL",
                  value: formatIdr(summary.cglInsuranceNominal),
                },
              ]}
              totalLabel="Subtotal II (Indirect Cost)"
              totalValue={formatIdr(indirectSubtotal)}
            />

            <BreakdownGroup
              eyebrow="Grand Total"
              title="Final Tender Value"
              description="Akumulasi akhir dari direct cost, indirect cost, dan penyesuaian pembulatan."
              rows={[
                {
                  label: "Subtotal I (Direct Cost)",
                  value: formatIdr(summary.directCosts.directCostSubtotal),
                },
                {
                  label: "Subtotal II (Indirect Cost)",
                  value: formatIdr(indirectSubtotal),
                },
                {
                  label: "Harga Sebelum Pembulatan",
                  value: formatIdr(summary.finalPriceBeforeRounding),
                },
                {
                  label: "Penyesuaian Pembulatan",
                  value: formatIdr(roundingAdjustment),
                },
              ]}
              totalLabel="Total Harga Akhir"
              totalValue={formatIdr(summary.finalRoundedPrice)}
            />
          </div>
        </div>

        <div className="glass-card rounded-[2rem] p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Bot className="text-primary h-5 w-5" />
                <h4 className="text-on-surface text-lg font-bold">
                  Machine Learning Prediction Benchmark (SVR)
                </h4>
              </div>
              <p className="text-on-surface-variant mt-1 text-sm">
                Benchmark ML ini memprediksi harga sebelum approval dari dua model SVR yang berbeda,
                lalu dibandingkan dengan hasil rule-based calculator. SVR Project-Only hanya
                menggunakan parameter proyek, sementara SVR Hybrid menggunakan parameter proyek plus
                ringkasan biaya langsung sebagai input.
              </p>
            </div>
            <Button variant="outline" onClick={onRefreshPrediction} disabled={isPredicting}>
              <RefreshCcw className="mr-2 h-4 w-4" />
              {isPredicting ? "Loading..." : "Refresh"}
            </Button>
          </div>

          <div className="bg-surface-container-low mt-6 space-y-3 rounded-[1.5rem] p-5">
            <SummaryRow label="Rule-Based Price" value={formatIdr(summary.finalRoundedPrice)} />
            <SummaryRow
              label="SVR Project-Only"
              value={
                aiBenchmark.projectOnly.predictedPrice === null
                  ? aiBenchmark.projectOnly.status === "error"
                    ? "Prediction failed"
                    : "Waiting for prediction"
                  : formatIdr(aiBenchmark.projectOnly.predictedPrice)
              }
            />
            <SummaryRow
              label="Variance Project-Only"
              value={projectOnlyVariance === null ? "-" : formatIdr(projectOnlyVariance)}
              emphasized
            />
            <SummaryRow
              label="SVR Hybrid"
              value={
                aiBenchmark.hybrid.predictedPrice === null
                  ? aiBenchmark.hybrid.status === "error"
                    ? "Prediction failed"
                    : "Waiting for prediction"
                  : formatIdr(aiBenchmark.hybrid.predictedPrice)
              }
            />
            <SummaryRow
              label="Variance Hybrid"
              value={hybridVariance === null ? "-" : formatIdr(hybridVariance)}
              emphasized
            />
          </div>

          <div className="bg-surface-container-low mt-5 rounded-[1.5rem] p-5">
            <div className="mb-3 flex items-center gap-2">
              <TrendingUp className="text-secondary h-4 w-4" />
              <span className="text-on-surface text-sm font-semibold">Payload Sent to AI</span>
            </div>
            <div className="space-y-2 text-sm">
              <SummaryRow label="Target" value="Harga Sebelum Approval" />
              <SummaryRow label="Lokasi" value={aiBenchmark.payload.projectLocation} />
              <SummaryRow label="Kategori" value={aiBenchmark.payload.projectCategory} />
              <SummaryRow
                label="Durasi"
                value={`${aiBenchmark.payload.totalDurationDays.toLocaleString("id-ID")} hari`}
              />
              <SummaryRow
                label="Total Personel"
                value={aiBenchmark.payload.ruleBasedSummary.totalPersonnel.toLocaleString("id-ID")}
              />
              <SummaryRow
                label="Estimate Before Approval"
                value={formatIdr(
                  aiBenchmark.payload.ruleBasedSummary.ruleBasedEstimateBeforeApproval
                )}
              />
              <SummaryRow label="Best Available Model" value={aiBenchmark.bestAvailable ?? "-"} />
            </div>
            {aiBenchmark.projectOnly.errorMessage || aiBenchmark.hybrid.errorMessage ? (
              <div className="text-error mt-4 space-y-1 text-sm">
                {aiBenchmark.projectOnly.errorMessage ? (
                  <div>Project-Only: {aiBenchmark.projectOnly.errorMessage}</div>
                ) : null}
                {aiBenchmark.hybrid.errorMessage ? (
                  <div>Hybrid: {aiBenchmark.hybrid.errorMessage}</div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
