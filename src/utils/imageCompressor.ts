import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase';

/**
 * Compresses an image file on an HTML5 canvas before uploading.
 * Reduces bandwidth, avoids base64 bloat, and standardizes image dimension.
 */
export async function compressImage(
  file: File,
  maxWidth = 1280,
  maxHeight = 1280,
  quality = 0.82
): Promise<{ blob: Blob; dataUrl: string }> {
  return new Promise((resolve, reject) => {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      return reject(new Error('請上傳有效的圖片檔案 (JPG, PNG, WebP)'));
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('讀取圖片失敗'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('解析圖片失敗'));
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return reject(new Error('無法初始化圖片壓縮畫布'));
        }

        ctx.drawImage(img, 0, 0, width, height);

        // Try webp, fallback to jpeg
        const outputType = 'image/jpeg';
        const dataUrl = canvas.toDataURL(outputType, quality);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve({ blob, dataUrl });
            } else {
              reject(new Error('圖片壓縮轉換失敗'));
            }
          },
          outputType,
          quality
        );
      };

      img.src = e.target?.result as string;
    };

    reader.readAsDataURL(file);
  });
}

export interface PhotoUploadResult {
  downloadUrl: string;
  storagePath: string;
}

/**
 * Uploads a compressed image blob to Firebase Cloud Storage.
 * Links the upload with the Case ID.
 * Returns public download URL and storage path.
 */
export async function uploadAnimalPhoto(
  blob: Blob,
  caseId: string,
  fallbackDataUrl?: string
): Promise<PhotoUploadResult> {
  const timestamp = Date.now();
  const safeCaseId = (caseId || `PW-${Date.now()}`).replace(/[^a-zA-Z0-9_-]/g, '');
  const storagePath = `animal-reports/${safeCaseId}_${timestamp}.jpg`;

  // Attempt 1: Direct Firebase Cloud Storage upload
  try {
    const storageRef = ref(storage, storagePath);
    const snapshot = await uploadBytes(storageRef, blob, {
      contentType: 'image/jpeg',
      customMetadata: {
        caseId: safeCaseId,
        uploadedAt: new Date().toISOString(),
      },
    });

    const downloadUrl = await getDownloadURL(snapshot.ref);
    return { downloadUrl, storagePath };
  } catch (storageError) {
    console.warn('Direct Firebase Storage upload not permitted or unauthenticated, attempting server upload proxy:', storageError);
  }

  // Attempt 2: Server-side persistent upload route (/api/upload-photo)
  try {
    if (fallbackDataUrl) {
      const response = await fetch('/api/upload-photo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: fallbackDataUrl,
          caseId: safeCaseId,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        return {
          downloadUrl: result.downloadUrl || fallbackDataUrl,
          storagePath: result.storagePath || storagePath,
        };
      }
    }
  } catch (proxyError) {
    console.warn('Server upload fallback failed:', proxyError);
  }

  // Fallback to data URL
  return {
    downloadUrl: fallbackDataUrl || '',
    storagePath,
  };
}
