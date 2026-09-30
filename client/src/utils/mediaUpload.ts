import type { AttachmentInfo } from '../types';

export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
] as const;

export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export interface FileValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validates file type and size constraints
 */
export function validateMediaFile(file: File): FileValidationResult {
  if (!file) {
    return { valid: false, error: 'No file selected' };
  }

  const isAllowedType = ALLOWED_MIME_TYPES.some((type) => file.type === type);
  if (!isAllowedType) {
    return {
      valid: false,
      error: 'Only images (JPEG, PNG, WebP, GIF) and PDF documents are supported.',
    };
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    const sizeInMB = (file.size / (1024 * 1024)).toFixed(1);
    return {
      valid: false,
      error: `File is too large (${sizeInMB} MB). Maximum allowed size is 5 MB.`,
    };
  }

  return { valid: true };
}

/**
 * Generates a tiny, ~200-byte base64 blur preview from an image element
 */
function generateBlurPlaceholder(img: HTMLImageElement): string {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 16;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';
    ctx.drawImage(img, 0, 0, 16, 16);
    return canvas.toDataURL('image/jpeg', 0.4);
  } catch {
    return '';
  }
}

/**
 * Compresses an image in the browser before upload:
 * - Downscales resolution to max 1920px
 * - Re-encodes to WebP (quality 0.8)
 * - Extracts dimensions and blur placeholder
 */
export function prepareImageForUpload(
  file: File,
  maxDimension = 1920,
  quality = 0.8,
): Promise<{
  blob: Blob;
  width: number;
  height: number;
  blurhash: string;
}> {
  return new Promise((resolve, reject) => {
    // GIFs preserve animation, so don't compress frames via canvas
    if (file.type === 'image/gif') {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      img.onload = () => {
        const blur = generateBlurPlaceholder(img);
        resolve({
          blob: file,
          width: img.naturalWidth || 400,
          height: img.naturalHeight || 300,
          blurhash: blur,
        });
        URL.revokeObjectURL(objectUrl);
      };
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        resolve({ blob: file, width: 400, height: 300, blurhash: '' });
      };
      img.src = objectUrl;
      return;
    }

    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      let { naturalWidth: width, naturalHeight: height } = img;

      // Downscale if either dimension exceeds maxDimension
      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        URL.revokeObjectURL(objectUrl);
        return resolve({
          blob: file,
          width: img.naturalWidth,
          height: img.naturalHeight,
          blurhash: '',
        });
      }

      ctx.drawImage(img, 0, 0, width, height);
      const blur = generateBlurPlaceholder(img);

      // Attempt WebP export, fallback to JPEG if unsupported
      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(objectUrl);
          if (blob) {
            resolve({ blob, width, height, blurhash: blur });
          } else {
            resolve({
              blob: file,
              width: img.naturalWidth,
              height: img.naturalHeight,
              blurhash: blur,
            });
          }
        },
        'image/webp',
        quality,
      );
    };

    img.onerror = (err) => {
      URL.revokeObjectURL(objectUrl);
      reject(err);
    };

    img.src = objectUrl;
  });
}

export interface UploadOptions {
  onProgress?: (percent: number) => void;
  signal?: AbortSignal;
}

/**
 * Executes direct-to-storage upload:
 * 1. Validates file
 * 2. Compresses image & generates blur placeholder (if image)
 * 3. Requests temporary pre-signed URL from API Gateway
 * 4. Sends binary PUT directly to MinIO/S3 with progress tracking
 * 5. Returns completed AttachmentInfo
 */
export async function uploadMediaAttachment(
  file: File,
  conversationId: string,
  token: string,
  options?: UploadOptions,
): Promise<AttachmentInfo> {
  // 1. Validate
  const validation = validateMediaFile(file);
  if (!validation.valid) {
    throw new Error(validation.error || 'Invalid file');
  }

  let uploadBlob: Blob = file;
  let width: number | undefined;
  let height: number | undefined;
  let blurhash: string | undefined;
  let uploadMimeType = file.type;

  // 2. Client-side image optimization
  if (file.type.startsWith('image/')) {
    try {
      const prepared = await prepareImageForUpload(file);
      uploadBlob = prepared.blob;
      width = prepared.width;
      height = prepared.height;
      blurhash = prepared.blurhash;
      uploadMimeType = prepared.blob.type || file.type;
    } catch {
      // In case canvas fails, fallback to raw file
      uploadBlob = file;
    }
  }

  // 3. Request Pre-signed URL from Gateway
  const response = await fetch('/api/media/upload-url', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      conversationId,
      fileName: file.name,
      mimeType: uploadMimeType,
      fileSize: uploadBlob.size,
    }),
    signal: options?.signal,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message =
      Array.isArray(errorData.message)
        ? errorData.message.join(', ')
        : errorData.message || 'Failed to initialize upload';
    throw new Error(message);
  }

  const { uploadUrl, publicUrl, fileKey } = await response.json();

  // 4. Direct PUT to S3 / MinIO
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uploadUrl);
    xhr.setRequestHeader('Content-Type', uploadMimeType);

    if (options?.onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100);
          options.onProgress?.(percent);
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        options?.onProgress?.(100);
        resolve();
      } else {
        reject(
          new Error(
            `Storage upload failed with status ${xhr.status}: ${xhr.statusText}`,
          ),
        );
      }
    };

    xhr.onerror = () => reject(new Error('Network error during file upload'));
    xhr.onabort = () => reject(new Error('Upload was aborted'));

    if (options?.signal) {
      options.signal.addEventListener('abort', () => xhr.abort());
    }

    xhr.send(uploadBlob);
  });

  // 5. Construct completed AttachmentInfo
  return {
    fileId: fileKey.split('/').pop() || fileKey,
    type: file.type.startsWith('image/') ? 'image' : 'file',
    url: publicUrl,
    thumbnailUrl: publicUrl,
    fileName: file.name,
    fileSize: uploadBlob.size,
    mimeType: uploadMimeType,
    width,
    height,
    blurhash,
  };
}
