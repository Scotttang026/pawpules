import i18n from 'i18next';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase';

const MAX_INPUT_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20MB，上傳前原始檔案上限
const MAX_FIRESTORE_URL_LENGTH = 2048; // 對應 firestore.rules 嘅 photoUrl.size() <= 2048

// 網頁版留空 = 同網域；將來手機 app 會填 Cloud Run 網址
const API_BASE = ((import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '').replace(/\/$/, '');

const IMAGE_EXT_RE = /\.(jpe?g|png|webp|gif|bmp|avif|heic|heif)$/i;
const HEIC_RE = /(image\/hei[cf])|(\.(heic|heif)$)/i;

type PhotoErrorKey =
  | 'photo.invalidType'
  | 'photo.tooLarge'
  | 'photo.decodeFailed'
  | 'photo.heicFailed'
  | 'photo.canvasFailed'
  | 'photo.compressFailed'
  | 'photo.readFailed'
  | 'photo.empty'
  | 'photo.badCaseId'
  | 'photo.uploadFailed';

/** 帶翻譯 key 嘅錯誤；message 係當時語言嘅文字，key 可俾 UI 再翻譯 */
export class PhotoError extends Error {
  constructor(public readonly key: PhotoErrorKey) {
    super(i18n.t(key));
    this.name = 'PhotoError';
  }
}

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
    reader.onerror = () => reject(new PhotoError('photo.readFailed'));
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
    throw new PhotoError('photo.invalidType');
  }
  if (file.size > MAX_INPUT_FILE_SIZE_BYTES) {
    throw new PhotoError('photo.tooLarge');
  }

  let decoded: { img: HTMLImageElement; url: string };
  try {
    decoded = await decodeImage(file);
  } catch {
    if (!isHeic(file)) {
      throw new PhotoError('photo.decodeFailed');
    }
    try {
      const { default: heic2any } = await import('heic2any');
      const out = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.92 });
      decoded = await decodeImage(Array.isArray(out) ? out[0] : out);
    } catch {
      throw new PhotoError('photo.heicFailed');
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
    if (!ctx) throw new PhotoError('photo.canvasFailed');

    // 先填白色背景，避免 PNG 透明部分轉做 JPEG 後變黑
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, width, height); // 現代瀏覽器會自動跟 EXIF 方向轉正

    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new PhotoError('photo.compressFailed'))),
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
    throw new PhotoError('photo.empty');
  }

  if (!/^[A-Za-z0-9_-]{1,64}$/.test(caseId)) {
    throw new PhotoError('photo.badCaseId');
  }
  const safeCaseId = caseId;
  // 檔名必須等於案件編號，firestore.rules 會核對相片屬於呢宗案件
  const storagePath = `animal-reports/${safeCaseId}.jpg`;

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
    console.warn('Storage download URL exceeds Firestore limit, falling back to server proxy.');
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
        console.warn('Server proxy returned an invalid or too-long URL.');
      } else {
        console.warn(`Server proxy responded with HTTP ${response.status}.`);
      }
    } catch (proxyError) {
      console.warn('Server upload fallback failed:', proxyError);
    }
  }

  throw new PhotoError('photo.uploadFailed');
}
