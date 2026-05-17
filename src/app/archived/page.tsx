import { ArchivedTenderList } from "@/components/features/tender/ArchivedTenderList";
import { TopNavBar } from "@/components/layout/TopNavBar";
import { listTenderCalculations } from "@/lib/tender-repository";

export const dynamic = "force-dynamic";

export default async function ArchivedPage() {
  const records = await listTenderCalculations({
    includeArchived: true,
  }).catch((error) => {
    console.error("Failed to load archived tender calculations.", error);
    return [];
  });

  return (
    <div className="bg-background text-on-background min-h-screen">
      <TopNavBar />

      <main className="mt-16 min-h-screen px-6 py-12 sm:px-8">
        <div className="mx-auto max-w-5xl space-y-8">
          <div className="glass-card rounded-[2rem] p-10">
            <div className="text-primary mb-3 text-[11px] font-semibold tracking-[0.1em] uppercase">
              Saved Project
            </div>
            <h1 className="font-h1 text-h1 text-on-surface">Saved Tender Projects</h1>
            <p className="font-body-md text-on-surface-variant mt-3 max-w-3xl">
              Semua project yang pernah disimpan termasuk draft dan final record.
            </p>
          </div>

          <ArchivedTenderList records={records} />
        </div>
      </main>
    </div>
  );
}
