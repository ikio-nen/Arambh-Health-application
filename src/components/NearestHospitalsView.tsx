import React, { useState, useEffect, useRef } from 'react';
import { 
  Hospital, MapPin, PhoneCall, Zap, Clock, ShieldCheck, 
  Activity, Star, RefreshCw, ArrowRight, Bed, Navigation, HeartHandshake,
  AlertCircle, ZoomIn, ZoomOut, RotateCcw, Maximize2, Minimize2, Move,
  Radio, Compass, Layers
} from 'lucide-react';
import { HospitalEvaluation, EmergencyCase } from '../types';
import { rankAllHospitals, HOSPITALS_DATABASE } from '../services/geo';
import { VibrationService } from '../services/vibrationService';

interface NearestHospitalsViewProps {
  onSelectHospitalForAdmit: (hospital: HospitalEvaluation) => void;
  onOpenReceptionist: (hospitalName: string) => void;
}

export const NearestHospitalsView: React.FC<NearestHospitalsViewProps> = ({
  onSelectHospitalForAdmit,
  onOpenReceptionist,
}) => {
  const [lat, setLat] = useState<number>(28.6139);
  const [long, setLong] = useState<number>(77.2090);
  const [isDetecting, setIsDetecting] = useState<boolean>(false);
  const [locationStatus, setLocationStatus] = useState<string>('Central Delhi Emergency Corridor (28.6139° N, 77.2090° E)');
  const [evaluations, setEvaluations] = useState<HospitalEvaluation[]>([]);
  const [selectedHospitalId, setSelectedHospitalId] = useState<string | null>(null);
  const [isMapExpanded, setIsMapExpanded] = useState<boolean>(false);

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
      setLocationStatus('Geolocation not supported. Showing standard central hospital registry.');
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
      (err) => {
        setLocationStatus('GPS signal weak. Defaulting to New Delhi central cluster (28.6139, 77.2090)');
        setIsDetecting(false);
        updateRankings(28.6139, 77.2090);
      },
      { enableHighAccuracy: true, timeout: 6000 }
    );
  };

  const bestChoice = evaluations.find(e => e.isBestChoice) || evaluations[0];
  const highlightedEval = evaluations.find(e => e.hospital.id === selectedHospitalId) || bestChoice;

  // Zoom & Pan Handlers
  const handleZoomIn = () => {
    setZoom(prev => Math.min(3.5, Math.round((prev + 0.25) * 100) / 100));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(0.6, Math.round((prev - 0.25) * 100) / 100));
  };

  const handleResetMap = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const handleWheel = (e: React.WheelEvent) => {
    const delta = e.deltaY < 0 ? 0.15 : -0.15;
    setZoom(prev => Math.min(3.5, Math.max(0.6, Math.round((prev + delta) * 100) / 100)));
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

  const handleTouchEnd = () => {
    setIsDragging(false);
    dragOriginRef.current = null;
  };

  // Hospital Map Projection
  const degToPxX = 3800; // px per degree longitude
  const degToPxY = 4200; // px per degree latitude

  const projectPoint = (hLat: number, hLng: number) => {
    const x = 300 + (hLng - long) * degToPxX;
    const y = 200 - (hLat - lat) * degToPxY;
    return { x, y };
  };

  const vbWidth = 600 / zoom;
  const vbHeight = 400 / zoom;
  const vbMinX = (300 + pan.x) - vbWidth / 2;
  const vbMinY = (200 + pan.y) - vbHeight / 2;
  const computedViewBox = `${vbMinX} ${vbMinY} ${vbWidth} ${vbHeight}`;

  const handleFocusHospital = (hosp: HospitalEvaluation) => {
    setSelectedHospitalId(hosp.hospital.id);
    const pt = projectPoint(hosp.hospital.lat, hosp.hospital.lng);
    setPan({ x: pt.x - 300, y: pt.y - 200 });
    setZoom(1.8);
    VibrationService.triggerQuickTap();
  };

  return (
    <div className="w-full max-w-5xl xl:max-w-6xl mx-auto p-4 sm:p-6 space-y-6 text-slate-800" id="nearest-hospitals-view">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-100">
        <div>
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span className="text-xs font-semibold text-sky-700 uppercase tracking-wide">
              Live Facility Vacancy & ETA
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-1">
            Nearest Emergency Facilities
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Ranked by instantaneous ambulance arrival time and live emergency room trauma bed vacancies.
          </p>
        </div>

        <div className="flex items-center space-x-2 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-700">
          <MapPin className="w-3.5 h-3.5 text-sky-600 shrink-0" />
          <span className="text-slate-600 truncate max-w-[200px] font-medium">{locationStatus}</span>
          <button
            onClick={() => {
              detectLocation();
              VibrationService.triggerQuickTap();
            }}
            disabled={isDetecting}
            className="p-1 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
            title="Refresh GPS"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isDetecting ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* INTERACTIVE EMERGENCY FACILITIES MAP & RADAR */}
      <div 
        className={`bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs transition-all duration-300 ${
          isMapExpanded ? 'fixed inset-2 sm:inset-4 lg:inset-8 z-50 flex flex-col bg-slate-900 border-slate-700' : ''
        }`}
        id="hospitals-interactive-radar-map"
      >
        <div className="px-4 py-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-white">
          <div className="flex items-center space-x-2.5">
            <Radio className="w-4 h-4 text-sky-400 animate-pulse" />
            <div>
              <div className="text-xs font-bold text-slate-100 flex items-center gap-2">
                <span>Trauma Center Geolocation Radar</span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-sky-950 text-sky-300 border border-sky-800">
                  {evaluations.length} Active Centers
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Pinch / Scroll to zoom • Drag to pan • Tap pin for vacancy telemetry
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handleResetMap}
              className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium flex items-center space-x-1 cursor-pointer transition-colors"
              title="Recenter Map"
            >
              <RotateCcw className="w-3 h-3" />
              <span className="hidden sm:inline">Recenter</span>
            </button>

            <button
              type="button"
              onClick={() => setIsMapExpanded(!isMapExpanded)}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer transition-colors"
              title={isMapExpanded ? 'Minimize Map' : 'Maximize Map'}
            >
              {isMapExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* MAP CANVAS VIEWPORT */}
        <div 
          ref={mapContainerRef}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className={`relative w-full bg-[#0a0f1d] overflow-hidden select-none cursor-grab active:cursor-grabbing touch-none ${
            isMapExpanded ? 'flex-1 min-h-[400px]' : 'h-[320px] sm:h-[380px]'
          }`}
        >
          <svg
            viewBox={computedViewBox}
            className="w-full h-full object-cover pointer-events-none"
            preserveAspectRatio="xMidYMid slice"
          >
            <defs>
              <pattern id="hospGrid" width="60" height="60" patternUnits="userSpaceOnUse">
                <path d="M 60 0 L 0 0 0 60" fill="none" stroke="#1e293b" strokeWidth="1" />
                <path d="M 30 0 L 30 60 M 0 30 L 60 30" fill="none" stroke="#131d31" strokeWidth="0.6" />
              </pattern>
            </defs>

            {/* Dark background base */}
            <rect x="-2000" y="-2000" width="4600" height="4400" fill="#090d16" />
            <rect x="-2000" y="-2000" width="4600" height="4400" fill="url(#hospGrid)" opacity="0.8" />

            {/* City Arteries */}
            <path d="M -1000 120 Q 250 140 2000 110" fill="none" stroke="#1e293b" strokeWidth="10" />
            <path d="M -1000 280 L 2000 280" fill="none" stroke="#1e293b" strokeWidth="8" />
            <path d="M 120 -1000 L 120 2000" fill="none" stroke="#1e293b" strokeWidth="8" />
            <path d="M 440 -1000 L 440 2000" fill="none" stroke="#1e293b" strokeWidth="8" />

            {/* Radar Distance Rings centered on User (300, 200) */}
            {/* 2 KM RING */}
            <circle cx="300" cy="200" r="90" fill="none" stroke="#0284c7" strokeWidth="1" strokeDasharray="4,6" opacity="0.4" />
            <text x="305" y="115" fill="#38bdf8" fontSize="8" opacity="0.6" fontWeight="bold">2 KM RADIUS</text>

            {/* 5 KM RING */}
            <circle cx="300" cy="200" r="190" fill="none" stroke="#0284c7" strokeWidth="1.2" strokeDasharray="6,8" opacity="0.3" />
            <text x="305" y="18" fill="#38bdf8" fontSize="8" opacity="0.6" fontWeight="bold">5 KM RADIUS</text>

            {/* USER LOCATION BEACON */}
            <g transform="translate(300, 200)">
              <circle r="28" fill="#0ea5e9" opacity="0.15" className="animate-ping" />
              <circle r="14" fill="#0284c7" opacity="0.35" />
              <circle r="6" fill="#38bdf8" stroke="#ffffff" strokeWidth="2" />
              
              <g transform="translate(12, -4)">
                <rect x="0" y="-10" width="115" height="20" rx="4" fill="#0f172a" stroke="#0284c7" strokeWidth="1" />
                <text x="6" y="4" fill="#ffffff" fontSize="9" fontWeight="bold">
                  📍 Your Location (GPS)
                </text>
              </g>
            </g>

            {/* HOSPITAL MARKERS */}
            {evaluations.map((hospEval) => {
              const pt = projectPoint(hospEval.hospital.lat, hospEval.hospital.long);
              const isSelected = selectedHospitalId === hospEval.hospital.id;
              const isBest = hospEval.isBestChoice;

              return (
                <g key={hospEval.hospital.id} transform={`translate(${pt.x}, ${pt.y})`}>
                  {/* Active ping if selected */}
                  {isSelected && (
                    <circle r="26" fill="#38bdf8" opacity="0.25" className="animate-ping" />
                  )}

                  {/* Marker Pin Base */}
                  <circle 
                    r={isSelected ? 16 : 13} 
                    fill={isBest ? '#0284c7' : isSelected ? '#0369a1' : '#1e293b'} 
                    stroke={isBest ? '#38bdf8' : '#64748b'} 
                    strokeWidth={isSelected ? 2.5 : 1.5} 
                  />

                  {/* Red Cross */}
                  <rect x="-1.5" y="-6" width="3" height="12" fill="#ffffff" rx="0.5" />
                  <rect x="-6" y="-1.5" width="12" height="3" fill="#ffffff" rx="0.5" />

                  {/* Connecting Line to User */}
                  <line 
                    x1="0" 
                    y1="0" 
                    x2={300 - pt.x} 
                    y2={200 - pt.y} 
                    stroke={isSelected ? '#38bdf8' : '#334155'} 
                    strokeWidth={isSelected ? 2 : 1} 
                    strokeDasharray="4,4" 
                    opacity={isSelected ? 0.8 : 0.35} 
                  />

                  {/* Label Card */}
                  <g transform="translate(16, -14)">
                    <rect 
                      x="0" 
                      y="-12" 
                      width="155" 
                      height="36" 
                      rx="6" 
                      fill={isSelected ? '#0c4a6e' : '#0f172a'} 
                      stroke={isBest ? '#38bdf8' : isSelected ? '#0284c7' : '#334155'} 
                      strokeWidth={isSelected ? 1.5 : 1} 
                    />
                    
                    {/* Hospital Name */}
                    <text x="8" y="2" fill="#ffffff" fontSize="9.5" fontWeight="bold">
                      {hospEval.hospital.name.split(' ')[0]} {hospEval.hospital.name.split(' ')[1] || ''}
                    </text>

                    {/* ETA and Beds */}
                    <text x="8" y="15" fill="#38bdf8" fontSize="8" fontWeight="600">
                      ~{hospEval.etaMinutes}m ETA • {hospEval.availableBeds} ER Beds
                    </text>
                  </g>
                </g>
              );
            })}
          </svg>

          {/* ZOOM & RECENTER CONTROLS (Top Right) */}
          <div className="absolute top-3 right-3 flex flex-col items-center space-y-1.5 bg-slate-900/90 backdrop-blur-md border border-slate-700/70 p-1.5 rounded-xl shadow-lg pointer-events-auto z-10">
            <button
              type="button"
              onClick={handleZoomIn}
              className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center transition-colors cursor-pointer"
              title="Zoom In (+)"
              id="btn-hosp-zoom-in"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={handleResetMap}
              className="px-1 py-0.5 rounded text-[10px] font-mono font-bold text-slate-300 hover:text-white transition-colors cursor-pointer"
              title="Reset Zoom"
            >
              {Math.round(zoom * 100)}%
            </button>

            <button
              type="button"
              onClick={handleZoomOut}
              className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center transition-colors cursor-pointer"
              title="Zoom Out (-)"
              id="btn-hosp-zoom-out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* QUICK FACILITY SELECT CHIPS (Bottom) */}
          <div className="absolute bottom-3 left-3 right-3 flex items-center space-x-2 overflow-x-auto pb-1 scrollbar-none pointer-events-auto z-10">
            {evaluations.map((hosp) => (
              <button
                key={hosp.hospital.id}
                type="button"
                onClick={() => handleFocusHospital(hosp)}
                className={`px-3 py-1.5 rounded-xl text-xs whitespace-nowrap flex items-center space-x-2 border transition-all cursor-pointer ${
                  selectedHospitalId === hosp.hospital.id
                    ? 'bg-sky-600 border-sky-400 text-white shadow-md'
                    : 'bg-slate-900/90 backdrop-blur-md border-slate-700 text-slate-200 hover:bg-slate-800'
                }`}
              >
                <Hospital className="w-3.5 h-3.5" />
                <span className="font-semibold">{hosp.hospital.name.split(' ')[0]}</span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-950/60 text-emerald-400 font-bold">
                  {hosp.availableBeds} beds
                </span>
                <span className="text-[10px] opacity-80">~{hosp.etaMinutes}m</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* BEST HOSPITAL FOR YOU */}
      {bestChoice && (
        <div className="bg-white border border-sky-200 rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-sky-100 text-sky-800 flex items-center space-x-1.5">
                <Star className="w-3.5 h-3.5 fill-sky-700 text-sky-700" />
                <span>Optimal Emergency Match</span>
              </span>
              <span className="text-xs font-medium text-slate-500">
                Match Score: {bestChoice.score}/100
              </span>
            </div>

            <div className="text-right">
              <span className="text-xs text-slate-500">Ambulance ETA</span>
              <div className="text-lg font-bold text-sky-800">
                ~{bestChoice.etaMinutes} mins
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 space-y-1.5">
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                {bestChoice.hospital.name}
              </h2>
              <p className="text-xs text-slate-500 flex items-center space-x-1.5">
                <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>{bestChoice.hospital.address}</span>
              </p>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 mt-2">
                <span className="text-xs font-semibold text-slate-700 block">
                  Why this facility is recommended:
                </span>
                <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                  {bestChoice.recommendationReason}
                </p>
              </div>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                <span className="text-slate-500 block text-[11px]">ER Trauma Beds</span>
                <span className="text-lg font-bold text-emerald-700 block mt-0.5">
                  {bestChoice.availableBeds} Vacant
                </span>
                <span className="text-[11px] text-slate-400">Zero wait-time</span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                <span className="text-slate-500 block text-[11px]">Distance</span>
                <span className="text-lg font-bold text-slate-800 block mt-0.5">
                  {bestChoice.distanceKm} km
                </span>
                <span className="text-[11px] text-slate-400">{bestChoice.hospital.trauma_level}</span>
              </div>
            </div>
          </div>

          {/* Action CTAs */}
          <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
            <button
              onClick={() => {
                VibrationService.triggerQuickTap();
                onSelectHospitalForAdmit(bestChoice);
              }}
              className="flex-1 py-3 px-4 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs flex items-center justify-center space-x-2 transition-all cursor-pointer shadow-xs active:scale-[0.99]"
            >
              <Zap className="w-4 h-4 fill-white" />
              <span>Fast Admit to This Hospital</span>
              <ArrowRight className="w-4 h-4 ml-auto" />
            </button>

            <button
              onClick={() => {
                VibrationService.triggerQuickTap();
                onOpenReceptionist(bestChoice.hospital.name);
              }}
              className="py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs flex items-center justify-center space-x-1.5 border border-slate-200 cursor-pointer transition-colors"
            >
              <PhoneCall className="w-3.5 h-3.5 text-sky-600" />
              <span>Connect Receptionist</span>
            </button>

            <a
              href={`tel:${bestChoice.hospital.ambulance_hotline}`}
              className="py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs flex items-center justify-center space-x-1.5 border border-slate-200 cursor-pointer transition-colors"
            >
              <span>Hotline ({bestChoice.hospital.phone})</span>
            </a>
          </div>
        </div>
      )}

      {/* ALL NEARBY HOSPITALS LIST */}
      <div className="space-y-3">
        <h2 className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
          Nearby Emergency Centers ({evaluations.length})
        </h2>

        <div className="space-y-2.5">
          {evaluations.map((item) => (
            <div
              key={item.hospital.id}
              className={`p-4 rounded-xl border transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-3 bg-white ${
                item.isBestChoice 
                  ? 'border-sky-300 ring-1 ring-sky-200 shadow-xs' 
                  : 'border-slate-200/90 hover:border-slate-300'
              }`}
            >
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <h3 className="font-semibold text-sm text-slate-900">{item.hospital.name}</h3>
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                    {item.hospital.trauma_level}
                  </span>
                  {item.isBestChoice && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-sky-100 text-sky-800">
                      Optimal Match
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500">{item.hospital.address}</p>
                <p className="text-xs text-slate-600">{item.recommendationReason}</p>
              </div>

              <div className="flex items-center space-x-4 shrink-0 text-xs">
                <div className="text-right">
                  <div className="text-slate-900 font-bold">~{item.etaMinutes} mins</div>
                  <div className="text-xs text-slate-400">{item.distanceKm} km</div>
                </div>

                <div className="text-right">
                  <div className="text-emerald-700 font-bold">{item.availableBeds} beds</div>
                  <div className="text-xs text-slate-400">Vacant</div>
                </div>

                <div className="flex space-x-1.5">
                  <button
                    onClick={() => {
                      VibrationService.triggerQuickTap();
                      onSelectHospitalForAdmit(item);
                    }}
                    className="p-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white transition-colors cursor-pointer shadow-xs"
                    title="Fast Admit to this hospital"
                  >
                    <Zap className="w-3.5 h-3.5 fill-white" />
                  </button>
                  <button
                    onClick={() => {
                      VibrationService.triggerQuickTap();
                      onOpenReceptionist(item.hospital.name);
                    }}
                    className="p-2.5 rounded-xl bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200 cursor-pointer transition-colors"
                    title="Call Receptionist"
                  >
                    <PhoneCall className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
