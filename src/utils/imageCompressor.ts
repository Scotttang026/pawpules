import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase';

const MAX_INPUT_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20MB，上傳前原始檔案上限
const MAX_FIRESTORE_URL_LENGTH = 2048; // 對應 firestore.rules 嘅 photoUrl.size() <= 2048

/**
 * 於 HTML5 Canvas 智慧壓縮圖片。
 */
export async function compressImage(
  file: File,
  maxWidth = 1280,
  maxHeight = 1280,
  quality = 0.82
): Promise<{ blob: Blob; dataUrl: string }> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      return reject(new Error('請上傳有效的圖片檔案 (JPG, PNG, WebP)'));
    }

    if (file.size > MAX_INPUT_FILE_SIZE_BYTES) {
      return reject(new Error('圖片檔案過大（上限 20MB），請選擇較小的照片。'));
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('讀取圖片失敗'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('解析圖片失敗，檔案可能已損毀'));
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

        // 先填白色背景，避免 PNG 透明部分轉做 JPEG（冇 alpha channel）後變黑
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

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
 * 上傳壓縮後圖片至 Firebase Cloud Storage，失敗時 fallback 去伺服器
 * proxy /api/upload-photo。
 *
 * ⚠️ 關鍵修正：兩個上傳途徑都失敗時直接拋出明確錯誤，絕對唔會將
 * base64 Data URL 當做 downloadUrl 回傳（原本嘅 bug 會令成個報案
 * 流程喺最後一步被 Firestore 靜默拒絕）。
 *
 * ⚠️ 架構提醒：此函式第一步嘗試由瀏覽器直接寫入 Firebase Storage，
 * 呢一步嘅安全性完全取決於你 Firebase Storage 嘅 storage.rules——
 * 如果該規則寬鬆，會完全繞過伺服器端已強化嘅速率限制／格式驗證。
 * 強烈建議喺 Firebase Console 將 storage.rules 設定為拒絕所有直接
 * 寫入，強制此函式必定進入下方 Attempt 2 嘅安全路徑。
 */
export async function uploadAnimalPhoto(
  blob: Blob,
  caseId: string,
  fallbackDataUrl?: string
): Promise<PhotoUploadResult> {
  if (!blob || blob.size === 0) {
    throw new Error('照片資料為空，請重新選擇照片。');
  }

  const timestamp = Date.now();
  const safeCaseId =
    (caseId || `PW-${timestamp}`).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80) || `PW-${timestamp}`;
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

    if (downloadUrl && downloadUrl.length <= MAX_FIRESTORE_URL_LENGTH) {
      return { downloadUrl, storagePath };
    }

    console.warn('Firebase Storage 返回嘅連結長度超出 Firestore 限制，改用伺服器 proxy。');
  } catch (storageError) {
    console.warn('Direct Firebase Storage upload not permitted, attempting server upload proxy:', storageError);
  }

  // Attempt 2: Server-side persistent upload route (/api/upload-photo)
  if (fallbackDataUrl) {
    try {
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
        const resultUrl = result?.downloadUrl;

        if (typeof resultUrl === 'string' && resultUrl.length > 0 && resultUrl.length <= MAX_FIRESTORE_URL_LENGTH) {
          return {
            downloadUrl: resultUrl,
            storagePath: typeof result?.storagePath === 'string' ? result.storagePath : storagePath,
          };
        }
        console.warn('伺服器 proxy 返回嘅連結格式無效或過長。');
      } else {
        console.warn(`伺服器 proxy 回應 HTTP ${response.status}。`);
      }
    } catch (proxyError) {
      console.warn('Server upload fallback failed:', proxyError);
    }
  }

  throw new Error('照片上傳失敗，請檢查網絡連線後重新選擇照片再試一次。');
}
