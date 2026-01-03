import { Router, Request, Response } from "express";
import multer from "multer";
import { storagePut } from "./storage";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit
  },
});

export const uploadRouter = Router();

uploadRouter.post("/upload", upload.single("file"), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file provided" });
    }
    
    const key = req.body.key || `uploads/${Date.now()}-${req.file.originalname}`;
    const contentType = req.body.contentType || req.file.mimetype;
    
    const result = await storagePut(key, req.file.buffer, contentType);
    
    res.json(result);
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({ error: "Upload failed" });
  }
});
