// Cloudinary storage helpers for media file uploads
// Uses Cloudinary SDK for cloud storage

import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';

// Configure Cloudinary from environment variables
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "").replace(/\.[^/.]+$/, ""); // Remove leading slashes and file extension
}

function getResourceType(contentType: string): "image" | "video" | "raw" | "auto" {
  if (contentType.startsWith("image/")) return "image";
  if (contentType.startsWith("video/") || contentType.startsWith("audio/")) return "video";
  return "raw";
}

export interface CloudinaryUploadSignature {
  signature: string;
  timestamp: number;
  cloudName: string;
  apiKey: string;
  folder: string;
  publicId: string;
  resourceType: "image" | "video" | "raw" | "auto";
}

/**
 * Generate a signed upload URL for direct browser-to-Cloudinary uploads
 * This bypasses Vercel's 4.5MB body size limit
 */
export function generateUploadSignature(
  key: string,
  contentType: string
): CloudinaryUploadSignature {
  const publicId = normalizeKey(key);
  const resourceType = getResourceType(contentType);
  const timestamp = Math.round(Date.now() / 1000);

  // Extract folder from the key (e.g., "media/123-file.mp3" -> "media")
  const folder = publicId.includes('/') ? publicId.split('/').slice(0, -1).join('/') : '';
  const finalPublicId = publicId.includes('/') ? publicId.split('/').pop()! : publicId;

  // Parameters to sign (must be in alphabetical order)
  const paramsToSign: Record<string, string | number> = {
    folder,
    overwrite: 1,
    public_id: finalPublicId,
    timestamp,
  };

  // Generate signature
  const signature = cloudinary.utils.api_sign_request(
    paramsToSign,
    process.env.CLOUDINARY_API_SECRET!
  );

  return {
    signature,
    timestamp,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME!,
    apiKey: process.env.CLOUDINARY_API_KEY!,
    folder,
    publicId: finalPublicId,
    resourceType,
  };
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);
  const resourceType = getResourceType(contentType);

  // Convert data to base64 data URI for Cloudinary upload
  const buffer = typeof data === "string" ? Buffer.from(data) : Buffer.from(data);
  const base64Data = buffer.toString("base64");
  const dataUri = `data:${contentType};base64,${base64Data}`;

  try {
    const result: UploadApiResponse = await cloudinary.uploader.upload(dataUri, {
      public_id: key,
      resource_type: resourceType,
      overwrite: true,
      folder: "", // Use the key path as-is
    });

    return {
      key: result.public_id,
      url: result.secure_url,
    };
  } catch (error: any) {
    throw new Error(`Storage upload failed: ${error.message || error}`);
  }
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);

  // Generate a URL for the resource
  // For Cloudinary, we can construct the URL directly
  const url = cloudinary.url(key, {
    secure: true,
    resource_type: "auto",
  });

  return {
    key,
    url,
  };
}

export async function storageDelete(relKey: string): Promise<void> {
  const key = normalizeKey(relKey);

  try {
    await cloudinary.uploader.destroy(key, { resource_type: "video" });
  } catch (error) {
    // Try as image/raw if video fails
    try {
      await cloudinary.uploader.destroy(key, { resource_type: "image" });
    } catch {
      await cloudinary.uploader.destroy(key, { resource_type: "raw" });
    }
  }
}
