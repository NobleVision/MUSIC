/**
 * Client-side storage utilities for uploading files to Cloudinary
 * This wraps the server-side storage functions via API calls
 */

export interface StoragePutResult {
  key: string;
  url: string;
}

/**
 * Upload a file to Cloudinary storage via server API
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
    throw new Error('Upload failed');
  }
  
  const result = await response.json();
  return result;
}
