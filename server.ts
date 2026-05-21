import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { createProxyMiddleware } from "http-proxy-middleware";

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

const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:5222";

async function main() {
  const app = express();

  // -------------------------------------------------------
  // Proxy all /api requests to the C# Web API backend
  // -------------------------------------------------------
  app.use(
    createProxyMiddleware({
      target: API_BASE_URL,
      changeOrigin: true,
      pathFilter: "/api",
      // Forward errors to the client instead of crashing the proxy
      on: {
        error: (err, req, res) => {
          console.error("[proxy] error:", err.message);
          (res as any).status(502).json({
            title: "API Unavailable",
            detail: `Could not reach backend at ${API_BASE_URL}. Is the C# API running?`,
          });
        },
      },
    })
  );

  // -------------------------------------------------------
  // Vite Dev Middleware (dev) / Static hosting (prod)
  // -------------------------------------------------------
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
    console.log(`Frontend server started on http://0.0.0.0:${PORT}`);
    console.log(`Proxying /api requests to ${API_BASE_URL}`);
  });
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});

