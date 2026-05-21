import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

// Types matching the specified DTO layouts
interface Category {
  id: number;
  name: string;
  description: string;
}

interface Material {
  id: number;
  name: string;
  categoryId: number;
  unit: string;
  unitPrice: number;
}

interface StockBatch {
  batchId: number;
  materialId: number;
  quantityReceived: number;
  costTotal: number;
  expiryDate?: string;
  receivedAt: string;
}

// In-Memory Database store with real initial Ethiopian Airlines maintenance and cabin stock data
let categories: Category[] = [
  { id: 1, name: "Aircraft Lubricants", description: "Engine oils, hydraulic fluids, and landing gear lubricants." },
  { id: 2, name: "Cabin Amenities", description: "Bespoke passenger blanket kits, headrest covers, and comfort kits." },
  { id: 3, name: "Avionics & Spares", description: "Circuit boards, sensors, cabling bundles, and backup systems." }
];

let materials: Material[] = [
  { id: 1, name: "Mobil Jet Oil II", categoryId: 1, unit: "L", unitPrice: 420.50 },
  { id: 2, name: "Premium Comfort Blanket Packs", categoryId: 2, unit: "ea", unitPrice: 150.00 },
  { id: 3, name: "Temp-Pressure Sensor-TS3", categoryId: 3, unit: "ea", unitPrice: 2450.00 }
];

let batches: StockBatch[] = [
  { batchId: 101, materialId: 1, quantityReceived: 120, costTotal: 50460.00, expiryDate: "2028-12-31", receivedAt: "2026-05-10T08:30:00Z" },
  { batchId: 102, materialId: 1, quantityReceived: 80, costTotal: 33640.00, expiryDate: "2029-06-30", receivedAt: "2026-05-18T14:15:00Z" },
  { batchId: 103, materialId: 2, quantityReceived: 500, costTotal: 75000.00, expiryDate: undefined, receivedAt: "2026-05-15T11:00:00Z" },
  { batchId: 104, materialId: 3, quantityReceived: 15, costTotal: 36750.00, expiryDate: "2030-01-01", receivedAt: "2026-05-01T10:00:00Z" }
];

// Helper to calculate total on-hand quantity for a material
function getOnHand(materialId: number): number {
  return batches
    .filter((b) => b.materialId === materialId)
    .reduce((sum, b) => sum + b.quantityReceived, 0);
}

// Track mock deleted or usage constraints
// To simulate "usages exist" for some items if required
const materialsWithUsageMockIds = new Set<number>([3]); // Let's mock material 3 as having active maintenance usage records

async function main() {
  const app = express();
  app.use(express.json());

  // --- API ROUTE INTERCEPTORS & ENDPOINTS ---

  // Dashboard endpoint (Optional v1, lightweight landing stats)
  app.get("/api/dashboard", (req, res) => {
    const totalMaterials = materials.length;
    const totalCategories = categories.length;
    
    // Live compute of aggregate metrics
    const totalStockValue = materials.reduce((sum, mat) => {
      const onHand = getOnHand(mat.id);
      return sum + onHand * mat.unitPrice;
    }, 0);

    const lowStockCount = materials.filter(mat => {
      const onHand = getOnHand(mat.id);
      return onHand < 10;
    }).length;

    res.json({
      totalMaterials,
      totalCategories,
      totalStockValue,
      lowStockCount
    });
  });

  // --- CATEGORIES ENDPOINTS ---

  // List categories
  app.get("/api/categories", (req, res) => {
    const response = categories.map((cat) => {
      const count = materials.filter((m) => m.categoryId === cat.id).length;
      return {
        ...cat,
        materialCount: count
      };
    });
    res.json(response);
  });

  // Get single category
  app.get("/api/categories/:id", (req, res) => {
    const id = parseInt(req.params.id);
    const cat = categories.find((c) => c.id === id);
    if (!cat) {
      return res.status(404).json({
        title: "Category Not Found",
        status: 404,
        detail: `Category with ID ${id} was not found in the registers.`
      });
    }
    const count = materials.filter((m) => m.categoryId === cat.id).length;
    res.json({ ...cat, materialCount: count });
  });

  // Create category
  app.post("/api/categories", (req, res) => {
    const { name, description } = req.body;
    
    // Validations
    const errors: Record<string, string[]> = {};
    if (!name || !name.trim()) {
      errors["Name"] = ["The Category Name is required."];
    } else if (name.length > 200) {
      errors["Name"] = ["The Category Name must be 200 characters or fewer."];
    }
    if (description && description.length > 500) {
      errors["Description"] = ["The Category Description must be 500 characters or fewer."];
    }

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({
        title: "One or more validation errors occurred.",
        status: 400,
        errors
      });
    }

    // Duplicate search
    const exists = categories.some((c) => c.name.toLowerCase() === name.trim().toLowerCase());
    if (exists) {
      return res.status(409).json({
        title: "Duplicate Category Name",
        status: 409,
        detail: `A category named '${name.trim()}' already exists. Please choose a unique name.`
      });
    }

    const newId = categories.length > 0 ? Math.max(...categories.map((c) => c.id)) + 1 : 1;
    const newCategory: Category = {
      id: newId,
      name: name.trim(),
      description: (description || "").trim()
    };
    categories.push(newCategory);
    res.status(201).json(newCategory);
  });

  // Update category
  app.put("/api/categories/:id", (req, res) => {
    const id = parseInt(req.params.id);
    const index = categories.findIndex((c) => c.id === id);
    if (index === -1) {
      return res.status(404).json({
        title: "Category Not Found",
        status: 404,
        detail: `Category with ID ${id} was not found.`
      });
    }

    const { name, description } = req.body;
    const errors: Record<string, string[]> = {};
    if (!name || !name.trim()) {
      errors["Name"] = ["The Category Name is required."];
    } else if (name.length > 200) {
      errors["Name"] = ["The Category Name must be 200 characters or fewer."];
    }
    if (description && description.length > 500) {
      errors["Description"] = ["The Category Description must be 500 characters or fewer."];
    }

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({
        title: "One or more validation errors occurred.",
        status: 400,
        errors
      });
    }

    // Duplicate search (excluding self)
    const exists = categories.some(
      (c) => c.id !== id && c.name.toLowerCase() === name.trim().toLowerCase()
    );
    if (exists) {
      return res.status(409).json({
        title: "Duplicate Category Name",
        status: 409,
        detail: `A category named '${name.trim()}' already exists in another record.`
      });
    }

    categories[index] = {
      id,
      name: name.trim(),
      description: (description || "").trim()
    };
    res.json(categories[index]);
  });

  // Delete category
  app.delete("/api/categories/:id", (req, res) => {
    const id = parseInt(req.params.id);
    const index = categories.findIndex((c) => c.id === id);
    if (index === -1) {
      return res.status(404).json({
        title: "Category Not Found",
        status: 404,
        detail: `Category with ID ${id} was not found.`
      });
    }

    // 409 if materialCount > 0
    const materialCount = materials.filter((m) => m.categoryId === id).length;
    if (materialCount > 0) {
      return res.status(409).json({
        title: "Category In Use",
        status: 409,
        detail: `Cannot delete: category has ${materialCount} materials associated with it. Please reassign or delete those materials first.`
      });
    }

    categories.splice(index, 1);
    res.status(204).end();
  });


  // --- MATERIALS ENDPOINTS ---

  // List materials
  app.get("/api/materials", (req, res) => {
    const response = materials.map((mat) => {
      const onHand = getOnHand(mat.id);
      const cat = categories.find((c) => c.id === mat.categoryId);
      return {
        id: mat.id,
        name: mat.name,
        categoryId: mat.categoryId,
        categoryName: cat ? cat.name : "Uncategorized",
        unit: mat.unit,
        unitPrice: mat.unitPrice,
        onHand,
        stockValue: onHand * mat.unitPrice
      };
    });
    res.json(response);
  });

  // Get material details
  app.get("/api/materials/:id", (req, res) => {
    const id = parseInt(req.params.id);
    const mat = materials.find((m) => m.id === id);
    if (!mat) {
      return res.status(404).json({
        title: "Material Not Found",
        status: 404,
        detail: `Material with ID ${id} was not found.`
      });
    }

    const onHand = getOnHand(id);
    const cat = categories.find((c) => c.id === mat.categoryId);
    
    // Sort and grab top 5 batches for recentBatches on the detailed payload
    const recentBatches = batches
      .filter((b) => b.materialId === id)
      .sort((a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime())
      .slice(0, 5);

    res.json({
      id: mat.id,
      name: mat.name,
      categoryId: mat.categoryId,
      categoryName: cat ? cat.name : "Uncategorized",
      unit: mat.unit,
      unitPrice: mat.unitPrice,
      onHand,
      stockValue: onHand * mat.unitPrice,
      recentBatches
    });
  });

  // Get inventory (lightweight status)
  app.get("/api/materials/:id/inventory", (req, res) => {
    const id = parseInt(req.params.id);
    const mat = materials.find((m) => m.id === id);
    if (!mat) {
      return res.status(404).json({
        title: "Material Not Found",
        status: 404,
        detail: `Material with ID ${id} was not found.`
      });
    }
    const onHand = getOnHand(id);
    res.json({
      materialId: id,
      onHand,
      stockValue: onHand * mat.unitPrice
    });
  });

  // Create material
  app.post("/api/materials", (req, res) => {
    const { name, categoryId, unit, unitPrice } = req.body;

    // FluentValidation style mapped validation
    const errors: Record<string, string[]> = {};
    if (!name || !name.trim()) {
      errors["Name"] = ["The Material Name is required."];
    } else if (name.length > 200) {
      errors["Name"] = ["The Material Name must be 200 characters or fewer."];
    }

    const catId = parseInt(categoryId);
    if (!categoryId || isNaN(catId) || catId <= 0) {
      errors["CategoryId"] = ["Valid Category select is required."];
    } else if (!categories.some((c) => c.id === catId)) {
      errors["CategoryId"] = ["The selected category does not exist."];
    }

    if (!unit || !unit.trim()) {
      errors["Unit"] = ["Unit of measurement (e.g. kg, L, ea) is required."];
    } else if (unit.length > 50) {
      errors["Unit"] = ["Unit must be 50 characters or fewer."];
    }

    const price = parseFloat(unitPrice);
    if (isNaN(price) || price < 0) {
      errors["UnitPrice"] = ["Unit Price must be greater than or equal to 0."];
    }

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({
        title: "One or more validation errors occurred.",
        status: 400,
        errors
      });
    }

    const newId = materials.length > 0 ? Math.max(...materials.map((m) => m.id)) + 1 : 1;
    const newMaterial: Material = {
      id: newId,
      name: name.trim(),
      categoryId: catId,
      unit: unit.trim(),
      unitPrice: price
    };
    materials.push(newMaterial);

    res.status(201).json({
      ...newMaterial,
      onHand: 0,
      stockValue: 0
    });
  });

  // Update material
  app.put("/api/materials/:id", (req, res) => {
    const id = parseInt(req.params.id);
    const index = materials.findIndex((m) => m.id === id);
    if (index === -1) {
      return res.status(404).json({
        title: "Material Not Found",
        status: 404,
        detail: `Material with ID ${id} was not found.`
      });
    }

    const { name, categoryId, unit, unitPrice } = req.body;
    const errors: Record<string, string[]> = {};
    if (!name || !name.trim()) {
      errors["Name"] = ["The Material Name is required."];
    } else if (name.length > 200) {
      errors["Name"] = ["The Material Name must be 200 characters or fewer."];
    }

    const catId = parseInt(categoryId);
    if (!categoryId || isNaN(catId) || catId <= 0) {
      errors["CategoryId"] = ["Valid Category select is required."];
    } else if (!categories.some((c) => c.id === catId)) {
      errors["CategoryId"] = ["The selected category does not exist."];
    }

    if (!unit || !unit.trim()) {
      errors["Unit"] = ["Unit of measurement is required."];
    } else if (unit.length > 50) {
      errors["Unit"] = ["Unit must be 50 characters or fewer."];
    }

    const price = parseFloat(unitPrice);
    if (isNaN(price) || price < 0) {
      errors["UnitPrice"] = ["Unit Price must be greater than or equal to 0."];
    }

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({
        title: "One or more validation errors occurred.",
        status: 400,
        errors
      });
    }

    materials[index] = {
      id,
      name: name.trim(),
      categoryId: catId,
      unit: unit.trim(),
      unitPrice: price
    };

    const onHand = getOnHand(id);
    const cat = categories.find((c) => c.id === catId);

    res.json({
      ...materials[index],
      categoryName: cat ? cat.name : "Uncategorized",
      onHand,
      stockValue: onHand * price
    });
  });

  // Delete material
  app.delete("/api/materials/:id", (req, res) => {
    const id = parseInt(req.params.id);
    const index = materials.findIndex((m) => m.id === id);
    if (index === -1) {
      return res.status(404).json({
        title: "Material Not Found",
        status: 404,
        detail: `Material with ID ${id} was not found.`
      });
    }

    // Rule 1: 409 if usage records exist
    if (materialsWithUsageMockIds.has(id)) {
      return res.status(409).json({
        title: "Material Has Maintenance Usage Records",
        status: 409,
        detail: "Cannot delete: usage records exist."
      });
    }

    // Rule 2: 409 if batches exist
    const materialBatches = batches.filter((b) => b.materialId === id);
    if (materialBatches.length > 0) {
      return res.status(409).json({
        title: "Material Has Registered Batches",
        status: 409,
        detail: "Cannot delete: delete stock batches first or contact admin."
      });
    }

    materials.splice(index, 1);
    res.status(204).end();
  });


  // --- BATCHES ENDPOINTS (RECEIVE STOCK) ---

  // Get batches for a material
  app.get("/api/materials/:materialId/batches", (req, res) => {
    const materialId = parseInt(req.params.materialId);
    const mat = materials.find((m) => m.id === materialId);
    if (!mat) {
      return res.status(404).json({
        title: "Material Not Found",
        status: 404,
        detail: `Material with ID ${materialId} was not found.`
      });
    }

    const list = batches
      .filter((b) => b.materialId === materialId)
      .sort((a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime());
    res.json(list);
  });

  // Receive stock batch
  app.post("/api/materials/:materialId/batches", (req, res) => {
    const materialId = parseInt(req.params.materialId);
    const mat = materials.find((m) => m.id === materialId);
    if (!mat) {
      return res.status(404).json({
        title: "Material Not Found",
        status: 404,
        detail: `Material with ID ${materialId} was not found.`
      });
    }

    const { quantityReceived, costTotal, expiryDate, receivedAt } = req.body;
    
    // Validations
    const errors: Record<string, string[]> = {};
    const qty = parseFloat(quantityReceived);
    if (isNaN(qty) || qty <= 0) {
      errors["QuantityReceived"] = ["Quantity received must be greater than 0."];
    }

    const cost = parseFloat(costTotal);
    if (isNaN(cost) || cost < 0) {
      errors["CostTotal"] = ["Cost total must be greater than or equal to 0."];
    }

    if (!receivedAt) {
      errors["ReceivedAt"] = ["Received date is required."];
    }

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({
        title: "One or more validation errors occurred.",
        status: 400,
        errors
      });
    }

    const newBatchId = batches.length > 0 ? Math.max(...batches.map((b) => b.batchId)) + 1 : 100;
    const newBatch: StockBatch = {
      batchId: newBatchId,
      materialId,
      quantityReceived: qty,
      costTotal: cost,
      expiryDate: expiryDate || undefined,
      receivedAt: receivedAt
    };
    batches.push(newBatch);

    res.status(201).json(newBatch);
  });

  // Delete batch
  app.delete("/api/materials/:materialId/batches/:batchId", (req, res) => {
    const materialId = parseInt(req.params.materialId);
    const batchId = parseInt(req.params.batchId);

    const index = batches.findIndex((b) => b.batchId === batchId && b.materialId === materialId);
    if (index === -1) {
      return res.status(404).json({
        title: "Batch Not Found",
        status: 404,
        detail: `Batch ${batchId} for material ${materialId} does not exist.`
      });
    }

    batches.splice(index, 1);
    res.status(204).end();
  });


  // --- VITE DEV MIDDLEWARE AND STATIC PRODUCTION HOSTING ---

  if (process.env.NODE_ENV !== "production") {
    console.log("Configuring Vite Dev Middleware...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Configuring Production Static File Service...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const PORT = 3000;
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server successfully started on http://0.0.0.0:${PORT}`);
  });
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
