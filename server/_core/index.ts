import "dotenv/config";
import express from "express";
import type { Request, Response, NextFunction } from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { uploadRouter } from "../upload";
import { externalApiRouter } from "../external-api";
import { activityBroadcaster, startHeartbeat, stopHeartbeat } from "../sse";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);

  // CORS middleware
  app.use((req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin;
    if (origin) {
      res.setHeader("Access-Control-Allow-Origin", origin);
    }
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-API-Key");

    if (req.method === "OPTIONS") {
      return res.status(200).end();
    }
    next();
  });

  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  // Upload endpoint
  app.use("/api", uploadRouter);
  // External API endpoints
  app.use("/api", externalApiRouter);
  
  // Server-Sent Events endpoint for real-time activity updates
  app.get("/api/activity-stream", (req: Request, res: Response) => {
    // Set SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no"); // Disable nginx buffering
    
    // Flush headers immediately
    res.flushHeaders();
    
    // Send initial connection message
    res.write(": connected\n\n");
    
    // Add client to broadcaster
    const clientId = activityBroadcaster.addClient(res);
    
    // Handle client disconnect
    req.on("close", () => {
      activityBroadcaster.removeClient(clientId);
    });
    
    // Handle connection errors
    req.on("error", () => {
      activityBroadcaster.removeClient(clientId);
    });
  });
  
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
    
    // Start SSE heartbeat
    startHeartbeat();
  });
  
  // Graceful shutdown handling
  const gracefulShutdown = () => {
    console.log("Shutting down gracefully...");
    stopHeartbeat();
    activityBroadcaster.disconnectAll();
    server.close(() => {
      console.log("Server closed");
      process.exit(0);
    });
  };
  
  process.on("SIGTERM", gracefulShutdown);
  process.on("SIGINT", gracefulShutdown);
}

startServer().catch(console.error);
