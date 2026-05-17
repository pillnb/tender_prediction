import { PlusCircle, Trash2, Wrench } from "lucide-react";
import { Input } from "@/components/ui/input";
import { formatIdr, formatNumberInput, parseNullableNumberInput } from "@/lib/currency";
import { cn } from "@/lib/utils";
import type { EquipmentCostComputed, EquipmentCostInput } from "@/types/tender";

type EquipmentCostsProps = {
  items: EquipmentCostInput[];
  computedItems: EquipmentCostComputed[];
  onAdd: () => void;
  onRemove: (id: string) => void;
  onChange: <K extends keyof EquipmentCostInput>(
    id: string,
    field: K,
    value: EquipmentCostInput[K]
  ) => void;
  getError?: (fieldPath: string) => string | undefined;
};

function findComputedItem(id: string, computedItems: EquipmentCostComputed[]) {
  return computedItems.find((item) => item.id === id);
}

export function EquipmentCosts({
  items,
  computedItems,
  onAdd,
  onRemove,
  onChange,
  getError,
}: EquipmentCostsProps) {
  return (
    <div className="border-surface-container bg-surface-container-lowest col-span-12 rounded-lg border p-6 shadow-sm lg:col-span-6">
      <div className="text-primary mb-6 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Wrench className="h-6 w-6" />
          <h3 className="font-h3 text-h3">Biaya Peralatan</h3>
        </div>
        <button
          type="button"
          className="text-primary-container flex items-center gap-1 text-sm font-bold hover:underline"
          onClick={onAdd}
        >
          <PlusCircle className="h-4 w-4" />
          Tambah Alat
        </button>
      </div>
      <div className="space-y-4">
        <div className="border-surface-container-low font-label-md text-on-surface-variant grid grid-cols-[minmax(0,1fr)_70px_70px_140px_140px_40px] items-center gap-4 border-b pb-2 text-sm">
          <span>Nama Alat</span>
          <span className="text-center">Qty</span>
          <span className="text-center">Freq</span>
          <span className="text-right">Harga</span>
          <span className="text-right">Subtotal</span>
          <span></span>
        </div>
        {items.map((item) => {
          const computed = findComputedItem(item.id, computedItems);
          const errorBase = `equipmentCosts.${items.findIndex((entry) => entry.id === item.id)}`;

          return (
            <div key={item.id} className="space-y-2">
              <div className="grid grid-cols-[minmax(0,1fr)_70px_70px_140px_140px_40px] items-center gap-4 text-sm">
                <Input
                  className={cn(
                    "border-surface-container rounded p-2 text-xs",
                    getError?.(`${errorBase}.equipmentName`) ? "border-error" : ""
                  )}
                  type="text"
                  value={item.equipmentName}
                  onChange={(event) => onChange(item.id, "equipmentName", event.target.value)}
                />
                <Input
                  className={cn(
                    "border-surface-container rounded p-2 text-center text-xs",
                    getError?.(`${errorBase}.qty`) ? "border-error" : ""
                  )}
                  type="number"
                  min="0"
                  value={item.qty ?? ""}
                  onChange={(event) =>
                    onChange(
                      item.id,
                      "qty",
                      event.target.value === "" ? null : Number(event.target.value)
                    )
                  }
                />
                <Input
                  className={cn(
                    "border-surface-container rounded p-2 text-center text-xs",
                    getError?.(`${errorBase}.freq`) ? "border-error" : ""
                  )}
                  type="number"
                  min="0"
                  value={item.freq ?? ""}
                  onChange={(event) =>
                    onChange(
                      item.id,
                      "freq",
                      event.target.value === "" ? null : Number(event.target.value)
                    )
                  }
                />
                <Input
                  className={cn(
                    "border-surface-container rounded p-2 text-right text-xs",
                    getError?.(`${errorBase}.unitPrice`) ? "border-error" : ""
                  )}
                  type="text"
                  inputMode="numeric"
                  value={formatNumberInput(item.unitPrice)}
                  onChange={(event) =>
                    onChange(item.id, "unitPrice", parseNullableNumberInput(event.target.value))
                  }
                />
                <span className="text-on-surface text-right text-xs font-medium">
                  {formatIdr(computed?.subtotal ?? 0)}
                </span>
                <button
                  type="button"
                  className="text-outline hover:text-error transition-colors"
                  onClick={() => onRemove(item.id)}
                  disabled={items.length === 1}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              {getError?.(`${errorBase}.equipmentName`) ? (
                <p className="text-error text-xs">{getError(`${errorBase}.equipmentName`)}</p>
              ) : null}
              {getError?.(`${errorBase}.qty`) ? (
                <p className="text-error text-xs">{getError(`${errorBase}.qty`)}</p>
              ) : null}
              {getError?.(`${errorBase}.freq`) ? (
                <p className="text-error text-xs">{getError(`${errorBase}.freq`)}</p>
              ) : null}
              {getError?.(`${errorBase}.unitPrice`) ? (
                <p className="text-error text-xs">{getError(`${errorBase}.unitPrice`)}</p>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
