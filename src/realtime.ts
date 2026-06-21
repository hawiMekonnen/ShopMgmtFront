import * as signalR from "@microsoft/signalr";
import type { Alert } from "./types";

export type NewMaterialPayload = {
  materialId: number;
  name: string;
  partNumber?: string;
};

export type RealtimeHandlers = {
  onAlertCreated?: (alert: Alert) => void;
  onNewMaterial?: (payload: NewMaterialPayload) => void;
};

let connection: signalR.HubConnection | null = null;

function adaptAlert(raw: Record<string, unknown>): Alert {
  return {
    alertId: (raw.alertId as number) ?? 0,
    materialId: (raw.materialId as number) ?? 0,
    materialName: (raw.materialName as string) ?? "",
    type: (raw.type as string) ?? "",
    currentQuantity: (raw.currentQuantity as number) ?? 0,
    threshold: (raw.threshold as number) ?? 0,
    triggeredAt: (raw.triggeredAt as string) ?? "",
    requestId: raw.requestId as number | undefined,
    createdBy: raw.createdBy as number | undefined,
    requestShopId: raw.requestShopId as number | undefined,
    note: (raw.note as string) ?? undefined,
    createdAt: (raw.createdAt as string) ?? undefined,
  };
}

export async function startRealtimeHub(token: string, handlers: RealtimeHandlers): Promise<void> {
  await stopRealtimeHub();

  connection = new signalR.HubConnectionBuilder()
    .withUrl(`/shopMgmtHub?access_token=${encodeURIComponent(token)}`)
    .withAutomaticReconnect()
    .build();

  connection.on("AlertCreated", (payload: Record<string, unknown>) => {
    handlers.onAlertCreated?.(adaptAlert(payload));
  });

  connection.on("NewMaterialAdded", (payload: Record<string, unknown>) => {
    const materialId = (payload.materialId as number) ?? 0;
    const name = (payload.name as string) ?? "New material";
    const partNumber = payload.partNumber as string | undefined;
    handlers.onNewMaterial?.({ materialId, name, partNumber });
  });

  await connection.start();
}

export async function stopRealtimeHub(): Promise<void> {
  if (connection) {
    try {
      await connection.stop();
    } catch {
      // ignore disconnect errors
    }
    connection = null;
  }
}

/** Alert types relevant per role for badge counts and technician inbox. */
export function filterAlertsForRole(alerts: Alert[], role: string, userId?: number, shopId?: number): Alert[] {
  const normalized = role.trim();
  return alerts.filter((a) => {
    if (a.type === "PickupReady") {
      if (normalized === "Admin" || normalized === "Procurement") {
        return false;
      }
      if (normalized === "Employee" || normalized === "Technician") {
        return a.createdBy === userId;
      }
      if (normalized === "Manager" || normalized === "ShopManager") {
        return a.createdBy === userId || (shopId !== undefined && a.requestShopId === shopId);
      }
    }
    if (normalized === "Technician" && a.type === "NewMaterialAdded") {
      return false;
    }
    return true;
  });
}

export function alertTypeLabel(type: string): string {
  switch (type) {
    case "LowStock":
      return "Low stock";
    case "ExpiryWarning":
      return "Expiry warning";
    case "PickupReady":
      return "Ready for pickup";
    case "QuarantineReview":
      return "Quarantine review";
    case "NewMaterialAdded":
      return "New material";
    case "RequestEdited":
      return "Request edited";
    default:
      return type;
  }
}
