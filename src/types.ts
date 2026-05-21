export interface Category {
  id: number;
  name: string;
  description: string;
  materialCount?: number;
}

export interface Material {
  id: number;
  name: string;
  categoryId: number;
  categoryName?: string;
  unit: string;
  unitPrice: number;
  onHand: number;
  stockValue: number;
}

export interface MaterialDetail {
  id: number;
  name: string;
  categoryId: number;
  categoryName: string;
  unit: string;
  unitPrice: number;
  onHand: number;
  stockValue: number;
  recentBatches: StockBatch[];
}

export interface StockBatch {
  batchId: number;
  materialId: number;
  quantityReceived: number;
  costTotal: number;
  expiryDate?: string;
  receivedAt: string;
}

export interface DashboardStats {
  totalMaterials: number;
  totalCategories: number;
  totalStockValue: number;
  lowStockCount: number;
}

export type ViewState = 
  | { type: "dashboard" }
  | { type: "materials" }
  | { type: "material-new" }
  | { type: "material-edit"; id: number }
  | { type: "material-detail"; id: number }
  | { type: "material-receive"; id: number }
  | { type: "categories" };
