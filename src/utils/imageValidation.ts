/**
 * Client-side validation and optimization utilities for product scanner payloads.
 */

export interface OptimizedImagePayload {
  base64Data: string;
  mimeType: string;
  width: number;
  height: number;
}

/**
 * Validates, sanitizes, and optimizes an image data URL before sending to the backend.
 * Downscales images exceeding maxDimension to prevent oversized payloads and HTTP 413 / timeouts.
 */
export async function validateAndOptimizeImage(
  dataUrlOrBase64: string,
  maxDimension = 1280,
  quality = 0.85
): Promise<OptimizedImagePayload> {
  if (!dataUrlOrBase64 || typeof dataUrlOrBase64 !== 'string') {
    throw new Error('Image data is missing or invalid. Please select or capture a photo.');
  }

  const trimmed = dataUrlOrBase64.trim();
  if (trimmed.length < 50) {
    throw new Error('Image payload is too small to be a valid photo.');
  }

  // Ensure clean data URL structure
  let fullDataUrl = trimmed;
  let detectedMime = 'image/jpeg';

  if (trimmed.startsWith('data:')) {
    const mimeMatch = trimmed.match(/^data:([a-zA-Z0-9/+-]+);base64,/);
    if (mimeMatch && mimeMatch[1]) {
      detectedMime = mimeMatch[1];
    }
  } else {
    // Raw base64 string provided
    fullDataUrl = `data:image/jpeg;base64,${trimmed}`;
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    // Allow cross-origin if needed
    img.crossOrigin = 'anonymous';

    const timeout = setTimeout(() => {
      reject(new Error('Image processing timed out. Please try capturing the photo again.'));
    }, 8000);

    img.onload = () => {
      clearTimeout(timeout);
      try {
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;

        if (width <= 0 || height <= 0) {
          reject(new Error('Image has zero dimensions. Please capture another photo.'));
          return;
        }

        // Calculate scaled dimensions while preserving aspect ratio
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
          // If 2D context fails, fallback to original sanitized string
          resolve({
            base64Data: fullDataUrl,
            mimeType: detectedMime,
            width: img.naturalWidth || 640,
            height: img.naturalHeight || 480,
          });
          return;
        }

        // Fill background with white in case of transparent PNG
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        // Always encode as standard image/jpeg to avoid pattern errors and huge payloads
        const optimizedDataUrl = canvas.toDataURL('image/jpeg', quality);

        resolve({
          base64Data: optimizedDataUrl,
          mimeType: 'image/jpeg',
          width,
          height,
        });
      } catch (err: any) {
        console.warn('Canvas optimization warning, using sanitized original:', err);
        resolve({
          base64Data: fullDataUrl,
          mimeType: detectedMime,
          width: img.naturalWidth || 640,
          height: img.naturalHeight || 480,
        });
      }
    };

    img.onerror = (err) => {
      clearTimeout(timeout);
      reject(
        new Error(
          'Could not decode product photo. Please ensure the image is a valid JPEG, PNG, or WEBP file.'
        )
      );
    };

    img.src = fullDataUrl;
  });
}

/**
 * Validates search query input
 */
export function validateSearchQuery(query: string): string {
  if (!query || typeof query !== 'string') {
    throw new Error('Please enter a product name or model number to search.');
  }
  const clean = query.trim();
  if (clean.length === 0) {
    throw new Error('Search query cannot be empty.');
  }
  if (clean.length > 200) {
    return clean.slice(0, 200);
  }
  return clean;
}

/**
 * Validates barcode input
 */
export function validateBarcode(barcode: string): string {
  if (!barcode || typeof barcode !== 'string') {
    throw new Error('Barcode data is missing.');
  }
  const clean = barcode.trim();
  if (clean.length < 3) {
    throw new Error('Barcode is too short to be a valid product code.');
  }
  return clean;
}
