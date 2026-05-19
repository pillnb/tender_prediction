import { ClipboardList } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { CompanyCategory, ProjectCategory, ProjectInfoInput } from "@/types/tender";

type ProjectDescriptionProps = {
  value: ProjectInfoInput;
  onChange: <K extends keyof ProjectInfoInput>(field: K, nextValue: ProjectInfoInput[K]) => void;
  errors?: Partial<Record<keyof ProjectInfoInput, string>>;
};

const provinces = [
  "Aceh",
  "Sumatera Utara",
  "Sumatera Barat",
  "Riau",
  "Jambi",
  "Sumatera Selatan",
  "Bengkulu",
  "Lampung",
  "Kepulauan Bangka Belitung",
  "Kepulauan Riau",
  "DKI Jakarta",
  "Jawa Barat",
  "Jawa Tengah",
  "DI Yogyakarta",
  "Jawa Timur",
  "Banten",
  "Bali",
  "Nusa Tenggara Barat",
  "Nusa Tenggara Timur",
  "Kalimantan Barat",
  "Kalimantan Tengah",
  "Kalimantan Selatan",
  "Kalimantan Timur",
  "Kalimantan Utara",
  "Sulawesi Utara",
  "Sulawesi Tengah",
  "Sulawesi Selatan",
  "Sulawesi Tenggara",
  "Gorontalo",
  "Sulawesi Barat",
  "Maluku",
  "Maluku Utara",
  "Papua",
  "Papua Barat",
  "Papua Selatan",
  "Papua Tengah",
  "Papua Pegunungan",
  "Papua Barat Daya",
];

const projectCategoryOptions: Array<{ value: ProjectCategory; label: string }> = [
  { value: "pemetaan", label: "Pemetaan" },
  { value: "survey", label: "Survey/Identifikasi/Inventarisasi" },
  { value: "inspeksi", label: "Inspeksi" },
  { value: "assessment", label: "Assessment" },
  { value: "audit", label: "Audit" },
  { value: "pengujian", label: "Pengujian" },
  { value: "pengujian_lab", label: "Pengujian Laboratorium" },
  { value: "monitoring", label: "Monitoring" },
  { value: "supervisi", label: "Supervisi" },
  { value: "konsultansi", label: "Konsultansi" },
  { value: "sertifikasi", label: "Sertifikasi" },
  { value: "training", label: "Training" },
  { value: "labor_survey", label: "Labor Survey" },
];

const companyCategoryOptions: Array<{ value: CompanyCategory; label: string }> = [
  { value: "migas", label: "Migas" },
  { value: "minerba", label: "Minerba" },
  { value: "ebtke", label: "EBTKE" },
  { value: "kelistrikan", label: "Kelistrikan" },
  { value: "nakertrans", label: "Nakertrans" },
  { value: "dephub", label: "Dephub" },
  { value: "perindustrian", label: "Perindustrian" },
  { value: "bki", label: "BKI" },
  { value: "lain-lain", label: "Lain-Lain" },
];

function getProjectCategoryLabel(value: ProjectCategory | "") {
  return projectCategoryOptions.find((option) => option.value === value)?.label ?? "";
}

function getCompanyCategoryLabel(value: CompanyCategory | "") {
  return companyCategoryOptions.find((option) => option.value === value)?.label ?? "";
}

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return <p className="text-error text-xs">{message}</p>;
}

export function ProjectDescription({ value, onChange, errors }: ProjectDescriptionProps) {
  return (
    <div className="glass-card col-span-12 rounded-[2rem] p-8 lg:col-span-8">
      <div className="mb-6 flex items-center gap-4">
        <div className="bg-primary-container flex h-12 w-12 items-center justify-center rounded-xl">
          <ClipboardList className="h-5 w-5 text-white" />
        </div>
        <div>
          <div className="field-label text-primary mb-1">Input Data Proyek</div>
          <h3 className="font-h3 text-h3 text-on-surface">Deskripsi Proyek</h3>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="space-y-1.5">
          <label className="font-label-sm text-on-surface-variant">Nama Pekerjaan</label>
          <Input
            className={cn(
              "border-surface-container focus-visible:ring-primary-container w-full rounded-lg",
              errors?.projectName ? "border-error focus-visible:ring-error/20" : ""
            )}
            value={value.projectName}
            onChange={(event) => onChange("projectName", event.target.value)}
          />
          <p className="text-on-surface-variant text-xs">
            Kategori proyek akan terdeteksi otomatis dari nama pekerjaan, lalu tetap bisa kamu
            ubah manual bila perlu.
          </p>
          <FieldError message={errors?.projectName} />
        </div>

        <div className="space-y-1.5">
          <label className="font-label-sm text-on-surface-variant">Kategori Proyek</label>
          <Select
            value={
              value.projectCategory ? getProjectCategoryLabel(value.projectCategory) : undefined
            }
            onValueChange={(nextValue) => {
              const selectedOption = projectCategoryOptions.find(
                (option) => option.label === nextValue
              );
              onChange(
                "projectCategory",
                (selectedOption?.value ?? "") as ProjectInfoInput["projectCategory"]
              );
            }}
          >
            <SelectTrigger
              className={cn(
                "border-surface-container w-full rounded-lg",
                errors?.projectCategory ? "border-error" : ""
              )}
            >
              <SelectValue placeholder="Pilih Kategori Proyek" />
            </SelectTrigger>
            <SelectContent>
              {projectCategoryOptions.map((option) => (
                <SelectItem key={option.value} value={option.label}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldError message={errors?.projectCategory} />
        </div>

        <div className="space-y-1.5">
          <label className="font-label-sm text-on-surface-variant">Lokasi Proyek</label>
          <Select
            value={value.projectLocation || undefined}
            onValueChange={(nextValue) =>
              onChange("projectLocation", nextValue ?? value.projectLocation)
            }
          >
            <SelectTrigger
              className={cn(
                "border-surface-container w-full rounded-lg",
                errors?.projectLocation ? "border-error" : ""
              )}
            >
              <SelectValue placeholder="Pilih Lokasi Proyek" />
            </SelectTrigger>
            <SelectContent>
              {provinces.map((province) => (
                <SelectItem key={province} value={province}>
                  {province}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldError message={errors?.projectLocation} />
        </div>

        <div className="space-y-1.5">
          <label className="font-label-sm text-on-surface-variant">Nama Perusahaan</label>
          <Input
            className={cn(
              "border-surface-container w-full rounded-lg",
              errors?.companyName ? "border-error" : ""
            )}
            value={value.companyName}
            onChange={(event) => onChange("companyName", event.target.value)}
          />
          <FieldError message={errors?.companyName} />
        </div>

        <div className="space-y-1.5">
          <label className="font-label-sm text-on-surface-variant">Kategori Perusahaan</label>
          <Select
            value={
              value.companyCategory ? getCompanyCategoryLabel(value.companyCategory) : undefined
            }
            onValueChange={(nextValue) => {
              const selectedOption = companyCategoryOptions.find(
                (option) => option.label === nextValue
              );
              onChange(
                "companyCategory",
                (selectedOption?.value ?? "") as ProjectInfoInput["companyCategory"]
              );
            }}
          >
            <SelectTrigger
              className={cn(
                "border-surface-container w-full rounded-lg",
                errors?.companyCategory ? "border-error" : ""
              )}
            >
              <SelectValue placeholder="Pilih Kategori Perusahaan" />
            </SelectTrigger>
            <SelectContent>
              {companyCategoryOptions.map((option) => (
                <SelectItem key={option.value} value={option.label}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldError message={errors?.companyCategory} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="font-label-sm text-on-surface-variant">Durasi (Hari)</label>
            <Input
              className={cn(
                "border-surface-container w-full rounded-lg text-right",
                errors?.durationDays ? "border-error" : ""
              )}
              type="number"
              min="0"
              value={value.durationDays ?? ""}
              onChange={(event) =>
                onChange(
                  "durationDays",
                  event.target.value === "" ? null : Number(event.target.value)
                )
              }
            />
            <FieldError message={errors?.durationDays} />
          </div>
          <div className="space-y-1.5">
            <label className="font-label-sm text-on-surface-variant">Tgl Pekerjaan</label>
            <Input
              className={cn(
                "border-surface-container w-full rounded-lg",
                errors?.workDate ? "border-error" : ""
              )}
              type="date"
              value={value.workDate}
              onChange={(event) => onChange("workDate", event.target.value)}
            />
            <FieldError message={errors?.workDate} />
          </div>
        </div>
      </div>
    </div>
  );
}
