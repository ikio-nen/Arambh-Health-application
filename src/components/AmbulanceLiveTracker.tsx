import React, { useState, useEffect, useRef } from 'react';
import { 
  PhoneCall, MessageSquare, Navigation, ShieldCheck, 
  Clock, AlertTriangle, Volume2, VolumeX, Maximize2, Minimize2,
  RefreshCw, CheckCircle2, ChevronRight, Zap, Radio, MapPin,
  Heart, FastForward, Play, Pause, ZoomIn, ZoomOut, RotateCcw,
  Compass, Crosshair, Move
} from 'lucide-react';
import { EmergencyCase } from '../types';
import { calculateDistanceKm } from '../services/geo';
import { SmsDispatchModal } from './SmsDispatchModal';
import { SmsEmergencyService } from '../services/smsEmergencyService';
import { VibrationService } from '../services/vibrationService';

interface AmbulanceLiveTrackerProps {
  emergencyCase: EmergencyCase;
  onCallAmbulance?: () => void;
  onClose?: () => void;
}

interface Waypoint {
  lat: number;
  lng: number;
  streetName: string;
  speedKmh: number;
}

export const AmbulanceLiveTracker: React.FC<AmbulanceLiveTrackerProps> = ({
  emergencyCase,
  onCallAmbulance,
  onClose,
}) => {
  // Destination: Patient location
  const patientLat = emergencyCase.lat || 28.6139;
  const patientLng = emergencyCase.long || 77.2090;

  // Origin: Hospital location (offset slightly if hospital coordinates not specified)
  const hospitalLat = patientLat + 0.024;
  const hospitalLng = patientLng - 0.028;

  // Generate intermediate realistic street route waypoints
  const waypoints: Waypoint[] = [
    { 
      lat: hospitalLat, 
      lng: hospitalLng, 
      streetName: `${emergencyCase.assigned_hospital} Emergency Bay`, 
      speedKmh: 42 
    },
    { 
      lat: hospitalLat - 0.005, 
      lng: hospitalLng + 0.006, 
      streetName: 'Outer Ring Road (Green Wave Active)', 
      speedKmh: 68 
    },
    { 
      lat: hospitalLat - 0.012, 
      lng: hospitalLng + 0.014, 
      streetName: 'AIIMS Trauma Flyover Corridor', 
      speedKmh: 74 
    },
    { 
      lat: hospitalLat - 0.018, 
      lng: hospitalLng + 0.022, 
      streetName: 'Aurobindo Marg Interchange', 
      speedKmh: 58 
    },
    { 
      lat: patientLat + 0.003, 
      lng: patientLng - 0.003, 
      streetName: 'Approaching Patient Locality Access Road', 
      speedKmh: 35 
    },
    { 
      lat: patientLat, 
      lng: patientLng, 
      streetName: 'Patient Scene (Immediate Arrival)', 
      speedKmh: 0 
    },
  ];

  // Animation & simulation states
  const [progress, setProgress] = useState<number>(0.18); // 0 to 1
  const [isFastForward, setIsFastForward] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(
    Math.max(120, (emergencyCase.eta_minutes || 4) * 60)
  );
  const [isSirenAudible, setIsSirenAudible] = useState<boolean>(false);
  const [isMapExpanded, setIsMapExpanded] = useState<boolean>(false);
  const [mapFocus, setMapFocus] = useState<'all' | 'ambulance' | 'patient'>('all');
  const [isSmsModalOpen, setIsSmsModalOpen] = useState<boolean>(false);

  // Map Interactive Zoom & Pan states
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragOriginRef = useRef<{ mouseX: number; mouseY: number; panX: number; panY: number } | null>(null);
  const mapViewportRef = useRef<HTMLDivElement | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const sirenOscillatorRef = useRef<OscillatorNode | null>(null);

  // Total initial distance
  const totalDistKm = emergencyCase.distance_km || 2.4;
  const currentDistanceKm = Math.max(0.1, (totalDistKm * (1 - progress))).toFixed(1);

  // Calculate current interpolated position along the route
  const currentWaypointIndex = Math.min(
    waypoints.length - 2,
    Math.floor(progress * (waypoints.length - 1))
  );
  const segmentFraction = (progress * (waypoints.length - 1)) - currentWaypointIndex;

  const wpA = waypoints[currentWaypointIndex];
  const wpB = waypoints[currentWaypointIndex + 1] || waypoints[waypoints.length - 1];

  const currentLat = wpA.lat + (wpB.lat - wpA.lat) * segmentFraction;
  const currentLng = wpA.lng + (wpB.lng - wpA.lng) * segmentFraction;
  const currentStreet = wpA.streetName;
  const currentSpeed = Math.round(wpA.speedKmh + (wpB.speedKmh - wpA.speedKmh) * segmentFraction);

  // Bearing angle for vehicle rotation
  const bearingAngle = Math.atan2(wpB.lng - wpA.lng, wpB.lat - wpA.lat) * (180 / Math.PI);

  // Timer & progress update loop (simulating delivery app vehicle movement)
  useEffect(() => {
    if (isPaused) return;

    const intervalMs = isFastForward ? 300 : 1000;
    const progressIncrement = isFastForward ? 0.025 : 0.004;

    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 1) {
          clearInterval(timer);
          return 1;
        }
        return Math.min(1, prev + progressIncrement);
      });

      setSecondsRemaining((prev) => {
        if (prev <= 10) return 0;
        return isFastForward ? Math.max(0, prev - 15) : Math.max(0, prev - 1);
      });
    }, intervalMs);

    return () => clearInterval(timer);
  }, [isFastForward, isPaused]);

  // Audio simulation for emergency ambulance siren (synthesizer-based, no external assets needed)
  const toggleSirenAudio = () => {
    VibrationService.triggerQuickTap();
    if (isSirenAudible) {
      if (sirenOscillatorRef.current) {
        try {
          sirenOscillatorRef.current.stop();
          sirenOscillatorRef.current.disconnect();
        } catch (_) {}
      }
      setIsSirenAudible(false);
    } else {
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        audioContextRef.current = ctx;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(650, ctx.currentTime);

        // Modulate frequency like emergency siren (wail: 650Hz to 950Hz)
        const lfo = ctx.createOscillator();
        lfo.type = 'sine';
        lfo.frequency.setValueAtTime(0.8, ctx.currentTime); // 0.8 Hz siren period

        const lfoGain = ctx.createGain();
        lfoGain.gain.setValueAtTime(250, ctx.currentTime);

        lfo.connect(lfoGain);
        lfoGain.connect(osc.frequency);

        gain.gain.setValueAtTime(0.04, ctx.currentTime); // Gentle safe volume
        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start();
        lfo.start();
        sirenOscillatorRef.current = osc;
        setIsSirenAudible(true);
      } catch (err) {
        console.warn('Siren audio error:', err);
      }
    }
  };

  useEffect(() => {
    return () => {
      if (sirenOscillatorRef.current) {
        try {
          sirenOscillatorRef.current.stop();
          sirenOscillatorRef.current.disconnect();
        } catch (_) {}
      }
    };
  }, []);

  // Format seconds into "M mins S secs"
  const minutesLeft = Math.floor(secondsRemaining / 60);
  const secondsLeft = secondsRemaining % 60;
  const isArrived = progress >= 0.98 || secondsRemaining <= 5;

  // Map coordinates projection to SVG viewbox (0 to 600, 0 to 400)
  // Normalize lat/lng to SVG viewbox
  const minLat = Math.min(hospitalLat, patientLat) - 0.005;
  const maxLat = Math.max(hospitalLat, patientLat) + 0.005;
  const minLng = Math.min(hospitalLng, patientLng) - 0.005;
  const maxLng = Math.max(hospitalLng, patientLng) + 0.005;

  const projectPoint = (lat: number, lng: number) => {
    const x = ((lng - minLng) / (maxLng - minLng)) * 520 + 40;
    const y = 360 - ((lat - minLat) / (maxLat - minLat)) * 300;
    return { x, y };
  };

  const hospPt = projectPoint(hospitalLat, hospitalLng);
  const patientPt = projectPoint(patientLat, patientLng);
  const ambulancePt = projectPoint(currentLat, currentLng);

  // Build SVG path data for the route
  const projectedWaypoints = waypoints.map(wp => projectPoint(wp.lat, wp.lng));
  const routePathD = projectedWaypoints.reduce((acc, pt, i) => {
    return i === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`;
  }, '');

  // Zoom & Pan handlers
  const handleZoomIn = () => {
    setZoom(prev => Math.min(3.5, Math.round((prev + 0.25) * 100) / 100));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(0.6, Math.round((prev - 0.25) * 100) / 100));
  };

  const handleResetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setMapFocus('all');
  };

  const handleFocusTarget = (target: 'all' | 'ambulance' | 'patient') => {
    setMapFocus(target);
    if (target === 'ambulance') {
      setZoom(1.9);
      setPan({ x: ambulancePt.x - 300, y: ambulancePt.y - 200 });
    } else if (target === 'patient') {
      setZoom(2.1);
      setPan({ x: patientPt.x - 300, y: patientPt.y - 200 });
    } else {
      setZoom(1.0);
      setPan({ x: 0, y: 0 });
    }
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
    if (!isDragging || !dragOriginRef.current || !mapViewportRef.current) return;
    const rect = mapViewportRef.current.getBoundingClientRect();
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
    if (!isDragging || !dragOriginRef.current || !mapViewportRef.current || e.touches.length !== 1) return;
    const rect = mapViewportRef.current.getBoundingClientRect();
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

  // ViewBox dynamic calculation
  const vbWidth = 600 / zoom;
  const vbHeight = 400 / zoom;
  const vbMinX = (300 + pan.x) - vbWidth / 2;
  const vbMinY = (200 + pan.y) - vbHeight / 2;
  const computedViewBox = `${vbMinX} ${vbMinY} ${vbWidth} ${vbHeight}`;

  return (
    <div className={`w-full bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden transition-all duration-300 ${
      isMapExpanded ? 'fixed inset-2 sm:inset-4 lg:inset-8 z-50 max-w-6xl mx-auto my-auto h-[92vh] flex flex-col' : 'max-w-5xl xl:max-w-6xl mx-auto'
    }`} id="ambulance-live-tracker">

      {/* TOP HEADER: DELIVERY APP STYLE STATUS */}
      <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center space-x-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-600"></span>
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-rose-700">
              {isArrived ? 'Paramedics On-Scene' : 'Ambulance DL 01 EM 1082 En Route'}
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-xs font-medium text-slate-500">
              Case #{emergencyCase.id}
            </span>
          </div>

          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 mt-1">
            {isArrived ? 'Ambulance Has Arrived At Scene' : 'Live Ambulance Route Tracking'}
          </h2>
        </div>

        {/* Live Controls */}
        <div className="flex items-center space-x-2">
          {/* Siren Audio Toggle */}
          <button
            type="button"
            onClick={toggleSirenAudio}
            className={`px-3 py-1.5 rounded-xl border text-xs font-medium flex items-center space-x-1.5 transition-colors cursor-pointer ${
              isSirenAudible 
                ? 'bg-rose-600 text-white border-rose-600 animate-pulse' 
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
            title="Toggle realistic audio siren"
          >
            {isSirenAudible ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
            <span>{isSirenAudible ? 'Mute Siren' : 'Siren Audio'}</span>
          </button>

          {/* Fast Forward Demo Simulation Toggle */}
          <button
            type="button"
            onClick={() => {
              setIsFastForward(!isFastForward);
              VibrationService.triggerQuickTap();
            }}
            className={`px-3 py-1.5 rounded-xl border text-xs font-medium flex items-center space-x-1.5 transition-colors cursor-pointer ${
              isFastForward
                ? 'bg-sky-600 text-white border-sky-600'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
            title="Speed up movement for demo evaluation"
          >
            <FastForward className="w-3.5 h-3.5" />
            <span>{isFastForward ? 'Speed: 4x' : '1x Speed'}</span>
          </button>

          {/* Expand/Collapse Map */}
          <button
            type="button"
            onClick={() => setIsMapExpanded(!isMapExpanded)}
            className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
            title={isMapExpanded ? 'Minimize Map' : 'Maximize Map'}
          >
            {isMapExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {onClose && (
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-medium cursor-pointer"
            >
              Close
            </button>
          )}
        </div>
      </div>

      {/* DELIVERY APP STEPPER TIMELINE (Just like Uber Eats / Swiggy) */}
      <div className="p-4 sm:px-6 border-b border-slate-100 bg-white">
        <div className="grid grid-cols-4 gap-2 text-center text-xs">
          <div className="flex flex-col items-center">
            <div className="w-7 h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold text-xs shadow-xs mb-1">
              ✓
            </div>
            <span className="font-semibold text-slate-900 text-[11px] sm:text-xs">1. ER Allocated</span>
            <span className="text-[10px] text-slate-400">Bed reserved</span>
          </div>

          <div className="flex flex-col items-center">
            <div className="w-7 h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold text-xs shadow-xs mb-1">
              ✓
            </div>
            <span className="font-semibold text-slate-900 text-[11px] sm:text-xs">2. Dispatched</span>
            <span className="text-[10px] text-slate-400">ICU vehicle assigned</span>
          </div>

          <div className="flex flex-col items-center">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shadow-xs mb-1 ${
              isArrived ? 'bg-emerald-500 text-white' : 'bg-rose-600 text-white animate-pulse'
            }`}>
              {isArrived ? '✓' : '3'}
            </div>
            <span className={`font-semibold text-[11px] sm:text-xs ${isArrived ? 'text-slate-900' : 'text-rose-700'}`}>
              3. En Route
            </span>
            <span className="text-[10px] text-slate-400">Sirens active</span>
          </div>

          <div className="flex flex-col items-center">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shadow-xs mb-1 ${
              isArrived ? 'bg-emerald-600 text-white ring-4 ring-emerald-100' : 'bg-slate-100 text-slate-400 border border-slate-200'
            }`}>
              4
            </div>
            <span className={`font-semibold text-[11px] sm:text-xs ${isArrived ? 'text-emerald-700 font-bold' : 'text-slate-500'}`}>
              4. Arrived
            </span>
            <span className="text-[10px] text-slate-400">Stretcher ready</span>
          </div>
        </div>

        {/* Dynamic Progress Bar */}
        <div className="mt-3.5 w-full bg-slate-100 h-2 rounded-full overflow-hidden">
          <div 
            className="h-full bg-rose-600 transition-all duration-300 ease-out rounded-full"
            style={{ width: `${Math.min(100, progress * 100)}%` }}
          />
        </div>
      </div>

      {/* DELIVERY APP METRICS BANNER (Bold ETA, Distance, Speed, Street) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 sm:p-5 bg-slate-50 border-b border-slate-200/80">
        <div className="p-3 bg-white rounded-xl border border-slate-200/80 shadow-xs">
          <span className="text-[11px] font-semibold uppercase text-slate-500 block">
            Estimated Arrival
          </span>
          <div className="text-xl sm:text-2xl font-black text-rose-600 tracking-tight mt-0.5">
            {isArrived ? (
              <span className="text-emerald-600">Arrived Now</span>
            ) : (
              <span>{minutesLeft}m {secondsLeft}s</span>
            )}
          </div>
          <span className="text-[11px] text-slate-500">Live GPS Countdown</span>
        </div>

        <div className="p-3 bg-white rounded-xl border border-slate-200/80 shadow-xs">
          <span className="text-[11px] font-semibold uppercase text-slate-500 block">
            Distance Left
          </span>
          <div className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mt-0.5">
            {isArrived ? '0.0 km' : `${currentDistanceKm} km`}
          </div>
          <span className="text-[11px] text-slate-500">Optimal Corridor</span>
        </div>

        <div className="p-3 bg-white rounded-xl border border-slate-200/80 shadow-xs">
          <span className="text-[11px] font-semibold uppercase text-slate-500 block">
            Ambulance Speed
          </span>
          <div className="text-xl sm:text-2xl font-black text-sky-700 tracking-tight mt-0.5">
            {isArrived ? '0 km/h' : `${currentSpeed} km/h`}
          </div>
          <span className="text-[11px] text-emerald-600 font-medium flex items-center space-x-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            <span>Green Wave Active</span>
          </span>
        </div>

        <div className="p-3 bg-white rounded-xl border border-slate-200/80 shadow-xs">
          <span className="text-[11px] font-semibold uppercase text-slate-500 block">
            Current Street
          </span>
          <div className="text-xs font-bold text-slate-800 line-clamp-2 mt-1">
            {currentStreet}
          </div>
          <span className="text-[10px] text-slate-400 block mt-0.5">Traffic Priority 108</span>
        </div>
      </div>

      {/* INTERACTIVE DELIVERY MAP VIEWPORT */}
      <div 
        ref={mapViewportRef}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className={`relative w-full bg-slate-900 overflow-hidden select-none cursor-grab active:cursor-grabbing touch-none ${
          isMapExpanded ? 'flex-1 min-h-[400px]' : 'h-[360px] sm:h-[430px]'
        }`}
      >
        
        {/* SVG Road Map Layout */}
        <svg 
          viewBox={computedViewBox} 
          className="w-full h-full object-cover pointer-events-none"
          preserveAspectRatio="xMidYMid slice"
        >
          <defs>
            {/* Background Map Grid Pattern */}
            <pattern id="roadGrid" width="60" height="60" patternUnits="userSpaceOnUse">
              <path d="M 60 0 L 0 0 0 60" fill="none" stroke="#1e293b" strokeWidth="1.5" />
              <path d="M 30 0 L 30 60 M 0 30 L 60 30" fill="none" stroke="#0f172a" strokeWidth="0.8" />
            </pattern>

            {/* Glowing route filter */}
            <filter id="corridorGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Dark Map Canvas Base */}
          <rect x="-1000" y="-1000" width="2600" height="2400" fill="#090d16" />
          <rect x="-1000" y="-1000" width="2600" height="2400" fill="url(#roadGrid)" opacity="0.75" />

          {/* Simulated City Geography: Park Area */}
          <path 
            d="M 20 20 Q 90 40 140 110 T 60 180 Z" 
            fill="#064e3b" 
            opacity="0.35" 
          />
          <text x="65" y="110" fill="#047857" fontSize="10" fontWeight="bold" opacity="0.6">
            NEHRU BIODIVERSITY PARK
          </text>

          {/* Simulated City Geography: River / Canal */}
          <path 
            d="M 520 -400 Q 480 180 560 800" 
            fill="none" 
            stroke="#0369a1" 
            strokeWidth="14" 
            opacity="0.4" 
          />

          {/* Major City Arterial Roads */}
          <path d="M -400 120 Q 250 140 1000 110" fill="none" stroke="#334155" strokeWidth="9" />
          <path d="M -400 120 Q 250 140 1000 110" fill="none" stroke="#64748b" strokeWidth="1" strokeDasharray="6,6" />

          <path d="M 120 -400 L 120 800" fill="none" stroke="#334155" strokeWidth="7" />
          <path d="M 440 -400 L 440 800" fill="none" stroke="#334155" strokeWidth="7" />
          <path d="M -400 280 L 1000 280" fill="none" stroke="#334155" strokeWidth="8" />

          {/* Street Name Labels on Map */}
          <text x="140" y="115" fill="#94a3b8" fontSize="9" fontWeight="600" letterSpacing="0.5">
            RING ROAD EMERGENCY CORRIDOR
          </text>
          <text x="360" y="275" fill="#94a3b8" fontSize="9" fontWeight="600" letterSpacing="0.5">
            AUROBINDO MARG EXPRESS
          </text>

          {/* THE EMERGENCY ROUTE PATH */}
          {/* 1. Base glowing emergency route corridor */}
          <path 
            d={routePathD} 
            fill="none" 
            stroke="#0284c7" 
            strokeWidth="8" 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            filter="url(#corridorGlow)" 
            opacity="0.4" 
          />

          {/* 2. Covered Path (Solid Sky) */}
          <path 
            d={routePathD} 
            fill="none" 
            stroke="#38bdf8" 
            strokeWidth="5" 
            strokeLinecap="round" 
            strokeLinejoin="round" 
          />

          {/* 3. Pulsing dynamic dashes showing route flow */}
          <path 
            d={routePathD} 
            fill="none" 
            stroke="#ffffff" 
            strokeWidth="2.5" 
            strokeDasharray="8,10" 
            strokeLinecap="round" 
            className="animate-[dash_1s_linear_infinite]" 
          />

          {/* ORIGIN: HOSPITAL PIN */}
          <g transform={`translate(${hospPt.x}, ${hospPt.y})`}>
            {/* Base halo */}
            <circle r="16" fill="#0284c7" opacity="0.25" />
            <circle r="12" fill="#0284c7" />
            {/* Hospital Red Cross */}
            <rect x="-2" y="-7" width="4" height="14" fill="#ffffff" rx="1" />
            <rect x="-7" y="-2" width="14" height="4" fill="#ffffff" rx="1" />
            
            {/* Hospital Label Tag */}
            <g transform="translate(18, -4)">
              <rect x="0" y="-12" width="140" height="24" rx="6" fill="#0f172a" stroke="#334155" />
              <text x="8" y="4" fill="#f8fafc" fontSize="10" fontWeight="bold">
                {emergencyCase.assigned_hospital.split(' ')[0]} Hospital
              </text>
            </g>
          </g>

          {/* DESTINATION: PATIENT EMERGENCY SCENE PIN */}
          <g transform={`translate(${patientPt.x}, ${patientPt.y})`}>
            {/* Pulsing beacon waves */}
            <circle r="24" fill="#f43f5e" opacity="0.15" className="animate-ping" />
            <circle r="16" fill="#f43f5e" opacity="0.3" />
            <circle r="11" fill="#e11d48" stroke="#ffffff" strokeWidth="2.5" />
            <circle r="4" fill="#ffffff" />

            {/* Victim / Scene Label Tag */}
            <g transform="translate(16, -4)">
              <rect x="0" y="-12" width="128" height="24" rx="6" fill="#e11d48" stroke="#ffffff" strokeWidth="1" />
              <text x="8" y="4" fill="#ffffff" fontSize="10" fontWeight="bold">
                📍 You (Emergency Scene)
              </text>
            </g>
          </g>

          {/* MOVING VEHICLE: AMBULANCE MARKER */}
          <g 
            transform={`translate(${ambulancePt.x}, ${ambulancePt.y}) rotate(${bearingAngle})`}
            className="transition-transform duration-300 ease-out"
          >
            {/* Emergency Vehicle Radar Ping */}
            <circle r="26" fill="#e11d48" opacity="0.2" className="animate-ping" />

            {/* Vehicle Shadow */}
            <rect x="-11" y="-20" width="22" height="40" rx="6" fill="#000000" opacity="0.6" />

            {/* Vehicle Body (White EMS Van) */}
            <rect x="-10" y="-19" width="20" height="38" rx="5" fill="#f8fafc" stroke="#334155" strokeWidth="1" />

            {/* Front Windshield */}
            <rect x="-8" y="-16" width="16" height="8" rx="2" fill="#1e293b" />

            {/* Side Windows */}
            <rect x="-9" y="-6" width="3" height="12" rx="1" fill="#334155" />
            <rect x="6" y="-6" width="3" height="12" rx="1" fill="#334155" />

            {/* Medical Red Cross on Ambulance Roof */}
            <rect x="-1.5" y="-3" width="3" height="10" fill="#e11d48" rx="0.5" />
            <rect x="-5" y="0.5" width="10" height="3" fill="#e11d48" rx="0.5" />

            {/* Flashing Emergency Siren Strobe Lights (Roof Bar) */}
            <circle x="-4" cy="-8" r="2.5" fill="#38bdf8" className="animate-pulse" />
            <circle x="4" cy="-8" r="2.5" fill="#ef4444" className="animate-ping" />

            {/* Headlight Beams */}
            <path d="M -6 -19 L -14 -38 L -2 -38 Z" fill="#fef08a" opacity="0.3" />
            <path d="M 6 -19 L 2 -38 L 14 -38 Z" fill="#fef08a" opacity="0.3" />
          </g>
        </svg>

        {/* Floating Map Status Overlay (Top Left) */}
        <div className="absolute top-3 left-3 bg-slate-900/90 backdrop-blur-md border border-slate-700/70 rounded-xl px-3 py-1.5 text-white flex items-center space-x-2 shadow-lg pointer-events-auto">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="text-[11px] font-mono tracking-wide text-slate-200">
            GPS FIX: ±2.4m • 4G LTE TELEMETRY
          </span>
        </div>

        {/* INTERACTIVE ZOOM & MAP CONTROLS (Top Right) */}
        <div className="absolute top-3 right-3 flex flex-col items-center space-y-1.5 bg-slate-900/90 backdrop-blur-md border border-slate-700/70 p-1.5 rounded-xl shadow-lg pointer-events-auto z-10">
          <button
            type="button"
            onClick={handleZoomIn}
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-white flex items-center justify-center transition-colors cursor-pointer"
            title="Zoom In (+)"
            id="btn-map-zoom-in"
          >
            <ZoomIn className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={handleResetView}
            className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            title="Click to Reset Zoom (100%)"
          >
            {Math.round(zoom * 100)}%
          </button>

          <button
            type="button"
            onClick={handleZoomOut}
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-white flex items-center justify-center transition-colors cursor-pointer"
            title="Zoom Out (-)"
            id="btn-map-zoom-out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>

          <div className="w-5 h-px bg-slate-700 my-0.5"></div>

          <button
            type="button"
            onClick={handleResetView}
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            title="Recenter Map View"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => setIsMapExpanded(!isMapExpanded)}
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            title={isMapExpanded ? "Minimize Map" : "Maximize Full View"}
          >
            {isMapExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Map Center Quick Focus Buttons (Bottom Right) */}
        <div className="absolute bottom-3 right-3 flex items-center space-x-1.5 bg-slate-900/90 backdrop-blur-md border border-slate-700/70 p-1.5 rounded-xl shadow-lg pointer-events-auto z-10">
          <button
            type="button"
            onClick={() => handleFocusTarget('ambulance')}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
              mapFocus === 'ambulance' ? 'bg-sky-600 text-white font-semibold' : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
            }`}
          >
            🚑 Ambulance
          </button>
          <button
            type="button"
            onClick={() => handleFocusTarget('patient')}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
              mapFocus === 'patient' ? 'bg-rose-600 text-white font-semibold' : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
            }`}
          >
            📍 Scene
          </button>
          <button
            type="button"
            onClick={() => handleFocusTarget('all')}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
              mapFocus === 'all' ? 'bg-sky-600 text-white font-semibold' : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
            }`}
          >
            Full Corridor
          </button>
        </div>

        {/* Subtle pan/zoom guidance prompt (Bottom Left) */}
        <div className="absolute bottom-3 left-3 hidden sm:flex items-center space-x-1.5 text-[10px] text-slate-400 bg-slate-950/60 backdrop-blur-xs px-2.5 py-1 rounded-lg border border-slate-800/60 pointer-events-none">
          <Move className="w-3 h-3 text-slate-400" />
          <span>Click & drag to pan • Scroll / pinch to zoom</span>
        </div>

      </div>

      {/* PARAMEDIC & DRIVER PROFILE CARD (Delivery Partner Card) */}
      <div className="p-4 sm:p-5 bg-white border-t border-slate-200/80 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        
        {/* Paramedic Profile Details */}
        <div className="flex items-center space-x-3.5">
          <div className="relative">
            <div className="w-12 h-12 rounded-2xl bg-sky-50 border border-sky-200 text-sky-700 flex items-center justify-center font-bold text-base shadow-xs">
              VS
            </div>
            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px] font-bold border-2 border-white">
              ✓
            </div>
          </div>

          <div>
            <div className="flex items-center space-x-2">
              <h4 className="text-sm sm:text-base font-bold text-slate-900">
                Paramedic Vikram Singh
              </h4>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-sky-100 text-sky-800">
                ALS Lead
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Driver: Rajesh Kumar • Force Traveller Type-D ICU (DL 01 EM 1082)
            </p>
            <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px] text-slate-500">
              <span>⭐ 4.9 (1,240 dispatches)</span>
              <span>•</span>
              <span className="text-emerald-700 font-medium">Ventilator & AED Onboard</span>
            </div>
          </div>
        </div>

        {/* Quick Communication Actions */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* 1-Click Direct Phone Call */}
          <a
            href={`tel:${emergencyCase.ambulance_phone || '108'}`}
            onClick={() => {
              VibrationService.triggerQuickTap();
              if (onCallAmbulance) onCallAmbulance();
            }}
            className="flex-1 sm:flex-initial py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs flex items-center justify-center space-x-2 transition-all cursor-pointer shadow-xs"
          >
            <PhoneCall className="w-4 h-4" />
            <span>Call Ambulance ({emergencyCase.ambulance_phone || '108'})</span>
          </a>

          {/* 1-Click Send SMS */}
          <button
            type="button"
            onClick={() => {
              VibrationService.triggerQuickTap();
              setIsSmsModalOpen(true);
            }}
            className="flex-1 sm:flex-initial py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs flex items-center justify-center space-x-2 border border-slate-200 transition-colors cursor-pointer"
          >
            <MessageSquare className="w-4 h-4 text-sky-600" />
            <span>Send SMS Update</span>
          </button>
        </div>

      </div>

      {/* EMERGENCY PROTOCOL FOOTER TIP */}
      <div className="p-3 bg-amber-50/70 border-t border-amber-200 text-xs text-amber-900 flex items-center justify-between gap-2 px-4 sm:px-6">
        <div className="flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          <span>
            <strong>While waiting:</strong> Keep the patient still and calm. Clear building entrance and unlock gates for the stretcher team.
          </span>
        </div>
        <span className="text-[10px] text-amber-800 font-mono shrink-0 hidden sm:inline">
          PROTOCOL {emergencyCase.triage_tag.toUpperCase()}
        </span>
      </div>

      {/* Dedicated SMS Modal */}
      <SmsDispatchModal
        isOpen={isSmsModalOpen}
        onClose={() => setIsSmsModalOpen(false)}
        initialMessage={SmsEmergencyService.encodeEmergencyCase({
          lat: patientLat,
          long: patientLng,
          triageTag: emergencyCase.triage_tag,
          condition: emergencyCase.condition_text,
          bedToken: `BED-RES-${emergencyCase.id.slice(-4)}`,
          targetHospital: emergencyCase.assigned_hospital,
        })}
        initialPhone="108"
        caseId={emergencyCase.id}
        targetHospital={emergencyCase.assigned_hospital}
      />

    </div>
  );
};
