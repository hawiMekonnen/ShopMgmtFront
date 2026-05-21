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
      // Fallback
    }

    throw new ApiError(response.status, title, detail, errors);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json() as Promise<T>;
}

export const api = {
  // Categories
  getCategories: () => request<Category[]>("/api/categories"),
  getCategory: (id: number) => request<Category>(`/api/categories/${id}`),
  createCategory: (data: Partial<Category>) =>
    request<Category>("/api/categories", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateCategory: (id: number, data: Partial<Category>) =>
    request<Category>(`/api/categories/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteCategory: (id: number) =>
    request<void>(`/api/categories/${id}`, { method: "DELETE" }),

  // Materials
  getMaterials: () => request<Material[]>("/api/materials"),
  getMaterial: (id: number) => request<MaterialDetail>(`/api/materials/${id}`),
  getInventory: (id: number) =>
    request<{ materialId: number; onHand: number; stockValue: number }>(
      `/api/materials/${id}/inventory`
    ),
  createMaterial: (data: { name: string; categoryId: number; unit: string; unitPrice: number }) =>
    request<Material>("/api/materials", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateMaterial: (
    id: number,
    data: { name: string; categoryId: number; unit: string; unitPrice: number }
  ) =>
    request<Material>(`/api/materials/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteMaterial: (id: number) =>
    request<void>(`/api/materials/${id}`, { method: "DELETE" }),

  // Stock Batches
  getBatches: (materialId: number) =>
    request<StockBatch[]>(`/api/materials/${materialId}/batches`),
  receiveStock: (
    materialId: number,
    data: { quantityReceived: number; costTotal: number; expiryDate?: string; receivedAt: string }
  ) =>
    request<StockBatch>(`/api/materials/${materialId}/batches`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  deleteBatch: (materialId: number, batchId: number) =>
    request<void>(`/api/materials/${materialId}/batches/${batchId}`, {
      method: "DELETE",
    }),

  // Dashboard Stats
  getDashboardStats: () => request<DashboardStats>("/api/dashboard"),
};
