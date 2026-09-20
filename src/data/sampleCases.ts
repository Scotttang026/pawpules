import { StrayReport } from '../types';
import { rankNGOsForCase } from './mockNGOs';

export const SAMPLE_CASES: StrayReport[] = [
  {
    id: 'case-001',
    title: '旺角亞皆老街巷口受傷幼貓',
    animalType: 'cat',
    customAnimalName: '小橘貓',
    photoUrl: 'https://images.unsplash.com/photo-1548802673-380ab8ebc7b7?auto=format&fit=crop&w=800&q=80',
    location: {
      lat: 22.3193,
      lng: 114.1694,
      address: '九龍旺角亞皆老街45號後巷',
      district: '油尖旺區',
    },
    description: '發現一隻約2個月大橘白幼貓蜷縮在冷氣機底，左前肢不敢著地，疑似骨折，不斷微弱哀鳴，眼睛有嚴重分泌物。',
    reporterName: '陳先生',
    reporterPhone: '9123 4567',
    createdAt: new Date(Date.now() - 42 * 60 * 1000).toISOString(), // 42 mins ago
    status: 'in_progress',
    urgency: 'P1',
    aiAnalysis: {
      identifiedSpecies: '貓 (Felis catus)',
      estimatedBreed: '短毛家貓 (橘白斑紋)',
      appearanceDescription: '幼貓約 2-3 個月大，體態偏瘦，毛髮沾有灰塵及水漬，左前肢收縮呈保護姿態。',
      apparentInjuries: ['左前肢疑似閉合性骨折或嚴重扭傷', '雙眼膿性分泌物 (疑似上呼吸道感染)', '輕度脫水與體溫偏低'],
      urgencyLevel: 'P1',
      urgencyReason: '幼貓骨折疼痛且合併呼吸道症狀，抵抗力低下，需在數小時內送診接受止痛、固定與抗生素治療。',
      rescueEquipment: ['幼貓專用誘捕籠 / 提籠', '防抓厚毛巾 / 柔軟毛毯', '暖水袋 (維持體溫)', '生理食鹽水棉棒 (清理眼部)'],
      firstAidAdvice: [
        '保持距離並保持環境安靜，避免幼貓受驚竄入深處隙縫。',
        '可用柔軟毛毯包裹其身體以保暖，切勿強行拉扯受傷的前肢。',
        '勿強行灌水或餵食牛奶，可用乾淨濕紙巾輕抹眼周分泌物。'
      ],
      handlingPrecautions: ['幼貓驚慌時可能微弱抓咬，操作需戴厚棉手套', '動作請放輕，避免驚動逃離'],
      confidenceScore: 0.94,
      analyzedAt: new Date(Date.now() - 40 * 60 * 1000).toISOString(),
    },
    matchedNGOs: rankNGOsForCase(22.3193, 114.1694, 'cat', 'P1').slice(0, 3),
    dispatchedToNGO: {
      ngoId: 'ngo-hk-cats-care',
      ngoName: '香港流浪貓守護天使聯盟',
      dispatchedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      status: 'en_route',
    },
  },
  {
    id: 'case-002',
    title: '沙田城門河畔疑似車禍擦傷唐狗',
    animalType: 'dog',
    customAnimalName: '黑唐狗',
    photoUrl: 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&w=800&q=80',
    location: {
      lat: 22.3857,
      lng: 114.1915,
      address: '新界沙田大涌橋路近城門河單車徑邊草叢',
      district: '沙田區',
    },
    description: '看到黑色中型唐狗倒臥在草叢邊，後腿有明顯擦傷滲血，腹部起伏劇烈，對路人有警惕性但無力站起。',
    reporterName: '李小姐',
    reporterPhone: '6234 5678',
    createdAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(), // 15 mins ago
    status: 'analyzed',
    urgency: 'P0',
    aiAnalysis: {
      identifiedSpecies: '犬 (Canis lupus familiaris)',
      estimatedBreed: '香港米克斯 / 中型混種唐狗',
      appearanceDescription: '成犬黑色短毛，胸口微白，體重約 16-18 kg。側躺無力，舌色稍偏淡。',
      apparentInjuries: ['後腿及臀部大面積擦傷出滲血', '後軀無力，懷疑骨盆挫傷或內出血', '呼吸急促，休克前期徵象'],
      urgencyLevel: 'P0',
      urgencyReason: '疑似車禍撞擊傷，可能存在骨盆骨折及內部出血風險，生命徵象危急，需急救車即刻馳援！',
      rescueEquipment: ['大型犬專用擔架布', '犬用口套 / 紗布套嘴', '無菌止血敷料及壓力繃帶', '24小時急診動物救護車'],
      firstAidAdvice: [
        '立即通報具備急診出車能力的 NGO（如 SPCA / 毛守救援）。',
        '切勿隨意搬動犬隻軀幹與脊椎，避免二次傷害或加重內出血。',
        '傷犬疼痛時可能出現防禦性咬人反應，市民切勿徒手接觸口鼻。',
        '可用外套或傘為其遮蔭/保暖，在現場守候直至救援隊抵達。'
      ],
      handlingPrecautions: ['切勿徒手拉扯後肢', '傷勢嚴重時犬隻可能驚懼咬人，需由專業義工以擔架搬運'],
      confidenceScore: 0.96,
      analyzedAt: new Date(Date.now() - 14 * 60 * 1000).toISOString(),
    },
    matchedNGOs: rankNGOsForCase(22.3857, 114.1915, 'dog', 'P0').slice(0, 3),
    dispatchedToNGO: {
      ngoId: 'ngo-paws-guardian',
      ngoName: '毛守救援 (Paws Guardian)',
      dispatchedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
      status: 'acknowledged',
    },
  },
  {
    id: 'case-003',
    title: '元朗錦田公路旁迷途走失金毛尋回犬',
    animalType: 'dog',
    customAnimalName: '金毛大狗',
    photoUrl: 'https://images.unsplash.com/photo-1552053831-71594a27632d?auto=format&fit=crop&w=800&q=80',
    location: {
      lat: 22.4435,
      lng: 114.0682,
      address: '元朗錦田高埔村路口公車站旁',
      district: '元朗區',
    },
    description: '戴著紅色項圈的金毛犬，看起來親人，在公車站旁踱步尋找主人，有些口渴疲憊，無明顯外傷。',
    reporterName: '郭先生',
    reporterPhone: '9876 5432',
    createdAt: new Date(Date.now() - 120 * 60 * 1000).toISOString(),
    status: 'rescued',
    urgency: 'P2',
    aiAnalysis: {
      identifiedSpecies: '犬 (Canis lupus familiaris)',
      estimatedBreed: '金毛尋回犬 (Golden Retriever)',
      appearanceDescription: '成年金毛，毛色金黃乾淨，頸部有紅色項圈，精神尚可，對人親善。',
      apparentInjuries: ['無明顯創傷', '輕度口渴疲憊', '疑似與主人走失'],
      urgencyLevel: 'P2',
      urgencyReason: '無外傷，生命徵象穩定。需儘快掃描晶片並暫時收容安置，避免公路車輛危險。',
      rescueEquipment: ['牽引繩 / 胸背帶', '乾淨飲用水與水碗', '晶片掃描器'],
      firstAidAdvice: [
        '給予少量常溫水補充水分。',
        '使用牽引繩將其牽至安全避車處，避免衝出公路。',
        '通報鄰近機構（如阿棍屋或大樹下）前來掃描體內晶片聯絡主人。'
      ],
      handlingPrecautions: ['動作溫和，注意公路來車安全'],
      confidenceScore: 0.98,
      analyzedAt: new Date(Date.now() - 118 * 60 * 1000).toISOString(),
    },
    matchedNGOs: rankNGOsForCase(22.4435, 114.0682, 'dog', 'P2').slice(0, 3),
  }
];
