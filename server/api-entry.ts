// Vercel provides environment variables automatically, so dotenv is not needed
// For local development, dotenv is loaded separately in server/_core/index.ts
// This avoids bundling issues with dotenv's CommonJS require() in ESM
import express from "express";
import type { Request, Response } from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "./routers";
import { createContext } from "./_core/context";
import { registerOAuthRoutes } from "./_core/oauth";
import { uploadRouter } from "./upload";
import { externalApiRouter } from "./external-api";

const app = express();

// Configure body parser with larger size limit for file uploads
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// OAuth callback under /api/oauth/callback
registerOAuthRoutes(app);

// Upload endpoint
app.use("/api", uploadRouter);

// External API endpoints
app.use("/api", externalApiRouter);

// tRPC API
app.use(
  "/api/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext,
  })
);

// Health check
app.get("/api/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Export the Express app for Vercel serverless
// Both default and named exports for maximum compatibility
export default app;
export { app };
