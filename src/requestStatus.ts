export type RequestStatusKey =
  | "Submitted"
  | "Approved"
  | "ReadyForPickup"
  | "Issued"
  | "Cancelled";

const STATUS_BY_NUMBER: Record<number, RequestStatusKey> = {
  0: "Submitted",
  1: "Approved",
  2: "ReadyForPickup",
  3: "Issued",
  4: "Cancelled",
};

const STATUS_LABELS: Record<RequestStatusKey, string> = {
  Submitted: "Submitted",
  Approved: "Approved",
  ReadyForPickup: "Ready for pickup",
  Issued: "Issued",
  Cancelled: "Cancelled",
};

/** API may return enum as number (0–4) or string name. */
export function normalizeRequestStatus(status: string | number): RequestStatusKey {
  if (typeof status === "number") {
    return STATUS_BY_NUMBER[status] ?? "Submitted";
  }
  const trimmed = String(status).trim();
  if (/^\d+$/.test(trimmed)) {
    return STATUS_BY_NUMBER[Number(trimmed)] ?? "Submitted";
  }
  if (trimmed in STATUS_LABELS) {
    return trimmed as RequestStatusKey;
  }
  return "Submitted";
}

export function requestStatusLabel(status: string | number): string {
  return STATUS_LABELS[normalizeRequestStatus(status)];
}
