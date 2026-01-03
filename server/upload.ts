import { Router, Request, Response, NextFunction } from "express";
import multer from "multer";
import { storagePut } from "./storage";
import { sdk } from "./_core/sdk";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit
  },
});

export const uploadRouter = Router();

// Middleware to verify session for upload endpoint
async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user) {
      console.warn("[Upload] No user found in session");
      return res.status(403).json({ error: "Authentication required" });
    }
    // Attach user to request for downstream use
    (req as any).user = user;
    next();
  } catch (error) {
    console.warn("[Upload] Authentication failed:", error);
    return res.status(403).json({ error: "Authentication required" });
  }
}

uploadRouter.post("/upload", requireAuth, upload.single("file"), async (req: Request, res: Response) => {
  try {
    console.log("[Upload] Request received from user:", (req as any).user?.id);

    if (!req.file) {
      console.warn("[Upload] No file in request");
      return res.status(400).json({ error: "No file provided" });
    }

    console.log("[Upload] File received:", {
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
    });

    const key = req.body.key || `uploads/${Date.now()}-${req.file.originalname}`;
    const contentType = req.body.contentType || req.file.mimetype;

    console.log("[Upload] Uploading to storage with key:", key);
    const result = await storagePut(key, req.file.buffer, contentType);

    console.log("[Upload] Upload successful:", result);
    res.json(result);
  } catch (error: any) {
    console.error("[Upload] Error:", error?.message || error);
    res.status(500).json({ error: "Upload failed", details: error?.message });
  }
});
