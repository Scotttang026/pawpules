export type AnimalType = 'cat' | 'dog' | 'other';

export type UrgencyLevel = 'P0' | 'P1' | 'P2'; // P0: 極度緊急(重傷/瀕危), P1: 需醫療關注(骨折/明顯傷病), P2: 穩定(走失/幼崽/普通救助)

export type CaseStatus = 'pending' | 'analyzed' | 'dispatched' | 'in_progress' | 'rescued';

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
  address: string;
  district: string;
  lat: number;
  lng: number;
  acceptedAnimals: AnimalType[];
  specialties: string[];
  operatingHours: string;
  hasEmergencyRescue: boolean;
  distanceKm?: number;
  driveTimeMins?: number;
  matchScore?: number;
}

export interface StrayReport {
  id: string;
  title: string;
  animalType: AnimalType;
  customAnimalName?: string;
  photoUrl: string;
  location: LocationCoords;
  description: string;
  reporterName: string;
  reporterPhone: string;
  createdAt: string;
  status: CaseStatus;
  urgency: UrgencyLevel;
  aiAnalysis?: AIAnalysisResult;
  matchedNGOs?: NGOOrganization[];
  dispatchedToNGO?: {
    ngoId: string;
    ngoName: string;
    dispatchedAt: string;
    status: 'sent' | 'acknowledged' | 'en_route';
  };
}
