import React, { useEffect, useRef, useState } from 'react';
import { StrayReport, NGOOrganization, UrgencyLevel, AnimalType } from '../types';
import { INITIAL_NGOS } from '../data/mockNGOs';
import { getGoogleMapsDirectionsUrl } from '../utils/location';
import L from 'leaflet';
import { MapPin, Filter, ExternalLink, Sparkles, Building2, Phone, AlertTriangle } from 'lucide-react';

interface InteractiveMapProps {
  reports: StrayReport[];
  selectedReportId?: string;
  onSelectReport: (report: StrayReport) => void;
  centerCoords?: { lat: number; lng: number };
}

export const InteractiveMap: React.FC<InteractiveMapProps> = ({
  reports,
  selectedReportId,
  onSelectReport,
  centerCoords,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);

  // Filters
  const [filterAnimal, setFilterAnimal] = useState<'all' | AnimalType>('all');
  const [filterUrgency, setFilterUrgency] = useState<'all' | UrgencyLevel>('all');
  const [showNGOs, setShowNGOs] = useState(true);
  const [activeReport, setActiveReport] = useState<StrayReport | null>(null);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      // Center around Hong Kong / Kowloon by default
      const defaultCenter: [number, number] = centerCoords
        ? [centerCoords.lat, centerCoords.lng]
        : [22.33, 114.17];

      const map = L.map(mapContainerRef.current, {
        center: defaultCenter,
        zoom: 12,
        scrollWheelZoom: true,
      });

      // Crisp OpenStreetMap / CartoDB Voyager tiles (clean, modern, highly legible)
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        maxZoom: 19,
      }).addTo(map);

      const markersLayer = L.layerGroup().addTo(map);
      markersLayerRef.current = markersLayer;
      mapInstanceRef.current = map;
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update center if centerCoords changes
  useEffect(() => {
    if (mapInstanceRef.current && centerCoords) {
      mapInstanceRef.current.setView([centerCoords.lat, centerCoords.lng], 14, {
        animate: true,
      });
    }
  }, [centerCoords]);

  // Render Markers on Filter or Reports Change
  useEffect(() => {
    const map = mapInstanceRef.current;
    const markersLayer = markersLayerRef.current;
    if (!map || !markersLayer) return;

    markersLayer.clearLayers();

    // 1. Render Animal Case Markers
    const filteredReports = reports.filter((r) => {
      if (filterAnimal !== 'all' && r.animalType !== filterAnimal) return false;
      if (filterUrgency !== 'all' && r.urgency !== filterUrgency) return false;
      return true;
    });

    filteredReports.forEach((report) => {
      const isP0 = report.urgency === 'P0';
      const isP1 = report.urgency === 'P1';

      const bgCol = isP0 ? '#e11d48' : isP1 ? '#f59e0b' : '#10b981';
      const pulseAnimation = isP0 ? 'animation: pulse 1.5s infinite;' : '';

      // Custom HTML Marker Icon
      const customIcon = L.divIcon({
        className: 'custom-case-pin',
        html: `
          <div style="
            position: relative;
            width: 38px;
            height: 38px;
            background: ${bgCol};
            border: 3px solid white;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            box-shadow: 0 4px 10px rgba(0,0,0,0.3);
            font-size: 16px;
            font-weight: bold;
            cursor: pointer;
            ${pulseAnimation}
          ">
            <span>${report.animalType === 'cat' ? '🐱' : report.animalType === 'dog' ? '🐶' : '🐾'}</span>
            <span style="
              position: absolute;
              bottom: -6px;
              right: -6px;
              background: #1c1917;
              color: white;
              font-size: 10px;
              font-weight: 800;
              padding: 1px 4px;
              border-radius: 9999px;
              border: 1px solid white;
            ">${report.urgency}</span>
          </div>
        `,
        iconSize: [38, 38],
        iconAnchor: [19, 19],
      });

      const marker = L.marker([report.location.lat, report.location.lng], { icon: customIcon });

      marker.on('click', () => {
        setActiveReport(report);
        onSelectReport(report);
      });

      markersLayer.addLayer(marker);
    });

    // 2. Render NGO Organization Markers
    if (showNGOs) {
      INITIAL_NGOS.forEach((ngo) => {
        const ngoIcon = L.divIcon({
          className: 'custom-ngo-pin',
          html: `
            <div style="
              width: 32px;
              height: 32px;
              background: #0284c7;
              border: 2px solid white;
              border-radius: 8px;
              display: flex;
              align-items: center;
              justify-content: center;
              color: white;
              box-shadow: 0 3px 8px rgba(0,0,0,0.25);
              font-size: 14px;
              cursor: pointer;
            ">
              🏥
            </div>
          `,
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        });

        const ngoMarker = L.marker([ngo.lat, ngo.lng], { icon: ngoIcon });
        ngoMarker.bindPopup(`
          <div style="font-family: sans-serif; min-width: 200px;">
            <div style="font-weight: bold; font-size: 13px; color: #0f172a; margin-bottom: 2px;">
              ${ngo.name}
            </div>
            <div style="font-size: 11px; color: #64748b; margin-bottom: 6px;">
              ${ngo.englishName}
            </div>
            <div style="font-size: 11px; color: #334155; margin-bottom: 4px;">
              📍 ${ngo.address}
            </div>
            <div style="font-size: 11px; color: #dc2626; font-weight: 600; margin-bottom: 8px;">
              📞 救助專線：${ngo.hotline}
            </div>
            <a href="https://www.google.com/maps/search/?api=1&query=${ngo.lat},${ngo.lng}" 
               target="_blank" 
               rel="noopener noreferrer"
               style="display: inline-block; font-size: 11px; background: #f1f5f9; color: #0284c7; padding: 4px 8px; border-radius: 6px; text-decoration: none; font-weight: bold;">
              在 Google 地圖導航 ↗
            </a>
          </div>
        `);

        markersLayer.addLayer(ngoMarker);
      });
    }
  }, [reports, filterAnimal, filterUrgency, showNGOs, onSelectReport]);

  return (
    <div className="relative w-full h-[650px] rounded-3xl overflow-hidden border border-stone-200 shadow-sm bg-stone-100" id="interactive-map-container">
      {/* Top Filter Bar */}
      <div className="absolute top-4 left-4 right-4 z-[1000] flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        <div className="flex items-center gap-1.5 p-1.5 rounded-2xl bg-white/95 backdrop-blur border border-stone-200 shadow-md pointer-events-auto">
          {/* Animal Filter */}
          <div className="flex items-center gap-1 border-r border-stone-200 pr-1.5 mr-0.5">
            <button
              onClick={() => setFilterAnimal('all')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors ${
                filterAnimal === 'all' ? 'bg-amber-500 text-white' : 'text-stone-700 hover:bg-stone-100'
              }`}
            >
              全部物種
            </button>
            <button
              onClick={() => setFilterAnimal('cat')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors ${
                filterAnimal === 'cat' ? 'bg-amber-500 text-white' : 'text-stone-700 hover:bg-stone-100'
              }`}
            >
              🐱 貓咪
            </button>
            <button
              onClick={() => setFilterAnimal('dog')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors ${
                filterAnimal === 'dog' ? 'bg-amber-500 text-white' : 'text-stone-700 hover:bg-stone-100'
              }`}
            >
              🐶 犬隻
            </button>
          </div>

          {/* Urgency Filter */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setFilterUrgency('all')}
              className={`px-2 py-1 text-xs font-medium rounded-lg ${
                filterUrgency === 'all' ? 'bg-stone-900 text-white' : 'text-stone-600 hover:bg-stone-100'
              }`}
            >
              所有等級
            </button>
            <button
              onClick={() => setFilterUrgency('P0')}
              className={`px-2 py-1 text-xs font-bold rounded-lg ${
                filterUrgency === 'P0' ? 'bg-rose-600 text-white' : 'text-rose-700 hover:bg-rose-50'
              }`}
            >
              P0 危急
            </button>
            <button
              onClick={() => setFilterUrgency('P1')}
              className={`px-2 py-1 text-xs font-bold rounded-lg ${
                filterUrgency === 'P1' ? 'bg-amber-500 text-white' : 'text-amber-700 hover:bg-amber-50'
              }`}
            >
              P1 醫療
            </button>
            <button
              onClick={() => setFilterUrgency('P2')}
              className={`px-2 py-1 text-xs font-medium rounded-lg ${
                filterUrgency === 'P2' ? 'bg-emerald-600 text-white' : 'text-emerald-700 hover:bg-emerald-50'
              }`}
            >
              P2 穩定
            </button>
          </div>
        </div>

        {/* Toggle NGOs Pin */}
        <div className="p-1.5 rounded-2xl bg-white/95 backdrop-blur border border-stone-200 shadow-md pointer-events-auto flex items-center gap-2">
          <label className="flex items-center gap-2 text-xs font-bold text-stone-800 cursor-pointer px-2">
            <input
              type="checkbox"
              checked={showNGOs}
              onChange={(e) => setShowNGOs(e.target.checked)}
              className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
            />
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-blue-600 inline-block" />
              顯示救助機構 (NGO)
            </span>
          </label>
        </div>
      </div>

      {/* Actual Leaflet Map Canvas */}
      <div ref={mapContainerRef} className="w-full h-full" />

      {/* Floating Active Case Card (Bottom overlay if marker clicked) */}
      {activeReport && (
        <div className="absolute bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-96 z-[1000] bg-white/95 backdrop-blur rounded-2xl border border-stone-200 shadow-xl p-4 transition-all">
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="flex items-center gap-2">
              <span
                className={`text-xs font-bold px-2 py-0.5 rounded-full text-white ${
                  activeReport.urgency === 'P0'
                    ? 'bg-rose-600 animate-pulse'
                    : activeReport.urgency === 'P1'
                    ? 'bg-amber-500'
                    : 'bg-emerald-600'
                }`}
              >
                {activeReport.urgency}
              </span>
              <span className="text-xs font-bold text-stone-800">{activeReport.title}</span>
            </div>
            <button
              onClick={() => setActiveReport(null)}
              className="text-stone-400 hover:text-stone-600 text-xs font-bold p-1"
            >
              ✕
            </button>
          </div>

          <div className="flex gap-3 mb-3">
            <img
              src={activeReport.photoUrl}
              alt="個案照片"
              className="w-16 h-16 rounded-xl object-cover shrink-0 border border-stone-200"
              referrerPolicy="no-referrer"
            />
            <div className="text-xs text-stone-600 overflow-hidden">
              <p className="font-semibold text-stone-900 truncate mb-1">
                📍 {activeReport.location.address}
              </p>
              <p className="line-clamp-2 text-stone-500 mb-1">
                {activeReport.description}
              </p>
              {activeReport.aiAnalysis && (
                <div className="flex items-center gap-1 text-[11px] text-amber-700 font-medium">
                  <Sparkles className="w-3 h-3 text-amber-600" />
                  <span>AI: {activeReport.aiAnalysis.apparentInjuries[0] || '傷勢已分析'}</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 pt-2 border-t border-stone-100">
            <a
              href={getGoogleMapsDirectionsUrl(activeReport.location.lat, activeReport.location.lng)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-stone-600 hover:text-stone-900 font-medium"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              在 Google 地圖導航
            </a>

            <button
              type="button"
              onClick={() => onSelectReport(activeReport)}
              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-bold shadow-xs transition-colors"
            >
              檢視完整診斷 ＆ 媒合
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
