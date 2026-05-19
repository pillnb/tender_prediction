"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FolderPlus,
  Sparkles,
} from "lucide-react";
import { EquipmentCosts } from "@/components/features/tender/EquipmentCosts";
import { EstimationSummary } from "@/components/features/tender/EstimationSummary";
import { LaborCosts } from "@/components/features/tender/LaborCosts";
import { MobDemob } from "@/components/features/tender/MobDemob";
import { OperationalCosts } from "@/components/features/tender/OperationalCosts";
import { ProjectDescription } from "@/components/features/tender/ProjectDescription";
import { TaxMarginConfig } from "@/components/features/tender/TaxMarginConfig";
import { Button } from "@/components/ui/button";
import { formatIdr } from "@/lib/currency";
import { inferProjectCategoryFromName } from "@/lib/projectCategoryClassifier";
import {
  calculateTenderWizardComputedState,
  createEmptyEquipmentItem,
  createEmptyLaborItem,
  createEmptySupportingCost,
  createEmptyTenderFormData,
  fetchSVRPrediction,
} from "@/lib/tenderCalculations";
import {
  validateTenderWizardForm,
  type TenderValidationIssue,
  type TenderValidationSection,
} from "@/lib/tender-validation";
import { cn } from "@/lib/utils";
import type {
  EquipmentCostInput,
  LaborCostInput,
  MobilityCostInput,
  ProjectInfoInput,
  SupportingCostInput,
  SvrPredictionResult,
  TenderCalculationRecord,
  TenderWizardFormData,
  TenderWizardStep,
} from "@/types/tender";

const wizardSteps: Array<{
  step: Exclude<TenderWizardStep, "landing">;
  title: string;
  description: string;
}> = [
  {
    step: "direct-costs",
    title: "Direct Costs",
    description: "Deskripsi proyek dan Rincian biaya langsung",
  },
  {
    step: "indirect-costs",
    title: "Indirect Costs",
    description: "Rincian Biaya tidak langsung (Overhead)",
  },
  {
    step: "profit-cgl",
    title: "Profit & CGL",
    description: "Profit & CGL",
  },
  {
    step: "final-summary",
    title: "Final Summary",
    description: "Rangkuman & Benchmarking Model Machine Learning",
  },
];

const directCostSections: Array<{
  id: string;
  section: TenderValidationSection;
  title: string;
  description: string;
}> = [
  {
    id: "direct-project-info",
    section: "project-info",
    title: "Deskripsi Proyek",
    description: "Metadata tender dan parameter proyek utama.",
  },
  {
    id: "direct-labor-costs",
    section: "labor-costs",
    title: "Biaya Tenaga Kerja",
    description: "Crew composition, INKINDO rate, dan custom override.",
  },
  {
    id: "direct-mobility-costs",
    section: "mobility-costs",
    title: "Mob & Demob",
    description: "Qty, freq, dan harga untuk personil dan equipment handling.",
  },
  {
    id: "direct-equipment-costs",
    section: "equipment-costs",
    title: "Biaya Peralatan",
    description: "Semua alat kerja disusun rapi secara vertikal.",
  },
  {
    id: "direct-supporting-costs",
    section: "supporting-costs",
    title: "Material / Supporting",
    description: "Meal, lodging, reporting, permit, dan MCU.",
  },
];

const LOCAL_DRAFT_STORAGE_KEY = "pt-bki-tender-local-draft";

type LocalDraftSnapshot = {
  recordId: string | null;
  savedAt: string;
  form: TenderWizardFormData;
  aiBenchmark?: SvrPredictionResult;
};

function createStepValidationAttemptState() {
  return {
    "direct-costs": false,
    "indirect-costs": false,
    "profit-cgl": false,
    "final-summary": false,
  } satisfies Record<Exclude<TenderWizardStep, "landing">, boolean>;
}

function getStepIndex(currentStep: TenderWizardStep) {
  return wizardSteps.findIndex((item) => item.step === currentStep);
}

function scrollToPageTop() {
  if (typeof window !== "undefined") {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }
}

function triggerAsync(callback: () => void) {
  if (typeof window !== "undefined") {
    window.setTimeout(callback, 0);
  }
}

function triggerSmoothScrollToTop() {
  if (typeof window !== "undefined") {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        scrollToPageTop();
      });
    });
  }
}

function getFirstIssueMessage(issues: TenderValidationIssue[], field: string) {
  return issues.find((issue) => issue.field === field)?.message;
}

function ValidationBanner({
  title,
  issues,
  notice,
}: {
  title: string;
  issues: TenderValidationIssue[];
  notice?: string | null;
}) {
  if (issues.length === 0 && !notice) {
    return null;
  }

  return (
    <div className="border-error/15 from-error/6 rounded-[1.5rem] border bg-linear-to-r to-white/60 p-4 backdrop-blur-sm">
      <div className="flex items-start gap-3">
        <AlertCircle className="text-error mt-0.5 h-5 w-5" />
        <div className="space-y-2">
          <div className="text-error font-semibold">{title}</div>
          {notice ? <div className="text-on-surface-variant text-sm">{notice}</div> : null}
          {issues.length > 0 ? (
            <ul className="text-on-surface-variant space-y-1 text-sm">
              {issues.slice(0, 5).map((issue) => (
                <li key={issue.field}>- {issue.message}</li>
              ))}
              {issues.length > 5 ? (
                <li>- Dan {issues.length - 5} issue lain di step ini.</li>
              ) : null}
            </ul>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function SectionValidationHint({ issues }: { issues: TenderValidationIssue[] }) {
  if (issues.length === 0) {
    return null;
  }

  return (
    <div className="border-error/12 from-error/6 mb-3 rounded-[1.25rem] border bg-linear-to-r to-white/70 px-4 py-3 backdrop-blur-sm">
      <div className="text-error text-sm font-semibold">Perlu perhatian di section ini</div>
      <div className="text-on-surface-variant mt-1 text-sm">
        {issues
          .slice(0, 2)
          .map((issue) => issue.message)
          .join(" ")}
      </div>
    </div>
  );
}

function SectionStatusCard({
  title,
  description,
  issueCount,
  onClick,
}: {
  title: string;
  description: string;
  issueCount: number;
  onClick: () => void;
}) {
  const isPending = issueCount < 0;
  const isReady = issueCount === 0;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-[1.5rem] border p-4 text-left backdrop-blur-sm transition-all",
        isPending
          ? "border-outline-variant/60 hover:bg-surface-container-low/90 bg-white/68"
          : isReady
            ? "border-primary/15 from-primary/8 hover:from-primary/12 bg-linear-to-br to-white/80 hover:to-white"
            : "border-error/20 from-error/8 hover:from-error/10 bg-linear-to-br to-white/80 hover:to-white"
      )}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="text-on-surface font-semibold">{title}</div>
        <div
          className={cn(
            "rounded-full px-2 py-1 text-[11px] font-semibold uppercase",
            isPending
              ? "bg-surface-container text-on-surface-variant"
              : isReady
                ? "bg-primary text-on-primary"
                : "bg-error text-white"
          )}
        >
          {isPending ? "Pending" : isReady ? "Ready" : `${issueCount} issue`}
        </div>
      </div>
      <div className="text-on-surface-variant text-sm">{description}</div>
    </button>
  );
}

export function TenderDashboard() {
  const searchParams = useSearchParams();
  const selectedRecordId = searchParams.get("recordId");
  const allowProjectCategoryAutofillRef = useRef(true);
  const [form, setForm] = useState<TenderWizardFormData>(() => createEmptyTenderFormData());
  const [latestDraft, setLatestDraft] = useState<TenderCalculationRecord | null>(null);
  const [localRecovery, setLocalRecovery] = useState<LocalDraftSnapshot | null>(null);
  const [attemptedStepValidation, setAttemptedStepValidation] = useState(() =>
    createStepValidationAttemptState()
  );
  const [recordId, setRecordId] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [aiBenchmark, setAiBenchmark] = useState<SvrPredictionResult | undefined>(undefined);
  const [isHydrating, setIsHydrating] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isPredicting, setIsPredicting] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [stepNotice, setStepNotice] = useState<string | null>(null);

  useEffect(() => {
    if (
      form.directCosts.projectInfo.projectName === "" &&
      form.directCosts.projectInfo.projectCategory === ""
    ) {
      allowProjectCategoryAutofillRef.current = true;
    }
  }, [
    form.directCosts.projectInfo.projectCategory,
    form.directCosts.projectInfo.projectName,
  ]);

  useEffect(() => {
    let isMounted = true;

    async function loadInitialTenderCalculation() {
      try {
        const latestRequest = fetch("/api/tender-calculations?mode=latest", {
          cache: "no-store",
        });
        const selectedRequest = selectedRecordId
          ? fetch(`/api/tender-calculations/${selectedRecordId}`, {
              cache: "no-store",
            })
          : null;

        const latestResponse = await latestRequest;

        if (!latestResponse.ok) {
          throw new Error("Failed to load latest tender calculation.");
        }

        const latestPayload = (await latestResponse.json()) as {
          data: TenderCalculationRecord | null;
        };
        const selectedResponse = selectedRequest ? await selectedRequest : null;
        const selectedPayload =
          selectedResponse === null
            ? null
            : selectedResponse.ok
              ? ((await selectedResponse.json()) as {
                  data: TenderCalculationRecord;
                })
              : null;
        const recoveryPayload =
          typeof window === "undefined"
            ? null
            : window.localStorage.getItem(LOCAL_DRAFT_STORAGE_KEY);

        if (!isMounted) {
          return;
        }

        if (latestPayload.data) {
          setLatestDraft(latestPayload.data);
        }

        if (selectedPayload?.data) {
          setForm(selectedPayload.data.form);
          setRecordId(selectedPayload.data.id);
          setLastSavedAt(selectedPayload.data.updatedAt);
          setAiBenchmark(selectedPayload.data.computed.aiBenchmark);
          setSaveMessage("Project tersimpan berhasil dimuat dari arsip.");
          setStepNotice(null);
        } else if (selectedRecordId) {
          setSaveMessage("Project yang diminta tidak ditemukan. Menampilkan workspace default.");
        }

        if (recoveryPayload) {
          setLocalRecovery(JSON.parse(recoveryPayload) as LocalDraftSnapshot);
        }
      } catch (error) {
        if (isMounted) {
          setSaveMessage(
            error instanceof Error ? error.message : "Gagal memuat draft dari database."
          );
        }
      } finally {
        if (isMounted) {
          setIsHydrating(false);
        }
      }
    }

    void loadInitialTenderCalculation();

    return () => {
      isMounted = false;
    };
  }, [selectedRecordId]);

  const computed = useMemo(
    () => calculateTenderWizardComputedState(form, aiBenchmark),
    [form, aiBenchmark]
  );
  const validation = useMemo(
    () => validateTenderWizardForm(form, computed.summary.directCosts.directCostSubtotal),
    [form, computed.summary.directCosts.directCostSubtotal]
  );
  const currentStepIndex = getStepIndex(form.currentStep);
  const currentStepMeta = currentStepIndex >= 0 ? wizardSteps[currentStepIndex] : null;
  const currentStepValidation = validation.steps[form.currentStep];
  const shouldShowCurrentStepValidation =
    form.currentStep !== "landing" && attemptedStepValidation[form.currentStep];
  const visibleCurrentStepIssues = shouldShowCurrentStepValidation
    ? currentStepValidation.issues
    : [];
  const currentStepNeedsAttention =
    shouldShowCurrentStepValidation && !currentStepValidation.isValid;

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (form.currentStep === "landing") {
      return;
    }

    const snapshot: LocalDraftSnapshot = {
      recordId,
      savedAt: new Date().toISOString(),
      form,
      aiBenchmark,
    };

    window.localStorage.setItem(LOCAL_DRAFT_STORAGE_KEY, JSON.stringify(snapshot));
  }, [form, recordId, aiBenchmark]);

  useEffect(() => {
    if (isHydrating || form.currentStep === "landing") {
      return;
    }

    triggerSmoothScrollToTop();
  }, [form.currentStep, isHydrating]);

  async function refreshSvrPrediction() {
    setIsPredicting(true);

    try {
      const result = await fetchSVRPrediction(computed.aiBenchmark.payload);
      setAiBenchmark(result);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Gagal mengambil benchmark AI untuk payload ini.";

      setAiBenchmark({
        ...computed.aiBenchmark,
        hybrid: {
          ...computed.aiBenchmark.hybrid,
          status: "error",
          errorMessage,
        },
        errors: {
          hybrid: errorMessage,
        },
      });
    } finally {
      setIsPredicting(false);
    }
  }

  function updateCurrentStep(step: TenderWizardStep) {
    if (
      form.currentStep !== "landing" &&
      getStepIndex(step) > currentStepIndex &&
      !currentStepValidation.isValid
    ) {
      setAttemptedStepValidation((current) => ({
        ...current,
        [form.currentStep]: true,
      }));
      setStepNotice(
        `Step ${currentStepIndex + 1} belum valid. Rapikan ${currentStepValidation.issues.length} issue sebelum lanjut.`
      );
      return;
    }

    setStepNotice(null);
    setForm((current) => ({
      ...current,
      currentStep: step,
    }));

    if (
      step === "final-summary" &&
      computed.aiBenchmark.bestAvailable === null &&
      computed.aiBenchmark.hybrid.status === "idle"
    ) {
      triggerAsync(() => {
        void refreshSvrPrediction();
      });
    }
  }

  function moveStep(direction: "next" | "previous") {
    if (form.currentStep === "landing") {
      updateCurrentStep("direct-costs");
      return;
    }

    if (direction === "next" && !currentStepValidation.isValid) {
      setAttemptedStepValidation((current) => ({
        ...current,
        [form.currentStep]: true,
      }));
      setStepNotice(
        `Step ${currentStepIndex + 1} belum valid. Rapikan ${currentStepValidation.issues.length} issue sebelum lanjut.`
      );
      return;
    }

    setStepNotice(null);
    const nextIndex =
      direction === "next"
        ? Math.min(currentStepIndex + 1, wizardSteps.length - 1)
        : Math.max(currentStepIndex - 1, 0);

    updateCurrentStep(wizardSteps[nextIndex].step);
  }

  function startNewProject() {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(LOCAL_DRAFT_STORAGE_KEY);
    }

    setForm({
      ...createEmptyTenderFormData(),
      currentStep: "direct-costs",
    });
    setAttemptedStepValidation(createStepValidationAttemptState());
    setLocalRecovery(null);
    setRecordId(null);
    setLastSavedAt(null);
    setAiBenchmark(undefined);
    setSaveMessage(null);
    setStepNotice(null);
    triggerSmoothScrollToTop();
  }

  function resumeLatestDraft() {
    if (!latestDraft) {
      return;
    }

    setForm(latestDraft.form);
    setRecordId(latestDraft.id);
    setLastSavedAt(latestDraft.updatedAt);
    setAiBenchmark(latestDraft.computed.aiBenchmark);
    setAttemptedStepValidation(createStepValidationAttemptState());
    setLocalRecovery(null);
    setSaveMessage("Draft terakhir berhasil dimuat.");
    setStepNotice(null);
    triggerSmoothScrollToTop();
  }

  function resumeLocalRecovery() {
    if (!localRecovery) {
      return;
    }

    setForm(localRecovery.form);
    setRecordId(localRecovery.recordId);
    setAiBenchmark(localRecovery.aiBenchmark);
    setLastSavedAt(localRecovery.savedAt);
    setAttemptedStepValidation(createStepValidationAttemptState());
    setSaveMessage("Recovery draft lokal berhasil dimuat.");
    setStepNotice(null);
    triggerSmoothScrollToTop();
  }

  function setProjectInfo<K extends keyof ProjectInfoInput>(field: K, value: ProjectInfoInput[K]) {
    if (field === "projectCategory") {
      allowProjectCategoryAutofillRef.current = false;
    }

    setForm((current) => ({
      ...current,
      directCosts: (() => {
        const nextProjectInfo = {
          ...current.directCosts.projectInfo,
          [field]: value,
        };

        if (field === "projectName" && allowProjectCategoryAutofillRef.current) {
          nextProjectInfo.projectCategory = inferProjectCategoryFromName(String(value));
        }

        return {
          ...current.directCosts,
          projectInfo: nextProjectInfo,
        };
      })(),
    }));
  }

  function setLaborItem<K extends keyof LaborCostInput>(
    id: string,
    field: K,
    value: LaborCostInput[K]
  ) {
    setForm((current) => ({
      ...current,
      directCosts: {
        ...current.directCosts,
        laborCosts: current.directCosts.laborCosts.map((item) =>
          item.id === id
            ? {
                ...item,
                [field]: value,
              }
            : item
        ),
      },
    }));
  }

  function setMobilityItem<K extends keyof MobilityCostInput>(
    section: "personnelDeployment" | "equipmentHandling",
    field: K,
    value: MobilityCostInput[K]
  ) {
    setForm((current) => ({
      ...current,
      directCosts: {
        ...current.directCosts,
        mobilityCosts: {
          ...current.directCosts.mobilityCosts,
          [section]: {
            ...current.directCosts.mobilityCosts[section],
            [field]: value,
          },
        },
      },
    }));
  }

  function setEquipmentItem<K extends keyof EquipmentCostInput>(
    id: string,
    field: K,
    value: EquipmentCostInput[K]
  ) {
    setForm((current) => ({
      ...current,
      directCosts: {
        ...current.directCosts,
        equipmentCosts: current.directCosts.equipmentCosts.map((item) =>
          item.id === id
            ? {
                ...item,
                [field]: value,
              }
            : item
        ),
      },
    }));
  }

  function setSupportingItem<K extends keyof SupportingCostInput>(
    id: string,
    field: K,
    value: SupportingCostInput[K]
  ) {
    setForm((current) => ({
      ...current,
      directCosts: {
        ...current.directCosts,
        supportingCosts: current.directCosts.supportingCosts.map((item) =>
          item.id === id
            ? {
                ...item,
                [field]: value,
              }
            : item
        ),
      },
    }));
  }

  async function saveTenderCalculation() {
    setIsSaving(true);
    setSaveMessage(null);

    try {
      const response = await fetch(
        recordId ? `/api/tender-calculations/${recordId}` : "/api/tender-calculations",
        {
          method: recordId ? "PUT" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            form,
            status: form.currentStep === "final-summary" ? "final" : "draft",
            aiBenchmark,
          }),
        }
      );

      if (!response.ok) {
        const errorPayload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;

        throw new Error(errorPayload?.error || "Failed to save tender calculation.");
      }

      const payload = (await response.json()) as {
        data: TenderCalculationRecord;
      };

      setRecordId(payload.data.id);
      setLastSavedAt(payload.data.updatedAt);
      setLocalRecovery(null);
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(LOCAL_DRAFT_STORAGE_KEY);
      }
      setSaveMessage("Tender calculation berhasil disimpan ke Supabase.");
    } catch (error) {
      setSaveMessage(
        error instanceof Error ? error.message : "Terjadi kesalahan saat menyimpan data."
      );
    } finally {
      setIsSaving(false);
    }
  }

  function resetDraft() {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(LOCAL_DRAFT_STORAGE_KEY);
    }

    setForm(createEmptyTenderFormData());
    setAttemptedStepValidation(createStepValidationAttemptState());
    setLocalRecovery(null);
    setRecordId(null);
    setLastSavedAt(null);
    setAiBenchmark(undefined);
    setSaveMessage("Draft direset ke keadaan kosong.");
    setStepNotice(null);
    scrollToPageTop();
  }

  if (isHydrating) {
    return (
      <div className="glass-card text-on-surface-variant rounded-[1.5rem] p-6 text-sm">
        Memuat draft terakhir dari database...
      </div>
    );
  }

  if (form.currentStep === "landing") {
    return (
      <div className="space-y-8">
        <section className="glass-card rounded-[2rem] p-10">
          <div className="mx-auto max-w-4xl text-center">
            <div className="text-primary bg-primary-container/10 mb-4 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold tracking-[0.2em] uppercase">
              <Sparkles className="h-4 w-4" />
              PT BKI Tender Calculator
            </div>
            <h2 className="text-on-surface text-4xl font-bold tracking-tight">
              Rule-Based Parametric Calculator
            </h2>
            <p className="text-on-surface-variant mx-auto mt-4 max-w-2xl text-base">
              Mulai proyek baru untuk menghitung biaya langsung, overhead, profit, CGL, dan total
              harga akhir dengan flow tender yang lebih rapi dan siap dibandingkan dengan benchmark
              AI SVR.
            </p>
            <div className="mt-10 flex justify-center">
              <Button className="min-w-56" onClick={startNewProject}>
                <FolderPlus className="mr-2 h-4 w-4" />
                Add New Project
              </Button>
            </div>
            {latestDraft ? (
              <div className="mt-4 flex justify-center">
                <Button variant="outline" className="min-w-56" onClick={resumeLatestDraft}>
                  Continue Latest Draft
                </Button>
              </div>
            ) : null}
            {localRecovery ? (
              <div className="mt-4 flex justify-center">
                <Button variant="outline" className="min-w-56" onClick={resumeLocalRecovery}>
                  Resume Local Recovery
                </Button>
              </div>
            ) : null}
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <div className="glass-card rounded-[1.5rem] p-6">
            <div className="text-on-surface text-lg font-bold">Step 1</div>
            <div className="text-on-surface-variant mt-2 text-sm">
              Input seluruh direct cost dari proyek, tenaga kerja, mob demob, alat, dan material.
            </div>
          </div>
          <div className="glass-card rounded-[1.5rem] p-6">
            <div className="text-on-surface text-lg font-bold">Step 2-3</div>
            <div className="text-on-surface-variant mt-2 text-sm">
              Tambahkan overhead, profit, CGL, dan kontrol pembulatan final dengan validasi per
              step.
            </div>
          </div>
          <div className="glass-card rounded-[1.5rem] p-6">
            <div className="text-on-surface text-lg font-bold">Step 4</div>
            <div className="text-on-surface-variant mt-2 text-sm">
              Tinjau ringkasan invoice-style dan benchmark placeholder untuk integrasi SVR
              berikutnya.
            </div>
          </div>
        </section>
        {localRecovery ? (
          <section className="glass-card rounded-[1.5rem] p-6">
            <div className="text-on-surface text-lg font-bold">Local Recovery Tersedia</div>
            <div className="text-on-surface-variant mt-2 text-sm">
              Snapshot lokal terakhir tersimpan{" "}
              {new Date(localRecovery.savedAt).toLocaleString("id-ID")} dan bisa dipakai untuk
              melanjutkan input yang belum sempat masuk database.
            </div>
          </section>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="glass-card rounded-[2rem] p-6">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="space-y-2">
            <div className="text-primary flex items-center gap-2 text-sm font-semibold tracking-[0.2em] uppercase">
              <Sparkles className="h-4 w-4" />
              Rule-Based Parametric Calculator
            </div>
            <h2 className="text-on-surface text-3xl font-bold">
              Perhitungan Harga Penawaran Tender
            </h2>
            <p className="text-on-surface-variant max-w-3xl text-sm">
              Rule Based Calculator dibangun berdasarkan standar biaya INKINDO dan PMK 32/2025. Alur
              Perhitungan harga disesuaikan dengan proses bisnis tender PT BKI.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[340px]">
            <div className="glass-card-strong rounded-[1.5rem] p-4">
              <div className="text-on-surface-variant text-xs uppercase">
                Direct Cost Running Total
              </div>
              <div className="text-primary mt-2 text-2xl font-bold">
                {formatIdr(computed.summary.directCosts.directCostSubtotal)}
              </div>
            </div>
            <div className="glass-card-strong rounded-[1.5rem] p-4">
              <div className="text-on-surface-variant text-xs uppercase">Current Final Price</div>
              <div className="text-primary mt-2 text-2xl font-bold">
                {formatIdr(computed.summary.finalRoundedPrice)}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 grid gap-3 lg:grid-cols-4">
          {wizardSteps.map((step, index) => {
            const isActive = step.step === form.currentStep;
            const isCompleted = index < currentStepIndex;
            const isValid = validation.steps[step.step].isValid;
            const hasAttemptedValidation = attemptedStepValidation[step.step];
            const shouldShowNeedsFix = hasAttemptedValidation && !isValid;

            return (
              <button
                key={step.step}
                type="button"
                className={cn(
                  "rounded-2xl border p-4 text-left transition-all",
                  isActive
                    ? "border-primary/18 from-primary/8 bg-linear-to-br to-white/82 shadow-sm"
                    : "border-outline-variant/60 hover:bg-surface-container-low/90 bg-white/65",
                  isCompleted ? "ring-primary/15 ring-1" : ""
                )}
                onClick={() => updateCurrentStep(step.step)}
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-on-surface-variant text-xs uppercase">
                    Step {index + 1}
                  </span>
                  <span
                    className={cn(
                      "rounded-full px-2 py-1 text-[11px] font-semibold uppercase",
                      isActive
                        ? "bg-primary text-on-primary"
                        : isCompleted
                          ? "bg-secondary-fixed text-on-secondary-fixed"
                          : shouldShowNeedsFix
                            ? "bg-error text-white"
                            : "bg-surface-container text-on-surface-variant"
                    )}
                  >
                    {isActive
                      ? "Active"
                      : isCompleted
                        ? "Done"
                        : shouldShowNeedsFix
                          ? "Needs fix"
                          : "Ready"}
                  </span>
                </div>
                <div className="text-on-surface text-base font-bold">{step.title}</div>
                <div className="text-on-surface-variant mt-1 text-sm">{step.description}</div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="glass-card rounded-[2rem] p-6">
        <div className="mb-6 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-primary text-xs font-semibold tracking-[0.2em] uppercase">
              {currentStepMeta?.title}
            </div>
            <h3 className="text-on-surface mt-1 text-2xl font-bold">
              Step {(currentStepIndex ?? 0) + 1} of {wizardSteps.length}
            </h3>
          </div>
          <p className="text-on-surface-variant max-w-2xl text-sm">
            {currentStepMeta?.description}
          </p>
        </div>

        <div className="mb-6">
          <ValidationBanner
            title="Validasi Step Aktif"
            issues={visibleCurrentStepIssues}
            notice={stepNotice}
          />
        </div>

        {form.currentStep === "direct-costs" ? (
          <div className="space-y-6">
            <div className="grid gap-3 xl:grid-cols-5">
              {directCostSections.map((section) => (
                <SectionStatusCard
                  key={section.id}
                  title={section.title}
                  description={section.description}
                  issueCount={
                    shouldShowCurrentStepValidation
                      ? validation.sectionIssueCount[section.section]
                      : -1
                  }
                  onClick={() => {
                    document.getElementById(section.id)?.scrollIntoView({
                      behavior: "smooth",
                      block: "start",
                    });
                  }}
                />
              ))}
            </div>

            <section id="direct-project-info">
              <SectionValidationHint
                issues={visibleCurrentStepIssues.filter(
                  (issue) => issue.section === "project-info"
                )}
              />
              <div className="space-y-6">
                <ProjectDescription
                  value={form.directCosts.projectInfo}
                  onChange={setProjectInfo}
                  errors={{
                    projectName: getFirstIssueMessage(visibleCurrentStepIssues, "projectName"),
                    projectCategory: getFirstIssueMessage(
                      visibleCurrentStepIssues,
                      "projectCategory"
                    ),
                    projectLocation: getFirstIssueMessage(
                      visibleCurrentStepIssues,
                      "projectLocation"
                    ),
                    companyName: getFirstIssueMessage(visibleCurrentStepIssues, "companyName"),
                    companyCategory: getFirstIssueMessage(
                      visibleCurrentStepIssues,
                      "companyCategory"
                    ),
                    durationDays: getFirstIssueMessage(visibleCurrentStepIssues, "durationDays"),
                    workDate: getFirstIssueMessage(visibleCurrentStepIssues, "workDate"),
                  }}
                />
              </div>
            </section>

            <section id="direct-labor-costs">
              <SectionValidationHint
                issues={visibleCurrentStepIssues.filter((issue) => issue.section === "labor-costs")}
              />
              <LaborCosts
                items={form.directCosts.laborCosts}
                computedItems={computed.laborCosts}
                onAdd={() => {
                  setForm((current) => ({
                    ...current,
                    directCosts: {
                      ...current.directCosts,
                      laborCosts: [
                        ...current.directCosts.laborCosts,
                        createEmptyLaborItem(current.directCosts.laborCosts.length),
                      ],
                    },
                  }));
                }}
                onRemove={(id) => {
                  setForm((current) => ({
                    ...current,
                    directCosts: {
                      ...current.directCosts,
                      laborCosts:
                        current.directCosts.laborCosts.length > 1
                          ? current.directCosts.laborCosts.filter((item) => item.id !== id)
                          : current.directCosts.laborCosts,
                    },
                  }));
                }}
                onChange={setLaborItem}
                getError={(fieldPath) => getFirstIssueMessage(visibleCurrentStepIssues, fieldPath)}
              />
            </section>

            <section id="direct-mobility-costs">
              <SectionValidationHint
                issues={visibleCurrentStepIssues.filter(
                  (issue) => issue.section === "mobility-costs"
                )}
              />
              <MobDemob
                personnelDeployment={form.directCosts.mobilityCosts.personnelDeployment}
                equipmentHandling={form.directCosts.mobilityCosts.equipmentHandling}
                computed={computed.mobilityCosts}
                onChange={setMobilityItem}
                getError={(fieldPath) => getFirstIssueMessage(visibleCurrentStepIssues, fieldPath)}
              />
            </section>

            <section id="direct-equipment-costs">
              <SectionValidationHint
                issues={visibleCurrentStepIssues.filter(
                  (issue) => issue.section === "equipment-costs"
                )}
              />
              <EquipmentCosts
                items={form.directCosts.equipmentCosts}
                computedItems={computed.equipmentCosts}
                onAdd={() => {
                  setForm((current) => ({
                    ...current,
                    directCosts: {
                      ...current.directCosts,
                      equipmentCosts: [
                        ...current.directCosts.equipmentCosts,
                        createEmptyEquipmentItem(current.directCosts.equipmentCosts.length),
                      ],
                    },
                  }));
                }}
                onRemove={(id) => {
                  setForm((current) => ({
                    ...current,
                    directCosts: {
                      ...current.directCosts,
                      equipmentCosts:
                        current.directCosts.equipmentCosts.length > 1
                          ? current.directCosts.equipmentCosts.filter((item) => item.id !== id)
                          : current.directCosts.equipmentCosts,
                    },
                  }));
                }}
                onChange={setEquipmentItem}
                getError={(fieldPath) => getFirstIssueMessage(visibleCurrentStepIssues, fieldPath)}
              />
            </section>

            <section id="direct-supporting-costs">
              <SectionValidationHint
                issues={visibleCurrentStepIssues.filter(
                  (issue) => issue.section === "supporting-costs"
                )}
              />
              <OperationalCosts
                items={form.directCosts.supportingCosts}
                computedItems={computed.supportingCosts}
                onAdd={() => {
                  setForm((current) => ({
                    ...current,
                    directCosts: {
                      ...current.directCosts,
                      supportingCosts: [
                        ...current.directCosts.supportingCosts,
                        createEmptySupportingCost(
                          "other",
                          current.directCosts.supportingCosts.length
                        ),
                      ],
                    },
                  }));
                }}
                onChange={setSupportingItem}
                getError={(fieldPath) => getFirstIssueMessage(visibleCurrentStepIssues, fieldPath)}
              />
              <div className="mt-6 grid gap-4 md:grid-cols-3">
                <div className="glass-card-strong rounded-[1.5rem] p-5">
                  <div className="text-on-surface-variant text-xs uppercase">Total Personel</div>
                  <div className="text-on-surface mt-2 text-3xl font-bold">
                    {computed.summary.directCosts.totalPersonnel.toLocaleString("id-ID")}
                  </div>
                </div>
                <div className="glass-card-strong rounded-[1.5rem] p-5">
                  <div className="text-on-surface-variant text-xs uppercase">
                    Supporting Subtotal
                  </div>
                  <div className="text-on-surface mt-2 text-2xl font-bold">
                    {formatIdr(computed.summary.directCosts.supportingSubtotal)}
                  </div>
                </div>
                <div className="glass-card-strong rounded-[1.5rem] p-5">
                  <div className="text-on-surface-variant text-xs uppercase">
                    Direct Cost Subtotal
                  </div>
                  <div className="text-primary mt-2 text-2xl font-bold">
                    {formatIdr(computed.summary.directCosts.directCostSubtotal)}
                  </div>
                </div>
              </div>
            </section>
          </div>
        ) : null}

        {form.currentStep === "indirect-costs" ? (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="glass-card-strong rounded-[1.5rem] p-5">
                <div className="text-on-surface-variant text-xs uppercase">Validation Status</div>
                <div className="mt-2 flex items-center gap-2">
                  {currentStepNeedsAttention ? (
                    <AlertCircle className="text-error h-5 w-5" />
                  ) : currentStepValidation.isValid ? (
                    <CheckCircle2 className="text-primary h-5 w-5" />
                  ) : (
                    <CheckCircle2 className="text-on-surface-variant h-5 w-5" />
                  )}
                  <span className="text-on-surface font-semibold">
                    {currentStepNeedsAttention
                      ? `${visibleCurrentStepIssues.length} issue perlu dirapikan.`
                      : currentStepValidation.isValid
                        ? "Indirect cost input aman."
                        : "Isi field dulu. Validasi merah baru muncul saat menekan Next."}
                  </span>
                </div>
              </div>
              <div className="glass-card-strong rounded-[1.5rem] p-5">
                <div className="text-on-surface-variant text-xs uppercase">Direct Cost Basis</div>
                <div className="text-on-surface mt-2 text-xl font-bold">
                  {formatIdr(computed.summary.directCosts.directCostSubtotal)}
                </div>
              </div>
              <div className="glass-card-strong rounded-[1.5rem] p-5">
                <div className="text-on-surface-variant text-xs uppercase">Current Overhead</div>
                <div className="text-on-surface mt-2 text-xl font-bold">
                  {formatIdr(computed.summary.overheadAmount)}
                </div>
              </div>
            </div>
            <TaxMarginConfig
              mode="indirect-costs"
              directCostSubtotal={computed.summary.directCosts.directCostSubtotal}
              overheadPercentage={form.indirectCosts.overheadPercentage}
              errors={{
                overheadPercentage: getFirstIssueMessage(
                  visibleCurrentStepIssues,
                  "overheadPercentage"
                ),
              }}
              onOverheadPercentageChange={(value) => {
                setForm((current) => ({
                  ...current,
                  indirectCosts: {
                    ...current.indirectCosts,
                    overheadPercentage: value,
                  },
                }));
              }}
            />
          </div>
        ) : null}

        {form.currentStep === "profit-cgl" ? (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="glass-card-strong rounded-[1.5rem] p-5">
                <div className="text-on-surface-variant text-xs uppercase">Validation Status</div>
                <div className="mt-2 flex items-center gap-2">
                  {currentStepNeedsAttention ? (
                    <AlertCircle className="text-error h-5 w-5" />
                  ) : currentStepValidation.isValid ? (
                    <CheckCircle2 className="text-primary h-5 w-5" />
                  ) : (
                    <CheckCircle2 className="text-on-surface-variant h-5 w-5" />
                  )}
                  <span className="text-on-surface font-semibold">
                    {currentStepNeedsAttention
                      ? `${visibleCurrentStepIssues.length} issue perlu dirapikan.`
                      : currentStepValidation.isValid
                        ? "Profit & CGL input aman."
                        : "Isi field dulu. Validasi merah baru muncul saat menekan Next."}
                  </span>
                </div>
              </div>
              <div className="glass-card-strong rounded-[1.5rem] p-5">
                <div className="text-on-surface-variant text-xs uppercase">
                  Subtotal Before Profit
                </div>
                <div className="text-on-surface mt-2 text-xl font-bold">
                  {formatIdr(computed.summary.subtotalBeforeProfit)}
                </div>
              </div>
              <div className="glass-card-strong rounded-[1.5rem] p-5">
                <div className="text-on-surface-variant text-xs uppercase">Current Final Total</div>
                <div className="text-primary mt-2 text-xl font-bold">
                  {formatIdr(computed.summary.finalRoundedPrice)}
                </div>
              </div>
            </div>
            <TaxMarginConfig
              mode="profit-cgl"
              subtotalBeforeProfit={computed.summary.subtotalBeforeProfit}
              profitPercentage={form.profitAndCgl.profitPercentage}
              cglInsuranceNominal={form.profitAndCgl.cglInsuranceNominal}
              autoRoundFinalTotal={form.profitAndCgl.autoRoundFinalTotal}
              roundingIncrement={form.profitAndCgl.roundingIncrement}
              errors={{
                profitPercentage: getFirstIssueMessage(
                  visibleCurrentStepIssues,
                  "profitPercentage"
                ),
                cglInsuranceNominal: getFirstIssueMessage(
                  visibleCurrentStepIssues,
                  "cglInsuranceNominal"
                ),
                roundingIncrement: getFirstIssueMessage(
                  visibleCurrentStepIssues,
                  "roundingIncrement"
                ),
              }}
              onProfitPercentageChange={(value) => {
                setForm((current) => ({
                  ...current,
                  profitAndCgl: {
                    ...current.profitAndCgl,
                    profitPercentage: value,
                  },
                }));
              }}
              onCglInsuranceNominalChange={(value) => {
                setForm((current) => ({
                  ...current,
                  profitAndCgl: {
                    ...current.profitAndCgl,
                    cglInsuranceNominal: value,
                  },
                }));
              }}
              onAutoRoundFinalTotalChange={(value) => {
                setForm((current) => ({
                  ...current,
                  profitAndCgl: {
                    ...current.profitAndCgl,
                    autoRoundFinalTotal: value,
                  },
                }));
              }}
              onRoundingIncrementChange={(value) => {
                setForm((current) => ({
                  ...current,
                  profitAndCgl: {
                    ...current.profitAndCgl,
                    roundingIncrement: value,
                  },
                }));
              }}
            />
          </div>
        ) : null}

        {form.currentStep === "final-summary" ? (
          <EstimationSummary
            projectInfo={form.directCosts.projectInfo}
            computed={computed}
            hasSavedRecord={recordId !== null}
            isSaving={isSaving}
            isPredicting={isPredicting}
            lastSavedAt={lastSavedAt}
            saveMessage={saveMessage}
            onSave={() => {
              void saveTenderCalculation();
            }}
            onReset={resetDraft}
            onRefreshPrediction={() => {
              void refreshSvrPrediction();
            }}
          />
        ) : null}

        {form.currentStep !== "final-summary" ? (
          <div className="glass-card-strong mt-8 grid gap-4 rounded-[1.75rem] p-5 lg:grid-cols-4">
            <div>
              <div className="text-on-surface-variant text-xs uppercase">Direct Cost</div>
              <div className="text-on-surface mt-2 text-lg font-bold">
                {formatIdr(computed.summary.directCosts.directCostSubtotal)}
              </div>
            </div>
            <div>
              <div className="text-on-surface-variant text-xs uppercase">Overhead</div>
              <div className="text-on-surface mt-2 text-lg font-bold">
                {formatIdr(computed.summary.overheadAmount)}
              </div>
            </div>
            <div>
              <div className="text-on-surface-variant text-xs uppercase">Profit</div>
              <div className="text-on-surface mt-2 text-lg font-bold">
                {formatIdr(computed.summary.profitAmount)}
              </div>
            </div>
            <div>
              <div className="text-on-surface-variant text-xs uppercase">Current Final Total</div>
              <div className="text-primary mt-2 text-lg font-bold">
                {formatIdr(computed.summary.finalRoundedPrice)}
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div className="glass-card flex items-center justify-between rounded-[2rem] p-5">
        <Button
          variant="outline"
          className="min-w-36"
          onClick={() => moveStep("previous")}
          disabled={currentStepIndex === 0}
        >
          <ChevronLeft className="mr-2 h-4 w-4" />
          Previous
        </Button>

        <div className="text-on-surface-variant text-center text-sm">
          {currentStepIndex === wizardSteps.length - 1
            ? ""
            : currentStepNeedsAttention
              ? `Step ini masih memiliki ${visibleCurrentStepIssues.length} issue yang perlu dirapikan.`
              : currentStepValidation.isValid
                ? "Lanjut ke step berikutnya setelah input pada langkah ini benar."
                : ""}
        </div>

        <Button
          className="min-w-36"
          onClick={() => moveStep("next")}
          disabled={currentStepIndex === wizardSteps.length - 1}
        >
          Next
          <ChevronRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
