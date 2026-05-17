import { HardHat, PlusCircle, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatIdr, formatNumberInput, parseNullableNumberInput } from "@/lib/currency";
import {
  EDUCATION_OPTIONS,
  LABOR_MAIN_CATEGORY_OPTIONS,
  PROFESSIONAL_EDUCATION_OPTIONS,
  PROFESSIONAL_SKK_OPTIONS,
  SUPPORTING_ROLE_OPTIONS,
} from "@/lib/tender-master-data";
import { cn } from "@/lib/utils";
import type {
  EducationLevel,
  LaborCostComputed,
  LaborCostInput,
  LaborMainCategory,
  ProfessionalSkkLevel,
  SupportingStaffRole,
} from "@/types/tender";

type LaborCostsProps = {
  items: LaborCostInput[];
  computedItems: LaborCostComputed[];
  onAdd: () => void;
  onRemove: (id: string) => void;
  onChange: <K extends keyof LaborCostInput>(
    id: string,
    field: K,
    value: LaborCostInput[K]
  ) => void;
  getError?: (fieldPath: string) => string | undefined;
};

function findComputedItem(id: string, computedItems: LaborCostComputed[]) {
  return computedItems.find((item) => item.id === id);
}

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return <p className="text-error text-xs">{message}</p>;
}

export function LaborCosts({
  items,
  computedItems,
  onAdd,
  onRemove,
  onChange,
  getError,
}: LaborCostsProps) {
  return (
    <div className="glass-card col-span-12 overflow-hidden rounded-[2rem]">
      <div className="from-surface-container-low flex items-center justify-between border-b border-black/5 bg-linear-to-r to-transparent p-6">
        <div className="flex items-center gap-4">
          <div className="bg-primary-container flex h-12 w-12 items-center justify-center rounded-xl">
            <HardHat className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="field-label text-primary mb-1">Biaya Personel</div>
            <h3 className="font-h3 text-h3 text-on-surface">Biaya Tenaga Kerja</h3>
          </div>
        </div>
        <button
          type="button"
          className="text-primary bg-primary/8 hover:bg-primary/12 flex items-center gap-1 rounded-full px-4 py-2 text-sm font-bold shadow-[inset_0_0_0_1px_rgba(0,74,198,0.08)]"
          onClick={onAdd}
        >
          <PlusCircle className="h-4 w-4" />
          Tambah Crew
        </button>
      </div>

      <div className="space-y-6 p-6">
        {items.map((item, index) => {
          const computed = findComputedItem(item.id, computedItems);
          const errorBase = `laborCosts.${index}`;
          const isProfessional = item.mainCategory === "tenaga-ahli-profesional";
          const isSubprofessional = item.mainCategory === "teknisi-analis-subprofesional";
          const isSupporting = item.mainCategory === "tenaga-pendukung";
          const manualRequired =
            item.isCustomPrice || (isSupporting && item.supportingRole === "lainnya");

          return (
            <div
              key={item.id}
              className="border-outline-variant/60 relative rounded-[1.5rem] border bg-white/75 p-6 shadow-[0_10px_24px_rgba(11,28,48,0.04)]"
            >
              <button
                type="button"
                className="text-outline hover:text-error absolute top-4 right-4 transition-colors"
                onClick={() => onRemove(item.id)}
                disabled={items.length === 1}
              >
                <Trash2 className="h-4 w-4" />
              </button>

              <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <h4 className="text-on-surface font-bold">Crew {index + 1}</h4>
                <button
                  type="button"
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    manualRequired
                      ? "bg-secondary-fixed text-on-secondary-fixed"
                      : "bg-primary-container/10 text-primary"
                  }`}
                  onClick={() =>
                    onChange(
                      item.id,
                      "isCustomPrice",
                      isSupporting && item.supportingRole === "lainnya" ? true : !item.isCustomPrice
                    )
                  }
                  disabled={isSupporting && item.supportingRole === "lainnya"}
                >
                  {manualRequired ? "Custom Price" : "Auto Rate INKINDO"}
                </button>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="space-y-1.5">
                  <label className="font-label-sm text-on-surface-variant">Kategori Utama</label>
                  <Select
                    value={item.mainCategory || undefined}
                    onValueChange={(nextValue) => {
                      const nextCategory = (nextValue ?? "") as LaborMainCategory | "";

                      onChange(item.id, "mainCategory", nextCategory);

                      if (nextCategory !== "tenaga-ahli-profesional") {
                        onChange(item.id, "professionalSkkLevel", "");
                      }

                      if (nextCategory === "tenaga-pendukung") {
                        onChange(item.id, "education", "");
                        onChange(item.id, "experienceYears", null);
                      }

                      if (nextCategory !== "tenaga-pendukung") {
                        onChange(item.id, "supportingRole", "");
                      }
                    }}
                  >
                    <SelectTrigger
                      className={cn(
                        "bg-surface-container-lowest border-surface-container w-full rounded-lg",
                        getError?.(`${errorBase}.mainCategory`) ? "border-error" : ""
                      )}
                    >
                      <SelectValue placeholder="Pilih kategori utama" />
                    </SelectTrigger>
                    <SelectContent>
                      {LABOR_MAIN_CATEGORY_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FieldError message={getError?.(`${errorBase}.mainCategory`)} />
                </div>

                <div className="space-y-1.5 xl:col-span-2">
                  <label className="font-label-sm text-on-surface-variant">
                    Posisi / Komposisi Crew
                  </label>
                  <Input
                    className={cn(
                      "bg-surface-container-lowest border-surface-container w-full rounded-lg",
                      getError?.(`${errorBase}.roleName`) ? "border-error" : ""
                    )}
                    value={item.roleName}
                    onChange={(event) => onChange(item.id, "roleName", event.target.value)}
                  />
                  <FieldError message={getError?.(`${errorBase}.roleName`)} />
                </div>

                {isProfessional ? (
                  <div className="space-y-1.5">
                    <label className="font-label-sm text-on-surface-variant">SKK</label>
                    <Select
                      value={item.professionalSkkLevel || undefined}
                      onValueChange={(nextValue) =>
                        onChange(
                          item.id,
                          "professionalSkkLevel",
                          (nextValue ?? "") as ProfessionalSkkLevel | ""
                        )
                      }
                    >
                      <SelectTrigger
                        className={cn(
                          "bg-surface-container-lowest border-surface-container w-full rounded-lg",
                          getError?.(`${errorBase}.professionalSkkLevel`) ? "border-error" : ""
                        )}
                      >
                        <SelectValue placeholder="Pilih level SKK" />
                      </SelectTrigger>
                      <SelectContent>
                        {PROFESSIONAL_SKK_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FieldError message={getError?.(`${errorBase}.professionalSkkLevel`)} />
                  </div>
                ) : null}

                {isSupporting ? (
                  <div className="space-y-1.5">
                    <label className="font-label-sm text-on-surface-variant">Peran</label>
                    <Select
                      value={item.supportingRole || undefined}
                      onValueChange={(nextValue) => {
                        const nextRole = (nextValue ?? "") as SupportingStaffRole | "";

                        onChange(item.id, "supportingRole", nextRole);

                        if (nextRole === "lainnya") {
                          onChange(item.id, "isCustomPrice", true);
                        }
                      }}
                    >
                      <SelectTrigger
                        className={cn(
                          "bg-surface-container-lowest border-surface-container w-full rounded-lg",
                          getError?.(`${errorBase}.supportingRole`) ? "border-error" : ""
                        )}
                      >
                        <SelectValue placeholder="Pilih peran tenaga pendukung" />
                      </SelectTrigger>
                      <SelectContent>
                        {SUPPORTING_ROLE_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FieldError message={getError?.(`${errorBase}.supportingRole`)} />
                  </div>
                ) : null}

                <div className="space-y-1.5">
                  <label className="font-label-sm text-on-surface-variant">Jumlah Personil</label>
                  <Input
                    className={cn(
                      "bg-surface-container-lowest border-surface-container w-full rounded-lg text-right",
                      getError?.(`${errorBase}.quantity`) ? "border-error" : ""
                    )}
                    type="number"
                    min="0"
                    value={item.quantity ?? ""}
                    onChange={(event) =>
                      onChange(
                        item.id,
                        "quantity",
                        event.target.value === "" ? null : Number(event.target.value)
                      )
                    }
                  />
                  <FieldError message={getError?.(`${errorBase}.quantity`)} />
                </div>

                <div className="space-y-1.5">
                  <label className="font-label-sm text-on-surface-variant">Durasi (Hari)</label>
                  <Input
                    className={cn(
                      "bg-surface-container-lowest border-surface-container w-full rounded-lg text-right",
                      getError?.(`${errorBase}.durationDays`) ? "border-error" : ""
                    )}
                    type="number"
                    min="0"
                    value={item.durationDays ?? ""}
                    onChange={(event) =>
                      onChange(
                        item.id,
                        "durationDays",
                        event.target.value === "" ? null : Number(event.target.value)
                      )
                    }
                  />
                  <FieldError message={getError?.(`${errorBase}.durationDays`)} />
                </div>

                {!isSupporting ? (
                  <div className="space-y-1.5">
                    <label className="font-label-sm text-on-surface-variant">Pendidikan</label>
                    <Select
                      value={item.education || undefined}
                      onValueChange={(nextValue) =>
                        onChange(item.id, "education", (nextValue ?? "") as EducationLevel | "")
                      }
                    >
                      <SelectTrigger
                        className={cn(
                          "bg-surface-container-lowest border-surface-container w-full rounded-lg",
                          getError?.(`${errorBase}.education`) ? "border-error" : ""
                        )}
                      >
                        <SelectValue placeholder="Pilih Pendidikan" />
                      </SelectTrigger>
                      <SelectContent>
                        {(isProfessional ? PROFESSIONAL_EDUCATION_OPTIONS : EDUCATION_OPTIONS).map(
                          (option) => (
                            <SelectItem key={option} value={option}>
                              {option.toUpperCase()}
                            </SelectItem>
                          )
                        )}
                      </SelectContent>
                    </Select>
                    <FieldError message={getError?.(`${errorBase}.education`)} />
                  </div>
                ) : null}

                {!isSupporting ? (
                  <div className="space-y-1.5">
                    <label className="font-label-sm text-on-surface-variant">
                      Pengalaman (Tahun)
                    </label>
                    <Input
                      className={cn(
                        "bg-surface-container-lowest border-surface-container w-full rounded-lg text-right",
                        getError?.(`${errorBase}.experienceYears`) ? "border-error" : ""
                      )}
                      type="number"
                      min="0"
                      value={item.experienceYears ?? ""}
                      onChange={(event) =>
                        onChange(
                          item.id,
                          "experienceYears",
                          event.target.value === "" ? null : Number(event.target.value)
                        )
                      }
                    />
                    <FieldError message={getError?.(`${errorBase}.experienceYears`)} />
                  </div>
                ) : null}

                <div className="space-y-1.5 xl:col-span-2">
                  <label className="font-label-sm text-on-surface-variant">
                    Upah All In / Unit Rate
                  </label>
                  <Input
                    className={cn(
                      "bg-surface-container-lowest border-surface-container w-full rounded-lg text-right font-medium",
                      getError?.(`${errorBase}.manualUnitRate`) ? "border-error" : ""
                    )}
                    inputMode="numeric"
                    value={formatNumberInput(
                      manualRequired ? item.manualUnitRate : computed?.resolvedUnitRate
                    )}
                    readOnly={!manualRequired}
                    onChange={(event) =>
                      onChange(
                        item.id,
                        "manualUnitRate",
                        parseNullableNumberInput(event.target.value)
                      )
                    }
                  />
                  <FieldError message={getError?.(`${errorBase}.manualUnitRate`)} />
                  <p className="text-on-surface-variant text-xs">
                    {manualRequired
                      ? isSupporting && item.supportingRole === "lainnya"
                        ? "Peran 'Lainnya' wajib diisi manual karena tidak ada tarif lookup."
                        : "Manual override aktif. Nilai ini menggantikan tarif INKINDO."
                      : `Auto = Tarif Dasar ${formatIdr(computed?.baseRate ?? 0)} x Indeks Lokasi ${computed?.locationIndex?.toFixed(3) ?? "1.000"}${
                          isSubprofessional
                            ? " (kategori sub profesional memakai lookup skala kategori)."
                            : ""
                        }`}
                  </p>
                </div>
              </div>

              <div className="border-surface-container mt-4 grid gap-2 border-t pt-4 text-sm md:grid-cols-3">
                <div className="bg-surface-container-low rounded-lg px-4 py-3">
                  <div className="text-on-surface-variant text-xs uppercase">Mode Harga</div>
                  <div className="text-on-surface font-semibold">
                    {computed?.pricingMode === "custom_manual" ? "Custom Manual" : "Auto INKINDO"}
                  </div>
                </div>
                <div className="bg-surface-container-low rounded-lg px-4 py-3">
                  <div className="text-on-surface-variant text-xs uppercase">Sumber Rule</div>
                  <div className="text-on-surface font-semibold">
                    {computed?.lookup.referenceName ?? "Belum tersedia"}
                  </div>
                </div>
                <div className="bg-surface-container-low rounded-lg px-4 py-3 text-right">
                  <div className="text-on-surface-variant text-xs uppercase">Subtotal Biaya</div>
                  <div className="text-on-surface text-lg font-bold">
                    {formatIdr(computed?.subtotal ?? 0)}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
