import {
  Category,
  Material,
  MaterialDetail,
  StockBatch,
  DashboardStats,
  AuthSession,
  MaterialRequest,
  Alert,
  Shop,
} from "./types";
import { normalizeRequestStatus } from "./requestStatus";

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

function getToken(): string | null {
  return sessionStorage.getItem("authToken");
}

let onUnauthorized: (() => void) | null = null;

/** Called when API returns 401 — typically expired or missing JWT. */
export function setOnUnauthorized(handler: (() => void) | null) {
  onUnauthorized = handler;
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options?.headers as Record<string, string> | undefined),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(url, { ...options, headers });
  if (response.status === 401) {
    sessionStorage.removeItem("authToken");
    sessionStorage.removeItem("authRole");
    sessionStorage.removeItem("authEmail");
    sessionStorage.removeItem("authShopId");
    onUnauthorized?.();
  }
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
    partNumber: raw.partNumber ?? "",
    name: raw.name,
    description: raw.description,
    aircraftTypes: raw.aircraftTypes,
    categoryId: raw.categoryId,
    categoryName: raw.categoryName,
    unit: raw.unit,
    unitPrice: raw.unitPrice,
    minStock: raw.minStock,
    onHand: raw.onHand ?? 0,
    blocked: raw.blocked,
    reserved: raw.reserved,
    available: raw.available ?? raw.onHand ?? 0,
    stockValue: raw.stockValue ?? 0,
    reorderPlaced: raw.reorderPlaced ?? false,
    reorderNote: raw.reorderNote,
    defaultShopId: raw.defaultShopId,
  };
}

function adaptShop(raw: any): Shop {
  return {
    id: raw.shopId ?? raw.id,
    name: raw.name,
    location: raw.location,
  };
}

function adaptMaterialDetail(raw: any): MaterialDetail {
  return {
    id: raw.materialId ?? raw.id,
    partNumber: raw.partNumber ?? "",
    name: raw.name,
    description: raw.description,
    aircraftTypes: raw.aircraftTypes,
    categoryId: raw.categoryId,
    categoryName: raw.categoryName ?? "",
    unit: raw.unit,
    unitPrice: raw.unitPrice,
    minStock: raw.minStock,
    onHand: raw.onHand ?? 0,
    blocked: raw.blocked,
    reserved: raw.reserved,
    available: raw.available ?? raw.onHand ?? 0,
    stockValue: raw.stockValue ?? 0,
    recentBatches: (raw.recentBatches ?? []).map(adaptBatch),
  };
}

function adaptBatch(raw: any): StockBatch {
  return {
    batchId: raw.batchId,
    materialId: raw.materialId,
    shopId: raw.shopId,
    quantityReceived: raw.quantityReceived,
    costTotal: raw.costTotal,
    expiryDate: raw.expiryDate,
    receivedAt: raw.receivedAt,
    status: raw.status,
    quarantineReason: raw.quarantineReason,
  };
}

function adaptRequest(raw: any): MaterialRequest {
  return {
    requestId: raw.requestId,
    materialId: raw.materialId,
    materialName: raw.materialName,
    partNumber: raw.partNumber,
    shopId: raw.shopId,
    shopName: raw.shopName,
    requestedByUserId: raw.requestedByUserId,
    requestedByName: raw.requestedByName,
    quantity: raw.quantity,
    aircraftOrWorkOrder: raw.aircraftOrWorkOrder,
    status: normalizeRequestStatus(raw.status),
    notes: raw.notes,
    createdAt: raw.createdAt,
  };
}

export const api = {
  login: async (email: string, password: string): Promise<AuthSession> => {
    const res = await request<any>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    const session: AuthSession = {
      token: res.token,
      email: res.email,
      role: res.role,
      shopId: res.shopId,
    };
    sessionStorage.setItem("authToken", session.token);
    sessionStorage.setItem("authRole", session.role);
    sessionStorage.setItem("authEmail", session.email);
    if (session.shopId) sessionStorage.setItem("authShopId", String(session.shopId));
    return session;
  },

  logout: () => {
    sessionStorage.removeItem("authToken");
    sessionStorage.removeItem("authRole");
    sessionStorage.removeItem("authEmail");
    sessionStorage.removeItem("authShopId");
  },

  getSession: (): AuthSession | null => {
    const token = sessionStorage.getItem("authToken");
    if (!token) return null;
    return {
      token,
      email: sessionStorage.getItem("authEmail") ?? "",
      role: sessionStorage.getItem("authRole") ?? "",
      shopId: sessionStorage.getItem("authShopId")
        ? parseInt(sessionStorage.getItem("authShopId")!, 10)
        : undefined,
    };
  },

  getShops: () => request<any[]>("/api/shops").then((items) => items.map(adaptShop)),

  getCategories: () => request<any[]>("/api/categories").then((items) => items.map(adaptCategory)),
  getCategory: (id: number) => request<any>(`/api/categories/${id}`).then(adaptCategory),
  createCategory: (data: Partial<Category>) =>
    request<any>("/api/categories", { method: "POST", body: JSON.stringify(data) }).then(adaptCategory),
  updateCategory: (id: number, data: Partial<Category>) =>
    request<any>(`/api/categories/${id}`, { method: "PUT", body: JSON.stringify(data) }).then(adaptCategory),
  deleteCategory: (id: number) => request<void>(`/api/categories/${id}`, { method: "DELETE" }),

  getMaterials: (shopId?: number) => {
    const q = shopId ? `?shopId=${shopId}` : "";
    return request<any[]>(`/api/materials${q}`).then((items) => items.map(adaptMaterial));
  },

  searchMaterials: (params: { partNumber?: string; aircraft?: string; q?: string; shopId?: number }) => {
    const search = new URLSearchParams();
    if (params.partNumber) search.set("partNumber", params.partNumber);
    if (params.aircraft) search.set("aircraft", params.aircraft);
    if (params.q) search.set("q", params.q);
    if (params.shopId) search.set("shopId", String(params.shopId));
    return request<any[]>(`/api/materials/search?${search}`).then((items) => items.map(adaptMaterial));
  },

  getMaterial: (id: number, shopId?: number) => {
    const q = shopId ? `?shopId=${shopId}` : "";
    return request<any>(`/api/materials/${id}${q}`).then(adaptMaterialDetail);
  },

  getInventory: (id: number, shopId?: number) => {
    const q = shopId ? `?shopId=${shopId}` : "";
    return request<{ materialId: number; onHand: number; available: number; stockValue: number }>(
      `/api/materials/${id}/inventory${q}`
    );
  },

  createMaterial: (data: {
    partNumber: string;
    name: string;
    categoryId: number;
    unit: string;
    unitPrice: number;
    description?: string;
    aircraftTypes?: string;
    minStock?: number;
    defaultShopId?: number;
  }) => request<any>("/api/materials", { method: "POST", body: JSON.stringify(data) }).then(adaptMaterialDetail),

  updateMaterial: (
    id: number,
    data: {
      partNumber: string;
      name: string;
      categoryId: number;
      unit: string;
      unitPrice: number;
      description?: string;
      aircraftTypes?: string;
      minStock?: number;
      defaultShopId?: number;
    }
  ) => request<any>(`/api/materials/${id}`, { method: "PUT", body: JSON.stringify(data) }).then(adaptMaterialDetail),

  deleteMaterial: (id: number) => request<void>(`/api/materials/${id}`, { method: "DELETE" }),

  getBatches: (materialId: number) =>
    request<any[]>(`/api/materials/${materialId}/batches`).then((items) => items.map(adaptBatch)),

  receiveStock: (
    materialId: number,
    data: { quantityReceived: number; costTotal: number; expiryDate?: string; receivedAt: string; shopId?: number }
  ) =>
    request<any>(`/api/materials/${materialId}/batches`, {
      method: "POST",
      body: JSON.stringify(data),
    }).then(adaptBatch),

  deleteBatch: (materialId: number, batchId: number) =>
    request<void>(`/api/materials/${materialId}/batches/${batchId}`, { method: "DELETE" }),

  getDashboardStats: () => request<DashboardStats>("/api/dashboard"),

  getMaterialRequests: (shopId?: number, status?: string) => {
    const search = new URLSearchParams();
    if (shopId) search.set("shopId", String(shopId));
    if (status) search.set("status", status);
    const q = search.toString() ? `?${search}` : "";
    return request<any[]>(`/api/materialrequests${q}`).then((items) => items.map(adaptRequest));
  },

  submitMaterialRequest: (data: {
    materialId: number;
    shopId: number;
    quantity: number;
    aircraftOrWorkOrder: string;
    notes?: string;
  }) =>
    request<any>("/api/materialrequests", { method: "POST", body: JSON.stringify(data) }).then(adaptRequest),

  releaseRequest: (id: number) =>
    request<any>(`/api/materialrequests/${id}/release`, { method: "PATCH" }).then(adaptRequest),

  issueRequest: (id: number, collectedByUserId: number, flightNumber?: string) =>
    request<any>(`/api/materialrequests/${id}/issue`, {
      method: "PATCH",
      body: JSON.stringify({ collectedByUserId, flightNumber }),
    }).then(adaptRequest),

  cancelRequest: (id: number, notes?: string) =>
    request<any>(`/api/materialrequests/${id}/cancel`, {
      method: "PATCH",
      body: JSON.stringify({ notes }),
    }).then(adaptRequest),

  getAlerts: () => request<any[]>("/api/alerts").then((items) => items as Alert[]),

  resolveAlert: (id: number, note: string) =>
    request<void>(`/api/alerts/${id}/resolve`, {
      method: "PATCH",
      body: JSON.stringify({ resolvedNote: note, resolvedBy: 1 }),
    }),

  recordReturn: (data: {
    materialId: number;
    shopId: number;
    quantity: number;
    remarks: string;
    usageId?: number;
    batchId?: number;
  }) => request<any>("/api/materialreturns", { method: "POST", body: JSON.stringify(data) }),

  getProcurementActions: (shopId?: number) => {
    const q = shopId ? `?shopId=${shopId}` : "";
    return request<any[]>(`/api/procurement/actions${q}`);
  },

  markReorder: (materialId: number, reorderNote?: string) =>
    request<void>(`/api/procurement/materials/${materialId}/reorder`, {
      method: "PATCH",
      body: JSON.stringify({ reorderNote }),
    }),
};
