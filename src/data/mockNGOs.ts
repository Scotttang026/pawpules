import { NGOOrganization, AnimalType } from '../types';

export const INITIAL_NGOS: NGOOrganization[] = [
  {
    id: 'ngo-spca',
    name: '香港愛護動物協會 (SPCA)',
    englishName: 'Society for the Prevention of Cruelty to Animals',
    hotline: '2711 1000',
    whatsapp: '5566 7788',
    address: '灣仔運盛街5號 (全港24小時動物救助行動總部)',
    district: '灣仔區',
    lat: 22.2831,
    lng: 114.1789,
    acceptedAnimals: ['cat', 'dog', 'other'],
    specialties: ['24小時緊急意外救援', '虐待動物調查', '重傷手術急救', '全港出車'],
    operatingHours: '24小時全天候緊急熱線 (2711 1000)',
    hasEmergencyRescue: true,
  },
  {
    id: 'ngo-paws-guardian',
    name: '毛守救援 (Paws Guardian)',
    englishName: 'Paws Guardian Rescue Association',
    hotline: '9060 4880',
    whatsapp: '9060 4880',
    address: '元朗錦田大江埔村',
    district: '元朗區',
    lat: 22.4412,
    lng: 114.0734,
    acceptedAnimals: ['dog', 'cat'],
    specialties: ['危急流浪動物第一線搜救', '捕犬器專業誘捕', '深坑受困救援', '重傷車禍搶救'],
    operatingHours: '24小時緊急義工救援專線',
    hasEmergencyRescue: true,
  },
  {
    id: 'ngo-saa',
    name: '保護遺棄動物協會 (SAA)',
    englishName: 'Society for Abandoned Animals',
    hotline: '2838 4808',
    whatsapp: '9211 3456',
    address: '元朗白沙村第一段281號',
    district: '元朗區',
    lat: 22.4289,
    lng: 114.0261,
    acceptedAnimals: ['cat', 'dog'],
    specialties: ['不殺生收容所', '醫療善終', '大型犬收容照護', '街貓絕育及救助'],
    operatingHours: '10:00 - 18:00 (急症轉介支援至 22:00)',
    hasEmergencyRescue: false,
  },
  {
    id: 'ngo-agnhouse',
    name: '阿棍屋 (House of Joy & Mercy)',
    englishName: 'House of Joy & Mercy',
    hotline: '9424 5543',
    whatsapp: '9424 5543',
    address: '錦田下高埔村 (新界西救援中心)',
    district: '元朗區',
    lat: 22.4468,
    lng: 114.0621,
    acceptedAnimals: ['dog', 'cat'],
    specialties: ['老弱傷殘流浪犬貓收容', '重大車禍創傷照護', '臨終舒緩安寧'],
    operatingHours: '09:00 - 21:00 (緊急案件專人即時回應)',
    hasEmergencyRescue: true,
  },
  {
    id: 'ngo-hkdr',
    name: '救狗之家 (Hong Kong Dog Rescue)',
    englishName: 'Hong Kong Dog Rescue',
    hotline: '2875 2132',
    address: '鴨脷洲大街21號新利大廈',
    district: '南區',
    lat: 22.2443,
    lng: 114.1565,
    acceptedAnimals: ['dog'],
    specialties: ['流浪幼犬急救', '被棄犬隻復康', '行為矯正與領養'],
    operatingHours: '10:00 - 18:00 (全年無休)',
    hasEmergencyRescue: false,
  },
  {
    id: 'ngo-hk-cats-care',
    name: '香港流浪貓守護天使聯盟',
    englishName: 'HK Stray Cats Guardian League',
    hotline: '6123 9876',
    whatsapp: '6123 9876',
    address: '九龍旺角彌敦道578號 (九龍區貓咪緊急暫託站)',
    district: '油尖旺區',
    lat: 22.3168,
    lng: 114.1702,
    acceptedAnimals: ['cat'],
    specialties: ['母貓帶幼貓緊急誘捕', '失明/貓瘟急症醫療', '高空墜樓受困貓救援'],
    operatingHours: '24小時緊急義工 WhatsApp 連線',
    hasEmergencyRescue: true,
  },
  {
    id: 'ngo-bigtree',
    name: '大樹下善待動物庇護者',
    englishName: 'Big Tree Animal Sanctuary and Adoption Centre',
    hotline: '9379 8133',
    whatsapp: '9379 8133',
    address: '元朗逢吉鄉錦莆路',
    district: '元朗區',
    lat: 22.4578,
    lng: 114.0538,
    acceptedAnimals: ['dog', 'cat'],
    specialties: ['流浪狗場避難所', '鄉村被遺棄動物緊急收容', '傷病狗隻手術後復健'],
    operatingHours: '10:00 - 17:00 (緊急救援請直接致電)',
    hasEmergencyRescue: true,
  },
  {
    id: 'ngo-shatin-animal',
    name: '沙田及新界東動物救援義工隊',
    englishName: 'Shatin & NT East Animal Rescue Volunteers',
    hotline: '9888 1234',
    whatsapp: '9888 1234',
    address: '沙田火炭山尾街',
    district: '沙田區',
    lat: 22.3951,
    lng: 114.1952,
    acceptedAnimals: ['cat', 'dog', 'other'],
    specialties: ['城門河及山徑流浪動物救援', '雨季渠道受困搶救', '夜間即時出勤隊伍'],
    operatingHours: '24小時即時回覆',
    hasEmergencyRescue: true,
  }
];

// Calculate Haversine distance in kilometers
export function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c;
  return Math.round(d * 10) / 10; // 1 decimal place
}

// Estimate drive time in minutes roughly based on distance & urban density
export function estimateDriveTimeMinutes(distanceKm: number): number {
  const avgSpeedKmH = 35; // typical city/mixed speed
  const mins = Math.round((distanceKm / avgSpeedKmH) * 60) + 3; // +3 min buffer
  return Math.max(2, mins);
}

// Score and rank NGOs for a specific case
export function rankNGOsForCase(
  caseLat: number,
  caseLng: number,
  animalType: AnimalType,
  urgency: 'P0' | 'P1' | 'P2'
): NGOOrganization[] {
  return INITIAL_NGOS
    .map((ngo) => {
      const distanceKm = calculateDistanceKm(caseLat, caseLng, ngo.lat, ngo.lng);
      const driveTimeMins = estimateDriveTimeMinutes(distanceKm);

      // Match scoring logic
      let score = 100;

      // 1. Distance penalty
      score -= Math.min(45, distanceKm * 2.2);

      // 2. Animal type compatibility
      if (ngo.acceptedAnimals.includes(animalType)) {
        score += 15;
      } else {
        score -= 50; // Incompatible animal type
      }

      // 3. Emergency capability bonus for P0/P1
      if (urgency === 'P0') {
        if (ngo.hasEmergencyRescue) {
          score += 25;
        } else {
          score -= 30;
        }
      } else if (urgency === 'P1' && ngo.hasEmergencyRescue) {
        score += 10;
      }

      const matchScore = Math.max(10, Math.min(99, Math.round(score)));

      return {
        ...ngo,
        distanceKm,
        driveTimeMins,
        matchScore,
      };
    })
    .sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));
}
