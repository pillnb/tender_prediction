import Link from "next/link";
import { CalendarDays, Clock3, Download, FolderArchive, MapPin, Pencil } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatIdr } from "@/lib/currency";
import type { TenderCalculationRecord } from "@/types/tender";

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatStatusLabel(record: TenderCalculationRecord) {
  if (record.status === "archived") {
    return "Archived";
  }

  if (record.status === "final") {
    return "Final";
  }

  if (record.status === "reviewed") {
    return "Reviewed";
  }

  return "Draft";
}

function statusClasses(status: TenderCalculationRecord["status"]) {
  if (status === "final") {
    return "bg-emerald-100 text-emerald-800";
  }

  if (status === "reviewed") {
    return "bg-sky-100 text-sky-800";
  }

  if (status === "archived") {
    return "bg-amber-100 text-amber-800";
  }

  return "bg-slate-100 text-slate-700";
}

export function ArchivedTenderList({ records }: { records: TenderCalculationRecord[] }) {
  if (records.length === 0) {
    return (
      <Card className="border-surface-container bg-surface-container-lowest rounded-3xl border shadow-sm">
        <CardContent className="flex min-h-64 flex-col items-center justify-center gap-4 text-center">
          <div className="bg-primary-container/10 text-primary flex h-14 w-14 items-center justify-center rounded-2xl">
            <FolderArchive className="h-7 w-7" />
          </div>
          <div>
            <div className="text-on-surface text-xl font-bold">Belum ada project tersimpan</div>
            <div className="text-on-surface-variant mt-2 text-sm">
              Draft, reviewed, final, dan archived project akan muncul di halaman ini setelah
              disimpan dari workspace.
            </div>
          </div>
          <Link
            href="/"
            className="bg-primary text-primary-foreground inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold"
          >
            <Pencil className="h-4 w-4" />
            Buka Workspace
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-5 xl:grid-cols-2">
      {records.map((record) => {
        const projectInfo = record.form.directCosts.projectInfo;
        const summary = record.computed.summary;

        return (
          <Card
            key={record.id}
            className="border-surface-container bg-surface-container-lowest rounded-3xl border shadow-sm"
          >
            <CardHeader className="gap-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-on-surface text-xl font-bold">
                    {projectInfo.projectName || "Untitled Project"}
                  </CardTitle>
                  <CardDescription className="text-on-surface-variant text-sm">
                    {projectInfo.companyName || "Perusahaan belum diisi"} -{" "}
                    {projectInfo.projectCategory || "Kategori belum diisi"}
                  </CardDescription>
                </div>
                <span
                  className={`inline-flex w-fit items-center rounded-full px-3 py-1 text-xs font-semibold uppercase ${statusClasses(record.status)}`}
                >
                  {formatStatusLabel(record)}
                </span>
              </div>
            </CardHeader>

            <CardContent className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="bg-surface rounded-2xl p-4">
                  <div className="text-on-surface-variant text-xs uppercase">Final Total</div>
                  <div className="text-primary mt-2 text-2xl font-bold">
                    {formatIdr(summary.finalRoundedPrice)}
                  </div>
                </div>
                <div className="bg-surface rounded-2xl p-4">
                  <div className="text-on-surface-variant text-xs uppercase">Direct Cost</div>
                  <div className="text-on-surface mt-2 text-2xl font-bold">
                    {formatIdr(summary.directCosts.directCostSubtotal)}
                  </div>
                </div>
              </div>

              <div className="grid gap-3 text-sm text-slate-600 sm:grid-cols-2">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  <span>{projectInfo.projectLocation || "Lokasi belum diisi"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4" />
                  <span>
                    {projectInfo.workDate
                      ? new Date(projectInfo.workDate).toLocaleDateString("id-ID", {
                          dateStyle: "medium",
                        })
                      : "Tanggal belum diisi"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock3 className="h-4 w-4" />
                  <span>
                    {projectInfo.durationDays
                      ? `${projectInfo.durationDays} hari`
                      : "Durasi belum diisi"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock3 className="h-4 w-4" />
                  <span>Disimpan {formatDateTime(record.updatedAt)}</span>
                </div>
              </div>

              <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-on-surface-variant text-sm">
                  Step terakhir:{" "}
                  <span className="text-on-surface font-medium">{record.form.currentStep}</span>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Link
                    href={`/?recordId=${record.id}`}
                    className="bg-primary inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white"
                  >
                    <Pencil className="h-4 w-4" />
                    Open
                  </Link>
                  <a
                    href={`/tender-calculations/${record.id}/print?autoprint=1`}
                    target="_blank"
                    rel="noreferrer"
                    className="border-surface-container bg-surface text-on-surface inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold"
                  >
                    <Download className="h-4 w-4" />
                    Print / Save PDF
                  </a>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
