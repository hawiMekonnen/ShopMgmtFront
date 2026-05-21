import { Category, Material, MaterialDetail, StockBatch, DashboardStats } from "./types";

export class ApiError extends Error {
  status: number;
  title: string;
  errors?: Record<string, string[]>;
  detail?: string;

  constructor(status: number, title: string, detail?: string, errors?: Record<string, string[]>) {
    super(detail || title);
    this.name = "ApiError";
    this.status = status;
    this.title = title;
    this.detail = detail;
    this.errors = errors;
  }
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const headers = {
    "Content-Type": "application/json",
    ...(options?.headers || {}),
  };
  const response = await fetch(url, { ...options, headers });
  if (!response.ok) {
    let title = "API Error";
    let detail = "An unknown error has occurred.";
    let errors: Record<string, string[]> | undefined;
    try {
      const errorJson = await response.json();
      title = errorJson.title || title;
      detail = errorJson.detail || errorJson.message || detail;
      errors = errorJson.errors;
    } catch {
      // ignore parse errors
    }
    throw new ApiError(response.status, title, detail, errors);
  }
  if (response.status === 204) {
    return {} as T;
  }
  return response.json() as Promise<T>;
}

// -------------------------------------------------------
// Adapters: map C# PascalCase primary keys to frontend `id`
// -------------------------------------------------------
function adaptCategory(raw: any): Category {
  return {
    id: raw.categoryId ?? raw.id,
    name: raw.name,
    description: raw.description ?? "",
    materialCount: raw.materialCount,
  };
}
function adaptMaterial(raw: any): Material {
  return {
    id: raw.materialId ?? raw.id,
    name: raw.name,
    categoryId: raw.categoryId,
    categoryName: raw.categoryName,
    unit: raw.unit,
    unitPrice: raw.unitPrice,
    onHand: raw.onHand ?? 0,
    stockValue: raw.stockValue ?? 0,
  };
}
function adaptMaterialDetail(raw: any): MaterialDetail {
  return {
    id: raw.materialId ?? raw.id,
    name: raw.name,
    categoryId: raw.categoryId,
    categoryName: raw.categoryName ?? "",
    unit: raw.unit,
    unitPrice: raw.unitPrice,
    onHand: raw.onHand ?? 0,
    stockValue: raw.stockValue ?? 0,
    recentBatches: (raw.recentBatches ?? []).map(adaptBatch),
  };
}
function adaptBatch(raw: any): StockBatch {
  return {
    batchId: raw.batchId,
    materialId: raw.materialId,
    quantityReceived: raw.quantityReceived,
    costTotal: raw.costTotal,
    expiryDate: raw.expiryDate,
    receivedAt: raw.receivedAt,
  };
}

export const api = {
  // Categories
  getCategories: () => request<any[]>("/api/categories").then(items => items.map(adaptCategory)),
  getCategory: (id: number) => request<any>(`/api/categories/${id}`).then(adaptCategory),
  createCategory: (data: Partial<Category>) => request<any>("/api/categories", { method: "POST", body: JSON.stringify(data) }).then(adaptCategory),
  updateCategory: (id: number, data: Partial<Category>) => request<any>(`/api/categories/${id}`, { method: "PUT", body: JSON.stringify(data) }).then(adaptCategory),
  deleteCategory: (id: number) => request<void>(`/api/categories/${id}`, { method: "DELETE" }),

  // Materials
  getMaterials: () => request<any[]>("/api/materials").then(items => items.map(adaptMaterial)),
  getMaterial: (id: number) => request<any>(`/api/materials/${id}`).then(adaptMaterialDetail),
  getInventory: (id: number) => request<{ materialId: number; onHand: number; stockValue: number }>(`/api/materials/${id}/inventory`),
  createMaterial: (data: { name: string; categoryId: number; unit: string; unitPrice: number }) => request<any>("/api/materials", { method: "POST", body: JSON.stringify(data) }).then(adaptMaterialDetail),
  updateMaterial: (id: number, data: { name: string; categoryId: number; unit: string; unitPrice: number }) => request<any>(`/api/materials/${id}`, { method: "PUT", body: JSON.stringify(data) }).then(adaptMaterialDetail),
  deleteMaterial: (id: number) => request<void>(`/api/materials/${id}`, { method: "DELETE" }),

  // Stock Batches
  getBatches: (materialId: number) => request<any[]>(`/api/materials/${materialId}/batches`).then(items => items.map(adaptBatch)),
  receiveStock: (materialId: number, data: { quantityReceived: number; costTotal: number; expiryDate?: string; receivedAt: string }) => request<any>(`/api/materials/${materialId}/batches`, { method: "POST", body: JSON.stringify(data) }).then(adaptBatch),
  deleteBatch: (materialId: number, batchId: number) => request<void>(`/api/materials/${materialId}/batches/${batchId}`, { method: "DELETE" }),

  // Dashboard
  getDashboardStats: () => request<DashboardStats>("/api/dashboard"),
};
