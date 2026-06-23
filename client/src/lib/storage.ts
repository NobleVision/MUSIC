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
/**
 * Maximum file sizes for Cloudinary uploads (in bytes)
 * Video: 300MB (requires Plus plan or higher; free plan limit is 100MB)
 * Image: 10MB, Raw: 10MB
 */
const MAX_VIDEO_SIZE = 300 * 1024 * 1024; // 300MB
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;  // 10MB
const MAX_RAW_SIZE = 10 * 1024 * 1024;    // 10MB

/** Upload timeout: 15 minutes for large video files (up to 300MB) */
const UPLOAD_TIMEOUT_MS = 15 * 60 * 1000;

/**
 * Cloudinary requires chunked uploads for files larger than 100MB (per-request limit),
 * regardless of account plan. Files at or below this threshold use a single POST request.
 */
const CHUNKED_UPLOAD_THRESHOLD = 95 * 1024 * 1024; // 95MB (with safety margin below 100MB limit)

/** Chunk size for chunked uploads. Must be >= 5MB per Cloudinary docs. Default is 20MB. */
const CHUNK_SIZE = 20 * 1024 * 1024; // 20MB

export async function uploadToCloudinary(
  signatureData: CloudinaryUploadSignature,
  file: File | Blob,
  onProgress?: (percent: number) => void
): Promise<StoragePutResult> {
  // Validate file size before attempting upload
  const maxSize =
    signatureData.resourceType === 'video' ? MAX_VIDEO_SIZE :
    signatureData.resourceType === 'image' ? MAX_IMAGE_SIZE :
    MAX_RAW_SIZE;

  if (file.size > maxSize) {
    const maxMB = Math.round(maxSize / (1024 * 1024));
    const fileMB = (file.size / (1024 * 1024)).toFixed(1);
    throw new Error(
      `File size (${fileMB}MB) exceeds the maximum allowed size of ${maxMB}MB for ${signatureData.resourceType} uploads`
    );
  }

  // Use chunked upload for files larger than 95MB (Cloudinary's per-request limit is 100MB)
  if (file.size > CHUNKED_UPLOAD_THRESHOLD) {
    return uploadChunked(signatureData, file, onProgress);
  }

  return uploadSingleRequest(signatureData, file, onProgress);
}

/**
 * Upload a large file to Cloudinary using chunked upload with Content-Range headers.
 * Required for files larger than 100MB regardless of Cloudinary plan.
 * Uses the same /upload endpoint but sends file in chunks with special headers.
 */
async function uploadChunked(
  signatureData: CloudinaryUploadSignature,
  file: File | Blob,
  onProgress?: (percent: number) => void
): Promise<StoragePutResult> {
  const uploadUrl = `https://api.cloudinary.com/v1_1/${signatureData.cloudName}/${signatureData.resourceType}/upload`;
  const uniqueUploadId = `uqid-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  const totalSize = file.size;
  const totalChunks = Math.ceil(totalSize / CHUNK_SIZE);

  let result: StoragePutResult | null = null;

  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, totalSize);
    const chunk = file.slice(start, end);

    const formData = new FormData();
    formData.append('file', chunk);
    formData.append('api_key', signatureData.apiKey);
    formData.append('timestamp', signatureData.timestamp.toString());
    formData.append('signature', signatureData.signature);
    formData.append('public_id', signatureData.publicId);
    formData.append('folder', signatureData.folder);
    // IMPORTANT: Must match the server-side signature which signs overwrite as 1 (integer)
    formData.append('overwrite', '1');

    const contentRange = `bytes ${start}-${end - 1}/${totalSize}`;

    let response: Response;
    try {
      response = await fetch(uploadUrl, {
        method: 'POST',
        body: formData,
        headers: {
          'X-Unique-Upload-Id': uniqueUploadId,
          'Content-Range': contentRange,
        },
      });
    } catch (networkError) {
      throw new Error(
        `Network error uploading chunk ${i + 1}/${totalChunks}. ` +
        'Please check your connection and try again.'
      );
    }

    if (!response.ok) {
      let errorMessage = `Chunk ${i + 1}/${totalChunks} upload failed with status ${response.status}`;
      try {
        const error = await response.json();
        errorMessage = error.error?.message || errorMessage;
      } catch {
        // Use default error message
      }
      throw new Error(errorMessage);
    }

    const data = await response.json();

    // Update progress based on bytes uploaded so far
    if (onProgress) {
      const percent = Math.round((end / totalSize) * 100);
      onProgress(percent);
    }

    // Final chunk returns done: true with full upload response
    if (data.done !== false && data.public_id && data.secure_url) {
      result = {
        key: data.public_id,
        url: data.secure_url,
      };
    }
  }

  if (!result) {
    throw new Error('Chunked upload completed but no final response was returned from Cloudinary');
  }

  return result;
}

/**
 * Upload a file to Cloudinary in a single POST request.
 * Used for files under the chunked upload threshold (< 95MB).
 */
function uploadSingleRequest(
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
  // IMPORTANT: Must match the server-side signature which signs overwrite as 1 (integer)
  // Using 'true' here would cause a signature mismatch and connection abort
  formData.append('overwrite', '1');

  const uploadUrl = `https://api.cloudinary.com/v1_1/${signatureData.cloudName}/${signatureData.resourceType}/upload`;

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.timeout = UPLOAD_TIMEOUT_MS;

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
        let errorMessage = `Upload failed with status ${xhr.status}`;
        try {
          const error = JSON.parse(xhr.responseText);
          errorMessage = error.error?.message || errorMessage;
        } catch {
          // Use default error message
        }
        reject(new Error(errorMessage));
      }
    });

    xhr.addEventListener('error', () => {
      reject(new Error(
        'Network error during upload. This may be caused by: file too large, ' +
        'unstable connection, or CORS restrictions. Please check your connection and try again.'
      ));
    });

    xhr.addEventListener('timeout', () => {
      reject(new Error(
        'Upload timed out. The file may be too large or your connection too slow. Please try again.'
      ));
    });

    xhr.addEventListener('abort', () => {
      reject(new Error('Upload was cancelled'));
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
