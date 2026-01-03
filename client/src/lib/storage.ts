/**
 * Client-side storage utilities for uploading files to Cloudinary
 * Uses direct browser-to-Cloudinary uploads to bypass Vercel's 4.5MB body size limit
 */

export interface StoragePutResult {
  key: string;
  url: string;
}

export interface CloudinaryUploadSignature {
  signature: string;
  timestamp: number;
  cloudName: string;
  apiKey: string;
  folder: string;
  publicId: string;
  resourceType: "image" | "video" | "raw" | "auto";
  key: string;
}

/**
 * Upload a file directly to Cloudinary using a signed upload
 * This bypasses Vercel's 4.5MB request body limit by uploading directly to Cloudinary
 *
 * @param signatureData - The signature data from the server (from trpc.upload.getSignature)
 * @param file - The file to upload
 * @param onProgress - Optional callback for upload progress (0-100)
 */
export async function uploadToCloudinary(
  signatureData: CloudinaryUploadSignature,
  file: File | Blob,
  onProgress?: (percent: number) => void
): Promise<StoragePutResult> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('api_key', signatureData.apiKey);
  formData.append('timestamp', signatureData.timestamp.toString());
  formData.append('signature', signatureData.signature);
  formData.append('public_id', signatureData.publicId);
  formData.append('folder', signatureData.folder);
  formData.append('overwrite', 'true');

  const uploadUrl = `https://api.cloudinary.com/v1_1/${signatureData.cloudName}/${signatureData.resourceType}/upload`;

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable && onProgress) {
        const percent = Math.round((event.loaded / event.total) * 100);
        onProgress(percent);
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const response = JSON.parse(xhr.responseText);
          resolve({
            key: response.public_id,
            url: response.secure_url,
          });
        } catch (e) {
          reject(new Error('Failed to parse Cloudinary response'));
        }
      } else {
        try {
          const error = JSON.parse(xhr.responseText);
          reject(new Error(error.error?.message || 'Upload failed'));
        } catch {
          reject(new Error(`Upload failed with status ${xhr.status}`));
        }
      }
    });

    xhr.addEventListener('error', () => {
      reject(new Error('Network error during upload'));
    });

    xhr.addEventListener('abort', () => {
      reject(new Error('Upload aborted'));
    });

    xhr.open('POST', uploadUrl);
    xhr.send(formData);
  });
}

/**
 * Legacy upload function - uploads via server API
 * WARNING: This has a 4.5MB limit on Vercel. Use uploadToCloudinary for larger files.
 * @deprecated Use uploadToCloudinary with trpc.upload.getSignature instead
 */
export async function storagePut(
  key: string,
  data: ArrayBuffer,
  contentType: string
): Promise<StoragePutResult> {
  // Convert data to blob
  const blob = new Blob([data], { type: contentType });

  // Create form data
  const formData = new FormData();
  formData.append('file', blob);
  formData.append('key', key);
  formData.append('contentType', contentType);

  // Upload via API endpoint
  const response = await fetch('/api/upload', {
    method: 'POST',
    body: formData,
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Upload failed: ${error}`);
  }

  const result = await response.json();
  return result;
}
