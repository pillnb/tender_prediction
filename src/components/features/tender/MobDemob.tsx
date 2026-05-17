import { Truck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { formatIdr, formatNumberInput, parseNullableNumberInput } from "@/lib/currency";
import { cn } from "@/lib/utils";
import type { MobilityCostComputed, MobilityCostInput } from "@/types/tender";

type MobDemobProps = {
  personnelDeployment: MobilityCostInput;
  equipmentHandling: MobilityCostInput;
  computed: {
    personnelDeployment: MobilityCostComputed;
    equipmentHandling: MobilityCostComputed;
  };
  onChange: (
    section: "personnelDeployment" | "equipmentHandling",
    field: keyof MobilityCostInput,
    value: MobilityCostInput[keyof MobilityCostInput]
  ) => void;
  getError?: (fieldPath: string) => string | undefined;
};

function CostLineCard({
  title,
  value,
  computed,
  onChange,
  getError,
  errorPrefix,
}: {
  title: string;
  value: MobilityCostInput;
  computed: MobilityCostComputed;
  onChange: (
    field: keyof MobilityCostInput,
    nextValue: MobilityCostInput[keyof MobilityCostInput]
  ) => void;
  getError?: (fieldPath: string) => string | undefined;
  errorPrefix: string;
}) {
  return (
    <div className="border-surface-container-low bg-surface-container-low/50 rounded-md border p-4">
      <span className="text-on-surface-variant mb-3 block text-xs font-bold uppercase">
        {title}
      </span>
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <label className="text-on-surface-variant text-xs font-semibold uppercase">Qty</label>
          <Input
            className={cn(
              "border-surface-container rounded text-right text-sm",
              getError?.(`${errorPrefix}.qty`) ? "border-error" : ""
            )}
            placeholder="Qty"
            type="number"
            min="0"
            value={value.qty ?? ""}
            onChange={(event) =>
              onChange("qty", event.target.value === "" ? null : Number(event.target.value))
            }
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-on-surface-variant text-xs font-semibold uppercase">Freq</label>
          <Input
            className={cn(
              "border-surface-container rounded text-right text-sm",
              getError?.(`${errorPrefix}.freq`) ? "border-error" : ""
            )}
            placeholder="Freq"
            type="number"
            min="0"
            value={value.freq ?? ""}
            onChange={(event) =>
              onChange("freq", event.target.value === "" ? null : Number(event.target.value))
            }
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-on-surface-variant text-xs font-semibold uppercase">Price</label>
          <Input
            className={cn(
              "border-surface-container rounded text-right text-sm",
              getError?.(`${errorPrefix}.unitPrice`) ? "border-error" : ""
            )}
            placeholder="Price"
            type="text"
            inputMode="numeric"
            value={formatNumberInput(value.unitPrice)}
            onChange={(event) => onChange("unitPrice", parseNullableNumberInput(event.target.value))}
          />
        </div>
      </div>
      <div className="mt-2 space-y-1">
        {getError?.(`${errorPrefix}.qty`) ? (
          <p className="text-error text-xs">{getError(`${errorPrefix}.qty`)}</p>
        ) : null}
        {getError?.(`${errorPrefix}.freq`) ? (
          <p className="text-error text-xs">{getError(`${errorPrefix}.freq`)}</p>
        ) : null}
        {getError?.(`${errorPrefix}.unitPrice`) ? (
          <p className="text-error text-xs">{getError(`${errorPrefix}.unitPrice`)}</p>
        ) : null}
      </div>
      <div className="text-on-surface-variant mt-3 text-right text-xs">
        Subtotal {formatIdr(computed.subtotal)}
      </div>
    </div>
  );
}

export function MobDemob({
  personnelDeployment,
  equipmentHandling,
  computed,
  onChange,
  getError,
}: MobDemobProps) {
  return (
    <div className="border-surface-container bg-surface-container-lowest col-span-12 rounded-lg border p-6 shadow-sm lg:col-span-6">
      <div className="text-primary mb-6 flex items-center gap-2">
        <Truck className="h-6 w-6" />
        <h3 className="font-h3 text-h3">Mob & Demob</h3>
      </div>
      <div className="space-y-6">
        <CostLineCard
          title="Mob Demob Personil"
          value={personnelDeployment}
          computed={computed.personnelDeployment}
          getError={getError}
          errorPrefix="personnelDeployment"
          onChange={(field, nextValue) => onChange("personnelDeployment", field, nextValue)}
        />
        <CostLineCard
          title="Equipment Handling"
          value={equipmentHandling}
          computed={computed.equipmentHandling}
          getError={getError}
          errorPrefix="equipmentHandling"
          onChange={(field, nextValue) => onChange("equipmentHandling", field, nextValue)}
        />
      </div>
    </div>
  );
}
