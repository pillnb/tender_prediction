import { Calculator, Settings, Shield } from "lucide-react";
import { Input } from "@/components/ui/input";
import { formatIdr, formatNumberInput, parseNullableNumberInput } from "@/lib/currency";
import { cn } from "@/lib/utils";

type IndirectTaxMarginConfigProps = {
  mode: "indirect-costs";
  directCostSubtotal: number;
  overheadPercentage: number | null;
  onOverheadPercentageChange: (value: number | null) => void;
  errors?: {
    overheadPercentage?: string;
  };
};

type ProfitTaxMarginConfigProps = {
  mode: "profit-cgl";
  subtotalBeforeProfit: number;
  profitPercentage: number | null;
  cglInsuranceNominal: number | null;
  autoRoundFinalTotal: boolean;
  roundingIncrement: number | null;
  onProfitPercentageChange: (value: number | null) => void;
  onCglInsuranceNominalChange: (value: number | null) => void;
  onAutoRoundFinalTotalChange: (value: boolean) => void;
  onRoundingIncrementChange: (value: number | null) => void;
  errors?: {
    profitPercentage?: string;
    cglInsuranceNominal?: string;
    roundingIncrement?: string;
  };
};

type TaxMarginConfigProps = IndirectTaxMarginConfigProps | ProfitTaxMarginConfigProps;

function Toggle({ checked, onToggle }: { checked: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={checked}
      onClick={onToggle}
      className={`relative h-6 w-10 cursor-pointer rounded-full transition-colors ${
        checked ? "bg-secondary-fixed" : "bg-tertiary-fixed-dim"
      }`}
    >
      <div
        className={`bg-on-tertiary absolute top-1 h-4 w-4 rounded-full transition-all ${
          checked ? "right-1" : "right-5"
        }`}
      />
    </button>
  );
}

export function TaxMarginConfig(props: TaxMarginConfigProps) {
  if (props.mode === "indirect-costs") {
    const overheadAmount = props.directCostSubtotal * ((props.overheadPercentage ?? 0) / 100);

    return (
      <div className="glass-card rounded-[2rem] p-8">
        <div className="mb-8 flex items-center gap-3">
          <div className="bg-primary-container flex h-12 w-12 items-center justify-center rounded-xl">
            <Settings className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="field-label text-primary mb-1">Indirect Costs</div>
            <h3 className="font-h3 text-h3 text-on-surface">Step 2. Indirect Costs</h3>
            <p className="text-on-surface-variant text-sm">
              Subtotal biaya langsung dibawa dari Step 1 dan dipakai sebagai basis overhead.
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="glass-card-strong rounded-[1.5rem] p-4">
            <div className="text-on-surface-variant text-xs uppercase">Subtotal Biaya Langsung</div>
            <div className="text-on-surface mt-2 text-2xl font-bold">
              {formatIdr(props.directCostSubtotal)}
            </div>
          </div>
          <div className="glass-card-strong rounded-[1.5rem] p-4">
            <div className="mb-2 flex items-center justify-between">
              <label className="text-on-tertiary-container text-sm font-semibold">
                Overhead Percentage
              </label>
              <span className="text-on-tertiary-container text-xs">
                Basis: subtotal direct cost
              </span>
            </div>
            <div className="relative">
              <Input
                className={cn(
                  "w-full pr-10",
                  props.errors?.overheadPercentage ? "border-error" : ""
                )}
                type="number"
                min="0"
                value={props.overheadPercentage ?? ""}
                onChange={(event) =>
                  props.onOverheadPercentageChange(
                    event.target.value === "" ? null : Number(event.target.value)
                  )
                }
              />
              <span className="text-on-tertiary-container absolute top-2.5 right-3">%</span>
            </div>
            {props.errors?.overheadPercentage ? (
              <p className="text-error mt-2 text-xs">{props.errors.overheadPercentage}</p>
            ) : null}
            <div className="text-on-surface mt-3 text-sm font-semibold">
              Overhead = {formatIdr(overheadAmount)}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-[2rem] p-8">
      <div className="mb-8 flex items-center gap-3">
        <div className="bg-secondary-container flex h-12 w-12 items-center justify-center rounded-xl">
          <Shield className="h-5 w-5 text-white" />
        </div>
        <div>
          <div className="field-label text-secondary mb-1">Margin & Protection</div>
          <h3 className="font-h3 text-h3 text-on-surface">Step 3. Profit & CGL</h3>
          <p className="text-on-surface-variant text-sm">
            Atur margin laba, nilai asuransi/CGL, dan aturan pembulatan total akhir.
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-5">
          <div className="glass-card-strong rounded-[1.5rem] p-4">
            <div className="mb-2 flex items-center justify-between">
              <label className="text-on-surface-variant text-sm font-semibold">
                Profit Percentage
              </label>
              <span className="text-primary text-xs font-semibold">
                Applied to subtotal before profit
              </span>
            </div>
            <div className="relative">
              <Input
                className={cn(
                  "border-surface-container bg-surface-container-lowest w-full rounded-lg pr-10",
                  props.errors?.profitPercentage ? "border-error" : ""
                )}
                type="number"
                min="0"
                value={props.profitPercentage ?? ""}
                onChange={(event) =>
                  props.onProfitPercentageChange(
                    event.target.value === "" ? null : Number(event.target.value)
                  )
                }
              />
              <span className="text-on-surface-variant absolute top-2.5 right-3">%</span>
            </div>
            {props.errors?.profitPercentage ? (
              <p className="text-error mt-2 text-xs">{props.errors.profitPercentage}</p>
            ) : null}
          </div>

          <div className="glass-card-strong rounded-[1.5rem] p-4">
            <label className="text-on-surface-variant mb-2 block text-sm font-semibold">
              Asuransi / CGL
            </label>
            <Input
              className={cn(
                "border-surface-container bg-surface-container-lowest w-full rounded-lg text-right",
                props.errors?.cglInsuranceNominal ? "border-error" : ""
              )}
              inputMode="numeric"
              value={formatNumberInput(props.cglInsuranceNominal)}
              onChange={(event) =>
                props.onCglInsuranceNominalChange(parseNullableNumberInput(event.target.value))
              }
            />
            {props.errors?.cglInsuranceNominal ? (
              <p className="text-error mt-2 text-xs">{props.errors.cglInsuranceNominal}</p>
            ) : null}
            <p className="text-on-surface-variant mt-2 text-xs">
              Nominal ini ditambahkan ke total akhir setelah direct cost, overhead, dan profit.
            </p>
          </div>
        </div>

        <div className="space-y-5">
          <div className="glass-card-strong rounded-[1.5rem] p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-on-surface-variant text-sm font-semibold">
                Auto-Round Final Total
              </span>
              <Toggle
                checked={props.autoRoundFinalTotal}
                onToggle={() => props.onAutoRoundFinalTotalChange(!props.autoRoundFinalTotal)}
              />
            </div>
            <label className="text-on-surface-variant mb-2 block text-sm font-semibold">
              Rounding Increment
            </label>
            <Input
              className={cn(
                "border-surface-container bg-surface-container-lowest w-full rounded-lg text-right",
                props.errors?.roundingIncrement ? "border-error" : ""
              )}
              inputMode="numeric"
              value={formatNumberInput(props.roundingIncrement)}
              onChange={(event) =>
                props.onRoundingIncrementChange(parseNullableNumberInput(event.target.value))
              }
            />
            {props.errors?.roundingIncrement ? (
              <p className="text-error mt-2 text-xs">{props.errors.roundingIncrement}</p>
            ) : null}
          </div>

          <div className="glass-card-strong rounded-[1.5rem] p-4">
            <div className="mb-3 flex items-center gap-2">
              <Calculator className="text-primary h-4 w-4" />
              <span className="text-on-surface text-sm font-semibold">Current Basis</span>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-on-surface-variant">Subtotal Before Profit</span>
                <span className="text-on-surface font-semibold">
                  {formatIdr(props.subtotalBeforeProfit)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-on-surface-variant">CGL / Insurance</span>
                <span className="text-on-surface font-semibold">
                  {formatIdr(props.cglInsuranceNominal)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
