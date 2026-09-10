import React, { useState, useEffect, useRef } from 'react';
import { 
  Hospital, MapPin, PhoneCall, Zap, Clock, ShieldCheck, 
  Activity, RefreshCw, ArrowRight, Bed, Navigation,
  ZoomIn, ZoomOut, RotateCcw, Maximize2, Minimize2,
  Radio, Compass, Layers, CheckCircle2, ChevronRight, Phone
} from 'lucide-react';
import { HospitalEvaluation } from '../types';
import { rankAllHospitals } from '../services/geo';
import { VibrationService } from '../services/vibrationService';

interface NearestHospitalsViewProps {
  onSelectHospitalForAdmit: (hospital: HospitalEvaluation) => void;
  onCallHospitalPhone?: (phone: string) => void;
}

export const NearestHospitalsView: React.FC<NearestHospitalsViewProps> = ({
  onSelectHospitalForAdmit,
}) => {
  const [lat, setLat] = useState<number>(28.6139);
  const [long, setLong] = useState<number>(77.2090);
  const [isDetecting, setIsDetecting] = useState<boolean>(false);
  const [locationStatus, setLocationStatus] = useState<string>('Central Health District (28.6139° N, 77.2090° E)');
  const [evaluations, setEvaluations] = useState<HospitalEvaluation[]>([]);
  const [selectedHospitalId, setSelectedHospitalId] = useState<string | null>(null);
  const [isMapExpanded, setIsMapExpanded] = useState<boolean>(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'level1' | 'high_beds' | 'fast_eta'>('all');

  // Map Zoom & Pan State
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragOriginRef = useRef<{ mouseX: number; mouseY: number; panX: number; panY: number } | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    updateRankings(lat, long);
    detectLocation();
  }, []);

  const updateRankings = (userLat: number, userLong: number) => {
    const results = rankAllHospitals(userLat, userLong);
    setEvaluations(results);
    if (results.length > 0 && !selectedHospitalId) {
      const best = results.find(e => e.isBestChoice) || results[0];
      setSelectedHospitalId(best.hospital.id);
    }
  };

  const detectLocation = () => {
    if (!navigator.geolocation) {
      setLocationStatus('Geolocation not supported. Showing central hospital registry.');
      return;
    }

    setIsDetecting(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const uLat = Math.round(pos.coords.latitude * 10000) / 10000;
        const uLng = Math.round(pos.coords.longitude * 10000) / 10000;
        setLat(uLat);
        setLong(uLng);
        setLocationStatus(`GPS: ${uLat.toFixed(4)}° N, ${uLng.toFixed(4)}° E`);
        setIsDetecting(false);
        updateRankings(uLat, uLng);
      },
      () => {
        setLocationStatus('GPS signal unavailable. Defaulting to New Delhi central cluster.');
        setIsDetecting(false);
        updateRankings(28.6139, 77.2090);
      },
      { enableHighAccuracy: true, timeout: 6000 }
    );
  };

  const bestChoice = evaluations.find(e => e.isBestChoice) || evaluations[0];
  const highlightedEval = evaluations.find(e => e.hospital.id === selectedHospitalId) || bestChoice;

  // Projection math: centered at (300, 200) for user location
  const degToPxX = 1400;
  const degToPxY = 1600;

  const projectPoint = (hLat: number, hLng: number) => {
    const x = 300 + (hLng - long) * degToPxX;
    const y = 200 - (hLat - lat) * degToPxY;
    return { x, y };
  };

  // ViewBox calculation
  const vbWidth = 600 / zoom;
  const vbHeight = 400 / zoom;
  const vbMinX = (300 + pan.x) - vbWidth / 2;
  const vbMinY = (200 + pan.y) - vbHeight / 2;
  const computedViewBox = `${vbMinX} ${vbMinY} ${vbWidth} ${vbHeight}`;

  // Focus on a specific hospital
  const handleFocusHospital = (hosp: HospitalEvaluation) => {
    setSelectedHospitalId(hosp.hospital.id);
    const pt = projectPoint(hosp.hospital.lat, hosp.hospital.lng);
    setPan({ x: pt.x - 300, y: pt.y - 200 });
    setZoom(1.5);
    VibrationService.triggerQuickTap();
  };

  const handleZoomIn = () => {
    setZoom(prev => Math.min(3.2, Math.round((prev + 0.3) * 100) / 100));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(0.7, Math.round((prev - 0.3) * 100) / 100));
  };

  const handleResetMap = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    VibrationService.triggerQuickTap();
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.15 : -0.15;
    setZoom(prev => Math.min(3.2, Math.max(0.7, Math.round((prev + delta) * 100) / 100)));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    dragOriginRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      panX: pan.x,
      panY: pan.y
    };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !dragOriginRef.current || !mapContainerRef.current) return;
    const rect = mapContainerRef.current.getBoundingClientRect();
    const scaleX = (600 / zoom) / rect.width;
    const scaleY = (400 / zoom) / rect.height;
    const deltaX = (e.clientX - dragOriginRef.current.mouseX) * scaleX;
    const deltaY = (e.clientY - dragOriginRef.current.mouseY) * scaleY;
    setPan({
      x: dragOriginRef.current.panX - deltaX,
      y: dragOriginRef.current.panY - deltaY
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    dragOriginRef.current = null;
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      dragOriginRef.current = {
        mouseX: e.touches[0].clientX,
        mouseY: e.touches[0].clientY,
        panX: pan.x,
        panY: pan.y
      };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || !dragOriginRef.current || !mapContainerRef.current || e.touches.length !== 1) return;
    const rect = mapContainerRef.current.getBoundingClientRect();
    const scaleX = (600 / zoom) / rect.width;
    const scaleY = (400 / zoom) / rect.height;
    const deltaX = (e.touches[0].clientX - dragOriginRef.current.mouseX) * scaleX;
    const deltaY = (e.touches[0].clientY - dragOriginRef.current.mouseY) * scaleY;
    setPan({
      x: dragOriginRef.current.panX - deltaX,
      y: dragOriginRef.current.panY - deltaY
    });
  };

  // Filtered List
  const filteredEvaluations = evaluations.filter(e => {
    if (activeFilter === 'level1') return e.hospital.trauma_level === 'Level 1';
    if (activeFilter === 'high_beds') return e.availableBeds >= 10;
    if (activeFilter === 'fast_eta') return e.etaMinutes <= 10;
    return true;
  });

  return (
    <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6 text-slate-800" id="nearest-hospitals-view">
      
      {/* HEADER SECTION */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span className="text-[11px] font-semibold text-sky-700 uppercase tracking-wider">
              Real-Time Capacity & Transit Telemetry
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 mt-1">
            Emergency Hospital & Bed Radar
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Interactive GIS radar connecting incident coordinates directly to nearest accredited trauma bays.
          </p>
        </div>

        {/* GPS Telemetry Pill */}
        <div className="flex items-center space-x-2 bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-200 text-xs text-slate-700">
          <MapPin className="w-3.5 h-3.5 text-sky-600 shrink-0" />
          <span className="font-medium truncate max-w-[220px]">{locationStatus}</span>
          <button
            type="button"
            onClick={() => {
              detectLocation();
              VibrationService.triggerQuickTap();
            }}
            disabled={isDetecting}
            className="p-1 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
            title="Refresh GPS location"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isDetecting ? 'animate-spin text-sky-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* CLAUDE-STYLE INTERACTIVE MAP & INSPECTOR CARD GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        
        {/* INTERACTIVE VECTOR CARTOGRAPHY MAP (7 COLS ON DESKTOP) */}
        <div 
          className={`lg:col-span-7 bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs flex flex-col ${
            isMapExpanded ? 'fixed inset-2 sm:inset-6 z-50 shadow-2xl' : ''
          }`}
          id="hospitals-interactive-radar-map"
        >
          {/* Map Top Bar */}
          <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-slate-700 text-xs">
            <div className="flex items-center space-x-2 font-semibold text-slate-900">
              <Compass className="w-3.5 h-3.5 text-sky-600" />
              <span>Interactive Casualty Radar</span>
              <span className="text-[10px] font-normal text-slate-400">({evaluations.length} Facilities)</span>
            </div>

            <div className="flex items-center space-x-1.5">
              <button
                type="button"
                onClick={handleResetMap}
                className="px-2 py-1 rounded-lg bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 text-[11px] font-medium flex items-center space-x-1 transition-colors cursor-pointer"
                title="Recenter Map"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Recenter</span>
              </button>
              <button
                type="button"
                onClick={() => setIsMapExpanded(!isMapExpanded)}
                className="p-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 transition-colors cursor-pointer"
                title={isMapExpanded ? 'Minimize Map' : 'Maximize Fullscreen'}
              >
                {isMapExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* Map Viewport Area */}
          <div 
            ref={mapContainerRef}
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleMouseUp}
            className={`relative w-full bg-[#f8fafc] overflow-hidden select-none cursor-grab active:cursor-grabbing touch-none ${
              isMapExpanded ? 'flex-1 min-h-[450px]' : 'h-[360px] sm:h-[420px]'
            }`}
          >
            {/* SVG Cartography Canvas */}
            <svg
              viewBox={computedViewBox}
              className="w-full h-full object-cover"
              preserveAspectRatio="xMidYMid slice"
            >
              <defs>
                {/* Subtle Map Grid */}
                <pattern id="lightGrid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#e2e8f0" strokeWidth="0.8" />
                  <path d="M 20 0 L 20 40 M 0 20 L 40 20" fill="none" stroke="#f1f5f9" strokeWidth="0.5" />
                </pattern>
              </defs>

              {/* Base Canvas */}
              <rect x="-2000" y="-2000" width="4600" height="4400" fill="#f8fafc" />
              <rect x="-2000" y="-2000" width="4600" height="4400" fill="url(#lightGrid)" />

              {/* Road Corridors & Arteries */}
              <path d="M -1000 120 Q 250 140 2000 110" fill="none" stroke="#cbd5e1" strokeWidth="6" />
              <path d="M -1000 280 L 2000 280" fill="none" stroke="#cbd5e1" strokeWidth="5" />
              <path d="M 150 -1000 L 150 2000" fill="none" stroke="#cbd5e1" strokeWidth="5" />
              <path d="M 450 -1000 L 450 2000" fill="none" stroke="#cbd5e1" strokeWidth="6" />

              {/* Concentric Distance Rings around User (300, 200) */}
              <circle cx="300" cy="200" r="80" fill="none" stroke="#94a3b8" strokeWidth="1" strokeDasharray="3,4" opacity="0.5" />
              <text x="305" y="125" fill="#64748b" fontSize="7.5" fontWeight="bold">3 KM RADIUS</text>

              <circle cx="300" cy="200" r="160" fill="none" stroke="#94a3b8" strokeWidth="1.2" strokeDasharray="4,6" opacity="0.4" />
              <text x="305" y="45" fill="#64748b" fontSize="7.5" fontWeight="bold">6 KM RADIUS</text>

              {/* User Location Beacon */}
              <g transform="translate(300, 200)">
                <circle r="22" fill="#0284c7" opacity="0.12" className="animate-ping" />
                <circle r="12" fill="#0284c7" opacity="0.25" />
                <circle r="5" fill="#0284c7" stroke="#ffffff" strokeWidth="2" />
                
                <g transform="translate(10, -5)">
                  <rect x="0" y="-8" width="95" height="18" rx="4" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1" />
                  <text x="6" y="4.5" fill="#0f172a" fontSize="8" fontWeight="bold">
                    📍 Incident Location
                  </text>
                </g>
              </g>

              {/* Connecting Corridor from User to Selected Hospital */}
              {highlightedEval && (() => {
                const pt = projectPoint(highlightedEval.hospital.lat, highlightedEval.hospital.lng);
                return (
                  <g>
                    <line 
                      x1="300" 
                      y1="200" 
                      x2={pt.x} 
                      y2={pt.y} 
                      stroke="#0284c7" 
                      strokeWidth="2.5" 
                      strokeDasharray="6,4" 
                      opacity="0.8" 
                    />
                    {/* Intermediate ambulance beacon */}
                    <circle 
                      cx={(300 + pt.x) / 2} 
                      cy={(200 + pt.y) / 2} 
                      r="4" 
                      fill="#0284c7" 
                      stroke="#ffffff" 
                      strokeWidth="1.5" 
                    />
                  </g>
                );
              })()}

              {/* HOSPITAL PINS (Interactive) */}
              {evaluations.map((hospEval) => {
                const pt = projectPoint(hospEval.hospital.lat, hospEval.hospital.long);
                const isSelected = selectedHospitalId === hospEval.hospital.id;
                const isBest = hospEval.isBestChoice;

                return (
                  <g 
                    key={hospEval.hospital.id} 
                    transform={`translate(${pt.x}, ${pt.y})`}
                    onClick={() => handleFocusHospital(hospEval)}
                    className="cursor-pointer"
                  >
                    {/* Outer Glow if selected */}
                    {isSelected && (
                      <circle r="22" fill="#0284c7" opacity="0.2" className="animate-pulse" />
                    )}

                    {/* Pin Circle */}
                    <circle 
                      r={isSelected ? 15 : 12} 
                      fill={isBest ? '#e11d48' : isSelected ? '#0284c7' : '#ffffff'} 
                      stroke={isBest ? '#be123c' : isSelected ? '#0369a1' : '#94a3b8'} 
                      strokeWidth={isSelected ? 2.5 : 1.5} 
                    />

                    {/* Red Cross Icon */}
                    <rect 
                      x="-1.5" 
                      y="-5" 
                      width="3" 
                      height="10" 
                      fill={isBest || isSelected ? '#ffffff' : '#e11d48'} 
                      rx="0.5" 
                    />
                    <rect 
                      x="-5" 
                      y="-1.5" 
                      width="10" 
                      height="3" 
                      fill={isBest || isSelected ? '#ffffff' : '#e11d48'} 
                      rx="0.5" 
                    />

                    {/* Bed Count Bubble Badge */}
                    <g transform="translate(8, -12)">
                      <circle r="7.5" fill="#0f172a" stroke="#ffffff" strokeWidth="1" />
                      <text x="0" y="2.5" textAnchor="middle" fill="#ffffff" fontSize="7" fontWeight="bold">
                        {hospEval.availableBeds}
                      </text>
                    </g>

                    {/* Interactive Name Callout Card */}
                    <g transform="translate(18, -12)">
                      <rect 
                        x="0" 
                        y="-10" 
                        width="135" 
                        height="30" 
                        rx="6" 
                        fill={isSelected ? '#0f172a' : '#ffffff'} 
                        stroke={isSelected ? '#0284c7' : '#cbd5e1'} 
                        strokeWidth={isSelected ? 1.5 : 1} 
                        filter="drop-shadow(0px 2px 4px rgba(0,0,0,0.06))"
                      />
                      <text 
                        x="7" 
                        y="2" 
                        fill={isSelected ? '#ffffff' : '#0f172a'} 
                        fontSize="8.5" 
                        fontWeight="bold"
                      >
                        {hospEval.hospital.name.split(' ')[0]} {hospEval.hospital.name.split(' ')[1] || ''}
                      </text>
                      <text 
                        x="7" 
                        y="13" 
                        fill={isSelected ? '#38bdf8' : '#0284c7'} 
                        fontSize="7.5" 
                        fontWeight="600"
                      >
                        ~{hospEval.etaMinutes}m ETA • {hospEval.availableBeds} Beds Vacant
                      </text>
                    </g>
                  </g>
                );
              })}
            </svg>

            {/* Floating Map Zoom Controls (Top Right) */}
            <div className="absolute top-3 right-3 flex flex-col space-y-1 bg-white/90 backdrop-blur-xs border border-slate-200 rounded-xl p-1 shadow-sm">
              <button
                type="button"
                onClick={handleZoomIn}
                className="w-7 h-7 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-700 transition-colors cursor-pointer"
                title="Zoom In (+)"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleZoomOut}
                className="w-7 h-7 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-700 transition-colors cursor-pointer"
                title="Zoom Out (-)"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Map Footnote & Help */}
            <div className="absolute bottom-2.5 left-3 bg-white/80 backdrop-blur-xs px-2.5 py-1 rounded-lg border border-slate-200 text-[10px] text-slate-500 pointer-events-none">
              Tap any pin to inspect hospital • Scroll to zoom • Drag to pan
            </div>
          </div>
        </div>

        {/* SELECTED FACILITY INSPECTOR (5 COLS ON DESKTOP) */}
        <div className="lg:col-span-5 space-y-4">
          {highlightedEval ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4 animate-in fade-in duration-150">
              
              {/* Header with Trauma Badge */}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-sky-700 bg-sky-50 px-2 py-0.5 rounded-md border border-sky-200">
                    {highlightedEval.hospital.trauma_level} Emergency Center
                  </span>
                  <h2 className="text-base sm:text-lg font-bold text-slate-900 mt-1.5 tracking-tight">
                    {highlightedEval.hospital.name}
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5 flex items-center space-x-1">
                    <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                    <span className="truncate">{highlightedEval.hospital.address}</span>
                  </p>
                </div>

                {highlightedEval.isBestChoice && (
                  <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold whitespace-nowrap shrink-0">
                    ★ Best Choice
                  </span>
                )}
              </div>

              {/* Key Capacity Metrics Grid */}
              <div className="grid grid-cols-3 gap-2.5 py-2">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-center">
                  <span className="text-[10px] text-slate-400 block font-medium">Ambulance ETA</span>
                  <span className="text-base font-bold text-rose-600 font-mono mt-0.5 block">
                    ~{highlightedEval.etaMinutes}m
                  </span>
                  <span className="text-[9px] text-slate-400">{highlightedEval.distanceKm} km transit</span>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-center">
                  <span className="text-[10px] text-slate-400 block font-medium">ER Beds Vacant</span>
                  <span className="text-base font-bold text-emerald-700 font-mono mt-0.5 block">
                    {highlightedEval.availableBeds}
                  </span>
                  <span className="text-[9px] text-emerald-600 font-medium">Confirmed live</span>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-center">
                  <span className="text-[10px] text-slate-400 block font-medium">Triage Score</span>
                  <span className="text-base font-bold text-slate-800 font-mono mt-0.5 block">
                    {highlightedEval.score}/100
                  </span>
                  <span className="text-[9px] text-slate-400">Algorithmic</span>
                </div>
              </div>

              {/* Recommendation Rationale */}
              <div className="p-3 bg-sky-50/60 rounded-xl border border-sky-100 text-xs text-sky-900 leading-relaxed">
                <strong className="font-semibold text-sky-800 block mb-0.5">Clinical Routing Assessment:</strong>
                {highlightedEval.recommendationReason}
              </div>

              {/* Action Buttons: 1-Click Fast Admit & Direct Phone */}
              <div className="space-y-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    VibrationService.triggerQuickTap();
                    onSelectHospitalForAdmit(highlightedEval);
                  }}
                  className="w-full py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-white text-xs font-bold flex items-center justify-center space-x-2 transition-all cursor-pointer shadow-xs"
                >
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  <span>Fast Admit to this Facility</span>
                  <ArrowRight className="w-3.5 h-3.5 ml-1 text-slate-400" />
                </button>

                <a
                  href={`tel:${highlightedEval.hospital.phone.replace(/[^0-9+]/g, '')}`}
                  className="w-full py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center justify-center space-x-2 transition-colors cursor-pointer border border-slate-200"
                >
                  <Phone className="w-3.5 h-3.5 text-slate-500" />
                  <span>Call Hospital ER Desk ({highlightedEval.hospital.phone})</span>
                </a>
              </div>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center text-xs text-slate-400">
              Select a facility pin from the radar map to view telemetry details.
            </div>
          )}
        </div>
      </div>

      {/* ALL EMERGENCY FACILITIES LIST & FILTER TABS */}
      <div className="space-y-3 pt-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="text-base font-bold text-slate-900">
            All Verified Emergency Centers ({evaluations.length})
          </h2>

          {/* Filter Pills */}
          <div className="flex items-center space-x-1.5 overflow-x-auto text-xs">
            {[
              { id: 'all', label: 'All Centers' },
              { id: 'level1', label: 'Level 1 Trauma' },
              { id: 'high_beds', label: 'High Vacancy (>10 Beds)' },
              { id: 'fast_eta', label: 'Under 10m ETA' },
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  VibrationService.triggerQuickTap();
                  setActiveFilter(tab.id as any);
                }}
                className={`px-3 py-1 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  activeFilter === tab.id
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Facility Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {filteredEvaluations.map(e => {
            const isSelected = selectedHospitalId === e.hospital.id;
            return (
              <div
                key={e.hospital.id}
                onClick={() => handleFocusHospital(e)}
                className={`bg-white rounded-2xl p-4 border transition-all cursor-pointer flex flex-col justify-between space-y-3 ${
                  isSelected 
                    ? 'border-sky-600 ring-1 ring-sky-600/30 shadow-xs' 
                    : 'border-slate-200 hover:border-slate-300 shadow-xs'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[10px] font-semibold text-sky-700 bg-sky-50 px-2 py-0.5 rounded-md border border-sky-200">
                      {e.hospital.trauma_level}
                    </span>
                    <span className="text-xs font-bold text-rose-600 font-mono">
                      ~{e.etaMinutes} mins
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-slate-900 mt-2 line-clamp-1">
                    {e.hospital.name}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5 truncate">
                    {e.hospital.address}
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-1.5 text-emerald-700 font-semibold">
                    <Bed className="w-3.5 h-3.5" />
                    <span>{e.availableBeds} ER Beds</span>
                  </div>

                  <span className="text-xs font-semibold text-sky-600 flex items-center space-x-0.5 hover:text-sky-800">
                    <span>Inspect</span>
                    <ChevronRight className="w-3 h-3" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
};
