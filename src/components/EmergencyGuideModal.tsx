import React from 'react';
import { X, ShieldAlert, CheckCircle2, AlertTriangle, Phone, HeartPulse } from 'lucide-react';

interface EmergencyGuideModalProps {
  onClose: () => void;
}

export const EmergencyGuideModal: React.FC<EmergencyGuideModalProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto" id="emergency-guide-modal">
      <div className="relative w-full max-w-3xl bg-white rounded-3xl shadow-2xl border border-stone-200 overflow-hidden my-auto max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 bg-rose-600 text-white">
          <div className="flex items-center gap-2.5">
            <ShieldAlert className="w-6 h-6 text-rose-200" />
            <div>
              <h2 className="font-bold text-base sm:text-lg">市民現場救護應急指南 (Waiting for Rescue)</h2>
              <p className="text-xs text-rose-100">遇見流浪／受傷動物時的第一時間處置守則</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-rose-700 hover:bg-rose-800 text-white flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs text-stone-700 leading-relaxed">
          {/* Critical Rule */}
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold text-sm text-rose-900 mb-1">自身安全第一 (Safety First)</h3>
              <p className="text-rose-800">
                受傷極度疼痛或受驚的動物，即便平時溫馴，亦極可能出現本能的防禦性撕咬或抓傷。切勿徒手直接扳開口鼻或強行強抱！
              </p>
            </div>
          </div>

          {/* Dos and Don'ts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* DOs */}
            <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-4 space-y-2.5">
              <h4 className="font-bold text-sm text-emerald-900 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                建議採取的救護行動 (DO)
              </h4>
              <ul className="space-y-2 text-emerald-950">
                <li>• <strong>守護現場：</strong>在安全距離（2-3 米）持續觀察，避免動物因驚嚇逃入車道或深溝。</li>
                <li>• <strong>保暖防風：</strong>天氣寒冷或動物失血體溫下降時，可用乾淨毛毯或外套覆蓋其身軀。</li>
                <li>• <strong>拍照上傳：</strong>利用 PawPulse 拍照通報，讓 AI 即時評估傷勢並啟動 NGO 出車。</li>
                <li>• <strong>補充常溫水：</strong>僅在動物清醒且可自行低頭時，提供極少量常溫水，切勿強灌。</li>
              </ul>
            </div>

            {/* DONTs */}
            <div className="bg-stone-50 border border-stone-200 rounded-2xl p-4 space-y-2.5">
              <h4 className="font-bold text-sm text-stone-900 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-rose-500" />
                切勿採取的危險行為 (DON'T)
              </h4>
              <ul className="space-y-2 text-stone-700">
                <li>• <strong>切勿隨意翻動：</strong>疑似車禍撞擊傷者，搬動脊椎或骨盆可能造成神經切斷或致命內出血。</li>
                <li>• <strong>切勿餵食人食牛奶：</strong>貓狗多有乳糖不耐，且若需緊急全身麻醉手術，胃內食物會引致嘔吐窒息。</li>
                <li>• <strong>切勿亂擦成藥：</strong>人類的外用消炎藥、碘酒或止痛藥（如撲熱息痛）對貓狗有劇毒性。</li>
                <li>• <strong>切勿圍觀喧嘩：</strong>過多人聚攏會加劇動物心理壓力，引發休克或拚死逃竄。</li>
              </ul>
            </div>
          </div>

          {/* 24h Hotlines reminder */}
          <div className="bg-amber-50 rounded-2xl p-4 border border-amber-200 text-xs">
            <h4 className="font-bold text-amber-900 mb-2 flex items-center gap-1.5">
              <Phone className="w-4 h-4 text-amber-700" />
              全港 24 小時動物緊急意外救援熱線備忘
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-amber-950 font-medium">
              <div className="bg-white p-2.5 rounded-xl border border-amber-200/80">
                <span>愛護動物協會 (SPCA) 24h 熱線：</span>
                <a href="tel:27111000" className="text-rose-600 font-bold block text-sm">2711 1000</a>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-amber-200/80">
                <span>毛守救援 24h 緊急專線：</span>
                <a href="tel:90604880" className="text-rose-600 font-bold block text-sm">9060 4880</a>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-stone-50 border-t border-stone-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-stone-900 text-white font-bold text-xs hover:bg-stone-800 transition-colors"
          >
            我已知悉
          </button>
        </div>
      </div>
    </div>
  );
};
