import type { RequestStatusKey } from "./requestStatus";

export interface Shop {
  id: number;
  name: string;
  location?: string;
}

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
  reorderPlaced?: boolean;
  reorderNote?: string;
  defaultShopId?: number;
  hiddenFromTechnicians?: boolean;
  isOrderable?: boolean;
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
  userId?: number;
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

export interface UserAccount {
  userId: number;
  name: string;
  email: string;
  role: string;
  shopId?: number;
}

export interface ProcurementPurchase {
  batchId: number;
  materialId: number;
  materialName: string;
  partNumber: string;
  shopId?: number;
  shopName: string;
  quantityReceived: number;
  unitPrice: number;
  costTotal: number;
  unit: string;
  receivedAt: string;
}

export interface ProcurementBudgetReport {
  totalSpent: number;
  monthlySpent: number;
  totalQuantityPurchased: number;
  byShop: { shopId?: number; shopName: string; totalSpent: number; totalQuantity: number }[];
  purchases: ProcurementPurchase[];
}

export interface Alert {
  alertId: number;
  materialId: number;
  materialName: string;
  type: string;
  currentQuantity: number;
  threshold?: number;
  triggeredAt?: string;
  requestId?: number;
  note?: string;
  createdAt?: string;
}

export type ViewState =
  | { type: "dashboard" }
  | { type: "materials" }
  | { type: "material-search" }
  | { type: "material-requests" }
  | { type: "team" }
  | { type: "alerts" }
  | { type: "procurement" }
  | { type: "stock-by-shop" }
  | { type: "material-new" }
  | { type: "material-edit"; id: number }
  | { type: "material-detail"; id: number }
  | { type: "material-receive"; id: number }
  | { type: "categories" };
