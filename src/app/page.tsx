import { TopNavBar } from "@/components/layout/TopNavBar";
import { TenderDashboard } from "@/components/features/tender/TenderDashboard";

export default function Home() {
  return (
    <div className="bg-background text-on-background min-h-screen">
      <TopNavBar />

      <main className="mt-16 min-h-screen px-6 py-12 sm:px-8">
        <div className="mx-auto max-w-5xl">
          <TenderDashboard />
        </div>
      </main>
    </div>
  );
}
