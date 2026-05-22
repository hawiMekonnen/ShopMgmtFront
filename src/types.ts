import type { RequestStatusKey } from "./requestStatus";

export interface Category {
  id: number;
  name: string;
  description: string;
  materialCount?: number;
}

export interface Material {
  id: number;
  partNumber: string;
  name: string;
  description?: string;
  aircraftTypes?: string;
  categoryId: number;
  categoryName?: string;
  unit: string;
  unitPrice: number;
  minStock?: number;
  onHand: number;
  blocked?: number;
  reserved?: number;
  available: number;
  stockValue: number;
}

export interface MaterialDetail {
  id: number;
  partNumber: string;
  name: string;
  description?: string;
  aircraftTypes?: string;
  categoryId: number;
  categoryName: string;
  unit: string;
  unitPrice: number;
  minStock?: number;
  onHand: number;
  blocked?: number;
  reserved?: number;
  available: number;
  stockValue: number;
  recentBatches: StockBatch[];
}

export interface StockBatch {
  batchId: number;
  materialId: number;
  shopId?: number;
  quantityReceived: number;
  costTotal: number;
  expiryDate?: string;
  receivedAt: string;
  status?: string;
  quarantineReason?: string;
}

export interface DashboardStats {
  totalMaterials: number;
  totalCategories: number;
  totalStockValue: number;
  lowStockCount: number;
}

export interface AuthSession {
  token: string;
  email: string;
  role: string;
  shopId?: number;
}

export interface MaterialRequest {
  requestId: number;
  materialId: number;
  materialName: string;
  partNumber: string;
  shopId: number;
  shopName: string;
  requestedByUserId: number;
  requestedByName: string;
  quantity: number;
  aircraftOrWorkOrder?: string;
  status: RequestStatusKey;
  notes?: string;
  createdAt: string;
}

export interface Alert {
  alertId: number;
  materialId: number;
  materialName: string;
  type: string;
  currentQuantity: number;
  requestId?: number;
}

export type ViewState =
  | { type: "dashboard" }
  | { type: "materials" }
  | { type: "material-search" }
  | { type: "material-requests" }
  | { type: "alerts" }
  | { type: "procurement" }
  | { type: "material-new" }
  | { type: "material-edit"; id: number }
  | { type: "material-detail"; id: number }
  | { type: "material-receive"; id: number }
  | { type: "categories" };
