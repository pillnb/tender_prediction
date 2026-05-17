import {
  Archive,
  Bed,
  CirclePlus,
  LineChart,
  ShieldCheck,
  Stethoscope,
  Utensils,
  WalletCards,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { formatIdr, formatNumberInput, parseNullableNumberInput } from "@/lib/currency";
import { cn } from "@/lib/utils";
import type {
  OperationalCostKey,
  SupportingCostComputed,
  SupportingCostInput,
} from "@/types/tender";

type OperationalCostsProps = {
  items: SupportingCostInput[];
  computedItems: SupportingCostComputed[];
  onAdd: () => void;
  onChange: <K extends keyof SupportingCostInput>(
    id: string,
    field: K,
    value: SupportingCostInput[K]
  ) => void;
  getError?: (fieldPath: string) => string | undefined;
};

const itemIcons: Record<OperationalCostKey, typeof Utensils> = {
  mealAllowance: Utensils,
  lodging: Bed,
  reporting: LineChart,
  permits: ShieldCheck,
  medicalCheckup: Stethoscope,
  other: WalletCards,
};

function findComputedItem(id: string, computedItems: SupportingCostComputed[]) {
  return computedItems.find((item) => item.id === id);
}

export function OperationalCosts({
  items,
  computedItems,
  onAdd,
  onChange,
  getError,
}: OperationalCostsProps) {
  return (
    <div className="border-surface-container bg-surface-container-lowest col-span-12 rounded-lg border p-8 shadow-sm">
      <div className="text-primary mb-6 flex items-center gap-2">
        <Archive className="h-6 w-6" />
        <h3 className="font-h3 text-h3">Biaya Material / Supporting</h3>
      </div>
      <div className="mb-6 flex justify-end">
        <button
          type="button"
          onClick={onAdd}
          className="bg-primary text-on-primary inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold"
        >
          <CirclePlus className="h-4 w-4" />
          Add Item Baru
        </button>
      </div>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {items.map((item) => {
          const Icon = itemIcons[item.key];
          const computed = findComputedItem(item.id, computedItems);
          const errorBase = `supportingCosts.${items.findIndex((entry) => entry.id === item.id)}`;

          return (
            <div
              key={item.id}
              className="border-surface-container bg-surface rounded-lg border p-5 shadow-sm"
            >
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <label className="font-label-sm text-on-surface-variant flex items-center gap-1">
                    <Icon className="h-4 w-4" /> {item.itemName}
                  </label>
                  <div className="text-on-surface-variant mt-1 text-xs">
                    {item.key === "lodging"
                      ? "Auto default rate berdasarkan PMK 32/2025 dan lokasi proyek."
                      : "Isi nama item, unit price, qty, dan freq/durasi."}
                  </div>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase ${
                    item.key === "lodging" && !item.isCustomPrice
                      ? "bg-primary-container/10 text-primary"
                      : "bg-secondary-fixed text-on-secondary-fixed"
                  }`}
                >
                  {item.key === "lodging" && !item.isCustomPrice ? "Rule-Based" : "Manual"}
                </span>
              </div>

              <label className="mb-4 flex items-center gap-3 text-sm font-semibold">
                <input
                  type="checkbox"
                  checked={item.isIncluded}
                  onChange={(event) => onChange(item.id, "isIncluded", event.target.checked)}
                />
                Masukkan item ini ke kalkulasi
              </label>

              {item.key === "lodging" ? (
                <button
                  type="button"
                  className={`mb-4 rounded-full px-3 py-1 text-xs font-semibold ${
                    item.isCustomPrice
                      ? "bg-secondary-fixed text-on-secondary-fixed"
                      : "bg-primary-container/10 text-primary"
                  }`}
                  onClick={() => onChange(item.id, "isCustomPrice", !item.isCustomPrice)}
                >
                  {item.isCustomPrice ? "Custom Price Penginapan" : "Auto PMK 32/2025"}
                </button>
              ) : null}

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-1.5 md:col-span-2">
                  <label className="font-label-sm text-on-surface-variant">Nama Item</label>
                  <Input
                    className={cn(
                      "border-surface-container w-full rounded-lg",
                      getError?.(`${errorBase}.itemName`) ? "border-error" : ""
                    )}
                    value={item.itemName}
                    readOnly={item.key === "lodging" && !item.isCustomPrice}
                    onChange={(event) => onChange(item.id, "itemName", event.target.value)}
                    disabled={!item.isIncluded}
                  />
                  {getError?.(`${errorBase}.itemName`) ? (
                    <p className="text-error text-xs">{getError(`${errorBase}.itemName`)}</p>
                  ) : null}
                </div>

                <div className="space-y-1.5">
                  <label className="font-label-sm text-on-surface-variant">Unit Price (IDR)</label>
                  <Input
                    className={cn(
                      "border-surface-container w-full rounded-lg text-right",
                      getError?.(`${errorBase}.unitPrice`) ? "border-error" : ""
                    )}
                    inputMode="numeric"
                    value={formatNumberInput(
                      item.key === "lodging" && !item.isCustomPrice
                        ? computed?.unitRate
                        : item.unitPrice
                    )}
                    readOnly={item.key === "lodging" && !item.isCustomPrice}
                    disabled={!item.isIncluded}
                    onChange={(event) =>
                      onChange(item.id, "unitPrice", parseNullableNumberInput(event.target.value))
                    }
                  />
                  {getError?.(`${errorBase}.unitPrice`) ? (
                    <p className="text-error text-xs">{getError(`${errorBase}.unitPrice`)}</p>
                  ) : null}
                </div>

                <div className="space-y-1.5">
                  <label className="font-label-sm text-on-surface-variant">Qty</label>
                  <Input
                    className={cn(
                      "border-surface-container w-full rounded-lg text-right",
                      getError?.(`${errorBase}.qty`) ? "border-error" : ""
                    )}
                    type="number"
                    min="0"
                    value={item.qty ?? ""}
                    disabled={!item.isIncluded}
                    onChange={(event) =>
                      onChange(
                        item.id,
                        "qty",
                        event.target.value === "" ? null : Number(event.target.value)
                      )
                    }
                  />
                  {getError?.(`${errorBase}.qty`) ? (
                    <p className="text-error text-xs">{getError(`${errorBase}.qty`)}</p>
                  ) : null}
                </div>

                <div className="space-y-1.5">
                  <label className="font-label-sm text-on-surface-variant">Freq / Durasi</label>
                  <Input
                    className={cn(
                      "border-surface-container w-full rounded-lg text-right",
                      getError?.(`${errorBase}.freq`) ? "border-error" : ""
                    )}
                    type="number"
                    min="0"
                    value={item.freq ?? ""}
                    disabled={!item.isIncluded}
                    onChange={(event) =>
                      onChange(
                        item.id,
                        "freq",
                        event.target.value === "" ? null : Number(event.target.value)
                      )
                    }
                  />
                  {getError?.(`${errorBase}.freq`) ? (
                    <p className="text-error text-xs">{getError(`${errorBase}.freq`)}</p>
                  ) : null}
                </div>

                <div className="space-y-1.5">
                  <label className="font-label-sm text-on-surface-variant">Sumber Rate</label>
                  <Input
                    className="border-surface-container w-full rounded-lg"
                    value={computed?.lookup.referenceName ?? "-"}
                    readOnly
                  />
                </div>
              </div>

              <div className="bg-surface-container-low mt-4 flex items-center justify-between rounded-lg px-4 py-3">
                <span className="text-on-surface-variant text-sm">Subtotal {item.itemName}</span>
                <span className="text-on-surface text-lg font-bold">
                  {formatIdr(computed?.subtotal ?? 0)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
