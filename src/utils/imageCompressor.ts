import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase';

const MAX_INPUT_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20MB，上傳前原始檔案上限
const MAX_FIRESTORE_URL_LENGTH = 2048; // 對應 firestore.rules 嘅 photoUrl.size() <= 2048

// 網頁版留空 = 同網域；將來手機 app 會填 Cloud Run 網址
const API_BASE = ((import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '').replace(/\/$/, '');

const IMAGE_EXT_RE = /\.(jpe?g|png|webp|gif|bmp|avif|heic|heif)$/i;
const HEIC_RE = /(image\/hei[cf])|(\.(heic|heif)$)/i;

function looksLikeImage(file: File): boolean {
  return file.type.startsWith('image/') || IMAGE_EXT_RE.test(file.name);
}

function isHeic(file: File): boolean {
  return HEIC_RE.test(file.type) || HEIC_RE.test(file.name);
}

async function decodeImage(blob: Blob): Promise<{ img: HTMLImageElement; url: string }> {
  const url = URL.createObjectURL(blob);
  const img = new Image();
  img.decoding = 'async';
  img.src = url;
  try {
    await img.decode();
    return { img, url };
  } catch (err) {
    URL.revokeObjectURL(url);
    throw err;
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('讀取壓縮後圖片失敗'));
    reader.readAsDataURL(blob);
  });
}

/**
 * 壓縮圖片並統一輸出 JPEG。
 * 支援 JPG / PNG / WebP / HEIC。HEIC 會先試瀏覽器原生解碼（Safari 得），
 * 失敗先動態載入 heic2any 轉換，唔會拖慢一般用戶。
 */
export async function compressImage(
  file: File,
  maxWidth = 1280,
  maxHeight = 1280,
  quality = 0.82
): Promise<{ blob: Blob; dataUrl: string }> {
  if (!looksLikeImage(file)) {
    throw new Error('請上傳有效的圖片檔案（JPG、PNG、WebP、HEIC）');
  }
  if (file.size > MAX_INPUT_FILE_SIZE_BYTES) {
    throw new Error('圖片檔案過大（上限 20MB），請選擇較小的照片。');
  }

  let decoded: { img: HTMLImageElement; url: string };
  try {
    decoded = await decodeImage(file);
  } catch {
    if (!isHeic(file)) {
      throw new Error('解析圖片失敗，檔案可能已損毀或格式不支援');
    }
    try {
      const { default: heic2any } = await import('heic2any');
      const out = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.92 });
      decoded = await decodeImage(Array.isArray(out) ? out[0] : out);
    } catch {
      throw new Error('呢張 HEIC 相片未能轉換。可喺 iPhone「設定 > 相機 > 格式」揀「最兼容」，或截圖後再上載。');
    }
  }

  const { img, url } = decoded;
  try {
    const scale = Math.min(1, maxWidth / img.naturalWidth, maxHeight / img.naturalHeight);
    const width = Math.round(img.naturalWidth * scale);
    const height = Math.round(img.naturalHeight * scale);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('無法初始化圖片壓縮畫布');

    // 先填白色背景，避免 PNG 透明部分轉做 JPEG 後變黑
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, width, height); // 現代瀏覽器會自動跟 EXIF 方向轉正

    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('圖片壓縮轉換失敗'))),
        'image/jpeg',
        quality
      )
    );
    const dataUrl = await blobToDataUrl(blob);
    return { blob, dataUrl };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export interface PhotoUploadResult {
  downloadUrl: string;
  storagePath: string;
}

/**
 * 上傳壓縮後圖片至 Firebase Cloud Storage（主要途徑，受 storage.rules 保護：
 * 只准新建、只准 JPEG、< 5MB、唔准覆蓋）。失敗時 fallback 去伺服器 /api/upload-photo。
 * 兩條路都失敗就拋出明確錯誤，絕對唔會將 base64 當 downloadUrl 回傳。
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
    console.warn('Direct Firebase Storage upload failed, attempting server upload proxy:', storageError);
  }

  // Attempt 2: Server-side upload route (/api/upload-photo)
  if (fallbackDataUrl) {
    try {
      const response = await fetch(`${API_BASE}/api/upload-photo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: fallbackDataUrl, caseId: safeCaseId }),
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
