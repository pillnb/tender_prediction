const rupiahFormatter = new Intl.NumberFormat("id-ID");

export function formatIdr(value: number | null | undefined) {
  const safeValue = typeof value === "number" && Number.isFinite(value) ? value : 0;

  return `IDR ${rupiahFormatter.format(safeValue)}`;
}

export function formatNumberInput(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "";
  }

  return rupiahFormatter.format(value);
}

export function parseNumberInput(value: string) {
  const digits = value.replace(/[^\d]/g, "");

  return digits ? Number(digits) : 0;
}

export function parseNullableNumberInput(value: string) {
  const digits = value.replace(/[^\d]/g, "");

  return digits ? Number(digits) : null;
}

export function parseNullableFloatInput(value: string) {
  if (!value.trim()) {
    return null;
  }

  const parsed = Number.parseFloat(value);

  return Number.isNaN(parsed) ? null : parsed;
}
