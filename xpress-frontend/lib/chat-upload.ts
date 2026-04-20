import { getAccessToken } from './auth-client';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, '') ?? 'http://localhost:3000';

export interface PresignedUrlResponse {
  uploadUrl: string;
  publicUrl: string;
  fileName: string;
  contentType: string;
}

export async function getPresignedUrl(
  fileName: string,
  contentType: string,
  fileSize: number,
): Promise<PresignedUrlResponse> {
  const token = getAccessToken();
  if (!token) {
    throw new Error('User is not authenticated');
  }

  const response = await fetch(`${API_BASE_URL}/chat/presigned-url`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fileName, contentType, fileSize }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Failed to get presigned URL from server:', errorText);
    throw new Error(`Failed to get presigned URL from server: ${errorText}`);
  }

  return await response.json();
}

export function uploadFileToS3(
  uploadUrl: string,
  file: File,
  onProgress?: (percent: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    
    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable && onProgress) {
        const percentComplete = Math.round((event.loaded / event.total) * 100);
        onProgress(percentComplete);
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        const responseBody = xhr.responseText?.trim();
        reject(
          new Error(
            responseBody
              ? `Failed to upload to S3: ${xhr.status} ${xhr.statusText} - ${responseBody}`
              : `Failed to upload to S3: ${xhr.status} ${xhr.statusText}`,
          ),
        );
      }
    });

    xhr.addEventListener('error', () => {
      reject(new Error('Network error occurred while uploading.'));
    });

    xhr.addEventListener('timeout', () => {
      reject(new Error('Khớp nối quá hạn (Timeout) trong lúc tải file lên máy chủ.'));
    });

    xhr.open('PUT', uploadUrl, true);
    xhr.timeout = 60000; // 60 seconds
    xhr.setRequestHeader('Content-Type', file.type);
    xhr.send(file);
  });
}
