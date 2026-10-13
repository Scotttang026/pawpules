// ⚠️ 已加入 'bird'，同 firestore.rules 及 entities schema 對齊。
// 如果產品範圍確實不打算處理雀鳥案件，請反過來喺 Rules／schema 移除 bird。
export type AnimalType = 'cat' | 'dog' | 'bird' | 'other';
// 報案人喺「現場狀況」揀嘅標籤（可以揀多個），用嚟喺地圖同個案頁篩選
export type CaseTag = 'stray' | 'injured' | 'trapped' | 'juvenile' | 'adult';

export type UrgencyLevel = 'P0' | 'P1' | 'P2'; // P0: 極度緊急(重傷/瀕危), P1: 需醫療關注(骨折/明顯傷病), P2: 穩定(走失/幼崽/普通救助)

// ⚠️ 已移除 'analyzed' 與 'dispatched'，因為目前 firestore.rules 嘅
// isValidCase() 只接受 pending/in_progress/rescued/closed 四個值，
// 寫入其他兩個值會被 Firestore 直接拒絕。如果你有計劃將來引入
// 更細緻嘅分階段狀態，請同時擴充 firestore.rules 嘅 enum。
export type CaseStatus = 'pending' | 'in_progress' | 'rescued' | 'closed';

export type NGOCapacityStatus = 'available' | 'busy' | 'full';

export interface LocationCoords {
  lat: number;
  lng: number;
  address: string;
  district?: string;
}

export interface AIAnalysisResult {
  identifiedSpecies: string;
  estimatedBreed: string;
  appearanceDescription: string;
  apparentInjuries: string[];
  urgencyLevel: UrgencyLevel;
  urgencyReason: string;
  rescueEquipment: string[];
  firstAidAdvice: string[];
  handlingPrecautions: string[];
  confidenceScore: number;
  analyzedAt: string;
}

export interface NGOOrganization {
  id: string;
  name: string;
  englishName: string;
  hotline: string;
  whatsapp?: string;
  publicEmail?: string;  // 公開電郵（報案人睇到），唔係登入用
  website?: string;      // 只接受 http(s):// 開頭
  address: string;
  district: string;
  lat: number;
  lng: number;
  acceptedAnimals: AnimalType[];
  specialties: string[];
  operatingHours: string;
  hasEmergencyRescue: boolean;
  capacityStatus?: NGOCapacityStatus;
  distanceKm?: number;
  driveTimeMins?: number;
  matchScore?: number;
}

// 機構登入帳戶（ngouser/{uid}），只有 admin 同本人讀到
export interface NgoAccount {
  uid: string;
  email: string;
  ngoId: string;
}

export interface CasePhoto {
  url: string;   // Storage 下載網址
  path: string;  // animal-reports/{caseId}/{index}.jpg
}

/** NGO 接手紀錄（公開資料，唔放職員電郵） */
export interface CaseAcceptance {
  ngoId: string;
  ngoName: string;
  acceptedByUid: string;
  acceptedAt: string;
}

export interface StrayReport {
  id: string; // Case ID
  title: string;
  animalType: AnimalType;
  customAnimalName?: string;
  tags?: CaseTag[];
  photoUrl: string; // Cloud Storage public URL or served URL
  storagePath?: string; // Cloud Storage object path linked to this case
  photos: CasePhoto[];   // 全部相（第 1 張 = photoUrl 封面）
  acceptedBy?: CaseAcceptance;
  location: LocationCoords;
  description: string;
  reporterName: string;
  reporterPhone: string;
  reporterEmail?: string;
  createdByUid?: string;
  createdAt: string;
  status: CaseStatus;
  urgency: UrgencyLevel;
  geminiResponse?: AIAnalysisResult | null; // gemini 回答內容
  aiAnalysis?: AIAnalysisResult | null;
  matchedNGOs?: NGOOrganization[];
  dispatchedToNGO?: {
    ngoId: string;
    ngoName: string;
    dispatchedAt: string;
    status: 'sent' | 'acknowledged' | 'en_route' | 'arrived';
    // ⚠️ 新增：反映伺服器目前尚未串接真實推播服務嘅誠實標記，
    // 對應 server.ts /api/ngo/notify 回傳嘅 simulated 欄位
    simulated?: boolean;
  };
}

// 登入後嘅身份；未登入就係 null（唔係呢度其中一個值）
export type UserRole = 'user' | 'ngo' | 'admin';

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  role: UserRole;
  ngoId: string | null; // 只有 ngo 先有，對應 ngodatail/{ngoId}
  isAdmin: boolean;
}
