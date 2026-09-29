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

/**
 * Uploads a compressed image blob to Firebase Cloud Storage.
 * Returns public download URL. If cloud storage upload fails, returns dataUrl fallback.
 */
export async function uploadAnimalPhoto(
  blob: Blob,
  caseId: string,
  fallbackDataUrl?: string
): Promise<string> {
  try {
    const timestamp = Date.now();
    const safeCaseId = caseId.replace(/[^a-zA-Z0-9_-]/g, '');
    const storageRef = ref(storage, `animal-reports/${safeCaseId}_${timestamp}.jpg`);
    
    const snapshot = await uploadBytes(storageRef, blob, {
      contentType: 'image/jpeg',
      customMetadata: {
        caseId: safeCaseId,
        uploadedAt: new Date().toISOString(),
      },
    });

    const downloadUrl = await getDownloadURL(snapshot.ref);
    return downloadUrl;
  } catch (storageError) {
    console.warn('Firebase Storage upload failed or not configured, using compressed image fallback:', storageError);
    return fallbackDataUrl || '';
  }
}
