import { Router } from "express";
import { z } from "zod";
import * as db from "./db";
import { hashApiKey, generateToken } from "./auth";
import { storagePut } from "./storage";

export const externalApiRouter = Router();

// Middleware to verify API key
async function verifyApiKey(req: any, res: any, next: any) {
  const apiKey = req.headers["x-api-key"] || req.headers["authorization"]?.replace("Bearer ", "");
  
  if (!apiKey) {
    return res.status(401).json({ error: "API key required" });
  }
  
  const keyHash = hashApiKey(apiKey as string);
  const apiKeyRecord = await db.getApiKeyByHash(keyHash);
  
  if (!apiKeyRecord) {
    return res.status(401).json({ error: "Invalid API key" });
  }
  
  // Update last used timestamp
  await db.updateApiKeyLastUsed(apiKeyRecord.id);
  
  // Attach user info to request
  req.apiUser = {
    userId: apiKeyRecord.userId,
    apiKeyId: apiKeyRecord.id,
  };
  
  next();
}

// Schema for export request
const exportRequestSchema = z.object({
  sectionId: z.number().optional(),
  categoryId: z.number().optional(),
  files: z.array(z.object({
    title: z.string(),
    fileUrl: z.string(),
    filename: z.string(),
    mediaType: z.enum(["audio", "video"]),
    mimeType: z.string().optional(),
    lyrics: z.string().optional(),
    musicStyle: z.string().optional(),
    coverArtUrl: z.string().optional(),
  })),
});

/**
 * POST /api/external/export-to-dashboard
 * 
 * Export media files from external tools to user's dashboard
 * Requires API key authentication via X-API-Key header
 * 
 * Request body:
 * {
 *   "sectionId": 123,  // Optional: target section ID
 *   "categoryId": 456, // Optional: target category ID (if not provided, creates new category)
 *   "files": [
 *     {
 *       "title": "Song Title",
 *       "fileUrl": "https://...",
 *       "filename": "song.mp3",
 *       "mediaType": "audio",
 *       "mimeType": "audio/mpeg",
 *       "lyrics": "...",
 *       "musicStyle": "Pop",
 *       "coverArtUrl": "https://..."
 *     }
 *   ]
 * }
 */
externalApiRouter.post("/external/export-to-dashboard", verifyApiKey, async (req: any, res: any) => {
  try {
    const body = exportRequestSchema.parse(req.body);
    const userId = req.apiUser.userId;
    
    // Determine target category
    let targetCategoryId = body.categoryId;
    
    if (!targetCategoryId) {
      // If no category specified, check if section exists or create default
      let sectionId = body.sectionId;
      
      if (!sectionId) {
        // Create default "Imported" section
        const sections = await db.getUserSections(userId);
        const importedSection = sections.find(s => s.name === "Imported");
        
        if (importedSection) {
          sectionId = importedSection.id;
        } else {
          await db.createSection({
            userId,
            name: "Imported",
            description: "Files imported from external tools",
            displayOrder: 999,
          });
          const newSections = await db.getUserSections(userId);
          sectionId = newSections.find(s => s.name === "Imported")!.id;
        }
      }
      
      // Create category with timestamp
      const timestamp = new Date().toISOString().split('T')[0];
      await db.createCategory({
        sectionId,
        name: `Import ${timestamp}`,
        description: "Imported via API",
        displayOrder: 0,
      });
      
      const categories = await db.getSectionCategories(sectionId);
      targetCategoryId = categories[0]!.id;
    }
    
    // Verify user owns the category
    const category = await db.getCategoryById(targetCategoryId);
    if (!category) {
      return res.status(404).json({ error: "Category not found" });
    }
    
    const section = await db.getSectionById(category.sectionId);
    if (!section || section.userId !== userId) {
      return res.status(403).json({ error: "Access denied" });
    }
    
    // Process each file
    const results = [];
    for (const file of body.files) {
      try {
        // Download file from URL and re-upload to our S3
        const response = await fetch(file.fileUrl);
        if (!response.ok) {
          throw new Error(`Failed to download file: ${response.statusText}`);
        }
        
        const fileBuffer = await response.arrayBuffer();
        const fileKey = `imported/${Date.now()}-${file.filename}`;
        const uploadResult = await storagePut(fileKey, Buffer.from(fileBuffer), file.mimeType || "application/octet-stream");
        
        // Handle cover art if provided
        let coverArtKey = undefined;
        let coverArtUrl = undefined;
        if (file.coverArtUrl) {
          try {
            const coverResponse = await fetch(file.coverArtUrl);
            if (coverResponse.ok) {
              const coverBuffer = await coverResponse.arrayBuffer();
              const coverKey = `imported/covers/${Date.now()}-cover.jpg`;
              const coverUploadResult = await storagePut(coverKey, Buffer.from(coverBuffer), "image/jpeg");
              coverArtKey = coverKey;
              coverArtUrl = coverUploadResult.url;
            }
          } catch (e) {
            console.warn("Failed to download cover art:", e);
          }
        }
        
        // Create media file record
        const shareToken = generateToken(32);
        await db.createMediaFile({
          categoryId: targetCategoryId,
          userId,
          title: file.title,
          filename: file.filename,
          fileKey,
          fileUrl: uploadResult.url,
          fileSize: fileBuffer.byteLength,
          mimeType: file.mimeType || null,
          mediaType: file.mediaType,
          lyrics: file.lyrics || null,
          musicStyle: file.musicStyle || null,
          coverArtKey: coverArtKey || null,
          coverArtUrl: coverArtUrl || null,
          shareToken,
          isPubliclyShared: false,
          displayOrder: 0,
        });
        
        results.push({
          success: true,
          title: file.title,
          url: uploadResult.url,
        });
      } catch (error: any) {
        results.push({
          success: false,
          title: file.title,
          error: error.message,
        });
      }
    }
    
    res.json({
      success: true,
      categoryId: targetCategoryId,
      results,
    });
  } catch (error: any) {
    console.error("Export API error:", error);
    
    if (error.name === "ZodError") {
      return res.status(400).json({
        error: "Invalid request format",
        details: error.errors,
      });
    }
    
    res.status(500).json({
      error: "Failed to process export",
      message: error.message,
    });
  }
});

/**
 * GET /api/external/sections
 * 
 * List user's sections for selection in external tools
 */
externalApiRouter.get("/external/sections", verifyApiKey, async (req: any, res: any) => {
  try {
    const userId = req.apiUser.userId;
    const sections = await db.getUserSections(userId);
    
    res.json({
      success: true,
      sections: sections.map(s => ({
        id: s.id,
        name: s.name,
        description: s.description,
      })),
    });
  } catch (error: any) {
    console.error("List sections error:", error);
    res.status(500).json({ error: "Failed to list sections" });
  }
});

/**
 * GET /api/external/categories/:sectionId
 * 
 * List categories within a section
 */
externalApiRouter.get("/external/categories/:sectionId", verifyApiKey, async (req: any, res: any) => {
  try {
    const userId = req.apiUser.userId;
    const sectionId = parseInt(req.params.sectionId);
    
    // Verify ownership
    const section = await db.getSectionById(sectionId);
    if (!section || section.userId !== userId) {
      return res.status(403).json({ error: "Access denied" });
    }
    
    const categories = await db.getSectionCategories(sectionId);
    
    res.json({
      success: true,
      categories: categories.map(c => ({
        id: c.id,
        name: c.name,
        description: c.description,
      })),
    });
  } catch (error: any) {
    console.error("List categories error:", error);
    res.status(500).json({ error: "Failed to list categories" });
  }
});
